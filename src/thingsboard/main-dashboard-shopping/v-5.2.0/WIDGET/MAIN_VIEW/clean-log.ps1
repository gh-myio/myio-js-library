# Script para limpar linhas de stack trace do log
$inputFile = "dashboard.myio-bas.com-1761152489200.log"
$outputFile = "dashboard.myio-bas.com-1761152489200-CLEAN.log"

Write-Host "Limpando arquivo de log..." -ForegroundColor Cyan
Write-Host "Input: $inputFile" -ForegroundColor Gray
Write-Host "Output: $outputFile" -ForegroundColor Gray

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
    '^setTimeout$',                 # Linha contendo apenas "setTimeout"
    '^setInterval$',                # Linha contendo apenas "setInterval"
    '^requestAnimationFrame$',      # Linha contendo apenas "requestAnimationFrame"
    '^Promise\.then$',              # Linha contendo apenas "Promise.then"
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

Write-Host "`n"
Write-Host "Limpeza concluída!" -ForegroundColor Green
Write-Host "Linhas lidas: $linesRead" -ForegroundColor Cyan
Write-Host "Linhas mantidas: $linesKept" -ForegroundColor Cyan
Write-Host "Linhas removidas: $($linesRead - $linesKept)" -ForegroundColor Yellow
Write-Host "Arquivo limpo salvo em: $outputFile" -ForegroundColor Green
