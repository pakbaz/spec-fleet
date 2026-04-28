namespace NoviMart.Infrastructure.Auth;

/// <summary>Authentication scheme names registered by <c>AddCustomerAuth</c> and <c>AddAdminAuth</c>.</summary>
public static class AuthSchemes
{
    /// <summary>Customer (Entra External ID) bearer scheme.</summary>
    public const string Customer = "Customer";

    /// <summary>Admin (Entra ID) bearer scheme.</summary>
    public const string Admin = "Admin";

    /// <summary>Combined challenge scheme — accepts either above.</summary>
    public const string CombinedChallenge = "Customer,Admin";
}

/// <summary>Authorization policy names.</summary>
public static class AuthPolicies
{
    /// <summary>Requires a customer principal (Entra External ID).</summary>
    public const string RequireCustomer = "RequireCustomer";

    /// <summary>Requires an admin principal (Entra ID).</summary>
    public const string RequireAdmin = "RequireAdmin";

    /// <summary>Requires that the caller's <c>oid</c>/<c>sub</c> claim matches the <c>{customerId}</c> route value.</summary>
    public const string OwnsResource = "OwnsResource";
}

/// <summary>Configuration section for an Entra OIDC issuer.</summary>
public sealed class EntraAuthOptions
{
    /// <summary>OIDC authority URL (no trailing slash). E.g., <c>https://login.ciamlogin.com/{tenantId}/v2.0</c>.</summary>
    public string Authority { get; set; } = string.Empty;

    /// <summary>Expected token audience (e.g., <c>api://novimart-api</c>).</summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>For admin auth: required role/app-role names.</summary>
    public IList<string> RequiredRoles { get; } = [];
}
