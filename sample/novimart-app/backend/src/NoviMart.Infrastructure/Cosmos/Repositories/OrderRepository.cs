using NoviMart.Domain.Entities;
using NoviMart.Domain.Repositories;
using NoviMart.Domain.ValueObjects;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;

namespace NoviMart.Infrastructure.Cosmos.Repositories;

/// <summary>Cosmos-backed order repository. Partition key: <c>/customerId</c>; append-only.</summary>
public sealed class OrderRepository : IOrderRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured orders container.</summary>
    public OrderRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Orders);
    }

    /// <inheritdoc />
    public async Task AddAsync(Order order, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(order);
        await _container.CreateItemAsync(
            order, new PartitionKey(order.CustomerId.ToString()), cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Order>> ListForCustomerAsync(
        CustomerId customerId, CancellationToken cancellationToken)
    {
        var iterator = _container.GetItemQueryIterator<Order>(
            new QueryDefinition("SELECT * FROM o ORDER BY o.placedAt DESC"),
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = new PartitionKey(customerId.ToString()),
            });
        var results = new List<Order>();
        while (iterator.HasMoreResults)
        {
            var batch = await iterator.ReadNextAsync(cancellationToken).ConfigureAwait(false);
            results.AddRange(batch);
        }
        return results;
    }

    /// <inheritdoc />
    public async Task<Order?> GetAsync(OrderId id, CustomerId customerId, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _container.ReadItemAsync<Order>(
                id.ToString(),
                new PartitionKey(customerId.ToString()),
                cancellationToken: cancellationToken).ConfigureAwait(false);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
