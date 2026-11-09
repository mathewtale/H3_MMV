
using Backend.Services;
using Microsoft.Extensions.Hosting;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using System.Text;
using System.Text.Json;

namespace MSpace.Backend.Services;

public sealed class MqttInputService : BackgroundService
{
    private const string InputTopic = "mspace/+/input";
    private const string StatusTopic = "mspace/+/status";
    private static readonly TimeSpan ReconnectDelay = TimeSpan.FromSeconds(3);

    private readonly GameStateService _gameState;
    private readonly DeviceRegistry _deviceRegistry;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MqttInputService> _logger;

    private IMqttClient? _client;
    private string? _offlineDeviceId;

    public MqttInputService(
        GameStateService gameState,
        DeviceRegistry deviceRegistry,
        IConfiguration configuration,
        ILogger<MqttInputService> logger)
    {
        _gameState = gameState;
        _deviceRegistry = deviceRegistry;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        var factory = new MqttFactory();

        _client = factory.CreateMqttClient();

        _client.ApplicationMessageReceivedAsync += async e =>
        {
            var topicParts = e.ApplicationMessage.Topic.Split('/');

            if (topicParts.Length != 3 ||
                topicParts[0] != "mspace")
            {
                return;
            }

            var deviceId = topicParts[1];

            var payload = Encoding.UTF8.GetString(
                e.ApplicationMessage.PayloadSegment);

            try
            {
                if (topicParts[2] == "status")
                    await HandleStatusAsync(deviceId, payload);
                else if (topicParts[2] == "input")
                    await HandleInputAsync(deviceId, payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to process MQTT message on {Topic}",
                    e.ApplicationMessage.Topic);
            }
        };

        _client.DisconnectedAsync += async e =>
        {
            if (!e.ClientWasConnected || stoppingToken.IsCancellationRequested)
                return;

            _logger.LogWarning(
                e.Exception,
                "Lost connection to the MQTT broker: {Reason}",
                e.Reason);

            await _gameState.SendConnectionLostAsync();
        };

        var host = _configuration["Mqtt:Host"] ?? "localhost";
        var port = int.Parse(_configuration["Mqtt:Port"] ?? "1883");

        var options = new MqttClientOptionsBuilder()
            .WithClientId($"mspace-input-{Guid.NewGuid():N}")
            .WithTcpServer(host, port)
            .WithCleanSession()
            .Build();

        try
        {
            // Reconnects if the broker goes away
            while (!stoppingToken.IsCancellationRequested)
            {
                if (!_client.IsConnected)
                    await ConnectAsync(options, host, port, stoppingToken);

                await Task.Delay(ReconnectDelay, stoppingToken);
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        finally
        {
            if (_client.IsConnected)
            {
                await _client.DisconnectAsync(
                    new MqttClientDisconnectOptionsBuilder().Build());
            }

            _client.Dispose();
        }
    }

    private async Task ConnectAsync(
        MqttClientOptions options,
        string host,
        int port,
        CancellationToken stoppingToken)
    {
        try
        {
            await _client!.ConnectAsync(options, stoppingToken);

            _logger.LogInformation(
                "Connected to MQTT broker at {Host}:{Port}",
                host, port);

            var subscribeOptions = new MqttFactory().CreateSubscribeOptionsBuilder()
                .WithTopicFilter(InputTopic, MqttQualityOfServiceLevel.AtMostOnce)
                .WithTopicFilter(StatusTopic, MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            await _client.SubscribeAsync(subscribeOptions, stoppingToken);

            _logger.LogInformation(
                "Subscribed to {InputTopic} and {StatusTopic}",
                InputTopic, StatusTopic);
        }
        catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
        {
            _logger.LogWarning(
                ex,
                "Could not connect to MQTT broker at {Host}:{Port}, retrying",
                host, port);
        }
    }

    private async Task HandleInputAsync(string deviceId, string payload)
    {
        _deviceRegistry.Register(deviceId);

        _logger.LogInformation(
            "MQTT input received from device {DeviceId}: {Payload}",
            deviceId,
            payload);

        await _gameState.HandleInputAsync(payload);
    }

    // The board publishes {"online":true} and the broker publishes {"online":false} (Last Will)
    private async Task HandleStatusAsync(string deviceId, string payload)
    {
        using var document = JsonDocument.Parse(payload);

        if (!document.RootElement.TryGetProperty("online", out var online))
            return;

        if (online.ValueKind == JsonValueKind.True)
        {
            _offlineDeviceId = null;
            _deviceRegistry.Register(deviceId);

            _logger.LogInformation("Device {DeviceId} is online", deviceId);

            return;
        }

        // Old boards also have a retained offline status, so only the active board counts
        if (deviceId != _deviceRegistry.LastSeenDeviceId)
            return;

        // The retained status is delivered again when the backend reconnects to the broker
        if (deviceId == _offlineDeviceId)
            return;

        _offlineDeviceId = deviceId;

        _logger.LogWarning("Device {DeviceId} went offline", deviceId);

        await _gameState.SendConnectionLostAsync();
    }
}