using StackExchange.Redis;

namespace Backend.Repository
{
    public class LeaderboardRepository : ILeaderboardRepository
    {
        private const string LeaderboardKey = "mspace:leaderboard";
        private readonly IDatabase _database;

        public LeaderboardRepository(IConnectionMultiplexer redis)
        {
            _database = redis.GetDatabase();
        }

        public async Task AddHighScoreAsync(string name, long score)
        {
            await _database.SortedSetAddAsync(LeaderboardKey, name, score, SortedSetWhen.GreaterThan);
        }

        public async Task<SortedSetEntry[]> GetHighScoresAsync()
        {
            return await _database.SortedSetRangeByRankWithScoresAsync(LeaderboardKey, 0, -1, Order.Descending);
        }
    }
}
