#!/bin/bash
# metrics-snapshot.sh — coleta métricas do sistema e salva em /tmp
# Uso: bash metrics-snapshot.sh
# Ou com cron: */30 * * * * bash /path/to/metrics-snapshot.sh

LOG=/tmp/metrics-$(date +%Y%m%d-%H%M%S).log

{
  echo "=============================="
  echo " METRICS SNAPSHOT"
  echo " $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=============================="

  echo ""
  echo "--- UPTIME / LOAD ---"
  uptime
  echo ""
  cat /proc/loadavg

  echo ""
  echo "--- MEMÓRIA (free -m) ---"
  free -m

  echo ""
  echo "--- TEMPERATURA ---"
  for zone in /sys/class/thermal/thermal_zone*/temp; do
    name=$(cat "$(dirname "$zone")/type" 2>/dev/null || echo "zone")
    raw=$(cat "$zone" 2>/dev/null)
    if [ -n "$raw" ]; then
      temp=$(awk "BEGIN {printf \"%.1f\", $raw/1000}")
      echo "  $name: ${temp}°C"
    fi
  done

  echo ""
  echo "--- DISCO (df -h) ---"
  df -h --exclude-type=tmpfs --exclude-type=devtmpfs 2>/dev/null || df -h

  echo ""
  echo "--- TOP 10 PROCESSOS POR MEMÓRIA ---"
  ps aux --sort=-%mem | head -11

  echo ""
  echo "--- TOP 10 PROCESSOS POR CPU ---"
  ps aux --sort=-%cpu | head -11

  echo ""
  echo "--- REDE (bytes tx/rx) ---"
  cat /proc/net/dev | grep -v "lo:" | awk 'NR>2 {
    printf "  %-12s RX: %s bytes  TX: %s bytes\n", $1, $2, $10
  }'

  echo ""
  echo "=============================="
  echo " END"
  echo "=============================="

} > "$LOG" 2>&1

echo "Salvo em: $LOG"
