using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace Acme.Retail.Infrastructure.Auth;

/// <summary>
/// DI extension methods that wire up Entra External ID (customers) and Entra ID (admins) JWT bearer
/// authentication. Per <c>.eas/policies/zero-trust.md</c> §1: NO client secrets, authority + audience only.
/// </summary>
public static class EntraAuthExtensions
{
    /// <summary>Registers the customer (Entra External ID) bearer scheme + <c>RequireCustomer</c> policy.</summary>
    public static IServiceCollection AddCustomerAuth(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        var section = configuration.GetSection("Auth:Customer");
        services.Configure<EntraAuthOptions>(AuthSchemes.Customer, section);

        services.AddAuthentication()
            .AddJwtBearer(AuthSchemes.Customer, options =>
            {
                options.Authority = section["Authority"];
                options.Audience = section["Audience"];
                options.RequireHttpsMetadata = true;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = "name",
                    RoleClaimType = "roles",
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(AuthPolicies.RequireCustomer, p =>
            {
                p.AuthenticationSchemes = [AuthSchemes.Customer];
                p.RequireAuthenticatedUser();
            })
            .AddPolicy(AuthPolicies.OwnsResource, p =>
            {
                p.AuthenticationSchemes = [AuthSchemes.Customer];
                p.RequireAuthenticatedUser();
                p.AddRequirements(new OwnsResourceRequirement());
            });

        services.AddSingleton<IAuthorizationHandler, OwnsResourceHandler>();
        return services;
    }

    /// <summary>Registers the admin (Entra ID) bearer scheme + <c>RequireAdmin</c> policy.</summary>
    public static IServiceCollection AddAdminAuth(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        var section = configuration.GetSection("Auth:Admin");
        services.Configure<EntraAuthOptions>(AuthSchemes.Admin, section);

        services.AddAuthentication()
            .AddJwtBearer(AuthSchemes.Admin, options =>
            {
                options.Authority = section["Authority"];
                options.Audience = section["Audience"];
                options.RequireHttpsMetadata = true;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = "name",
                    RoleClaimType = "roles",
                };
            });

        var requiredRoles = section.GetSection("RequiredRoles").Get<string[]>() ?? [];
        services.AddAuthorizationBuilder()
            .AddPolicy(AuthPolicies.RequireAdmin, p =>
            {
                p.AuthenticationSchemes = [AuthSchemes.Admin];
                p.RequireAuthenticatedUser();
                if (requiredRoles.Length > 0)
                {
                    p.RequireRole(requiredRoles);
                }
            });

        return services;
    }
}
