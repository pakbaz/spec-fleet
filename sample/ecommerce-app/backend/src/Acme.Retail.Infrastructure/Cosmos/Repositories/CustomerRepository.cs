using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Repositories;
using Acme.Retail.Domain.ValueObjects;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;

namespace Acme.Retail.Infrastructure.Cosmos.Repositories;

/// <summary>Cosmos-backed customer repository. Partition key: <c>/customerId</c>.</summary>
public sealed class CustomerRepository : ICustomerRepository
{
    private readonly Container _container;

    /// <summary>Creates a repository over the configured customers container.</summary>
    public CustomerRepository(CosmosClient client, IOptions<CosmosOptions> options)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(options);
        var o = options.Value;
        _container = client.GetContainer(o.DatabaseName, o.Containers.Customers);
    }

    /// <inheritdoc />
    public async Task<Customer?> GetAsync(CustomerId id, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _container.ReadItemAsync<Customer>(
                id.ToString(),
                new PartitionKey(id.ToString()),
                cancellationToken: cancellationToken).ConfigureAwait(false);
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<Customer?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(externalId);
        // Cross-partition query — used at sign-in only; result cached on the customer principal.
        var query = new QueryDefinition("SELECT * FROM c WHERE c.externalId = @ext").WithParameter("@ext", externalId);
        var iterator = _container.GetItemQueryIterator<Customer>(query);
        while (iterator.HasMoreResults)
        {
            var batch = await iterator.ReadNextAsync(cancellationToken).ConfigureAwait(false);
            foreach (var c in batch)
            {
                return c;
            }
        }
        return null;
    }

    /// <inheritdoc />
    public async Task SaveAsync(Customer customer, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(customer);
        await _container.UpsertItemAsync(
            customer, new PartitionKey(customer.Id.ToString()), cancellationToken: cancellationToken)
            .ConfigureAwait(false);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(CustomerId id, CancellationToken cancellationToken)
    {
        try
        {
            await _container.DeleteItemAsync<Customer>(
                id.ToString(),
                new PartitionKey(id.ToString()),
                cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Already gone — idempotent.
        }
    }
}
