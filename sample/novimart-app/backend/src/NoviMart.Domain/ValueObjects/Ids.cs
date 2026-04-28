namespace NoviMart.Domain.ValueObjects;

/// <summary>Strongly-typed product identifier (GUID-backed).</summary>
public readonly record struct ProductId(Guid Value)
{
    /// <summary>Creates a new random product id.</summary>
    public static ProductId New() => new(Guid.NewGuid());

    /// <summary>Parses from string; throws on invalid input.</summary>
    public static ProductId Parse(string value) => new(Guid.Parse(value));

    /// <inheritdoc />
    public override string ToString() => Value.ToString("D");
}

/// <summary>Strongly-typed customer identifier (GUID-backed).</summary>
public readonly record struct CustomerId(Guid Value)
{
    /// <summary>Creates a new random customer id.</summary>
    public static CustomerId New() => new(Guid.NewGuid());

    /// <summary>Parses from string; throws on invalid input.</summary>
    public static CustomerId Parse(string value) => new(Guid.Parse(value));

    /// <inheritdoc />
    public override string ToString() => Value.ToString("D");
}

/// <summary>Strongly-typed order identifier (GUID-backed).</summary>
public readonly record struct OrderId(Guid Value)
{
    /// <summary>Creates a new random order id.</summary>
    public static OrderId New() => new(Guid.NewGuid());

    /// <summary>Parses from string; throws on invalid input.</summary>
    public static OrderId Parse(string value) => new(Guid.Parse(value));

    /// <inheritdoc />
    public override string ToString() => Value.ToString("D");
}
