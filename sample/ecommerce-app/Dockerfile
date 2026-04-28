# syntax=docker/dockerfile:1.7
# ============================================================================
# Acme Retail API — multi-stage Dockerfile
# Builds the .NET minimal-API into an Alpine runtime image with non-root user,
# read-only root FS expectations, and a TCP healthcheck wired to /livez.
#
# .NET 10 is the target runtime per .eas/instruction.md (approvedRuntimes).
# If 10.x preview tags are unavailable in the build environment, swap the
# build base to mcr.microsoft.com/dotnet/sdk:9.0-alpine and the runtime base
# to mcr.microsoft.com/dotnet/aspnet:9.0-alpine — the API targets net10.0
# but is source-compatible with net9.0 (documented in /docs/runtime.md).
# ============================================================================

ARG DOTNET_SDK_TAG=10.0-preview-alpine
ARG DOTNET_RUNTIME_TAG=10.0-preview-alpine

# ---------- Build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build
WORKDIR /src

# Copy solution + projects first to leverage Docker layer caching.
COPY backend/Acme.Retail.sln ./
COPY backend/src ./src
COPY backend/tests ./tests

RUN dotnet restore ./src/Acme.Retail.Api/Acme.Retail.Api.csproj

RUN dotnet publish ./src/Acme.Retail.Api/Acme.Retail.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false \
    /p:TreatWarningsAsErrors=true

# ---------- Runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime
WORKDIR /app

# curl for the HEALTHCHECK; remove apk cache to keep image lean.
RUN apk add --no-cache curl=~8 && \
    addgroup -S -g 1000 acme && \
    adduser  -S -u 1000 -G acme acme && \
    mkdir -p /tmp && chown acme:acme /tmp

COPY --from=build --chown=acme:acme /app/publish ./

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:8080 \
    PORT=8080 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0 \
    DOTNET_gcServer=1

# Non-root, low-privilege.
USER 1000:1000

EXPOSE 8080

# Liveness probe; Container Apps also issues HTTP probes per containerapps.bicep.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8080/livez || exit 1

ENTRYPOINT ["dotnet", "Acme.Retail.Api.dll"]
