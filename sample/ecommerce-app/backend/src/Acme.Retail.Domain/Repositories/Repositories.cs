using Acme.Retail.Domain.Entities;
using Acme.Retail.Domain.Services;
using Acme.Retail.Domain.ValueObjects;

namespace Acme.Retail.Domain.Repositories;

/// <summary>Read/write access to the product catalog.</summary>
public interface IProductRepository
{
    /// <summary>Searches the catalog using the supplied filters.</summary>
    Task<ProductSearchResult> SearchAsync(
        string? query,
        string? categoryId,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    /// <summary>Loads a single product by id.</summary>
    Task<Product?> GetAsync(ProductId id, string categoryId, CancellationToken cancellationToken);
}

/// <summary>Read/write access to category metadata.</summary>
public interface ICategoryRepository
{
    /// <summary>Lists all categories for the given region.</summary>
    Task<IReadOnlyList<Category>> ListAsync(string region, CancellationToken cancellationToken);
}

/// <summary>Read/write access to per-customer carts.</summary>
public interface ICartRepository
{
    /// <summary>Fetches the customer's cart, or null if none exists.</summary>
    Task<Cart?> GetAsync(CustomerId customerId, CancellationToken cancellationToken);

    /// <summary>Persists (upserts) the cart.</summary>
    Task SaveAsync(Cart cart, CancellationToken cancellationToken);

    /// <summary>Deletes the cart entirely (used by GDPR erasure).</summary>
    Task DeleteAsync(CustomerId customerId, CancellationToken cancellationToken);
}

/// <summary>Append-only access to placed orders.</summary>
public interface IOrderRepository
{
    /// <summary>Persists a newly-placed order.</summary>
    Task AddAsync(Order order, CancellationToken cancellationToken);

    /// <summary>Lists orders for a customer, newest first.</summary>
    Task<IReadOnlyList<Order>> ListForCustomerAsync(CustomerId customerId, CancellationToken cancellationToken);

    /// <summary>Loads a single order by id.</summary>
    Task<Order?> GetAsync(OrderId id, CustomerId customerId, CancellationToken cancellationToken);
}

/// <summary>Read/write access to customer profiles.</summary>
public interface ICustomerRepository
{
    /// <summary>Loads a customer by internal id.</summary>
    Task<Customer?> GetAsync(CustomerId id, CancellationToken cancellationToken);

    /// <summary>Loads a customer by Entra external id.</summary>
    Task<Customer?> GetByExternalIdAsync(string externalId, CancellationToken cancellationToken);

    /// <summary>Inserts or updates a customer.</summary>
    Task SaveAsync(Customer customer, CancellationToken cancellationToken);

    /// <summary>Hard-deletes a customer (GDPR Art. 17 erasure where no legal hold applies).</summary>
    Task DeleteAsync(CustomerId id, CancellationToken cancellationToken);
}

/// <summary>Append-only access to the audit log.</summary>
public interface IAuditRepository
{
    /// <summary>Writes a new audit event.</summary>
    Task AppendAsync(AuditEvent auditEvent, CancellationToken cancellationToken);
}
