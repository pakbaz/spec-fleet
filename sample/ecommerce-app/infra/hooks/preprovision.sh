#!/usr/bin/env sh
# preprovision.sh — runs before `azd provision`.
# Validates the Bicep templates so we surface issues before hitting ARM.
set -euo pipefail

echo "Preflight: validating Bicep..."
az bicep build --file infra/main.bicep --stdout > /dev/null
echo "  ok — main.bicep compiles clean"

echo "Preflight: complete"
