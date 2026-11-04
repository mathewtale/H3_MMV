using Backend.Hubs;
using Backend.Repository;
using Backend.Services;
using MSpace.Backend.Services;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(
        builder.Configuration.GetConnectionString("Redis")));

builder.Services.AddScoped<ILeaderboardRepository, LeaderboardRepository>();

builder.Services.AddOpenApi();
builder.Services.AddSignalR();

builder.Services.AddSingleton<GameStateService>();
builder.Services.AddSingleton<DeviceRegistry>();

builder.Services.AddHostedService<MqttInputService>();

builder.Services.AddSingleton<MqttCommandService>();
builder.Services.AddHostedService(
    services => services.GetRequiredService<MqttCommandService>());

var app = builder.Build();

app.MapHub<GameHub>("/gameHub");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
