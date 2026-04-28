using NoviMart.Domain.ValueObjects;

namespace NoviMart.Domain.Entities;

/// <summary>Postal address (shipping or billing).</summary>
public sealed record Address
{
    /// <summary>Per-customer address id.</summary>
    public required Guid AddressId { get; init; }

    /// <summary>Recipient name (separate from any payment cardholder name).</summary>
    public required string RecipientName { get; init; }

    /// <summary>Street line 1.</summary>
    public required string Line1 { get; init; }

    /// <summary>Optional street line 2.</summary>
    public string? Line2 { get; init; }

    /// <summary>City / locality.</summary>
    public required string City { get; init; }

    /// <summary>Optional region / state / province.</summary>
    public string? Region { get; init; }

    /// <summary>Postal code.</summary>
    public required string PostalCode { get; init; }

    /// <summary>ISO-3166-1 alpha-2 country code.</summary>
    public required string CountryCode { get; init; }
}

/// <summary>
/// Payment instrument metadata. Per <c>.specfleet/policies/pci.md</c> §4 we may store ONLY the fields
/// below — never PAN, CVV, full track, or cardholder name.
/// </summary>
public sealed record PaymentMethod
{
    /// <summary>Payment method id (per-customer).</summary>
    public required Guid PaymentMethodId { get; init; }

    /// <summary>Opaque token issued by the payment provider.</summary>
    public required string PaymentToken { get; init; }

    /// <summary>Last 4 digits of the card (for support / fraud signals only).</summary>
    public required string Last4 { get; init; }

    /// <summary>Bank Identification Number (first 6 digits).</summary>
    public required string Bin { get; init; }

    /// <summary>Card brand (visa/mc/amex/etc.).</summary>
    public required string CardBrand { get; init; }

    /// <summary>Expiry as YYYY-MM (used for "expiring card" reminders).</summary>
    public required string ExpiryYearMonth { get; init; }

    /// <summary>When the customer added this method (UTC).</summary>
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>Customer profile aggregate (personal data; CMK-encrypted at rest).</summary>
public sealed record Customer
{
    /// <summary>Stable internal customer id (GUID; not derived from PII per GDPR §5).</summary>
    public required CustomerId Id { get; init; }

    /// <summary>Entra External ID object id (the <c>oid</c>/<c>sub</c> claim value).</summary>
    public required string ExternalId { get; init; }

    /// <summary>Display name.</summary>
    public required string DisplayName { get; init; }

    /// <summary>Contact email.</summary>
    public required string Email { get; init; }

    /// <summary>Saved addresses.</summary>
    public IReadOnlyList<Address> Addresses { get; init; } = [];

    /// <summary>Saved payment methods (PCI-allowed fields only).</summary>
    public IReadOnlyList<PaymentMethod> PaymentMethods { get; init; } = [];

    /// <summary>Marketing/consent preferences.</summary>
    public CustomerPreferences Preferences { get; init; } = new();

    /// <summary>Account creation timestamp (UTC).</summary>
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Last activity timestamp; drives 7-year retention from this point.</summary>
    public DateTimeOffset LastActivityAt { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Set when an erasure request is in progress (Art. 17 workflow).</summary>
    public DateTimeOffset? ErasureRequestedAt { get; init; }
}

/// <summary>Customer marketing/consent preferences.</summary>
public sealed record CustomerPreferences
{
    /// <summary>Whether the customer has opted into marketing email (consent basis).</summary>
    public bool MarketingEmailOptIn { get; init; }

    /// <summary>Whether processing is restricted under Art. 18.</summary>
    public bool ProcessingRestricted { get; init; }
}
