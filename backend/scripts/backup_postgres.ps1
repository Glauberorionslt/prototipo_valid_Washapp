param(
    [string]$OutputDir = ".\\backups"
)

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^(?<key>[A-Z0-9_]+)=(?<value>.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches.key, $matches.value)
        }
    }
}

$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "127.0.0.1" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5433" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "washapp2" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }

if (-not $env:DB_PASSWORD) {
    throw "DB_PASSWORD nao configurada no ambiente ou no arquivo .env"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$target = Join-Path $OutputDir "washapp2_$timestamp.dump"

$env:PGPASSWORD = $env:DB_PASSWORD
pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -F c -f $target

if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar pg_dump"
}

Write-Output "Backup gerado em $target"