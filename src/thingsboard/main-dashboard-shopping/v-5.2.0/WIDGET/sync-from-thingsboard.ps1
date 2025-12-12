# ============================================
# Sync Widgets from ThingsBoard to Shopping Dashboard
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
$DEST_BASE = "C:\Projetos\GitHub\myio\myio-js-library-PROD.git\src\thingsboard\main-dashboard-shopping\v-5.2.0\WIDGET"
$REPO_ROOT = "C:\Projetos\GitHub\myio\myio-js-library-PROD.git"

# Mapping: Shopping Dashboard folder -> ThingsBoard widget folder
$MAPPING = @{
    "MAIN_VIEW"      = "widget_shopping_dashboard_main_view_v_5_2_0"
    "HEADER"         = "widget_shopping_dashboard_header_v_5_2_0"
    "MENU"           = "widget_shopping_dashboard_menu_v_5_2_0"
    "TELEMETRY"      = "widget_shopping_dashboard_telemetry_v_5_2_0"
    "TELEMETRY_INFO" = "widget_shopping_dashboard_info_v_5_2_0"
    "FOOTER"         = "widget_shopping_dashboard_footer_v_5_2_0"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Sync: ThingsBoard -> Shopping Dashboard v5.2.0" -ForegroundColor Cyan
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
    # Add all changes in shopping dashboard
    git add "src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/*"

    # Check if there are changes to commit
    $status = git status --porcelain "src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/"

    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "Nenhuma alteracao detectada. Nada para commitar." -ForegroundColor Yellow
        Pop-Location
        exit 0
    }

    # Commit
    $commitMsg = "update all widgets shopping-dashboard v5.2.0"
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
