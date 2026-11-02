using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs
{

    public class GameHub : Hub
    {
        public async Task SendTestMessage(string message)
        {
            await Clients.Caller.SendAsync(
                "ReceiveTestMessage",
                message
            );
        }
    }
}
