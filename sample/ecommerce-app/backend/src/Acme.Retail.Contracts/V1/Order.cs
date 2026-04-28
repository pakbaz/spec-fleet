namespace Acme.Retail.Contracts.V1;

/// <summary>An order line on a placed order.</summary>
public sealed record OrderLineDto
{
    /// <summary>Product id.</summary>
    public required string ProductId { get; init; }

    /// <summary>Product name snapshot.</summary>
    public required string ProductName { get; init; }

    /// <summary>Unit price snapshot.</summary>
    public required MoneyDto UnitPrice { get; init; }

    /// <summary>Quantity.</summary>
    public required int Quantity { get; init; }

    /// <summary>Line subtotal.</summary>
    public required MoneyDto Subtotal { get; init; }
}

/// <summary>Order DTO. Exposes only PCI-allowed payment fields per <c>.eas/policies/pci.md</c>.</summary>
public sealed record OrderDto
{
    /// <summary>Order id.</summary>
    public required string Id { get; init; }

    /// <summary>Customer id.</summary>
    public required string CustomerId { get; init; }

    /// <summary>Order lines.</summary>
    public required IReadOnlyList<OrderLineDto> Lines { get; init; }

    /// <summary>Currency.</summary>
    public required string Currency { get; init; }

    /// <summary>Order total.</summary>
    public required MoneyDto Total { get; init; }

    /// <summary>Shipping address snapshot.</summary>
    public required AddressDto ShippingAddress { get; init; }

    /// <summary>Last 4 digits of the card used.</summary>
    public required string PaymentLast4 { get; init; }

    /// <summary>Card brand.</summary>
    public required string PaymentCardBrand { get; init; }

    /// <summary>Order status.</summary>
    public required string Status { get; init; }

    /// <summary>Placed-at UTC.</summary>
    public required DateTimeOffset PlacedAt { get; init; }
}

/// <summary>Place an order. Note: NO payment fields — payment is via tokenising redirect (ADR-0003).</summary>
public sealed record PlaceOrderRequest
{
    /// <summary>Address id to ship to (must belong to the caller's customer profile).</summary>
    public required Guid ShippingAddressId { get; init; }

    /// <summary>Payment session id returned by <c>POST /checkout/session</c> and completed by the provider.</summary>
    public required string PaymentSessionId { get; init; }
}

/// <summary>Request to start a checkout session (returns a redirect URL to the payment provider).</summary>
public sealed record CheckoutSessionRequest
{
    /// <summary>Caller-supplied URL the provider redirects back to after success/failure.</summary>
    public required string ReturnUrl { get; init; }
}

/// <summary>Response from <c>POST /checkout/session</c>.</summary>
public sealed record CheckoutSessionResponse
{
    /// <summary>Provider session id (opaque).</summary>
    public required string SessionId { get; init; }

    /// <summary>URL the SPA should redirect the browser to.</summary>
    public required string RedirectUrl { get; init; }
}
