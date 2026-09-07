$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$testApp = Join-Path $workspace 'test-app'

Push-Location $workspace
try {
    $env:ULIBOT_EVALUATION_API_ENABLED = 'true'
    docker compose --profile evaluation up -d backdb ulibotback ulibot-eval-worker
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudieron iniciar el backend y el worker de evaluación locales.'
    }

    $apiReady = $false
    foreach ($attempt in 1..180) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/docs' -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $apiReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $apiReady) {
        throw 'El backend local no estuvo listo a tiempo. Revisa: docker compose logs ulibotback'
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $testApp 'node_modules\.bin\vite.cmd'))) {
    throw 'Faltan las dependencias del visor. Ejecuta npm install dentro de test-app una sola vez.'
}

$env:ULIBOT_EVAL_VIEWER = '1'
Push-Location $testApp
try {
    npm.cmd run dev -- --open /evaluations --host localhost
}
finally {
    Pop-Location
}
