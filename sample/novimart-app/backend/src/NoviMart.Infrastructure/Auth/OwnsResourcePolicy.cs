using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace NoviMart.Infrastructure.Auth;

/// <summary>Authorization requirement: caller's id claim matches a route-bound <c>{customerId}</c>.</summary>
public sealed class OwnsResourceRequirement : IAuthorizationRequirement
{
}

/// <summary>
/// Handler for <see cref="OwnsResourceRequirement"/>. Compares the caller's <c>oid</c> (preferred) or
/// <c>sub</c> claim against the <c>customerId</c> route value. Per <c>.specfleet/policies/zero-trust.md</c> §2,
/// customers may access only their own data.
/// </summary>
public sealed class OwnsResourceHandler : AuthorizationHandler<OwnsResourceRequirement>
{
    private readonly IHttpContextAccessor _accessor;

    /// <summary>Creates a handler.</summary>
    public OwnsResourceHandler(IHttpContextAccessor accessor)
    {
        ArgumentNullException.ThrowIfNull(accessor);
        _accessor = accessor;
    }

    /// <inheritdoc />
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, OwnsResourceRequirement requirement)
    {
        ArgumentNullException.ThrowIfNull(context);
        var http = _accessor.HttpContext;
        if (http is null)
        {
            return Task.CompletedTask;
        }

        var routeValue = http.Request.RouteValues.TryGetValue("customerId", out var raw)
            ? raw?.ToString()
            : null;
        if (string.IsNullOrWhiteSpace(routeValue))
        {
            // No customerId on this route — policy is not applicable here; let other policies decide.
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var oid = context.User.FindFirst("oid")?.Value
            ?? context.User.FindFirst("sub")?.Value;

        if (!string.IsNullOrEmpty(oid)
            && string.Equals(oid, routeValue, StringComparison.OrdinalIgnoreCase))
        {
            context.Succeed(requirement);
        }
        return Task.CompletedTask;
    }
}
