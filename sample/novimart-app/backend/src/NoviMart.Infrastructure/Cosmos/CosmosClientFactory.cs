using Azure.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;

namespace NoviMart.Infrastructure.Cosmos;

/// <summary>
/// Builds a single shared <see cref="CosmosClient"/> backed by <see cref="DefaultAzureCredential"/>.
/// Per <c>.specfleet/policies/zero-trust.md</c> §1: managed identities only, NO connection strings.
/// </summary>
public sealed class CosmosClientFactory
{
    private readonly CosmosOptions _options;

    /// <summary>Creates a factory from the bound options.</summary>
    public CosmosClientFactory(IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _options = options.Value;
        if (string.IsNullOrWhiteSpace(_options.Endpoint))
        {
            throw new InvalidOperationException(
                "Cosmos:Endpoint is required. Connection strings are forbidden — use the account endpoint URL.");
        }
    }

    /// <summary>Builds a configured <see cref="CosmosClient"/> using DefaultAzureCredential.</summary>
    public CosmosClient Create()
    {
        var clientOptions = new CosmosClientOptions
        {
            ApplicationName = "novimart-api",
            ConnectionMode = ConnectionMode.Direct,
            UseSystemTextJsonSerializerWithOptions = new System.Text.Json.JsonSerializerOptions(
                System.Text.Json.JsonSerializerDefaults.Web),
        };
        return new CosmosClient(_options.Endpoint, new DefaultAzureCredential(), clientOptions);
    }
}
