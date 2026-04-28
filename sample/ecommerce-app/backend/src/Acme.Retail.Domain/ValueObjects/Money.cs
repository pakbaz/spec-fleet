namespace Acme.Retail.Domain.ValueObjects;

/// <summary>
/// Money value object — amount + ISO-4217 currency code. Operations across mismatched currencies throw.
/// </summary>
public readonly record struct Money
{
    /// <summary>Numeric amount.</summary>
    public decimal Amount { get; }

    /// <summary>ISO-4217 currency code (e.g., "EUR", "USD"). Stored upper-case.</summary>
    public string Currency { get; }

    /// <summary>Creates a money instance.</summary>
    /// <param name="amount">Amount; may be negative for refunds.</param>
    /// <param name="currency">3-letter ISO-4217 code.</param>
    /// <exception cref="ArgumentException">Thrown when currency is not a 3-letter code.</exception>
    public Money(decimal amount, string currency)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);
        if (currency.Length != 3)
        {
            throw new ArgumentException("Currency must be a 3-letter ISO-4217 code.", nameof(currency));
        }

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    /// <summary>Zero in the given currency.</summary>
    public static Money Zero(string currency) => new(0m, currency);

    /// <summary>Adds two money values; both must share currency.</summary>
    public static Money operator +(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount + right.Amount, left.Currency);
    }

    /// <summary>Subtracts right from left; both must share currency.</summary>
    public static Money operator -(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount - right.Amount, left.Currency);
    }

    /// <summary>Scales the amount by an integer multiplier.</summary>
    public static Money operator *(Money left, int multiplier) =>
        new(left.Amount * multiplier, left.Currency);

    /// <inheritdoc />
    public override string ToString() => $"{Amount:0.00} {Currency}";

    private static void EnsureSameCurrency(Money a, Money b)
    {
        if (!string.Equals(a.Currency, b.Currency, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Currency mismatch: {a.Currency} vs {b.Currency}.");
        }
    }
}
