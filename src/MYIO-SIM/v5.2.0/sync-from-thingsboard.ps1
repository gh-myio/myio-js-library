# ============================================
# Sync Widgets from ThingsBoard to MYIO-SIM
# ============================================
# Copia conteudo do thingsboard_repo para myio-js-library-PROD
# e faz commit + push automaticamente
# ============================================

param(
    [switch]$DryRun = $false,
    [switch]$NoPush = $false
)

$ErrorActionPreference = "Stop"

# Paths
$TB_REPO = "C:\Projetos\GitHub\myio\thingsboard_repo.git"
$SOURCE_BASE = "$TB_REPO\widget_type"
$DEST_BASE = "C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\MYIO-SIM\v5.2.0"
$REPO_ROOT = "C:\Projetos\GitHub\myio\myio-js-library-PROD.git"

# Mapping: MYIO-SIM folder -> ThingsBoard widget folder
$MAPPING = @{
    "MAIN"                               = "widget_head_office_main_v_5_2_0"
    "HEADER"                             = "widget_head_office_header_v_5_2_0"
    "MENU"                               = "widget_head_office_menu_v_5_2_0"
    "FOOTER"                             = "widget_head_office_footer_v_5_2_0"
    "EQUIPMENTS"                         = "widget_head_office_equipments_v_5_2_0"
    "STORES"                             = "widget_head_office_stores_v_5_2_0"
    "ENERGY"                             = "widget_head_office_energy_v_5_2_0"
    "WATER"                              = "widget_head_office_water_v_5_2_0"
    "WATER_COMMON_AREA"                  = "widget_head_office_water_common_area_v_5_2_0"
    "WATER_STORES"                       = "widget_head_office_water_stores_v_5_2_0"
    "TEMPERATURE"                        = "widget_head_office_temperature_v_5_2_0"
    "TEMPERATURE_SENSORS"                = "widget_head_office_temperature_sensors_v_5_2_0"
    "TEMPERATURE_WITHOUT_CLIMATE_CONTROL" = "widget_head_office_temperature_without_climate_control_v_5_2_0"
    "WELCOME"                            = "widget_head_office_welcome_v_5_2_0"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Sync: ThingsBoard -> MYIO-SIM v5.2.0" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Nenhuma alteracao sera feita" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================
# STEP 1: Git pull from ThingsBoard repo
# ============================================
Write-Host "[STEP 1] Git pull em thingsboard_repo..." -ForegroundColor Cyan

Push-Location $TB_REPO

try {
    if (-not $DryRun) {
        git pull origin main
    }
    else {
        Write-Host "[DRY RUN] git pull origin main" -ForegroundColor Yellow
    }
    Write-Host "Git pull concluido!" -ForegroundColor Green
}
catch {
    Write-Host "Erro no git pull: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "[STEP 2] Copiando widgets..." -ForegroundColor Cyan
Write-Host ""

# Track stats
$copied = 0
$skipped = 0
$errors = 0

foreach ($entry in $MAPPING.GetEnumerator()) {
    $destFolder = $entry.Key
    $sourceFolder = $entry.Value

    $sourcePath = Join-Path $SOURCE_BASE $sourceFolder
    $destPath = Join-Path $DEST_BASE $destFolder

    Write-Host "[$destFolder]" -ForegroundColor White -NoNewline

    # Check if source exists
    if (-not (Test-Path $sourcePath)) {
        Write-Host " SKIP - Source not found: $sourceFolder" -ForegroundColor Yellow
        $skipped++
        continue
    }

    # Check if dest exists
    if (-not (Test-Path $destPath)) {
        Write-Host " SKIP - Dest not found: $destFolder" -ForegroundColor Yellow
        $skipped++
        continue
    }

    try {
        if (-not $DryRun) {
            # Copy all files from source to dest (overwrite)
            Copy-Item -Path "$sourcePath\*" -Destination $destPath -Recurse -Force
        }
        Write-Host " OK" -ForegroundColor Green
        $copied++
    }
    catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $errors++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Resultado: $copied copiados, $skipped ignorados, $errors erros" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] Finalizado - nenhum commit feito" -ForegroundColor Yellow
    exit 0
}

if ($errors -gt 0) {
    Write-Host "Erros encontrados. Abortando commit." -ForegroundColor Red
    exit 1
}

if ($copied -eq 0) {
    Write-Host "Nenhum arquivo copiado. Nada para commitar." -ForegroundColor Yellow
    exit 0
}

# ============================================
# STEP 3: Git commit + push in myio-js-library
# ============================================
Write-Host "[STEP 3] Git add + commit + push..." -ForegroundColor Cyan
Write-Host ""

Push-Location $REPO_ROOT

try {
    # Add all changes in v5.2.0
    git add "src/MYIO-SIM/v5.2.0/*"

    # Check if there are changes to commit
    $status = git status --porcelain "src/MYIO-SIM/v5.2.0/"

    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "Nenhuma alteracao detectada. Nada para commitar." -ForegroundColor Yellow
        Pop-Location
        exit 0
    }

    # Commit
    $commitMsg = "update all widgets myio-sim v5.2.0"
    git commit -m $commitMsg

    Write-Host ""
    Write-Host "Commit criado: $commitMsg" -ForegroundColor Green

    # Push (unless -NoPush flag)
    if (-not $NoPush) {
        Write-Host "Pushing to remote..." -ForegroundColor Cyan
        git push
        Write-Host "Push concluido!" -ForegroundColor Green
    }
    else {
        Write-Host "[NoPush] Commit criado mas NAO foi feito push" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Erro no git: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Sync completo!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
