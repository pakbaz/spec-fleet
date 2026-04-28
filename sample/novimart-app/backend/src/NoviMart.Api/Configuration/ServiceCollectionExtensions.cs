using NoviMart.Domain.Repositories;
using NoviMart.Infrastructure.Cosmos;
using NoviMart.Infrastructure.Cosmos.Repositories;
using NoviMart.Infrastructure.Payments;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.Azure.Cosmos;
using OpenTelemetry.Trace;

namespace NoviMart.Api.Configuration;

/// <summary>
/// Composition-root DI extensions. Keeps <c>Program.cs</c> thin and groups infrastructure wiring
/// so unit tests and integration tests can share configuration.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Wires Cosmos DB (DefaultAzureCredential), all five repositories, and the stub payment
    /// provider. Production deployments MUST override <c>IPaymentProvider</c> with a PCI Level-1
    /// provider per ADR-0003.
    /// </summary>
    public static IServiceCollection AddNoviMartInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<CosmosOptions>(configuration.GetSection(CosmosOptions.SectionName));
        services.AddSingleton<CosmosClientFactory>();
        services.AddSingleton<CosmosClient>(sp =>
            sp.GetRequiredService<CosmosClientFactory>().Create());

        services.AddSingleton<IProductRepository, ProductRepository>();
        services.AddSingleton<ICategoryRepository, CategoryRepository>();
        services.AddSingleton<ICartRepository, CartRepository>();
        services.AddSingleton<IOrderRepository, OrderRepository>();
        services.AddSingleton<ICustomerRepository, CustomerRepository>();
        services.AddSingleton<IAuditRepository, AuditRepository>();

        services.AddSingleton<IPaymentProvider, StubPaymentProvider>();
        return services;
    }

    /// <summary>
    /// Wires OpenTelemetry traces and metrics, exporting to Azure Monitor when an App Insights
    /// connection string is configured (<c>ApplicationInsights:ConnectionString</c>) — otherwise
    /// telemetry stays in-process (useful for local dev and tests).
    /// </summary>
    public static IServiceCollection AddNoviMartTelemetry(
        this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        var connectionString = configuration["ApplicationInsights:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            services.AddOpenTelemetry().UseAzureMonitor(o =>
            {
                o.ConnectionString = connectionString;
            });
        }
        else
        {
            services.AddOpenTelemetry()
                .WithTracing(t => t
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation());
        }

        return services;
    }
}
