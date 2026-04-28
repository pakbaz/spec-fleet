namespace NoviMart.Infrastructure.Cosmos;

/// <summary>Configuration for the Cosmos DB connection. Bound from the <c>Cosmos</c> section.</summary>
public sealed class CosmosOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Cosmos";

    /// <summary>Cosmos account endpoint (e.g., <c>https://novimart-prod.documents.azure.com:443/</c>).</summary>
    /// <remarks>Authentication uses <c>DefaultAzureCredential</c>. Connection strings are forbidden.</remarks>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>Database name. Defaults to <c>novimart</c>.</summary>
    public string DatabaseName { get; set; } = "novimart";

    /// <summary>Container names per <c>.specfleet/project.md</c>.</summary>
    public CosmosContainerNames Containers { get; set; } = new();
}

/// <summary>Configured container names.</summary>
public sealed class CosmosContainerNames
{
    /// <summary>Products container name.</summary>
    public string Products { get; set; } = "products";

    /// <summary>Categories container name.</summary>
    public string Categories { get; set; } = "categories";

    /// <summary>Carts container name.</summary>
    public string Carts { get; set; } = "carts";

    /// <summary>Orders container name.</summary>
    public string Orders { get; set; } = "orders";

    /// <summary>Customers container name.</summary>
    public string Customers { get; set; } = "customers";

    /// <summary>Audit container name.</summary>
    public string Audit { get; set; } = "audit";
}
