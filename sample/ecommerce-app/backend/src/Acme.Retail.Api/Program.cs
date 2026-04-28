using Acme.Retail.Api.Configuration;
using Acme.Retail.Api.Endpoints;
using Acme.Retail.Infrastructure.Auth;
using Acme.Retail.Infrastructure.Logging;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Logging — Serilog with PCI forbidden-field redaction (per .eas/policies/pci.md)
// ---------------------------------------------------------------------------
builder.Host.UseSerilog((ctx, sp, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName()
    .Enrich.WithForbiddenFieldRedaction()
    .WriteTo.Console(formatProvider: System.Globalization.CultureInfo.InvariantCulture));

// ---------------------------------------------------------------------------
// Telemetry — OpenTelemetry → Azure Monitor (App Insights) when configured
// ---------------------------------------------------------------------------
builder.Services.AddAcmeTelemetry(builder.Configuration);

// ---------------------------------------------------------------------------
// Infrastructure — Cosmos, repositories, payment provider
// ---------------------------------------------------------------------------
builder.Services.AddAcmeInfrastructure(builder.Configuration);

// ---------------------------------------------------------------------------
// Auth — Entra External ID (customers) + Entra ID (admins)
// ---------------------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddCustomerAuth(builder.Configuration);
builder.Services.AddAdminAuth(builder.Configuration);

// ---------------------------------------------------------------------------
// Web — problem details, OpenAPI, CORS (explicit origin allowlist), antiforgery
// ---------------------------------------------------------------------------
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddAntiforgery();

const string CorsPolicy = "spa";
builder.Services.AddCors(options =>
{
    var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    options.AddPolicy(CorsPolicy, policy =>
    {
        if (origins.Length == 0)
        {
            // Dev fallback — local Vite dev server. Production must specify Cors:AllowedOrigins explicitly
            // (no wildcards permitted per .eas/policies/zero-trust.md §3).
            policy.WithOrigins("http://localhost:5173", "https://localhost:5173");
        }
        else
        {
            policy.WithOrigins(origins);
        }
        policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder.Services.AddHealthChecks();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
app.UseSerilogRequestLogging();

app.UseExceptionHandler(errorApp => errorApp.Run(async ctx =>
{
    var feature = ctx.Features.Get<IExceptionHandlerFeature>();
    var problem = new ProblemDetails
    {
        Status = StatusCodes.Status500InternalServerError,
        Title = "Internal server error",
        Type = "https://datatracker.ietf.org/doc/html/rfc7231#section-6.6.1",
        Detail = app.Environment.IsDevelopment() ? feature?.Error.ToString() : null,
    };
    ctx.Response.StatusCode = problem.Status.Value;
    ctx.Response.ContentType = "application/problem+json";
    await ctx.Response.WriteAsJsonAsync(problem).ConfigureAwait(false);
}));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
var api = app.MapGroup("/api/v1");
api.MapProductsEndpoints();
api.MapCategoriesEndpoints();
api.MapCartEndpoints();

app.MapHealthChecks("/healthz/live");
app.MapHealthChecks("/healthz/ready");

app.Run();

/// <summary>Program type exposed for <c>WebApplicationFactory&lt;Program&gt;</c> integration tests.</summary>
public partial class Program { }
