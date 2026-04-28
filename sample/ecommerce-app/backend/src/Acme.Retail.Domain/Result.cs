namespace Acme.Retail.Domain;

/// <summary>
/// Discriminated success/failure result for domain operations. Avoids exceptions for expected
/// business outcomes (validation, not-found, conflict) while keeping unexpected faults as exceptions.
/// </summary>
/// <typeparam name="T">Success value type.</typeparam>
[System.Diagnostics.CodeAnalysis.SuppressMessage("Design", "CA1000:Do not declare static members on generic types",
    Justification = "Static factory methods are the idiomatic way to construct Result<T> instances.")]
public readonly record struct Result<T>
{
    /// <summary>Whether the operation succeeded.</summary>
    public bool IsSuccess { get; }

    /// <summary>The success value (only valid when <see cref="IsSuccess"/> is true).</summary>
    public T? Value { get; }

    /// <summary>Stable, machine-readable error code (only valid on failure).</summary>
    public string? ErrorCode { get; }

    /// <summary>Human-readable error message (only valid on failure).</summary>
    public string? ErrorMessage { get; }

    private Result(bool ok, T? value, string? code, string? message)
    {
        IsSuccess = ok;
        Value = value;
        ErrorCode = code;
        ErrorMessage = message;
    }

    /// <summary>Construct a success result.</summary>
    public static Result<T> Success(T value) => new(true, value, null, null);

    /// <summary>Construct a failure result.</summary>
    public static Result<T> Failure(string code, string message) => new(false, default, code, message);
}

/// <summary>Standard domain error codes.</summary>
public static class DomainErrors
{
    /// <summary>Aggregate not found.</summary>
    public const string NotFound = "not_found";

    /// <summary>Validation failure on input.</summary>
    public const string Validation = "validation";

    /// <summary>Business rule violation (e.g., quantity exceeds max).</summary>
    public const string RuleViolation = "rule_violation";

    /// <summary>Concurrency / etag mismatch.</summary>
    public const string Conflict = "conflict";
}
