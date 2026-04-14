# Fix Temp Registry — Execution Log
**Central:** Souza Aguiar — CO2
**Data:** 2026-04-13
**SSH:** `ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa`

---

## Batch 1 — `fix-temp-registry-batch1-2026-04-13.sql`

Executado via `psql -U hubot -f /tmp/fix.sql`

| Row | Ambiente | slave antigo → novo | offset | Rows migrados | Status |
|-----|----------|---------------------|--------|---------------|--------|
| row_020 | Centro Cirúrgico 04 | 44 → 45 | -7 | 448.256 | ✅ |
| row_021 | CTI 01 | 88 → 87 | -2 | 198.415 | ✅ |
| row_025 | Tomografia | 132 → 133 | -6 | 332.497 | ✅ |
| row_024 | Raio-X 01 | 103 → 102 | -5 | 464.170 | ✅ |
| row_027 | Hemodiálise | 130 → 131 | -6 | 246.415 | ✅ |
| row_028 | Agência Transfusional | 137 → 138 | -5 | 169.533 | ✅ |
| row_029 | CTI 04 | 84 → 91 | -5 | 235.083 | ✅ |

**Total histórico migrado:** 2.094.369 registros
**Nomes:** 14 × UPDATE 1 (7 pares OLD + novo) ✅
**Transação:** COMMIT ✅

---

## Avulsos executados diretamente no psql

| Row | Ambiente | slave antigo → novo | offset | Rows migrados | Status |
|-----|----------|---------------------|--------|---------------|--------|
| row_022 | CTI 02 | 144 → 152 | -4 | 202.492 | ✅ |

---

## Batch 2 — `fix-souza-aguiar-last-90-days.sql`

Executado via `psql -U hubot -f /tmp/fix-souza-aguiar-last-90-days.sql`

| Row | Ambiente | slave antigo → novo | offset | Rows migrados | Status |
|-----|----------|---------------------|--------|---------------|--------|
| row_026 | Raio-X 3 | 105 → 104 | -4 | 502.863 | ✅ |
| row_023 | Raio-X 4 | 99 → 100 | -5 | 464.519 | ✅ |

**Total histórico migrado:** 967.382 registros
**Nomes:** 4 × UPDATE 1 (2 pares OLD + novo) ✅
**Transação:** COMMIT ✅

---

## Resumo geral

| Métrica | Valor |
|---------|-------|
| Rows concluídas nesta sessão | 10 |
| Total registros `temperature_history` migrados | 3.264.243 |
| Slaves renomeados (OLD) | 10 |
| Slaves renomeados (novo) | 10 |
