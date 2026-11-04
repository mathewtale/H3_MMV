using Backend.Models;
using MQTTnet;
using MQTTnet.Client;
using System.Text.Json;

namespace Backend.Services;

public sealed class MqttCommandService : IHostedService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<MqttCommandService> _logger;
    private readonly IMqttClient _client;
    private readonly SemaphoreSlim _publishLock = new(1, 1);

    public MqttCommandService(
        IConfiguration configuration,
        ILogger<MqttCommandService> logger)
    {
        _configuration = configuration;
        _logger = logger;

        _client = new MqttFactory().CreateMqttClient();
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var host = _configuration["Mqtt:Host"] ?? "localhost";
        var port = int.Parse(_configuration["Mqtt:Port"] ?? "1883");

        var options = new MqttClientOptionsBuilder()
            .WithClientId($"mspace-command-{Guid.NewGuid():N}")
            .WithTcpServer(host, port)
            .WithCleanSession()
            .Build();

        await _client.ConnectAsync(options, cancellationToken);

        _logger.LogInformation(
            "MQTT command client connected to {Host}:{Port}",
            host, port);
    }

    public async Task SendCommandAsync(string deviceId, GameEvent gameEvent)
    {
        if (!_client.IsConnected)
        {
            throw new InvalidOperationException(
                "MQTT command client is not connected.");
        }

        var payload = JsonSerializer.Serialize(gameEvent);

        var message = new MqttApplicationMessageBuilder()
            .WithTopic($"mspace/{deviceId}/event")
            .WithPayload(payload)
            .Build();

        await _publishLock.WaitAsync();

        try
        {
            await _client.PublishAsync(message);

            _logger.LogInformation(
                "Published MQTT command to device {DeviceId}: {Payload}",
                deviceId, payload);
        }
        finally
        {
            _publishLock.Release();
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_client.IsConnected)
        {
            await _client.DisconnectAsync(
                new MqttClientDisconnectOptionsBuilder().Build());
        }

        _client.Dispose();
        _publishLock.Dispose();
    }
}
