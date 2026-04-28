using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Repositories;
using Acme.Retail.Domain.ValueObjects;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using static Acme.Retail.Infrastructure.Cosmos.CosmosDocuments;

namespace Acme.Retail.Infrastructure.Cosmos.Repositories;

/// <summary>Cosmos-backed cart repository. Partition key: <c>/customerId</c>.</summary>
public sealed class CartRepository : ICartRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured carts container.</summary>
    public CartRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Carts);
    }

    /// <inheritdoc />
    public async Task<Cart?> GetAsync(CustomerId customerId, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _container.ReadItemAsync<CartDocument>(
                customerId.ToString(),
                new PartitionKey(customerId.ToString()),
                cancellationToken: cancellationToken).ConfigureAwait(false);
            return response.Resource.ToDomain();
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task SaveAsync(Cart cart, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(cart);
        var doc = CartDocument.FromDomain(cart);
        await _container.UpsertItemAsync(
            doc, new PartitionKey(doc.CustomerId), cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(CustomerId customerId, CancellationToken cancellationToken)
    {
        try
        {
            await _container.DeleteItemAsync<CartDocument>(
                customerId.ToString(),
                new PartitionKey(customerId.ToString()),
                cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Already deleted — idempotent.
        }
    }
}
