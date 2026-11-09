

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Backend.Models;

public sealed class GameEvent
{
    [JsonPropertyName("event")]
    public string Event { get; init; }

    [JsonPropertyName("timestamp")]
    public DateTimeOffset Timestamp { get; init; }

    [JsonPropertyName("data")]
    public JsonElement? Data { get; init; }
}
