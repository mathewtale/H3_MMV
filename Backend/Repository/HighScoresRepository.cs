using StackExchange.Redis;

namespace Backend.Repository
{
    public class HighScoresRepository : IHighScoresRepository
    {
        private const string HighScoresKey = "mspace:highscores";
        private readonly IDatabase _database;

        public HighScoresRepository(IConnectionMultiplexer redis)
        {
            _database = redis.GetDatabase();
        }

        public async Task AddEntryAsync(string name, long score)
        {
            await _database.SortedSetAddAsync(HighScoresKey, $"{Guid.NewGuid():N}:{name}", score);
        }

        public async Task<SortedSetEntry[]> GetEntriesAsync()
        {
            return await _database.SortedSetRangeByRankWithScoresAsync(HighScoresKey, 0, -1, Order.Descending);
        }
    }
}
