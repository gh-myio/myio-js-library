# Script para limpar linhas de stack trace do log
# Usage: .\clean-log.ps1 [inputFile]
# Example: .\clean-log.ps1 dashboard.myio-bas.com-1761158233079.log

param(
    [Parameter(Position=0)]
    [string]$inputFile
)

# Se não foi passado parâmetro, procurar o arquivo .log mais recente
if ([string]::IsNullOrEmpty($inputFile)) {
    $logFiles = Get-ChildItem -Path "." -Filter "*.log" | Where-Object { $_.Name -notlike "*-CLEAN.log" } | Sort-Object LastWriteTime -Descending

    if ($logFiles.Count -eq 0) {
        Write-Host "[ERROR] Nenhum arquivo .log encontrado no diretorio atual" -ForegroundColor Red
        exit 1
    }

    $inputFile = $logFiles[0].Name
    Write-Host "[INFO] Arquivo nao especificado. Usando o mais recente: $inputFile" -ForegroundColor Yellow
}

# Verificar se o arquivo existe
if (-not (Test-Path $inputFile)) {
    Write-Host "[ERROR] Arquivo nao encontrado: $inputFile" -ForegroundColor Red
    exit 1
}

# Gerar nome do arquivo de saída
$outputFile = $inputFile -replace '\.log$', '-CLEAN.log'

Write-Host ""
Write-Host "Limpando arquivo de log..." -ForegroundColor Cyan
Write-Host "Input:  $inputFile" -ForegroundColor Gray
Write-Host "Output: $outputFile" -ForegroundColor Gray
Write-Host ""

# Padrões para filtrar (linhas que devem ser REMOVIDAS)
$patterns = @(
    '@ VM\d+',                    # @ VM938 polyfills-5W6QH7SK.js:1
    'invokeTask @',               # invokeTask @ VM938 polyfills-5W6QH7SK.js:1
    'runTask @',                  # runTask @ VM938 polyfills-5W6QH7SK.js:1
    '\.useG\.invoke @',           # _.useG.invoke @ VM938 polyfills-5W6QH7SK.js:1
    '\.<computed> @',             # n.<computed> @ VM938 polyfills-5W6QH7SK.js:1
    'p\.<computed> @',            # p.<computed> @ VM938 polyfills-5W6QH7SK.js:1
    'checkOrchestratorReady @',   # checkOrchestratorReady @ VM1446:164
    '\(anonymous\) @',            # (anonymous) @ VM938 polyfills-5W6QH7SK.js:1
    '@ chunk-[A-Z0-9]+\.js:\d+$', # @ chunk-O2ERKNLN.js:3
    '@ polyfills-[A-Z0-9]+\.js:\d+$', # @ polyfills-5W6QH7SK.js:1
    '^next @ chunk-',             # next @ chunk-O2ERKNLN.js:3
    '^_next @ chunk-',            # _next @ chunk-O2ERKNLN.js:3
    '^po @ chunk-',               # po @ chunk-O2ERKNLN.js:3
    '^u @ polyfills-',            # u @ polyfills-5W6QH7SK.js:1
    '^scheduleTask @ ',           # scheduleTask @ polyfills-5W6QH7SK.js:1
    '^scheduleMacroTask @ ',      # scheduleMacroTask @ polyfills-5W6QH7SK.js:1
    '^Tt @ polyfills-',           # Tt @ polyfills-5W6QH7SK.js:1
    '^rafSupported\.rafFunction @', # rafSupported.rafFunction @ chunk-5T4PGUXE.js:95
    '^\w{1,3} @ (chunk|polyfills)-[A-Z0-9]+\.js:\d+$', # Qualquer função curta (1-3 letras) @ chunk/polyfills
    '^\w{1,3} @ [a-f0-9]+-[a-f0-9]+\.js:\d+$',       # or @ fd9d1056-20ecbefacf915056.js:1 (hash filenames)
    '^\w{1,3} @ page-[a-f0-9]+\.js:\d+$',           # O @ page-855558f1d0d6946e.js:1
    '^[\w#\.]+\s*@\s*\d+-[a-f0-9]+\.js:\d+$',       # request @ 34-88b3f52306e892b1.js:1 (numbered hash files)
    '^await in \w+$',                               # await in request
    '^overrideMethod @ installHook\.js:\d+$',       # overrideMethod @ installHook.js:1
    '^window\.console\.\w+ @ \d+-[a-f0-9]+\.js:\d+$' # window.console.error @ 117-cd033fadff6bee47.js:1
    '^setTimeout$',                 # Linha contendo apenas "setTimeout"
    '^setInterval$',                # Linha contendo apenas "setInterval"
    '^requestAnimationFrame$',      # Linha contendo apenas "requestAnimationFrame"
    '^Promise\.then$',              # Linha contendo apenas "Promise.then"
    '^Promise\.catch$',             # Linha contendo apenas "Promise.catch"
    '^async function$',             # Linha contendo apenas "async function"
    '^\s*$'                         # Linhas em branco
)

# Contador
$linesRead = 0
$linesKept = 0

# Processar arquivo linha por linha
Get-Content $inputFile | ForEach-Object {
    $linesRead++
    $line = $_
    $shouldKeep = $true

    # Verificar se a linha corresponde a algum padrão de exclusão
    foreach ($pattern in $patterns) {
        if ($line -match $pattern) {
            $shouldKeep = $false
            break
        }
    }

    # Manter a linha se não corresponder a nenhum padrão
    if ($shouldKeep) {
        $linesKept++
        $line
    }

    # Mostrar progresso a cada 1000 linhas
    if ($linesRead % 1000 -eq 0) {
        Write-Host "Processadas $linesRead linhas..." -ForegroundColor Yellow -NoNewline
        Write-Host "`r" -NoNewline
    }
} | Set-Content $outputFile -Encoding UTF8

Write-Host ""
Write-Host "Limpeza concluida!" -ForegroundColor Green
Write-Host "Linhas lidas: $linesRead" -ForegroundColor Cyan
Write-Host "Linhas mantidas: $linesKept" -ForegroundColor Cyan
Write-Host "Linhas removidas: $($linesRead - $linesKept)" -ForegroundColor Yellow
Write-Host "Arquivo limpo salvo em: $outputFile" -ForegroundColor Green
