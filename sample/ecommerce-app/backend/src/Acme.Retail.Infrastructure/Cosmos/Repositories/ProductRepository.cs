using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Repositories;
using Acme.Retail.Domain.Services;
using Acme.Retail.Domain.ValueObjects;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;
using Microsoft.Extensions.Options;
using static Acme.Retail.Infrastructure.Cosmos.CosmosDocuments;

namespace Acme.Retail.Infrastructure.Cosmos.Repositories;

/// <summary>Cosmos-backed product repository. Partition key: <c>/categoryId</c>.</summary>
public sealed class ProductRepository : IProductRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured products container.</summary>
    public ProductRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Products);
    }

    /// <inheritdoc />
    public async Task<ProductSearchResult> SearchAsync(
        string? query, string? categoryId, int page, int pageSize, CancellationToken cancellationToken)
    {
        // Read-locality: partition-scoped query when category supplied; otherwise cross-partition (acceptable
        // for the modest catalog size in this MVP and per ADR-0001 we accept the partition-key constraint).
        var queryable = _container.GetItemLinqQueryable<ProductDocument>(
            allowSynchronousQueryExecution: false,
            requestOptions: string.IsNullOrWhiteSpace(categoryId)
                ? null
                : new QueryRequestOptions { PartitionKey = new PartitionKey(categoryId) });

        var iterator = queryable.ToFeedIterator();
        var loaded = new List<Product>();
        while (iterator.HasMoreResults)
        {
            var batch = await iterator.ReadNextAsync(cancellationToken).ConfigureAwait(false);
            loaded.AddRange(batch.Select(d => d.ToDomain()));
        }
        return ProductSearchSpecification.Apply(loaded, query, categoryId, page, pageSize);
    }

    /// <inheritdoc />
    public async Task<Product?> GetAsync(ProductId id, string categoryId, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _container.ReadItemAsync<ProductDocument>(
                id.ToString(), new PartitionKey(categoryId), cancellationToken: cancellationToken)
                .ConfigureAwait(false);
            return response.Resource.ToDomain();
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
