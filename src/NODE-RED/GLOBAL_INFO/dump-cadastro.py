#!/usr/bin/env python3
"""
dump-cadastro.py — dump do cadastro de QUALQUER central para JSON
Runbook: runbook-dump-cadastro-central.md (nesta pasta).

Acessa a central via SSH (Yggdrasil IPv6), roda SELECTs (somente leitura) no
banco hubot com `psql -U hubot` e gera na pasta --out:

  slaves.json · channels.json · ambients.json
  ambients_slaves_rel.json   (tabela ambients_rfir_slaves_rel)
  ambients_devices_rel.json  (tabela ambients_rfir_devices_rel)
  rfir_devices.json · rfir_remotes.json · rfir_commands.json · rfir_buttons.json
  slaves-map.md              (mapa legível slave → channels → ambients + resumo RFIR)

Formato igual ao de SOUL-MALLS/CONTAGEM: { "_meta": {...}, "rows": [...] }.

Caminho padrão (salto pelo box restarter — a id_rsa da frota nunca sai do box):
  sua máquina --(id_ed25519 via ssh-agent)--> ubuntu@healthchecks.myio-bas.com
              --(cd restarter; ssh -i id_rsa)--> root@<IPv6 da central> --> psql -U hubot
  O SQL vai pelo stdin (sh -s), sem aspas aninhadas.

ssh-agent automático (ensure_agent): se o serviço estiver desativado o script o liga
(pede UAC); se a id_ed25519 não estiver no agent, roda ssh-add e pede a senha UMA vez.
O agent do Windows guarda a chave (sobrevive ao reboot) → nas próximas execuções, zero prompt.

Uso (Windows, da raiz do repo):
  python -I src/NODE-RED/GLOBAL_INFO/dump-cadastro.py ^
    --host 201:3bed:541b:8c61:3e69:9:d453:1bef ^
    --name "Central Raiz Educação (Raiz Educação)" ^
    --gateway 1deb2d86-2b76-4f88-b86f-18b3a3f33b98 --central-id 197.20.86.102 --freq 102 ^
    --out src/NODE-RED/RAIZ-EDUCACAO
  ... --direct --key <id_rsa>     # sem box (id_rsa da frota local + Yggdrasil 0.3.x)

Nada é gravado na central: cada tabela é lida com SELECT json_agg(...).
"""
import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_KEY = r"C:\temp\myio-key\id_rsa"
DEFAULT_VIA = "ubuntu@healthchecks.myio-bas.com"
DEFAULT_BOX_KEY = str(Path.home() / ".ssh" / "id_ed25519")

# Preenchidos por main() a partir dos argumentos (--name/--gateway/--central-id/--freq).
CENTRAL = ""
GATEWAY_ID = CENTRAL_ID = FREQ = "—"

# (arquivo, tabela, ORDER BY)
TABLES = [
    ("slaves.json", "slaves", "id"),
    ("channels.json", "channels", "id"),
    ("ambients.json", "ambients", "id"),
    ("ambients_slaves_rel.json", "ambients_rfir_slaves_rel", "1, 2"),
    ("ambients_devices_rel.json", "ambients_rfir_devices_rel", "1, 2"),
    # RFIR (infravermelho): device lógico → comandos on/off; controle remoto → botões → comando
    ("rfir_devices.json", "rfir_devices", "id"),
    ("rfir_remotes.json", "rfir_remotes", "id"),
    ("rfir_commands.json", "rfir_commands", "id"),
    ("rfir_buttons.json", "rfir_buttons", "id"),
]
SEP = "@@@MYIO-TABLE@@@"
ERR = "@@@PSQL-ERR@@@ "


def build_remote_script() -> str:
    """Script sh enviado pelo stdin para a central (evita aspas aninhadas no salto)."""
    # Algumas centrais têm o psql apontando p/ socket em /tmp, mas o Postgres escuta
    # em /var/run/postgresql (ou só TCP) → detecta a conexão que funciona.
    lines = [
        "export PGCONNECT_TIMEOUT=5",
        'P="psql -U hubot -X -At"',
        '$P -c "select 1" >/dev/null 2>&1 || for h in /var/run/postgresql /run/postgresql localhost; do '
        'psql -h $h -U hubot -X -At -w -c "select 1" >/dev/null 2>&1 && { P="psql -h $h -U hubot -X -At -w"; break; }; done',
    ]
    for _, tbl, order in TABLES:
        sql = (
            f"SELECT coalesce(json_agg(row_to_json(t) ORDER BY {order}), '[]'::json) "
            f"FROM (SELECT * FROM {tbl}) t"
        )
        # tabela ausente → imprime null em vez de abortar o dump
        lines.append(f"echo '{SEP}{tbl}'")
        # erro do psql vai para stdout com prefixo (não some mais no 2>/dev/null)
        lines.append(f"$P -v ON_ERROR_STOP=1 -c \"{sql}\" 2>/tmp/.dump_err "
                     f"|| {{ echo null; sed 's/^/{ERR}/' /tmp/.dump_err; }}")
    lines.append("rm -f /tmp/.dump_err")
    return "\n".join(lines) + "\n"


SSH_OPTS_LOCAL = [
    "-o", "StrictHostKeyChecking=accept-new",
    "-o", "LogLevel=ERROR",
    "-o", "ConnectTimeout=20",
    "-o", "BatchMode=yes",          # falha em vez de pedir senha (use o ssh-agent)
]
SSH_OPTS_BOX = ("-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "
                "-o LogLevel=ERROR -o ConnectTimeout=20 -o BatchMode=yes")


def _agent_rc() -> int:
    """ssh-add -l → 0 = tem chaves · 1 = agent vazio · 2 = agent fora do ar."""
    return subprocess.run(["ssh-add", "-l"], capture_output=True, text=True).returncode


def _fingerprint(pub: Path):
    r = subprocess.run(["ssh-keygen", "-lf", str(pub)], capture_output=True, text=True)
    return r.stdout.split()[1] if r.returncode == 0 and r.stdout.strip() else None


def ensure_agent(key: str):
    """Automatiza o ssh-agent do Windows: liga o serviço (UAC 1x) e carrega a chave
    (senha 1x — o agent do Windows guarda a chave e ela sobrevive ao reboot)."""
    if not key:
        return
    if sys.platform == "win32" and _agent_rc() == 2:
        print(">> ssh-agent parado/desativado — ativando (aceite o UAC)…")
        ps = ("Set-Service ssh-agent -StartupType Automatic; Start-Service ssh-agent")
        subprocess.run(["powershell", "-NoProfile", "-Command",
                        f"Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden "
                        f"-ArgumentList '-NoProfile -Command \"{ps}\"'"], check=False)
        if _agent_rc() == 2:
            sys.exit("ERRO: não consegui iniciar o ssh-agent (UAC recusado?).")
    fp = _fingerprint(Path(key + ".pub"))
    listed = subprocess.run(["ssh-add", "-l"], capture_output=True, text=True).stdout
    if fp and fp in listed:
        return  # chave já está no agent → nada a pedir
    print(f">> carregando {key} no ssh-agent — digite a senha da chave (só desta vez):")
    if subprocess.run(["ssh-add", key]).returncode != 0:   # herda o terminal p/ a senha
        sys.exit("ERRO: ssh-add falhou (senha errada?).")


def run_ssh(a) -> str:
    if not a.direct:
        ensure_agent(a.box_key)
    if a.direct:
        # Sua máquina → central (precisa da id_rsa da frota local + Yggdrasil 0.3.x).
        cmd = ["ssh", "-i", a.key, *SSH_OPTS_LOCAL,
               "-o", "UserKnownHostsFile=NUL" if sys.platform == "win32" else "UserKnownHostsFile=/dev/null",
               f"root@{a.host}", "sh -s"]
    else:
        # Sua máquina → box (chave ed25519 via ssh-agent) → cd restarter → ssh -i id_rsa → central.
        # A id_rsa da frota fica SÓ no box.
        inner = f"cd {a.box_dir} && ssh -i id_rsa {SSH_OPTS_BOX} root@{a.host} sh -s"
        cmd = ["ssh", *SSH_OPTS_LOCAL]
        if a.box_key:
            cmd += ["-i", a.box_key]
        cmd += [a.via, inner]
    # stdin em BYTES: no Windows o modo texto converte \n → \r\n e quebra o sh remoto.
    res = subprocess.run(cmd, input=build_remote_script().encode("utf-8"), capture_output=True)
    out = res.stdout.decode("utf-8", errors="replace")
    err = res.stderr.decode("utf-8", errors="replace")
    if res.returncode != 0 and SEP not in out:
        sys.exit(f"ERRO ssh (rc={res.returncode}): {err.strip()}")
    return out


def parse(out: str) -> dict:
    data, errors = {}, {}
    for chunk in out.split(SEP)[1:]:
        tbl, _, body = chunk.partition("\n")
        tbl = tbl.strip()
        err = [l[len(ERR):] for l in body.splitlines() if l.startswith(ERR)]
        body = "\n".join(l for l in body.splitlines() if not l.startswith(ERR)).strip()
        if err:
            errors[tbl] = " ".join(err).strip()
        data[tbl] = None if body in ("", "null") else json.loads(body)
    return data, errors


def write_json(folder: Path, fname: str, tbl: str, rows, captured: str, host: str):
    meta = {
        "central": CENTRAL,
        "table": tbl,
        "rowCount": len(rows) if rows is not None else None,
        "capturedAt": captured,
        "source": f"dump-cadastro.py → ssh root@{host} · psql -U hubot (SELECT json_agg, somente leitura)",
    }
    if rows is None:
        meta["note"] = "Tabela não existe neste banco (ou erro no SELECT)."
    lines = ["{", f'  "_meta": {json.dumps(meta, ensure_ascii=False, indent=2).replace(chr(10), chr(10) + "  ")},', '  "rows": [']
    rows = rows or []
    for i, r in enumerate(rows):
        lines.append("    " + json.dumps(r, ensure_ascii=False, separators=(", ", ": ")) + ("," if i < len(rows) - 1 else ""))
    lines += ["  ]", "}", ""]
    (folder / fname).write_text("\n".join(lines), encoding="utf-8")


def md_cell(v) -> str:
    if v is None:
        return "—"
    s = str(v)
    if s != s.strip():
        s = f"`{s}` ⚠ espaço"
    return s.replace("|", "\\|")


def write_map(folder: Path, data: dict, captured: str, host: str):
    slaves = data.get("slaves") or []
    channels = data.get("channels") or []
    ambients = data.get("ambients") or []
    srel = data.get("ambients_rfir_slaves_rel") or []
    drel = data.get("ambients_rfir_devices_rel")

    amb_name = {a["id"]: a["name"] for a in ambients}
    ch_by_slave, orphan_ch = {}, []
    for c in channels:
        (ch_by_slave.setdefault(c["slave_id"], []) if c.get("slave_id") is not None else orphan_ch).append(c)
    amb_by_slave = {}
    for r in srel:
        amb_by_slave.setdefault(r["slave_id"], []).append(r["ambient_id"])
    slaves_by_amb = {}
    for r in srel:
        slaves_by_amb.setdefault(r["ambient_id"], []).append(r["slave_id"])

    types = {}
    for s in slaves:
        types[s["type"]] = types.get(s["type"], 0) + 1

    o = []
    o.append(f"# Slaves Map — {CENTRAL}\n")
    o.append(f"> Central: **{CENTRAL}** · Gateway `{GATEWAY_ID}` · Central ID `{CENTRAL_ID}` · Frequência `{FREQ}`")
    o.append(f"> IPv6: `{host}`")
    o.append(f"> Total slaves: **{len(slaves)}** · channels: **{len(channels)}** · ambients: **{len(ambients)}** · "
             f"`ambients_rfir_slaves_rel`: **{len(srel)}** · `ambients_rfir_devices_rel`: **{len(drel) if drel is not None else 'n/a'}**")
    rf = {t: data.get(t) for t in ("rfir_devices", "rfir_remotes", "rfir_commands", "rfir_buttons")}
    o.append("> RFIR: " + " · ".join(f"`{t}`: **{len(v) if v is not None else 'n/a'}**" for t, v in rf.items()))
    o.append(f"> Capturado em **{captured}** por `dump-cadastro.py` (somente leitura).")
    o.append("> Dados: [`slaves.json`](slaves.json) · [`channels.json`](channels.json) · [`ambients.json`](ambients.json) · "
             "[`ambients_slaves_rel.json`](ambients_slaves_rel.json) · [`ambients_devices_rel.json`](ambients_devices_rel.json)")
    o.append("> Tipos de slave: " + " · ".join(f"`{t}` {n}" for t, n in sorted(types.items(), key=lambda x: -x[1])) + "\n")

    o.append("## Slaves\n")
    o.append("| id | addr_low | addr_high | type | name | ch | clamp | ambients | channels (nº · type · name) |")
    o.append("|---:|---:|---:|---|---|---:|---:|---|---|")
    for s in sorted(slaves, key=lambda x: x["id"]):
        chs = sorted(ch_by_slave.get(s["id"], []), key=lambda c: (c.get("channel") or 0, c["id"]))
        chtxt = "<br>".join(f"{c.get('channel')} · {c['type']} · {md_cell(c['name'])}" for c in chs) or "—"
        ambs = ", ".join(f"{a} {md_cell(amb_name.get(a))}" for a in amb_by_slave.get(s["id"], [])) or "⚠ sem ambient"
        o.append(f"| {s['id']} | {s.get('addr_low')} | {s.get('addr_high')} | {s['type']} | {md_cell(s['name'])} | "
                 f"{s.get('channels')} | {md_cell(s.get('clamp_type'))} | {ambs} | {chtxt} |")

    o.append("\n## Ambients\n")
    o.append("| id | name | slaves |")
    o.append("|---:|---|---|")
    for a in sorted(ambients, key=lambda x: x["id"]):
        sl = slaves_by_amb.get(a["id"], [])
        o.append(f"| {a['id']} | {md_cell(a['name'])} | {', '.join(map(str, sorted(sl))) or '⚠ vazio'} |")

    if orphan_ch:
        o.append("\n## Channels sem slave_id\n")
        o.append("| id | channel | type | name |")
        o.append("|---:|---:|---|---|")
        for c in orphan_ch:
            o.append(f"| {c['id']} | {c.get('channel')} | {c['type']} | {md_cell(c['name'])} |")

    if drel:
        o.append("\n## ambients_rfir_devices_rel\n")
        cols = list(drel[0].keys())
        o.append("| " + " | ".join(cols) + " |")
        o.append("|" + "---|" * len(cols))
        for r in drel:
            o.append("| " + " | ".join(md_cell(r.get(k)) for k in cols) + " |")

    rdev = rf["rfir_devices"] or []
    if rdev:
        cmd_name = {c["id"]: c.get("name") for c in (rf["rfir_commands"] or [])}
        slave_name = {s["id"]: s["name"] for s in slaves}
        o.append("\n## RFIR devices\n")
        o.append("| id | type | category | name | output | slave | cmd ON | cmd OFF |")
        o.append("|---:|---|---|---|---|---|---|---|")
        for d in sorted(rdev, key=lambda x: x["id"]):
            sl = d.get("slave_id")
            on, off = d.get("command_on_id"), d.get("command_off_id")
            o.append(f"| {d['id']} | {md_cell(d.get('type'))} | {md_cell(d.get('category'))} | {md_cell(d.get('name'))} | "
                     f"{md_cell(d.get('output'))} | {sl if sl is None else f'{sl} {md_cell(slave_name.get(sl))}'} | "
                     f"{'—' if on is None else f'{on} {md_cell(cmd_name.get(on))}'} | "
                     f"{'—' if off is None else f'{off} {md_cell(cmd_name.get(off))}'} |")

    rrem = rf["rfir_remotes"] or []
    if rrem:
        btn_by_rem = {}
        for b in rf["rfir_buttons"] or []:
            btn_by_rem.setdefault(b["rfir_remote_id"], []).append(b)
        o.append("\n## RFIR remotes → buttons\n")
        o.append("| id | name | rfir_device | buttons (nome · command_id) |")
        o.append("|---:|---|---:|---|")
        for r in sorted(rrem, key=lambda x: x["id"]):
            bt = sorted(btn_by_rem.get(r["id"], []), key=lambda b: (b.get("order") or 0, b["id"]))
            bttxt = "<br>".join(f"{md_cell(b.get('name'))} · {b.get('rfir_command_id')}" for b in bt) or "⚠ sem botões"
            o.append(f"| {r['id']} | {md_cell(r.get('name'))} | {md_cell(r.get('rfir_device_id'))} | {bttxt} |")

    (folder / "slaves-map.md").write_text("\n".join(o) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", required=True, help="IPv6 Yggdrasil da central")
    ap.add_argument("--name", required=True, help='nome da central p/ _meta e slaves-map (ex.: "Central Raiz Educação (Raiz Educação)")')
    ap.add_argument("--gateway", default="—", help="Gateway ID / CENTRAL_UUID")
    ap.add_argument("--central-id", default="—", help="Central ID (ex.: 197.20.86.102)")
    ap.add_argument("--freq", default="—", help="Frequência")
    ap.add_argument("--via", default=DEFAULT_VIA, help="box de salto (user@host)")
    ap.add_argument("--box-dir", default="restarter", help="pasta no box onde está a id_rsa")
    ap.add_argument("--box-key", default=DEFAULT_BOX_KEY,
                    help="chave para entrar no box ('' = só o ssh-agent)")
    ap.add_argument("--direct", action="store_true", help="sem box: ssh direto da sua máquina")
    ap.add_argument("--key", default=DEFAULT_KEY, help="id_rsa da frota (só com --direct)")
    ap.add_argument("--out", required=True, help="pasta de saída (ex.: src/NODE-RED/RAIZ-EDUCACAO)")
    a = ap.parse_args()

    global CENTRAL, GATEWAY_ID, CENTRAL_ID, FREQ
    CENTRAL, GATEWAY_ID, CENTRAL_ID, FREQ = a.name, a.gateway, a.central_id, a.freq
    folder = Path(a.out)
    captured = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    data, errors = parse(run_ssh(a))
    for tbl, msg in errors.items():
        print(f"  psql [{tbl}]: {msg}", file=sys.stderr)
    # Fail-safe: se o slaves (tabela-base) não veio, NÃO sobrescreve nada.
    if not data or data.get("slaves") is None:
        sys.exit("ERRO: psql não retornou a tabela slaves — nada foi gravado. "
                 + (f"Motivo: {errors.get('slaves')}" if errors.get("slaves") else ""))
    folder.mkdir(parents=True, exist_ok=True)

    for fname, tbl, _ in TABLES:
        rows = data.get(tbl)
        write_json(folder, fname, tbl, rows, captured, a.host)
        print(f"{fname:<28} {tbl:<28} {len(rows) if rows is not None else 'AUSENTE'}")
    write_map(folder, data, captured, a.host)
    print("slaves-map.md gerado")


if __name__ == "__main__":
    main()
