# Starts a THROW-AWAY copy of the whole stack (own project name, own ports, own empty database), runs every live
# check against it and removes it again. The real stack and its data are never touched.
#
#   powershell -File scripts\verify-stack.ps1              # needs Docker, Node 18+ and the backend's .venv
#   powershell -File scripts\verify-stack.ps1 -Keep        # leave the throw-away stack running to look at it
#
# What it runs: scripts/e2e_check.py (registration -> panel -> status -> course limit -> landing page content),
# front/scripts/check-security-headers.mjs (public site) and admin/scripts/check-security-headers.mjs (admin origin).
param(
    [string]$Project = 'kidsup_check',
    [int]$FrontPort = 18080,
    [int]$AdminPort = 18081,
    [switch]$Keep
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($Project -eq 'kidsup') {
    throw "Refusing to use the real project's name ('kidsup'): this check creates test accounts and test data."
}
$python = Join-Path $root 'back\.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw "The backend's virtual environment is missing ($python): see back/CLAUDE.md." }

# Other ports, other private ranges and the matching admin origin, so it can run next to the real stack.
$env:FRONT_PORT = "$FrontPort"
$env:ADMIN_PORT = "$AdminPort"
$env:APP_SUBNET = '172.29.251.0/28'
$env:ADMIN_SUBNET = '172.29.251.16/28'
$env:ADMIN_ORIGINS = "[`"http://127.0.0.1:$AdminPort`",`"http://localhost:$AdminPort`"]"

$failed = $false
try {
    # --build: the check must run the code as it is now, never an image left from an earlier run.
    docker compose -p $Project up -d --build
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }

    # The two nginx containers need a moment after the stack reports healthy.
    $ready = $false
    for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$FrontPort/content/courses.json" | Out-Null
            Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$AdminPort/" | Out-Null
            $ready = $true
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { throw 'the throw-away stack did not answer' }

    & $python scripts\e2e_check.py --project $Project --public "http://127.0.0.1:$FrontPort" --admin "http://127.0.0.1:$AdminPort"
    if ($LASTEXITCODE -ne 0) { $failed = $true }
    node front\scripts\check-security-headers.mjs "http://127.0.0.1:$FrontPort" | Select-Object -Last 3
    if ($LASTEXITCODE -ne 0) { $failed = $true }
    node admin\scripts\check-security-headers.mjs "http://127.0.0.1:$AdminPort" | Select-Object -Last 3
    if ($LASTEXITCODE -ne 0) { $failed = $true }
}
finally {
    if ($Keep) {
        Write-Host "Left running as project '$Project' (public :$FrontPort, admin :$AdminPort). Remove it with: docker compose -p $Project down -v"
    } else {
        docker compose -p $Project down -v --remove-orphans
    }
}
if ($failed) { Write-Host 'SOME CHECKS FAILED' -ForegroundColor Red; exit 1 }
Write-Host 'ALL LIVE CHECKS PASSED' -ForegroundColor Green
