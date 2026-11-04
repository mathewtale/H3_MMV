

using System.Text.Json;

namespace Backend.Models;

public sealed class GameEvent
{
    public required string Event { get; init; }

    public DateTimeOffset Timestamp { get; init; }

    public JsonElement? Data { get; init; }
}
