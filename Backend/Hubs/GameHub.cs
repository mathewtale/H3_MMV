
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

public class GameHub : Hub
{
    private readonly MqttCommandService _mqttCommandService;
    private readonly DeviceRegistry _deviceRegistry;

    public GameHub(
        MqttCommandService mqttCommandService,
        DeviceRegistry deviceRegistry)
    {
        _mqttCommandService = mqttCommandService;
        _deviceRegistry = deviceRegistry;
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
                throw new HubException(
                    "This event requires a valid shields value.");
            }
        }

        var deviceId = _deviceRegistry.LastSeenDeviceId;

        if (deviceId == null)
        {
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

        await _mqttCommandService.SendCommandAsync(
            deviceId, command);
    }

    public async Task SendTestMessage(string message)
    {
        await Clients.Caller.SendAsync(
            "ReceiveTestMessage", message);
    }
}
