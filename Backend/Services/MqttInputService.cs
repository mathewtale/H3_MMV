
using Backend.Services;
using Microsoft.Extensions.Hosting;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using System.Text;

namespace MSpace.Backend.Services;

public sealed class MqttInputService : BackgroundService
{
    private const string Topic = "mspace/+/input";

    private readonly GameStateService _gameState;
    private readonly DeviceRegistry _deviceRegistry;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MqttInputService> _logger;

    private IMqttClient? _client;

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
                topicParts[0] != "mspace" ||
                topicParts[2] != "input")
            {
                return;
            }

            var deviceId = topicParts[1];

            _deviceRegistry.Register(deviceId);

            var payload = Encoding.UTF8.GetString(
                e.ApplicationMessage.PayloadSegment);

            _logger.LogInformation(
                "MQTT input received from device {DeviceId}: {Payload}",
                deviceId,
                payload);

            try
            {
                await _gameState.HandleInputAsync(payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to process MQTT input");
            }
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
            await _client.ConnectAsync(options, stoppingToken);

            _logger.LogInformation(
                "Connected to MQTT broker at {Host}:{Port}",
                host, port);

            var topic = new MqttTopicFilterBuilder()
                .WithTopic(Topic)
                .WithQualityOfServiceLevel(
                    MqttQualityOfServiceLevel.AtMostOnce)
                .Build();

            await _client.SubscribeAsync(topic, stoppingToken);

            _logger.LogInformation(
                "Subscribed to {Topic}",
                Topic);

            await Task.Delay(
                Timeout.Infinite,
                stoppingToken);
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Normal application shutdown.
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "MQTT connection or subscription failed");
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
}
