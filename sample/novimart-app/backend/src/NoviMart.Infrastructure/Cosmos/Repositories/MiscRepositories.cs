using NoviMart.Domain.Entities;
using NoviMart.Domain.Repositories;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using static NoviMart.Infrastructure.Cosmos.CosmosDocuments;

namespace NoviMart.Infrastructure.Cosmos.Repositories;

/// <summary>Cosmos-backed category repository. Partition key: <c>/region</c>.</summary>
public sealed class CategoryRepository : ICategoryRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured categories container.</summary>
    public CategoryRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Categories);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Category>> ListAsync(string region, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(region);
        var iterator = _container.GetItemQueryIterator<CategoryDocument>(
            new QueryDefinition("SELECT * FROM c ORDER BY c.sortOrder"),
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(region) });
        var results = new List<Category>();
        while (iterator.HasMoreResults)
        {
            var batch = await iterator.ReadNextAsync(cancellationToken).ConfigureAwait(false);
            results.AddRange(batch.Select(d => d.ToDomain()));
        }
        return results;
    }
}

/// <summary>Cosmos-backed audit repository. Partition key: <c>/aggregateId</c>; append-only.</summary>
public sealed class AuditRepository : IAuditRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured audit container.</summary>
    public AuditRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Audit);
    }

    /// <inheritdoc />
    public async Task AppendAsync(AuditEvent auditEvent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(auditEvent);
        await _container.CreateItemAsync(
            auditEvent, new PartitionKey(auditEvent.AggregateId), cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }
}
