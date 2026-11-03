using StackExchange.Redis;

namespace Backend.Models
{
    public class PlayerDto
    {
        public string Name { get; set; }
        public long Score { get; set; }
     
        public PlayerDto(SortedSetEntry entry)
        {
            Name = entry.Element.ToString().Split(':').Last();
            Score = (long)entry.Score;
        }
    }
}
