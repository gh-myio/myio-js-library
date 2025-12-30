#!/usr/bin/env bash
set -euo pipefail

# 5 nomes (como na imagem)
RAW_NAMES=(
  "Campinas Shopping G1/G2"
  "Campinas Shopping Subestação Principal"
  "Campinas Shopping Hidrometros G1/G2"
  "Campinas Shoppinas Hidrometros G0"
  "Campinas Shopping G0 NOVA"
)

# Arquivos .js que devem existir dentro de cada pasta
JS_FILES=(
  "statusSync.js"
  "attributesSync.js"
  "transformSlaveOutletDevices.js"
  "transformConsumptionReadingToDeviceUpdate.js"
  "transformCurrentReadingToDeviceUpdate.js"
  "transformVoltageReadingToDeviceUpdate.js"
  "mapDevicesPulsesWater.js"
)

normalize_name() {
  local input="$1"

  # 1) remove acentos (transliterate)
  # 2) remove / e \ e espaços (vira underscore)
  # 3) mantém só [a-z0-9_]
  # 4) normaliza underscores repetidos e tira underscores nas pontas
  echo "$input" \
    | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || true
}

normalize_name_safe() {
  local s
  s="$(normalize_name "$1")"
  echo "$s" \
    | tr '/\\' '_' \
    | tr ' ' '_' \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9_]+/_/g; s/_+/_/g; s/^_+|_+$//g'
}

for raw in "${RAW_NAMES[@]}"; do
  dir="$(normalize_name_safe "$raw")"

  mkdir -p "$dir"

  for f in "${JS_FILES[@]}"; do
    # cria o arquivo se não existir (não sobrescreve)
    if [[ ! -f "$dir/$f" ]]; then
      cat > "$dir/$f" <<EOF
'use strict';

// ${f}
// TODO: implement

module.exports = {};
EOF
    fi
  done

  echo "OK: $raw -> $dir"
done

echo "Concluído."
