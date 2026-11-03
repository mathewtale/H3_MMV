using Backend.Services;
using Microsoft.Extensions.Hosting;
using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Protocol;
using System.Text;

namespace MSpace.Backend.Services;

public sealed class MqttInputService : BackgroundService
{
    private const string Topic = "mspace/controller/input";

    private readonly GameStateService _gameState;
    private readonly ILogger<MqttInputService> _logger;

    private IMqttClient? _client;

    public MqttInputService(
        GameStateService gameState,
        ILogger<MqttInputService> logger)
    {
        _gameState = gameState;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        var factory = new MqttFactory();
        _client = factory.CreateMqttClient();

        _client.ApplicationMessageReceivedAsync += async e =>
        {
            var payload = Encoding.UTF8.GetString(
                e.ApplicationMessage.PayloadSegment);

            _logger.LogInformation(
                "MQTT input received: {Input}",
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

        var options = new MqttClientOptionsBuilder()
            .WithClientId("mspace-backend")
            .WithTcpServer("192.168.1.183", 1883)
            .WithCleanSession()
            .Build();

        try
        {
            await _client.ConnectAsync(options, stoppingToken);

            _logger.LogInformation(
                "Connected to MQTT broker");

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
                await _client.DisconnectAsync();
            }

            _client.Dispose();
        }
    }
}