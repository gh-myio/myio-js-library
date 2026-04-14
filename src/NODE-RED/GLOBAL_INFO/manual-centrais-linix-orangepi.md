# Manual de Acesso e Operação — Centrais Linux Orange Pi

> **Escopo:** Procedimentos para acesso remoto, operação e manutenção das centrais Orange Pi utilizadas nos shoppings MyIO.
> **Audiência:** Técnicos e desenvolvedores MyIO.

---

## 1. Visão Geral

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| Hardware       | Orange Pi <!-- modelo: ex. Orange Pi 3 LTS --> |
| SO             | <!-- ex. Armbian 22.x / Ubuntu 20.04 -->       |
| Node-RED       | <!-- versão: ex. 3.x -->                       |
| Porta Node-RED | `1880`                                         |

---

## 2. Acesso SSH

### 2.1 Credenciais Padrão

| Campo     | Valor                    |
| --------- | ------------------------ |
| Usuário   | `root`                   |
| Chave SSH | `id_rsa` (arquivo local) |
| Porta SSH | `22`                     |

### 2.2 Endereços das Centrais por Holding

Os IPs são **IPv6** (rede mesh — Yggdrasil). Conectar sempre com `-i id_rsa`:

```bash
ssh -i id_rsa root@<ipv6-da-central>
```

#### Holding: SÁ CAVALCANTE

| Central              | IPv6                                     | Gateway ID                             |
| -------------------- | ---------------------------------------- | -------------------------------------- |
| Mestre Álvaro — L0L1 | `200:ba5f:dacb:b278:8f85:acf4:f33c:f485` | `45250d44-bad0-4071-aaa0-8091cfb12691` |
| Mestre Álvaro — L2AC | `200:8b:483c:9008:1184:caec:41b1:fa28`   | `d3202744-05dd-46d1-af33-495e9a2ecd52` |
| Mestre Álvaro — L3L4 | `200:b0b1:81aa:49a4:c554:4fec:f110:9896` | `fcb3ccd1-4b85-4cef-a1de-0b8a80bec81e` |
| Rio Poty             | `203:bdfb:8fda:634d:c846:1404:f319:718c` | `c0af8288-7b13-4024-bc11-df5017fef656` |
| Shopping da Ilha     | `201:3447:911:5955:4018:3960:6838:ee12`  | `cb318f02-1020-4f99-857f-d44d001d939b` |
| Moxuara              | `202:1567:faee:79ef:486:6d44:d391:fb18`  | `e982edf9-edb1-4aa6-8a14-4782465ae5a3` |
| Montserrat           | `200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc`  | `186bbdcb-95bc-4290-bf33-1ce89e48ffb4` |
| Shopping Ananindeua  | `201:ca6e:c33b:3a06:f4dd:d148:5d85:6315` | `7ac0ac44-e631-4b64-ac1d-e9e93fe61e0a` |

#### Holding: SOUZA AGUIAR

| Central                         | IPv6                                     | Gateway ID |
| ------------------------------- | ---------------------------------------- | ---------- |
| Souza Aguiar — CO2              | `201:3941:4753:9232:901b:19fa:4978:51aa` | —          |
| Souza Aguiar — Ar Comprimido    | `200:4dbc:14be:a704:6904:81cd:b62a:ab22` | —          |
| Souza Aguiar — Maternidade Nova | `201:ce30:f047:7f02:a27c:cbac:ffb7:2b67` | —          |
| Souza Aguiar — T&D              | `202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7`  | —          |

#### Holding: SOUL MALLS

| Central           | IPv6                                     | Gateway ID |
| ----------------- | ---------------------------------------- | ---------- |
| Praia da Costa L1 | `200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa` | —          |

#### Holding: SUPERVIA ESTAÇÕES

| Central | IPv6 |
| ------- | ---- |
| —       | —    |

**Exemplos de conexão:**

```bash
# Mestre Álvaro L0L1 (Sá Cavalcante)
ssh -i id_rsa root@200:ba5f:dacb:b278:8f85:acf4:f33c:f485

# Mestre Álvaro L2AC (Sá Cavalcante)
ssh -i id_rsa root@200:8b:483c:9008:1184:caec:41b1:fa28

# Mestre Álvaro L3L4 (Sá Cavalcante)
ssh -i id_rsa root@200:b0b1:81aa:49a4:c554:4fec:f110:9896

# Rio Poty (Sá Cavalcante)
ssh -i id_rsa root@203:bdfb:8fda:634d:c846:1404:f319:718c

# Shopping da Ilha (Sá Cavalcante)
ssh -i id_rsa root@201:3447:911:5955:4018:3960:6838:ee12

# Moxuara (Sá Cavalcante)
ssh -i id_rsa root@202:1567:faee:79ef:486:6d44:d391:fb18

# Montserrat (Sá Cavalcante)
ssh -i id_rsa root@200:abb2:e99:ec3d:eaf8:2d90:7bd9:42cc

# Shopping Ananindeua (Sá Cavalcante)
ssh -i id_rsa root@201:ca6e:c33b:3a06:f4dd:d148:5d85:6315

# Souza Aguiar — CO2
ssh -i id_rsa root@201:3941:4753:9232:901b:19fa:4978:51aa

# Souza Aguiar — Ar Comprimido
ssh -i id_rsa root@200:4dbc:14be:a704:6904:81cd:b62a:ab22

# Souza Aguiar — Maternidade Nova
ssh -i id_rsa root@201:ce30:f047:7f02:a27c:cbac:ffb7:2b67

# Souza Aguiar — T&D
ssh -i id_rsa root@202:1d97:2112:f9b9:cfcb:e237:5dc:a3f7

# Praia da Costa L1 (Soul Malls)
ssh -i id_rsa root@200:8e12:1a64:71bc:ff06:5c56:9f09:f4aa
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

| Caminho                                  | Descrição                       |
| ---------------------------------------- | ------------------------------- |
| <!-- ex. /root/.node-red/ -->            | Diretório principal do Node-RED |
| <!-- ex. /root/.node-red/flows.json -->  | Flow principal                  |
| <!-- ex. /root/.node-red/settings.js --> | Configurações do Node-RED       |
| <!-- ex. /opt/myio/scripts/ -->          | Scripts JS customizados         |

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
--  SELECT id, name FROM slaves WHERE name ~ ' X[0-9]';
--  SELECT id, name FROM channels WHERE name ~ ' X[0-9]';

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

| Problema               | Causa provável                             | Solução          |
| ---------------------- | ------------------------------------------ | ---------------- |
| Node-RED não inicia    | <!-- ex. porta 1880 em uso -->             | <!-- solução --> |
| Slaves sem leitura     | <!-- ex. cabo Modbus solto -->             | <!-- solução --> |
| Dados não chegam ao TB | <!-- ex. sem internet / token expirado --> | <!-- solução --> |

---

## 10. Observações e Boas Práticas

<!-- Adicionar dicas, avisos, particularidades de instalação -->

---

_Última atualização: 2026-04-13_
