using Serilog;
using Serilog.Configuration;
using Serilog.Core;
using Serilog.Events;

namespace NoviMart.Infrastructure.Logging;

/// <summary>
/// Serilog configuration helpers. The <see cref="ForbiddenFieldRedactionEnricher"/> drops any log
/// property whose name matches one of the PCI-forbidden tokens
/// (<c>pan/cardnumber/cvv/cvc/cardholder/track</c>) before sinks ever see it.
/// </summary>
public static class SerilogConfig
{
    /// <summary>Adds the forbidden-field redaction enricher to a Serilog enricher configuration.</summary>
    public static LoggerConfiguration WithForbiddenFieldRedaction(this LoggerEnrichmentConfiguration enrich)
    {
        ArgumentNullException.ThrowIfNull(enrich);
        return enrich.With<ForbiddenFieldRedactionEnricher>();
    }
}

/// <summary>Drops any log property whose name matches a PCI-forbidden token.</summary>
public sealed class ForbiddenFieldRedactionEnricher : ILogEventEnricher
{
    private static readonly string[] ForbiddenTokens =
    [
        "pan",
        "cardnumber",
        "cvv",
        "cvc",
        "cardholder",
        "track",
    ];

    /// <inheritdoc />
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        ArgumentNullException.ThrowIfNull(logEvent);
        var toRemove = new List<string>();
        foreach (var prop in logEvent.Properties)
        {
            foreach (var token in ForbiddenTokens)
            {
                if (prop.Key.Contains(token, StringComparison.OrdinalIgnoreCase))
                {
                    toRemove.Add(prop.Key);
                    break;
                }
            }
        }
        foreach (var key in toRemove)
        {
            logEvent.RemovePropertyIfPresent(key);
        }
    }
}
