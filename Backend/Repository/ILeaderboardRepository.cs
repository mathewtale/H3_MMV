using StackExchange.Redis;

namespace Backend.Repository
{
    public interface ILeaderboardRepository
    {
        Task AddHighScoreAsync(string name, long score);
        Task<SortedSetEntry[]> GetHighScoresAsync();
    }
}