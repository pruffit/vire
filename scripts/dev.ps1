#Requires -Version 5.1
<#
  VireMusic full dev startup:
    1. Docker infrastructure (postgres, redis, minio)
    2. MinIO bucket policies via minio-init
    3. Wait for Postgres
    4. DB migrations
    5. Web + worker dev servers (turbo)
#>

$ErrorActionPreference = "Stop"

function Step([string]$msg) {
    Write-Host ""
    Write-Host "  >> $msg" -ForegroundColor Cyan
}

function Die([string]$msg) {
    Write-Host ""
    Write-Host "  ERROR: $msg" -ForegroundColor Red
    exit 1
}

# --- 1. Infrastructure ---
Step "Starting infrastructure (postgres, redis, minio)..."
docker compose up -d postgres redis minio
if ($LASTEXITCODE -ne 0) { Die "docker compose failed" }

# --- 2. MinIO init (sets vire-stream as public) ---
Step "Applying MinIO configuration..."
docker compose run --rm minio-init
# exit 0 is expected; non-zero only if minio isn't reachable yet

# --- 3. Wait for Postgres ---
Step "Waiting for Postgres..."
$tries = 40
do {
    Start-Sleep -Milliseconds 500
    docker exec vire-postgres pg_isready -U vire -q 2>$null
    $tries--
} until ($LASTEXITCODE -eq 0 -or $tries -le 0)

if ($tries -le 0) { Die "Postgres did not become ready in time" }
Write-Host "  Postgres ready" -ForegroundColor Green

# --- 4. Migrations ---
Step "Running database migrations..."
pnpm --filter @vire/db db:migrate
if ($LASTEXITCODE -ne 0) { Die "Migration failed" }

# --- 5. Dev servers ---
Step "Starting dev servers (web + worker)..."
Write-Host ""
pnpm dev
