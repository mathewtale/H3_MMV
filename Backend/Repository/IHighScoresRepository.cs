using StackExchange.Redis;

namespace Backend.Repository
{
    public interface IHighScoresRepository
    {
        Task AddEntryAsync(string name, long score);
        Task<SortedSetEntry[]> GetEntriesAsync();
    }
}