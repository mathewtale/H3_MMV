using Backend.Models;
using Backend.Repository;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("/api/leaderboard")]
    public class LeaderboardController : ControllerBase
    {
        private readonly ILeaderboardRepository _leaderboardRepository;

        public LeaderboardController(ILeaderboardRepository leaderboardRepository)
        {
            _leaderboardRepository = leaderboardRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetLeaderboard()
        {
            var highScores = await _leaderboardRepository.GetHighScoresAsync();

            return Ok(highScores.Select(s => new PlayerDto(s)));
        }

        [HttpPost]
        public async Task<IActionResult> AddHighScore([FromBody] CreatePlayerCommand command)
        {
            try
            {
                await _leaderboardRepository.AddHighScoreAsync(command.Name, command.Score);

                return Ok();
            }
            catch
            {
                return StatusCode(500, "An error occurred while adding the high score.");
            }
        }
    }
}
