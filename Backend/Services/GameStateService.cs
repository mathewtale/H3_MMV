using Backend.Hubs;
using Backend.Models;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;


namespace Backend.Services;

public sealed class GameStateService
{
    private readonly IHubContext<GameHub> _hub;

    public GameStateService(IHubContext<GameHub> hub)
    {
        _hub = hub;
    }

    public async Task HandleInputAsync(string input)
    {
        await _hub.Clients.All.SendAsync("ReceiveArduinoEvent", JsonSerializer.Deserialize<GameEvent>(input));
    }

    public async Task SendConnectionLostAsync()
    {
        await _hub.Clients.All.SendAsync("ReceiveArduinoEvent", new GameEvent
        {
            Event = "CONNECTION_LOST",
            Timestamp = DateTimeOffset.UtcNow
        });
    }
}