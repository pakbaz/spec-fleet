namespace NoviMart.Domain.Entities;

/// <summary>
/// Tamper-evident audit event (append-only; 7-year retention).
/// Personal data writes MUST emit one of these per <c>.specfleet/instruction.md</c> data policy.
/// </summary>
public sealed record AuditEvent
{
    /// <summary>Unique event id.</summary>
    public required Guid Id { get; init; }

    /// <summary>Aggregate id this event pertains to (partition key).</summary>
    public required string AggregateId { get; init; }

    /// <summary>Actor that performed the action (a customer or admin id, or "system").</summary>
    public required string ActorId { get; init; }

    /// <summary>Subject the action was performed on (often the customer id).</summary>
    public required string SubjectId { get; init; }

    /// <summary>Symbolic action name (e.g., "customer.profile.updated").</summary>
    public required string Action { get; init; }

    /// <summary>Timestamp (UTC).</summary>
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;

    /// <summary>Optional structured detail (must NOT contain PAN/CVV).</summary>
    public IReadOnlyDictionary<string, string>? Details { get; init; }
}
