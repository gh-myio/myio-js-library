# Manual de Acesso e Operação — Centrais Linux Orange Pi

> **Escopo:** Procedimentos para acesso remoto, operação e manutenção das centrais Orange Pi utilizadas nos shoppings MyIO.
> **Audiência:** Técnicos e desenvolvedores MyIO.

---

## 1. Visão Geral

| Campo | Valor |
|-------|-------|
| Hardware | Orange Pi <!-- modelo: ex. Orange Pi 3 LTS --> |
| SO | <!-- ex. Armbian 22.x / Ubuntu 20.04 --> |
| Node-RED | <!-- versão: ex. 3.x --> |
| Porta Node-RED | `1880` |

---

## 2. Acesso SSH

### 2.1 Credenciais Padrão

| Campo | Valor |
|-------|-------|
| Usuário | <!-- ex. root / orangepi --> |
| Senha padrão | <!-- ex. myio2025 --> |
| Porta SSH | `22` |

### 2.2 Endereço IP

<!-- Descreva como localizar o IP da central:
     - IP fixo configurado? Range? VPN?
     - ex. 192.168.1.x — verificar no roteador local
-->

```bash
# Conectar via SSH
ssh <usuario>@<ip-da-central>
```

### 2.3 Acesso via VPN (se aplicável)

<!-- Instruções de VPN, ex. WireGuard / OpenVPN -->

---

## 3. Node-RED

### 3.1 Verificar status

```bash
systemctl status nodered
```

### 3.2 Iniciar / Parar / Reiniciar

```bash
systemctl start nodered
systemctl stop nodered
systemctl restart nodered
```

### 3.3 Ver logs em tempo real

```bash
journalctl -u nodered -f
```

### 3.4 Acessar editor Node-RED (browser)

```
http://<ip-da-central>:1880
```

---

## 4. Arquivos e Diretórios

| Caminho | Descrição |
|---------|-----------|
| <!-- ex. /root/.node-red/ --> | Diretório principal do Node-RED |
| <!-- ex. /root/.node-red/flows.json --> | Flow principal |
| <!-- ex. /root/.node-red/settings.js --> | Configurações do Node-RED |
| <!-- ex. /opt/myio/scripts/ --> | Scripts JS customizados |

### 4.1 Editar um arquivo JS na central

```bash
# Usando nano
nano <caminho-do-arquivo>

# Salvar: Ctrl+O → Enter
# Sair:   Ctrl+X
```

### 4.2 Fazer deploy após editar flow manualmente

```bash
# Reiniciar o serviço para recarregar os flows
systemctl restart nodered
```

---

## 5. Modbus / Slaves

### 5.1 Verificar dispositivos ativos

<!-- Descrever como verificar slaves conectados:
     ex. via log Node-RED, arquivo de configuração, etc.
-->

### 5.2 Arquivo de mapeamento de devices

<!-- Caminho e formato do arquivo que mapeia slaveId → deviceName -->

---

## 6. Procedimentos Comuns

### 6.1 Atualizar script JS de um shopping

```bash
# 1. Conectar via SSH
ssh <usuario>@<ip-da-central>

# 2. Navegar até o diretório
cd <caminho-dos-scripts>

# 3. Editar o arquivo
nano <nome-do-arquivo>.js

# 4. Reiniciar Node-RED
systemctl restart nodered
```

### 6.2 Verificar se dados estão chegando ao ThingsBoard

<!-- Descrever como confirmar que a telemetria está sendo enviada:
     ex. via log, via painel TB, via debug node no Node-RED
-->

### 6.3 Reinicialização completa da central

```bash
reboot
```

---

## 7. Shoppings e IPs

| Shopping | IP da Central | Observações |
|----------|--------------|-------------|
| <!-- nome --> | <!-- ip --> | <!-- obs --> |
| <!-- nome --> | <!-- ip --> | <!-- obs --> |

---

## 8. Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| Node-RED não inicia | <!-- ex. porta 1880 em uso --> | <!-- solução --> |
| Slaves sem leitura | <!-- ex. cabo Modbus solto --> | <!-- solução --> |
| Dados não chegam ao TB | <!-- ex. sem internet / token expirado --> | <!-- solução --> |

---

## 9. Observações e Boas Práticas

<!-- Adicionar dicas, avisos, particularidades de instalação -->

---

*Última atualização: 2026-04-06*
