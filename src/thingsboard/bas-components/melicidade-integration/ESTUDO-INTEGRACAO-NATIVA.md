# Estudo de Integração Nativa — Melicidade BAS

> **Contexto**: Hoje a integração usa uma central MyIO como túnel/proxy reverso para expor
> páginas web dos sistemas externos via iframe. O cliente solicitou integração nativa:
> relatórios, agendamentos e ações sem depender de conectividade em tempo real,
> com sync automático quando a conexão voltar.

---

## 1. Situação Atual — Arquitetura de Túnel (iframe)

```
[Dashboard MyIO] ── iframe ──► [Central MyIO]
                                     │ proxy reverso
                                     ▼
                             [Servidor Externo]
                             (Niagara / Hitachi / etc.)
```

**Limitações:**
- Queda de conexão = tela em branco
- Dados ficam no sistema externo — MyIO não tem histórico
- Relatórios dependem da UI do fornecedor
- Agendamentos dependem de conectividade
- Usuário precisa logar separadamente em cada sistema

---

## 2. Arquitetura Alvo — Integração Nativa Offline-First

```
[ThingsBoard MyIO Cloud]
  Dashboard | Relatórios | Agendamentos | Alertas
        │
        │ MQTT / HTTP  +  sync assíncrono de backlog
        │
[MyIO Gateway Agent — on-premise]
  Modbus Adapter | Buffer Local | Scheduler | Sync Engine
        │
        │ protocolo nativo por sistema
        ├──── Modbus TCP/RTU ──────► [VRF — DCPF04]
        ├──── BACnet/IP ───────────► [CHILLER — Niagara]
        └──── (a definir) ─────────► [GERADOR]
```

**Princípios:**
- Coleta ativa por polling — dados armazenados localmente mesmo sem internet
- Sync assíncrono — quando conexão volta, envia backlog com timestamps originais
- Agendamentos executados localmente pelo Gateway — independente de conectividade
- Relatórios gerados pelo MyIO a partir dos dados no ThingsBoard

---

## 3. Sistemas Integrados

### 3.1 VRF — Hitachi Reiri for Office Touch (DCPF04)

| Campo | Valor |
|-------|-------|
| URL atual | `https://melicidade2.myio-bas.com/` |
| Plataforma | Hitachi Reiri DCPF04 |
| Protocolo nativo | Modbus RTU (RS485) / provável Modbus TCP |
| Status (16/04/2026) | ✅ Online |

Sistema de ar condicionado VRF — controla unidades internas (evaporadoras) de forma
individual por ambiente. Independente do CHILLER.

> **Estudo aprofundado:** `ESTUDO-VRF-INTEGRACAO-NATIVA.md`
> **Manual técnico:** `INS_DCPF04_Reiri for Office Touch_DHOS-CS-IM-2107002G.pdf`

---

### 3.2 CHILLER — Niagara Framework (Tridium)

| Campo | Valor |
|-------|-------|
| URL atual | `https://melicidade1.myio-bas.com/` |
| Plataforma | Niagara Framework (JACE) |
| Estação | `Mercado_Livre` |
| Protocolo nativo | BACnet/IP (UDP 47808) — principal opção |
| Status (16/04/2026) | ⚠️ Online — licença SMA expirada (não bloqueia integração) |

Sistema de resfriamento de água gelada para climatização de áreas grandes.
Independente do VRF.

> **Estudo aprofundado:** `ESTUDO-CHILLER-INTEGRACAO-NATIVA.md` *(a criar)*

---

### 3.3 GERADOR

| Campo | Valor |
|-------|-------|
| URL atual | `https://melicidade3.myio-bas.com/` |
| Plataforma | Desconhecida |
| Protocolo nativo | A definir (Modbus TCP típico em geradores) |
| Status (16/04/2026) | 🔴 502 Bad Gateway — serviço upstream parado |

Sistema de geração de energia elétrica de emergência. Precisa restaurar o serviço
e identificar marca/modelo antes de planejar integração.

> **Estudo aprofundado:** `ESTUDO-GERADOR-INTEGRACAO-NATIVA.md` *(a criar após identificar o sistema)*

---

## 4. Próximos Passos Imediatos

- [ ] Confirmar IP do DCPF04 na rede local → testar porta 502 (Modbus TCP)
- [ ] Confirmar IP do JACE Niagara → testar porta 47808 (BACnet/IP)
- [ ] Restaurar serviço `melicidade3.myio-bas.com` → identificar sistema do GERADOR
- [ ] Solicitar ao cliente: mapa de registros Modbus do DCPF04 ou exportar CSV do Reiri Setup Tool
- [ ] Definir localização física do MyIO Gateway Agent na rede da Melicidade
