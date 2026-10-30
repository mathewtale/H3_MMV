var builder = DistributedApplication.CreateBuilder(args);

var apiService = builder.AddProject<Projects.Backend>("apiservice");

builder.AddProject<Projects.Frontend>("webfrontend")
    .WithExternalHttpEndpoints()
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
