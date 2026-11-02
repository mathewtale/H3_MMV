using Backend.Hubs;
using Microsoft.AspNetCore.SignalR;


namespace Backend.Services;

public sealed class GameStateService
{
    private readonly IHubContext<GameHub> _hub;
    private readonly object _lock = new();

    private int _lane = 1;
    private int _score = 0;

    public GameStateService(IHubContext<GameHub> hub)
    {
        _hub = hub;
    }

    public async Task HandleInputAsync(string input)
    {
        int lane;
        int score;

        lock (_lock)
        {
            switch (input.Trim().ToLowerInvariant())
            {
                case "left":
                    _lane = Math.Max(0, _lane - 1);
                    break;

                case "right":
                    _lane = Math.Min(2, _lane + 1);
                    break;

                default:
                    return;
            }

            lane = _lane;
            score = _score;
        }

        await _hub.Clients.All.SendAsync(
            "GameStateUpdated",
            new
            {
                lane,
                score
            });
    }
}