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
| Usuário | `root` |
| Chave SSH | `id_rsa` (arquivo local) |
| Porta SSH | `22` |

### 2.2 Endereços das Centrais

Os IPs são **IPv6** (rede mesh — ex. Yggdrasil). Conectar sempre com `-i id_rsa`:

```bash
ssh -i id_rsa root@<ipv6-da-central>
```

| Central | IPv6 |
|---------|------|
| Souza Aguiar — CO2 | `201:3941:4753:9232:901b:19fa:4978:51aa` |
| Souza Aguiar — Ar Comprimido | `200:4dbc:14be:a704:6904:81cd:b62a:ab22` |
| Souza Aguiar — Maternidade Nova | `201:ce30:f047:7f02:a27c:cbac:ffb7:2b67` |
| Shopping Ananindeua | `201:ca6e:c33b:3a06:f4dd:d148:5d85:6315` |

**Exemplos completos:**

```bash
# Souza Aguiar CO2
ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa

# Souza Aguiar Ar Comprimido
ssh -i id_rsa root@200:4dbc:14be:a704:6904:81cd:b62a:ab22

# Souza Aguiar Maternidade Nova
ssh -i id_rsa root@201:ce30:f047:7f02:a27c:cbac:ffb7:2b67

# Central Shopping Ananindeua
ssh -i id_rsa root@201:ca6e:c33b:3a06:f4dd:d148:5d85:6315
```

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

## 5. Banco de Dados PostgreSQL

### 5.1 Conectar

```bash
psql -U hubot
```

### 5.2 Comandos úteis dentro do psql

```sql
-- Listar tabelas
\dt

-- Listar tabelas com detalhes (schema, tipo, owner)
\dt+

-- Detalhes de uma tabela
\d nome_da_tabela

-- Detalhes completos (tamanho, storage, descrições)
\d+ nome_da_tabela

-- Limpar o terminal
\! clear

-- Desconectar
\q
```

### 5.3 Executar um arquivo SQL

```bash
# 1. Criar arquivo temporário
cat > /tmp/fix-nome.sql << 'EOF'
-- Cole o SQL aqui
EOF

# 2. Executar
psql -U hubot -f /tmp/fix-nome.sql

# 3. Remover após uso
rm /tmp/fix-nome.sql
```

---

## 6. Serviços MyIO

### 6.1 Reiniciar APIs

```bash
systemctl restart myio.service
systemctl restart myio-api.service
```

### 6.2 Verificar status dos serviços

```bash
systemctl status myio.service
systemctl status myio-api.service
```

---

## 7. Modbus / Slaves

### 7.1 Verificar dispositivos ativos

<!-- Descrever como verificar slaves conectados:
     ex. via log Node-RED, arquivo de configuração, etc.
-->

### 7.2 Arquivo de mapeamento de devices

<!-- Caminho e formato do arquivo que mapeia slaveId → deviceName -->

---

## 8. Procedimentos Comuns

### 8.1 Atualizar script JS de um shopping

```bash
# 1. Conectar via SSH
ssh -i id_rsa root@<ipv6-da-central>

# 2. Navegar até o diretório
cd <caminho-dos-scripts>

# 3. Editar o arquivo
nano <nome-do-arquivo>.js

# 4. Reiniciar Node-RED
systemctl restart nodered
```

### 8.2 Verificar se dados estão chegando ao ThingsBoard

<!-- Descrever como confirmar que a telemetria está sendo enviada:
     ex. via log, via painel TB, via debug node no Node-RED
-->

### 8.3 Reinicialização completa da central

```bash
reboot
```

---

## 9. Troubleshooting

| Problema | Causa provável | Solução |
|----------|---------------|---------|
| Node-RED não inicia | <!-- ex. porta 1880 em uso --> | <!-- solução --> |
| Slaves sem leitura | <!-- ex. cabo Modbus solto --> | <!-- solução --> |
| Dados não chegam ao TB | <!-- ex. sem internet / token expirado --> | <!-- solução --> |

---

## 10. Observações e Boas Práticas

<!-- Adicionar dicas, avisos, particularidades de instalação -->

---

*Última atualização: 2026-04-06*
