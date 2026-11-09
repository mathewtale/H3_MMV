
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

public class GameHub : Hub
{
    private readonly MqttCommandService _mqttCommandService;
    private readonly DeviceRegistry _deviceRegistry;
    private readonly ILogger<GameHub> _logger;

    private static int _connectedClients;

    public GameHub(
        MqttCommandService mqttCommandService,
        DeviceRegistry deviceRegistry,
        ILogger<GameHub> logger)
    {
        _mqttCommandService = mqttCommandService;
        _deviceRegistry = deviceRegistry;
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        Interlocked.Increment(ref _connectedClients);

        _logger.LogInformation("Client {ConnectionId} connected", Context.ConnectionId);

        return base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception == null)
            _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);
        else
            _logger.LogWarning(exception, "Client {ConnectionId} disconnected with an error", Context.ConnectionId);

        // Tell the Arduino when no frontend is left
        if (Interlocked.Decrement(ref _connectedClients) == 0)
            await SendConnectionLostToArduinoAsync();

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendArduinoCommand(GameEvent gameEvent)
    {
        var allowedEvents = new HashSet<string>
        {
            "GAME_START",
            "GAME_OVER",
            "OBSTACLE_HIT",
            "ENERGY_CELL_HIT",
            "BORDER_HIT",
            "BOOST_ACTIVATED",
            "BOOST_DEACTIVATED"
        };

        if (gameEvent == null ||
            !allowedEvents.Contains(gameEvent.Event))
        {
            _logger.LogWarning("Rejected event {Event} from {ConnectionId}", gameEvent?.Event, Context.ConnectionId);

            throw new HubException(
                "This event is not allowed as an Arduino command.");
        }

        // OBSTACLE_HIT and ENERGY_CELL_HIT require shield data.
        if (gameEvent.Event == "OBSTACLE_HIT" ||
            gameEvent.Event == "ENERGY_CELL_HIT")
        {
            if (gameEvent.Data is not System.Text.Json.JsonElement data ||
                !data.TryGetProperty("shields", out var shields) ||
                shields.ValueKind != System.Text.Json.JsonValueKind.Number ||
                !shields.TryGetInt32(out var shieldCount) ||
                shieldCount < 0)
            {
                _logger.LogWarning("Rejected {Event} from {ConnectionId}: missing or invalid shields", gameEvent.Event, Context.ConnectionId);

                throw new HubException(
                    "This event requires a valid shields value.");
            }
        }

        var deviceId = _deviceRegistry.LastSeenDeviceId;

        if (deviceId == null)
        {
            _logger.LogWarning("Could not send {Event}: no Arduino device detected yet", gameEvent.Event);

            throw new HubException(
                "No Arduino device has been detected yet.");
        }

        var command = new GameEvent
        {
            Event = gameEvent.Event,
            Timestamp = gameEvent.Timestamp == default
                ? DateTimeOffset.UtcNow
                : gameEvent.Timestamp,
            Data = gameEvent.Data
        };

        try
        {
            await _mqttCommandService.SendCommandAsync(
                deviceId, command);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to send {Event} to {DeviceId}", command.Event, deviceId);

            await Clients.Caller.SendAsync("ReceiveArduinoEvent", new GameEvent
            {
                Event = "CONNECTION_LOST",
                Timestamp = DateTimeOffset.UtcNow
            });

            throw new HubException(
                "The command could not be sent to the Arduino.");
        }

        _logger.LogInformation("Sent {Event} to {DeviceId}", command.Event, deviceId);
    }

    private async Task SendConnectionLostToArduinoAsync()
    {
        var deviceId = _deviceRegistry.LastSeenDeviceId;

        if (deviceId == null)
            return;

        try
        {
            await _mqttCommandService.SendCommandAsync(deviceId, new GameEvent
            {
                Event = "CONNECTION_LOST",
                Timestamp = DateTimeOffset.UtcNow
            });

            _logger.LogWarning("No frontend connected, sent CONNECTION_LOST to {DeviceId}", deviceId);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to send CONNECTION_LOST to {DeviceId}", deviceId);
        }
    }

    public async Task SendTestMessage(string message)
    {
        await Clients.Caller.SendAsync(
            "ReceiveTestMessage", message);
    }
}
