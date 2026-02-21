# VealBiz Docker Helper for Windows PowerShell
# This script provides alternatives to Makefile commands for Windows environments

param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'rebuild', 'logs', 'ps', 'migrate', 'seed', 'exec', 'health')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'

# Define color codes
$colors = @{
    'success' = @{ foreground = 'Green'; }
    'error'   = @{ foreground = 'Red'; }
    'info'    = @{ foreground = 'Cyan'; }
    'warning' = @{ foreground = 'Yellow'; }
}

function Write-Status {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [string]$Type = 'info'
    )
    $color = $colors[$Type]
    if ($color) {
        Write-Host $Message @color
    }
    else {
        Write-Host $Message
    }
}

function Show-Help {
    Write-Host @"
VealBiz Docker Helper for Windows PowerShell
=============================================

Usage: .\docker-helper.ps1 [command]

Commands:
  up           - Start Docker Compose (development)
  down         - Stop Docker Compose
  rebuild      - Rebuild Docker images
  logs         - Tail Docker logs
  ps           - Show Docker services status
  migrate      - Run Prisma migrations
  seed         - Seed database with sample data
  exec         - Execute command in container
  health       - Check service health
  help         - Show this help message

Examples:
  .\docker-helper.ps1 up
  .\docker-helper.ps1 logs
  .\docker-helper.ps1 migrate
  .\docker-helper.ps1 health
"@
}

function Test-DockerInstalled {
    try {
        $null = docker --version
        return $true
    }
    catch {
        Write-Status "Docker is not installed or not in PATH" 'error'
        return $false
    }
}

function Start-Services {
    Write-Status "🐳 Starting Docker Compose (development)..." 'info'
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Services started" 'success'
        Write-Status "   - PostgreSQL: localhost:5432" 'info'
        Write-Status "   - API: http://localhost:3000" 'info'
        Write-Status "   - Web: http://localhost:5173" 'info'
    }
    else {
        Write-Status "❌ Failed to start services" 'error'
        exit 1
    }
}

function Stop-Services {
    Write-Status "🛑 Stopping Docker Compose..." 'info'
    docker-compose down
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Services stopped" 'success'
    }
    else {
        Write-Status "❌ Failed to stop services" 'error'
        exit 1
    }
}

function Rebuild-Images {
    Write-Status "🔨 Rebuilding Docker images..." 'info'
    docker-compose build --no-cache
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Images rebuilt" 'success'
    }
    else {
        Write-Status "❌ Failed to rebuild images" 'error'
        exit 1
    }
}

function Show-Logs {
    Write-Status "📋 Tailing Docker logs (Press Ctrl+C to stop)..." 'info'
    docker-compose logs -f
}

function Show-Services {
    Write-Status "📊 Docker services:" 'info'
    docker-compose ps
}

function Run-Migrations {
    Write-Status "📦 Running Prisma migrations..." 'info'
    docker-compose exec -T api npx prisma migrate deploy
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Migrations complete" 'success'
    }
    else {
        Write-Status "❌ Migrations failed" 'error'
        exit 1
    }
}

function Seed-Database {
    Write-Status "🌱 Seeding database..." 'info'
    docker-compose exec -T api npm run seed
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "✅ Database seeded" 'success'
    }
    else {
        Write-Status "❌ Seeding failed" 'error'
        exit 1
    }
}

function Check-Health {
    Write-Status "🏥 Checking service health..." 'info'
    Write-Status "" 'info'
    
    # Check API
    Write-Status "API Health:" 'info'
    try {
        $response = curl -s http://localhost:3000/health
        Write-Status "✅ API responding: $response" 'success'
    }
    catch {
        Write-Status "❌ API not responding" 'error'
    }
    
    Write-Status "" 'info'
    
    # Check Docker services
    Write-Status "Docker Services:" 'info'
    docker-compose ps
}

# Main execution
if (-not (Test-DockerInstalled)) {
    exit 1
}

switch ($Command) {
    'up' { Start-Services }
    'down' { Stop-Services }
    'rebuild' { Rebuild-Images }
    'logs' { Show-Logs }
    'ps' { Show-Services }
    'migrate' { Run-Migrations }
    'seed' { Seed-Database }
    'health' { Check-Health }
    'help' { Show-Help }
    default {
        Write-Status "Unknown command: $Command" 'error'
        Write-Status "" 'info'
        Show-Help
        exit 1
    }
}
