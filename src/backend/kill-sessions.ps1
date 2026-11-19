<#
.SYNOPSIS
    Kills running Caldova Wealth demo processes that lock build outputs.

.DESCRIPTION
    During iterative development, `dotnet build` / `dotnet run` against the
    backend often fails with MSB3026/MSB3027 errors like:

        The process cannot access the file
        'C:\...\src\backend\bin\Debug\net10.0\cs-agent.dll' because it is
        being used by another process. The file is locked by: "cs-backend (12345)"

    This happens when a previous `dotnet run` (or the debugger) is still
    holding the DLLs. This script stops any matching processes so the next
    build can succeed.

    By default it targets:
      - cs-backend
      - cs-agent
      - dotnet (only when running one of the above projects)

.PARAMETER IncludeAllDotnet
    If set, kills ALL `dotnet` processes regardless of what they are running.
    Use with caution — this can also stop unrelated dotnet tools.

.EXAMPLE
    .\kill-sessions.ps1

.EXAMPLE
    .\kill-sessions.ps1 -IncludeAllDotnet
#>
[CmdletBinding()]
param(
    [switch]$IncludeAllDotnet
)

$ErrorActionPreference = 'Stop'

$targetNames = @('cs-backend', 'cs-agent')
$killed = @()

# 1. Direct process names (the published / built executables).
foreach ($name in $targetNames) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        try {
            Write-Host "Stopping $($p.ProcessName) (PID $($p.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
            $killed += $p
        }
        catch {
            Write-Warning "Failed to stop PID $($p.Id): $_"
        }
    }
}

# 2. `dotnet` host processes running our projects.
$dotnetProcs = Get-CimInstance Win32_Process -Filter "Name = 'dotnet.exe'" -ErrorAction SilentlyContinue
foreach ($d in $dotnetProcs) {
    $cmd = $d.CommandLine
    if (-not $cmd) { continue }

    $isOurs = $IncludeAllDotnet -or
              ($cmd -match 'cs-backend') -or
              ($cmd -match 'cs-agent') -or
              ($cmd -match 'caldova-super')

    if ($isOurs) {
        try {
            Write-Host "Stopping dotnet host (PID $($d.ProcessId))..." -ForegroundColor Yellow
            Write-Host "  CommandLine: $cmd" -ForegroundColor DarkGray
            Stop-Process -Id $d.ProcessId -Force -ErrorAction Stop
            $killed += [pscustomobject]@{ ProcessName = 'dotnet'; Id = $d.ProcessId }
        }
        catch {
            Write-Warning "Failed to stop PID $($d.ProcessId): $_"
        }
    }
}

if ($killed.Count -eq 0) {
    Write-Host "No matching Caldova Wealth demo processes were running." -ForegroundColor Green
}
else {
    # Give the OS a moment to release file handles.
    Start-Sleep -Milliseconds 750
    Write-Host ""
    Write-Host "Stopped $($killed.Count) process(es). Build outputs are now unlocked." -ForegroundColor Green
}
