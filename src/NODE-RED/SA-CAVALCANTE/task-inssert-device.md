# Task: Insert Three Phase Sensor Devices

## Reference Table Structure

Based on the `slaves` table with `type = 'three_phase_sensor'`:

| Column | Description |
|--------|-------------|
| `id` | Device ID (usually same as addr_low) |
| `type` | `three_phase_sensor` |
| `addr_low` | Modbus address low |
| `addr_high` | Modbus address high |
| `channels` | Number of channels (3) |
| `name` | Device name |
| `color` | Color (empty) |
| `code` | Code (empty) |
| `clamp_type` | Clamp type (0) |
| `aggregate` | Aggregate flag (true) |
| `version` | Firmware version (6.0.0) |
| `temperature_correction` | Temperature correction (null) |
| `config` | JSON configuration |

## Existing Devices Reference

| ID | Name | addr_low | addr_high |
|----|------|----------|-----------|
| 1 | 3F SCMS002 | 1 | 248 |
| 25 | 3F SCMS106ABL1 | 25 | 248 |
| 49 | 3F SCMS203BL2 | 49 | 248 |
| 97 | 3F SCMS304CL3 | 97 | 248 |
| 121 | 3F SCMSQ218L2 | 121 | 248 |
| 128 | 3F ESRL. SCMSAC-ER1_L1 | 128 | 248 |
| 133 | 3F ELEV. SCMSAC-ES2_L3 | 133 | 248 |
| 141 | 3F MOTR. SCMSAC-AR6_L2 | 141 | 248 |

---

## New Devices to Insert

### Device 1: 3F SCMSAC_BI_Jockey

- **Name:** 3F SCMSAC_BI_Jockey
- **IDL (addr_low):** 202
- **IDH (addr_high):** 248

### Device 2: 3F SCMSAC-BI_Grande

- **Name:** 3F SCMSAC-BI_Grande
- **IDL (addr_low):** 201
- **IDH (addr_high):** 248

---

## Table Structure

```
id                     SERIAL (auto)
type                   varchar
addr_low               integer        -- IDL
addr_high              integer        -- IDH
channels               integer
name                   varchar
color                  varchar
code                   varchar
clamp_type             integer        -- TC
aggregate              boolean        (default true)
version                varchar        (default '1.0.0')
temperature_correction integer
config                 json
created_at             timestamp      (auto)
updated_at             timestamp      (auto)
```

## INSERT Commands

```sql
-- Insert: 3F SCMSAC-BI_Grande (IDL 201)
INSERT INTO slaves (type, addr_low, addr_high, channels, name, clamp_type, version)
VALUES ('three_phase_sensor', 201, 248, 3, '3F SCMSAC-BI_Grande', 0, '6.0.0');

-- Insert: 3F SCMSAC_BI_Jockey (IDL 202)
INSERT INTO slaves (type, addr_low, addr_high, channels, name, clamp_type, version)
VALUES ('three_phase_sensor', 202, 248, 3, '3F SCMSAC_BI_Jockey', 0, '6.0.0');
```

### Verify After Insert

```sql
SELECT id, name, addr_low, addr_high
FROM slaves
WHERE type = 'three_phase_sensor'
  AND id IN (201, 202);
```
