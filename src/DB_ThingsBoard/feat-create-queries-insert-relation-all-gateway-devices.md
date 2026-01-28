# RFC: Create relations for all gateway devices (ThingsBoard/Postgres)

## 1. Objetivo
Criar as relações necessárias no Postgres (ThingsBoard) para associar **um Asset TARGET**
com **todos os Devices** (gateway devices). Para cada device, inserir a relação:

- `ASSET (from) -> DEVICE (to)` com `relation_type_group = 'COMMON'` e `relation_type = 'Contains'`.

## 2. Contexto
Asset TARGET:
- `3f4b9080-fc52-11f0-998e-25174baff087`

Exemplo real já existente (ASSET -> DEVICE):
```
from_id                               |from_type|to_id                               |to_type|relation_type_group|relation_type|additional_info|version
--------------------------------------+---------+------------------------------------+-------+-------------------+-------------+---------------+-------
3f4b9080-fc52-11f0-998e-25174baff087   |ASSET    |dfd70bb0-3c09-11f0-8cbd-2b87fdb093e1|DEVICE |COMMON             |Contains     |null           |86468
```

Exemplo real de relação de grupo (ENTITY_GROUP -> ASSET):
```
from_id                               |from_type   |to_id                               |to_type|relation_type_group|relation_type|additional_info|version
--------------------------------------+------------+------------------------------------+-------+-------------------+-------------+---------------+-------
a9a5fb50-8359-11ef-a0b2-75fcdf36545f   |ENTITY_GROUP|3f4b9080-fc52-11f0-998e-25174baff087|ASSET  |FROM_ENTITY_GROUP  |Contains     |               |86467
```

Tabela alvo:
```
SELECT from_id, from_type, to_id, to_type, relation_type_group, relation_type, additional_info, "version"
FROM public.relation;
```

## 3. Lista de devices (to_id)
```
dfd70bb0-3c09-11f0-8cbd-2b87fdb093e1
0ab18e60-cdc3-11ef-9eb2-6f10bea6c4a8
d5fdd9d0-eace-11ee-8327-cfc6eea1d65a
df81b400-fe8c-11ee-8b82-b386dea39cb5
2ef0c3a0-325e-11ef-ad2c-53aeabe7d3fa
c4e0b7d0-1d2d-11ef-8b82-b386dea39cb5
afad4220-cdef-11ef-9eb2-6f10bea6c4a8
a4017ff0-f883-11ee-9378-6b50e3ef4c75
df3c1d90-13d7-11ef-8b82-b386dea39cb5
531dc980-e019-11ef-9eb2-6f10bea6c4a8
54b60950-eacf-11ee-8327-cfc6eea1d65a
61f6f100-835f-11ef-a17c-dfe898a3f1e0
7b380820-3ac6-11ef-ad2c-53aeabe7d3fa
8aad8b40-3954-11ef-ad2c-53aeabe7d3fa
1c1a1130-8417-11f0-a06d-e9509531b1d5
fe2f5700-a147-11ef-9e25-b7f6e6d4253b
68fc1be0-e7df-11ee-8327-cfc6eea1d65a
4bf69160-50f3-11ef-ad2c-53aeabe7d3fa
cb9337f0-40a1-11ef-ad2c-53aeabe7d3fa
abafe970-7b74-11ef-8167-c5e7403fe241
8f694c00-a146-11ef-9e25-b7f6e6d4253b
13b43a40-841a-11f0-a06d-e9509531b1d5
c5bab540-b88a-11ef-9d80-0f53bf3519bb
d30a53e0-b001-11ef-9e25-b7f6e6d4253b
3cd6cce0-a1d9-11ef-9e25-b7f6e6d4253b
310e9a00-6a16-11ef-ad2c-53aeabe7d3fa
9f62ddf0-6ed9-11ef-ad2c-53aeabe7d3fa
24d21b90-6eda-11ef-ad2c-53aeabe7d3fa
dcd34160-b32c-11ef-8c53-5f04a4275f04
4ff1b010-841e-11f0-a06d-e9509531b1d5
091efca0-63b9-11ef-ad2c-53aeabe7d3fa
8e9a4c60-96f7-11ef-88ea-9f32e7332750
3ee21680-7163-11ef-ad2c-53aeabe7d3fa
d0d6cdd0-b81f-11ef-9d80-0f53bf3519bb
ea408380-e040-11ef-9eb2-6f10bea6c4a8
39314740-9893-11ef-88ea-9f32e7332750
f894d3f0-fcd9-11ee-8b82-b386dea39cb5
06789c50-a837-11ef-9e25-b7f6e6d4253b
f9ae1ac0-8bf5-11ef-88ea-9f32e7332750
e6f26ef0-b688-11ef-9d80-0f53bf3519bb
e659b7b0-e7cf-11ee-bb29-7fe038403ebc
5fb4b400-e7e1-11ee-8327-cfc6eea1d65a
96b4f7a0-ea45-11ef-a212-67802bff4221
5f238090-eba8-11ef-a212-67802bff4221
a3412290-ee1a-11ef-a212-67802bff4221
742fa120-8b14-11ef-a57b-4befce978a53
42bf31c0-faac-11ef-9baa-8137e6ac9d72
321b9a80-fdc1-11ef-9baa-8137e6ac9d72
d33fa310-fdd1-11ef-9baa-8137e6ac9d72
3e77a1d0-0414-11f0-9baa-8137e6ac9d72
0e594cb0-3047-11f0-8cbd-2b87fdb093e1
a414d630-328a-11f0-8cbd-2b87fdb093e1
64d8ba20-13ec-11f0-9baa-8137e6ac9d72
0d308ba0-842f-11f0-a06d-e9509531b1d5
5f8b32a0-8430-11f0-a06d-e9509531b1d5
bfb03eb0-0a77-11f0-9baa-8137e6ac9d72
279b0430-a6d9-11f0-afe1-175479a33d89
01013bd0-3c00-11f0-8cbd-2b87fdb093e1
ef6eaad0-822a-11f0-a06d-e9509531b1d5
73077600-8434-11f0-a06d-e9509531b1d5
75af8430-8437-11f0-a06d-e9509531b1d5
6d7cd4d0-8382-11f0-a06d-e9509531b1d5
16618030-837b-11f0-a06d-e9509531b1d5
e450aca0-8439-11f0-a06d-e9509531b1d5
b2600720-843b-11f0-a06d-e9509531b1d5
9bd78670-843d-11f0-a06d-e9509531b1d5
39e8bcd0-5121-11f0-9291-41f94c09a8a6
464f0900-8445-11f0-a06d-e9509531b1d5
eea8d3d0-8c87-11ef-88ea-9f32e7332750
a5708ba0-8389-11f0-a06d-e9509531b1d5
e7a55720-838f-11f0-a06d-e9509531b1d5
21158e70-9011-11f0-a06d-e9509531b1d5
739bcec0-9011-11f0-a06d-e9509531b1d5
bf63d500-9011-11f0-a06d-e9509531b1d5
4c5ad6f0-b661-11f0-be7f-e760d1498268
c455ac60-b685-11f0-9898-a53e89467408
3f29f3a0-adc2-11f0-ab28-f9ba38648b20
336dc0a0-af84-11f0-9722-210aa9448abc
fa8c0480-af75-11f0-9722-210aa9448abc
1817cd70-cf03-11f0-998e-25174baff087
67f524b0-d6e1-11f0-998e-25174baff087
8e8d14f0-fac4-11f0-998e-25174baff087
```

## 4. Queries (SQL)

### 4.1. Query de simulação (preview)
```
SELECT
  '3f4b9080-fc52-11f0-998e-25174baff087'::uuid AS from_id,
  'ASSET' AS from_type,
  device_id::uuid AS to_id,
  'DEVICE' AS to_type,
  'COMMON' AS relation_type_group,
  'Contains' AS relation_type,
  NULL::jsonb AS additional_info,
  0 AS version
FROM (
  VALUES
    ('dfd70bb0-3c09-11f0-8cbd-2b87fdb093e1'),
    ('0ab18e60-cdc3-11ef-9eb2-6f10bea6c4a8'),
    ('d5fdd9d0-eace-11ee-8327-cfc6eea1d65a'),
    ('df81b400-fe8c-11ee-8b82-b386dea39cb5'),
    ('2ef0c3a0-325e-11ef-ad2c-53aeabe7d3fa'),
    ('c4e0b7d0-1d2d-11ef-8b82-b386dea39cb5'),
    ('afad4220-cdef-11ef-9eb2-6f10bea6c4a8'),
    ('a4017ff0-f883-11ee-9378-6b50e3ef4c75'),
    ('df3c1d90-13d7-11ef-8b82-b386dea39cb5'),
    ('531dc980-e019-11ef-9eb2-6f10bea6c4a8'),
    ('54b60950-eacf-11ee-8327-cfc6eea1d65a'),
    ('61f6f100-835f-11ef-a17c-dfe898a3f1e0'),
    ('7b380820-3ac6-11ef-ad2c-53aeabe7d3fa'),
    ('8aad8b40-3954-11ef-ad2c-53aeabe7d3fa'),
    ('1c1a1130-8417-11f0-a06d-e9509531b1d5'),
    ('fe2f5700-a147-11ef-9e25-b7f6e6d4253b'),
    ('68fc1be0-e7df-11ee-8327-cfc6eea1d65a'),
    ('4bf69160-50f3-11ef-ad2c-53aeabe7d3fa'),
    ('cb9337f0-40a1-11ef-ad2c-53aeabe7d3fa'),
    ('abafe970-7b74-11ef-8167-c5e7403fe241'),
    ('8f694c00-a146-11ef-9e25-b7f6e6d4253b'),
    ('13b43a40-841a-11f0-a06d-e9509531b1d5'),
    ('c5bab540-b88a-11ef-9d80-0f53bf3519bb'),
    ('d30a53e0-b001-11ef-9e25-b7f6e6d4253b'),
    ('3cd6cce0-a1d9-11ef-9e25-b7f6e6d4253b'),
    ('310e9a00-6a16-11ef-ad2c-53aeabe7d3fa'),
    ('9f62ddf0-6ed9-11ef-ad2c-53aeabe7d3fa'),
    ('24d21b90-6eda-11ef-ad2c-53aeabe7d3fa'),
    ('dcd34160-b32c-11ef-8c53-5f04a4275f04'),
    ('4ff1b010-841e-11f0-a06d-e9509531b1d5'),
    ('091efca0-63b9-11ef-ad2c-53aeabe7d3fa'),
    ('8e9a4c60-96f7-11ef-88ea-9f32e7332750'),
    ('3ee21680-7163-11ef-ad2c-53aeabe7d3fa'),
    ('d0d6cdd0-b81f-11ef-9d80-0f53bf3519bb'),
    ('ea408380-e040-11ef-9eb2-6f10bea6c4a8'),
    ('39314740-9893-11ef-88ea-9f32e7332750'),
    ('f894d3f0-fcd9-11ee-8b82-b386dea39cb5'),
    ('06789c50-a837-11ef-9e25-b7f6e6d4253b'),
    ('f9ae1ac0-8bf5-11ef-88ea-9f32e7332750'),
    ('e6f26ef0-b688-11ef-9d80-0f53bf3519bb'),
    ('e659b7b0-e7cf-11ee-bb29-7fe038403ebc'),
    ('5fb4b400-e7e1-11ee-8327-cfc6eea1d65a'),
    ('96b4f7a0-ea45-11ef-a212-67802bff4221'),
    ('5f238090-eba8-11ef-a212-67802bff4221'),
    ('a3412290-ee1a-11ef-a212-67802bff4221'),
    ('742fa120-8b14-11ef-a57b-4befce978a53'),
    ('42bf31c0-faac-11ef-9baa-8137e6ac9d72'),
    ('321b9a80-fdc1-11ef-9baa-8137e6ac9d72'),
    ('d33fa310-fdd1-11ef-9baa-8137e6ac9d72'),
    ('3e77a1d0-0414-11f0-9baa-8137e6ac9d72'),
    ('0e594cb0-3047-11f0-8cbd-2b87fdb093e1'),
    ('a414d630-328a-11f0-8cbd-2b87fdb093e1'),
    ('64d8ba20-13ec-11f0-9baa-8137e6ac9d72'),
    ('0d308ba0-842f-11f0-a06d-e9509531b1d5'),
    ('5f8b32a0-8430-11f0-a06d-e9509531b1d5'),
    ('bfb03eb0-0a77-11f0-9baa-8137e6ac9d72'),
    ('279b0430-a6d9-11f0-afe1-175479a33d89'),
    ('01013bd0-3c00-11f0-8cbd-2b87fdb093e1'),
    ('ef6eaad0-822a-11f0-a06d-e9509531b1d5'),
    ('73077600-8434-11f0-a06d-e9509531b1d5'),
    ('75af8430-8437-11f0-a06d-e9509531b1d5'),
    ('6d7cd4d0-8382-11f0-a06d-e9509531b1d5'),
    ('16618030-837b-11f0-a06d-e9509531b1d5'),
    ('e450aca0-8439-11f0-a06d-e9509531b1d5'),
    ('b2600720-843b-11f0-a06d-e9509531b1d5'),
    ('9bd78670-843d-11f0-a06d-e9509531b1d5'),
    ('39e8bcd0-5121-11f0-9291-41f94c09a8a6'),
    ('464f0900-8445-11f0-a06d-e9509531b1d5'),
    ('eea8d3d0-8c87-11ef-88ea-9f32e7332750'),
    ('a5708ba0-8389-11f0-a06d-e9509531b1d5'),
    ('e7a55720-838f-11f0-a06d-e9509531b1d5'),
    ('21158e70-9011-11f0-a06d-e9509531b1d5'),
    ('739bcec0-9011-11f0-a06d-e9509531b1d5'),
    ('bf63d500-9011-11f0-a06d-e9509531b1d5'),
    ('4c5ad6f0-b661-11f0-be7f-e760d1498268'),
    ('c455ac60-b685-11f0-9898-a53e89467408'),
    ('3f29f3a0-adc2-11f0-ab28-f9ba38648b20'),
    ('336dc0a0-af84-11f0-9722-210aa9448abc'),
    ('fa8c0480-af75-11f0-9722-210aa9448abc'),
    ('1817cd70-cf03-11f0-998e-25174baff087'),
    ('67f524b0-d6e1-11f0-998e-25174baff087'),
    ('8e8d14f0-fac4-11f0-998e-25174baff087')
) AS t(device_id);
```

### 4.2. INSERT (transação completa)
```
BEGIN;

INSERT INTO public.relation (
  from_id,
  from_type,
  to_id,
  to_type,
  relation_type_group,
  relation_type,
  additional_info,
  "version"
)
SELECT
  '3f4b9080-fc52-11f0-998e-25174baff087'::uuid AS from_id,
  'ASSET' AS from_type,
  device_id::uuid AS to_id,
  'DEVICE' AS to_type,
  'COMMON' AS relation_type_group,
  'Contains' AS relation_type,
  NULL::jsonb AS additional_info,
  0 AS version
FROM (
  VALUES
    ('dfd70bb0-3c09-11f0-8cbd-2b87fdb093e1'),
    ('0ab18e60-cdc3-11ef-9eb2-6f10bea6c4a8'),
    ('d5fdd9d0-eace-11ee-8327-cfc6eea1d65a'),
    ('df81b400-fe8c-11ee-8b82-b386dea39cb5'),
    ('2ef0c3a0-325e-11ef-ad2c-53aeabe7d3fa'),
    ('c4e0b7d0-1d2d-11ef-8b82-b386dea39cb5'),
    ('afad4220-cdef-11ef-9eb2-6f10bea6c4a8'),
    ('a4017ff0-f883-11ee-9378-6b50e3ef4c75'),
    ('df3c1d90-13d7-11ef-8b82-b386dea39cb5'),
    ('531dc980-e019-11ef-9eb2-6f10bea6c4a8'),
    ('54b60950-eacf-11ee-8327-cfc6eea1d65a'),
    ('61f6f100-835f-11ef-a17c-dfe898a3f1e0'),
    ('7b380820-3ac6-11ef-ad2c-53aeabe7d3fa'),
    ('8aad8b40-3954-11ef-ad2c-53aeabe7d3fa'),
    ('1c1a1130-8417-11f0-a06d-e9509531b1d5'),
    ('fe2f5700-a147-11ef-9e25-b7f6e6d4253b'),
    ('68fc1be0-e7df-11ee-8327-cfc6eea1d65a'),
    ('4bf69160-50f3-11ef-ad2c-53aeabe7d3fa'),
    ('cb9337f0-40a1-11ef-ad2c-53aeabe7d3fa'),
    ('abafe970-7b74-11ef-8167-c5e7403fe241'),
    ('8f694c00-a146-11ef-9e25-b7f6e6d4253b'),
    ('13b43a40-841a-11f0-a06d-e9509531b1d5'),
    ('c5bab540-b88a-11ef-9d80-0f53bf3519bb'),
    ('d30a53e0-b001-11ef-9e25-b7f6e6d4253b'),
    ('3cd6cce0-a1d9-11ef-9e25-b7f6e6d4253b'),
    ('310e9a00-6a16-11ef-ad2c-53aeabe7d3fa'),
    ('9f62ddf0-6ed9-11ef-ad2c-53aeabe7d3fa'),
    ('24d21b90-6eda-11ef-ad2c-53aeabe7d3fa'),
    ('dcd34160-b32c-11ef-8c53-5f04a4275f04'),
    ('4ff1b010-841e-11f0-a06d-e9509531b1d5'),
    ('091efca0-63b9-11ef-ad2c-53aeabe7d3fa'),
    ('8e9a4c60-96f7-11ef-88ea-9f32e7332750'),
    ('3ee21680-7163-11ef-ad2c-53aeabe7d3fa'),
    ('d0d6cdd0-b81f-11ef-9d80-0f53bf3519bb'),
    ('ea408380-e040-11ef-9eb2-6f10bea6c4a8'),
    ('39314740-9893-11ef-88ea-9f32e7332750'),
    ('f894d3f0-fcd9-11ee-8b82-b386dea39cb5'),
    ('06789c50-a837-11ef-9e25-b7f6e6d4253b'),
    ('f9ae1ac0-8bf5-11ef-88ea-9f32e7332750'),
    ('e6f26ef0-b688-11ef-9d80-0f53bf3519bb'),
    ('e659b7b0-e7cf-11ee-bb29-7fe038403ebc'),
    ('5fb4b400-e7e1-11ee-8327-cfc6eea1d65a'),
    ('96b4f7a0-ea45-11ef-a212-67802bff4221'),
    ('5f238090-eba8-11ef-a212-67802bff4221'),
    ('a3412290-ee1a-11ef-a212-67802bff4221'),
    ('742fa120-8b14-11ef-a57b-4befce978a53'),
    ('42bf31c0-faac-11ef-9baa-8137e6ac9d72'),
    ('321b9a80-fdc1-11ef-9baa-8137e6ac9d72'),
    ('d33fa310-fdd1-11ef-9baa-8137e6ac9d72'),
    ('3e77a1d0-0414-11f0-9baa-8137e6ac9d72'),
    ('0e594cb0-3047-11f0-8cbd-2b87fdb093e1'),
    ('a414d630-328a-11f0-8cbd-2b87fdb093e1'),
    ('64d8ba20-13ec-11f0-9baa-8137e6ac9d72'),
    ('0d308ba0-842f-11f0-a06d-e9509531b1d5'),
    ('5f8b32a0-8430-11f0-a06d-e9509531b1d5'),
    ('bfb03eb0-0a77-11f0-9baa-8137e6ac9d72'),
    ('279b0430-a6d9-11f0-afe1-175479a33d89'),
    ('01013bd0-3c00-11f0-8cbd-2b87fdb093e1'),
    ('ef6eaad0-822a-11f0-a06d-e9509531b1d5'),
    ('73077600-8434-11f0-a06d-e9509531b1d5'),
    ('75af8430-8437-11f0-a06d-e9509531b1d5'),
    ('6d7cd4d0-8382-11f0-a06d-e9509531b1d5'),
    ('16618030-837b-11f0-a06d-e9509531b1d5'),
    ('e450aca0-8439-11f0-a06d-e9509531b1d5'),
    ('b2600720-843b-11f0-a06d-e9509531b1d5'),
    ('9bd78670-843d-11f0-a06d-e9509531b1d5'),
    ('39e8bcd0-5121-11f0-9291-41f94c09a8a6'),
    ('464f0900-8445-11f0-a06d-e9509531b1d5'),
    ('eea8d3d0-8c87-11ef-88ea-9f32e7332750'),
    ('a5708ba0-8389-11f0-a06d-e9509531b1d5'),
    ('e7a55720-838f-11f0-a06d-e9509531b1d5'),
    ('21158e70-9011-11f0-a06d-e9509531b1d5'),
    ('739bcec0-9011-11f0-a06d-e9509531b1d5'),
    ('bf63d500-9011-11f0-a06d-e9509531b1d5'),
    ('4c5ad6f0-b661-11f0-be7f-e760d1498268'),
    ('c455ac60-b685-11f0-9898-a53e89467408'),
    ('3f29f3a0-adc2-11f0-ab28-f9ba38648b20'),
    ('336dc0a0-af84-11f0-9722-210aa9448abc'),
    ('fa8c0480-af75-11f0-9722-210aa9448abc'),
    ('1817cd70-cf03-11f0-998e-25174baff087'),
    ('67f524b0-d6e1-11f0-998e-25174baff087'),
    ('8e8d14f0-fac4-11f0-998e-25174baff087')
) AS t(device_id);

COMMIT;
```

### 4.3. Query de validação (pós-insert)
```
SELECT
  from_id,
  from_type,
  to_id,
  to_type,
  relation_type_group,
  relation_type,
  additional_info,
  "version"
FROM public.relation
WHERE from_id = '3f4b9080-fc52-11f0-998e-25174baff087'
  AND from_type = 'ASSET'
  AND to_type = 'DEVICE'
  AND relation_type_group = 'COMMON'
  AND relation_type = 'Contains'
ORDER BY to_id;
```

## 5. Observações
- `ingestionId` não é necessário para criar a relação. Essa tabela só guarda o vínculo.
- Se o ambiente usa controle de versão interno na tabela, ajuste `version` conforme o padrão do banco.
