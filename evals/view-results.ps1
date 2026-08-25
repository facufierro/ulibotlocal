$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSScriptRoot
$testApp = Join-Path $workspace 'test-app'

Push-Location $workspace
try {
    $env:ULIBOT_EVALUATION_API_ENABLED = 'true'
    docker compose up -d backdb ulibotback
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo iniciar el backend local de UliBot.'
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
    npm.cmd run dev -- --open /evaluations
}
finally {
    Pop-Location
}
