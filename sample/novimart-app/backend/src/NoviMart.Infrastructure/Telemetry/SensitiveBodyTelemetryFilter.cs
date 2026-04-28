using Microsoft.ApplicationInsights.Channel;
using Microsoft.ApplicationInsights.DataContracts;
using Microsoft.ApplicationInsights.Extensibility;

namespace NoviMart.Infrastructure.Telemetry;

/// <summary>
/// Application Insights telemetry processor that drops request and dependency *bodies* on routes
/// covered by the PCI scope-reduction policy (<c>.specfleet/policies/pci.md</c> §2):
/// <list type="bullet">
///   <item><description><c>/payments</c></description></item>
///   <item><description><c>/checkout</c> and any sub-route</description></item>
///   <item><description><c>/account/payment-methods</c></description></item>
/// </list>
/// The metadata (URL path, status, duration) is preserved; only the *body* fields are scrubbed.
/// </summary>
public sealed class SensitiveBodyTelemetryFilter : ITelemetryProcessor
{
    private static readonly string[] ProtectedPathPrefixes =
    [
        "/payments",
        "/checkout",
        "/account/payment-methods",
        "/api/me/payment-methods",
    ];

    private readonly ITelemetryProcessor _next;

    /// <summary>Creates the processor in the chain.</summary>
    public SensitiveBodyTelemetryFilter(ITelemetryProcessor next)
    {
        ArgumentNullException.ThrowIfNull(next);
        _next = next;
    }

    /// <inheritdoc />
    public void Process(ITelemetry item)
    {
        if (item is RequestTelemetry request && IsProtected(request.Url?.AbsolutePath))
        {
            ScrubBody(request.Properties);
        }
        else if (item is DependencyTelemetry dependency && IsProtected(dependency.Data))
        {
            ScrubBody(dependency.Properties);
        }
        else if (item is TraceTelemetry trace
                 && trace.Properties.TryGetValue("RequestPath", out var path)
                 && IsProtected(path))
        {
            ScrubBody(trace.Properties);
        }

        _next.Process(item);
    }

    /// <summary>Public for unit-test access.</summary>
    public static bool IsProtected(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return false;
        }
        foreach (var prefix in ProtectedPathPrefixes)
        {
            if (path.Contains(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    private static void ScrubBody(IDictionary<string, string> properties)
    {
        // Drop common body-bearing properties that App Insights or middleware may attach.
        var bodyKeys = new[] { "RequestBody", "ResponseBody", "Body", "RawBody", "Payload" };
        foreach (var key in bodyKeys)
        {
            properties.Remove(key);
        }
    }
}
