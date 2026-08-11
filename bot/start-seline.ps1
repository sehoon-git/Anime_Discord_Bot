# Starts the local Seline Discord bot from this repository.
$ErrorActionPreference = 'Stop'

$repositoryRoot = $PSScriptRoot
$environmentFile = Join-Path $repositoryRoot '.env'
$runningBot = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -ieq 'node.exe' -and
    $_.CommandLine -match [regex]::Escape($repositoryRoot) -and
    $_.CommandLine -match 'src[\\/]bot[\\/]index\.ts'
}

if ($runningBot) {
    $processIds = ($runningBot.ProcessId -join ', ')
    throw "Seline is already running (Node process: $processIds). Close the existing instance before starting it again."
}

if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw "Missing environment file: $environmentFile"
}

Get-Content -LiteralPath $environmentFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) {
        return
    }

    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2].Trim()
        if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

Set-Location -LiteralPath $repositoryRoot
$restartExitCode = 75

do {
    Write-Host 'Starting Seline. Type help after the bot is ready.' -ForegroundColor Cyan
    & npm.cmd run start --workspace=@anime/discord-bot
    $botExitCode = $LASTEXITCODE

    if ($botExitCode -ne $restartExitCode) {
        Write-Host "Seline stopped (exit code: $botExitCode)." -ForegroundColor Yellow
        break
    }

    Write-Host 'Restarting Seline in this same console...' -ForegroundColor Cyan
    Start-Sleep -Seconds 1
} while ($true)
