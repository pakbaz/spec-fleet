using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace NoviMart.Infrastructure.Payments;

/// <summary>
/// Deterministic in-memory stub of <see cref="IPaymentProvider"/>. Used in Dev/Staging and tests.
/// Per ADR-0003 the production provider is swapped via config — the contract above is identical to
/// a real Stripe / Adyen / Braintree integration.
/// </summary>
/// <remarks>
/// This stub never sees a PAN — by design. It returns a fake token derived from the session id.
/// Default test card values (last4=4242, bin=424242, brand=visa) match common provider sandbox cards.
/// </remarks>
public sealed class StubPaymentProvider : IPaymentProvider
{
    private readonly ConcurrentDictionary<string, SessionRecord> _sessions = new(StringComparer.Ordinal);

    /// <inheritdoc />
    public Task<RedirectResponse> CreateSessionAsync(
        decimal amount, string currency, string returnUrl, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(currency);
        ArgumentException.ThrowIfNullOrWhiteSpace(returnUrl);
        if (amount <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "Amount must be positive.");
        }

        var sessionId = $"stub_{Guid.NewGuid():N}";
        _sessions[sessionId] = new SessionRecord(amount, currency.ToUpperInvariant(), returnUrl);
        var redirectUrl = $"https://payments.stub.novimart.example/checkout/{sessionId}?return_url={Uri.EscapeDataString(returnUrl)}";
        return Task.FromResult(new RedirectResponse(sessionId, redirectUrl));
    }

    /// <inheritdoc />
    public Task<PaymentToken?> CompleteAsync(string sessionId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId);
        if (!_sessions.TryGetValue(sessionId, out _))
        {
            return Task.FromResult<PaymentToken?>(null);
        }

        // Deterministic token derived from session id — identical input -> identical output.
        var token = "tok_" + DeriveHexHash(sessionId);
        var expiry = DateTimeOffset.UtcNow.AddYears(3).ToString("yyyy-MM", CultureInfo.InvariantCulture);
        return Task.FromResult<PaymentToken?>(new PaymentToken(
            Token: token,
            Last4: "4242",
            Bin: "424242",
            CardBrand: "visa",
            ExpiryYearMonth: expiry));
    }

    private static string DeriveHexHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes)
        {
            sb.Append(b.ToString("x2", CultureInfo.InvariantCulture));
        }
        return sb.ToString();
    }

    private sealed record SessionRecord(decimal Amount, string Currency, string ReturnUrl);
}
