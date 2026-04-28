using NoviMart.Domain.ValueObjects;

namespace NoviMart.Domain.Entities;

/// <summary>One line on a placed order (immutable once written).</summary>
public sealed record OrderLine
{
    /// <summary>Product id.</summary>
    public required ProductId ProductId { get; init; }

    /// <summary>Snapshot of the product name at order time.</summary>
    public required string ProductName { get; init; }

    /// <summary>Snapshot of unit price at order time.</summary>
    public required Money UnitPrice { get; init; }

    /// <summary>Quantity ordered.</summary>
    public required int Quantity { get; init; }

    /// <summary>Line subtotal.</summary>
    public Money Subtotal => UnitPrice * Quantity;
}

/// <summary>
/// Placed order. Immutable history (append-only); 7-year retention per <c>.specfleet/policies/gdpr.md</c>.
/// Stores only PCI-allowed payment fields per <c>.specfleet/policies/pci.md</c>.
/// </summary>
public sealed record Order
{
    /// <summary>Unique order id.</summary>
    public required OrderId Id { get; init; }

    /// <summary>Customer who placed the order (partition key).</summary>
    public required CustomerId CustomerId { get; init; }

    /// <summary>Order lines.</summary>
    public required IReadOnlyList<OrderLine> Lines { get; init; }

    /// <summary>Currency.</summary>
    public required string Currency { get; init; }

    /// <summary>Total amount.</summary>
    public required Money Total { get; init; }

    /// <summary>Shipping address snapshot.</summary>
    public required Address ShippingAddress { get; init; }

    /// <summary>Opaque payment token returned by the provider.</summary>
    public required string PaymentToken { get; init; }

    /// <summary>Last 4 digits of the payment instrument (allowable per pci.md §4).</summary>
    public required string PaymentLast4 { get; init; }

    /// <summary>Card brand (allowable per pci.md §4).</summary>
    public required string PaymentCardBrand { get; init; }

    /// <summary>Order status.</summary>
    public OrderStatus Status { get; init; } = OrderStatus.Placed;

    /// <summary>UTC placed timestamp.</summary>
    public DateTimeOffset PlacedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Lifecycle status of an order.</summary>
public enum OrderStatus
{
    /// <summary>Order accepted, payment captured.</summary>
    Placed = 0,

    /// <summary>Order being prepared.</summary>
    Processing = 1,

    /// <summary>Order shipped.</summary>
    Shipped = 2,

    /// <summary>Order delivered.</summary>
    Delivered = 3,

    /// <summary>Order cancelled.</summary>
    Cancelled = 4,
}
