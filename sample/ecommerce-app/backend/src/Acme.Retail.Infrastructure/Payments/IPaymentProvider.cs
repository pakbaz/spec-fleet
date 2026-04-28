namespace Acme.Retail.Infrastructure.Payments;

/// <summary>
/// Payment provider abstraction. Implementations MUST tokenise — Acme NEVER receives PAN or CVV.
/// Per ADR-0003 the production provider is selected by config; this sample defaults to a stub.
/// </summary>
public interface IPaymentProvider
{
    /// <summary>
    /// Begins a payment session. The browser is redirected to <see cref="RedirectResponse.RedirectUrl"/>
    /// where the provider hosts the PAN/CVV entry on its own (PCI-Level-1) page.
    /// </summary>
    Task<RedirectResponse> CreateSessionAsync(
        decimal amount, string currency, string returnUrl, CancellationToken cancellationToken);

    /// <summary>
    /// Completes a session given the provider's session id. Returns the PCI-allowed token + last4 + bin
    /// + brand + expiry (<c>null</c> if the session does not exist or was not paid).
    /// </summary>
    Task<PaymentToken?> CompleteAsync(string sessionId, CancellationToken cancellationToken);
}

/// <summary>Response from <see cref="IPaymentProvider.CreateSessionAsync"/>.</summary>
/// <param name="SessionId">Opaque provider session id.</param>
/// <param name="RedirectUrl">URL the SPA must redirect the browser to.</param>
public sealed record RedirectResponse(string SessionId, string RedirectUrl);

/// <summary>Tokenised payment instrument data — the only payment fields Acme is permitted to store.</summary>
/// <param name="Token">Opaque provider token.</param>
/// <param name="Last4">Last 4 digits of the card.</param>
/// <param name="Bin">First 6 digits (BIN).</param>
/// <param name="CardBrand">Brand (visa/mc/amex).</param>
/// <param name="ExpiryYearMonth">Expiry as YYYY-MM.</param>
public sealed record PaymentToken(
    string Token, string Last4, string Bin, string CardBrand, string ExpiryYearMonth);
