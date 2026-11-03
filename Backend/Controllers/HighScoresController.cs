using Backend.Models;
using Backend.Repository;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers
{
    [ApiController]
    [Route("/api/highscores")]
    public class HighScoresController : ControllerBase
    {
        private readonly IHighScoresRepository _highScoresRepository;

        public HighScoresController(IHighScoresRepository highScoresRepository)
        {
            _highScoresRepository = highScoresRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetEntries()
        {
            var highScores = await _highScoresRepository.GetEntriesAsync();

            return Ok(highScores.Select(s => new PlayerDto(s)));
        }

        [HttpPost]
        public async Task<IActionResult> AddEntry([FromBody] CreatePlayerCommand command)
        {
            try
            {
                await _highScoresRepository.AddEntryAsync(command.Name, command.Score);

                return Ok();
            }
            catch
            {
                return StatusCode(500, "An error occurred while adding the high score.");
            }
        }
    }
}
