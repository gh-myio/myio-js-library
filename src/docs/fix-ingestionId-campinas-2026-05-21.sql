-- fix-ingestionId — Campinas Shopping — gerado 2026-05-21
-- 20 UPDATE + 3 INSERT (attribute_key 731 = ingestionId, attribute_type 2 = SERVER_SCOPE)

-- FASE 3 — BACKUP (rodar antes)
-- CREATE TABLE attribute_kv_bkp_ingestionid_20260521 AS SELECT * FROM attribute_kv WHERE attribute_key = 731;

BEGIN;

-- ===== UPDATE (20) =====
-- 3F SCP00110 Lupo
UPDATE attribute_kv SET str_v='ded4d547-9c2d-4868-bb96-9977f08c1ba9', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='60e558c0-b68a-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP00253 DiGaspi
UPDATE attribute_kv SET str_v='0c6df341-e119-459b-9a24-81926a1ba147', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='4db319e0-b68a-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP00434 Kalunga
UPDATE attribute_kv SET str_v='29c019a8-ca85-47a8-b4b5-733f499dcdbe', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='cc3031a0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP00601 Lojas Americanas
UPDATE attribute_kv SET str_v='a61bc467-8ecc-448d-be11-e8769feb8326', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='e82999f0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0L00055 Pernambucanas
UPDATE attribute_kv SET str_v='8e6482ed-6420-4425-8f6b-0d43abbdb1d2', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='79bd5240-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0L405 Makibela 02
UPDATE attribute_kv SET str_v='20ebaada-64f3-4d9d-848d-557fe985cdc1', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='cfa35f60-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q004 Love Case
UPDATE attribute_kv SET str_v='937592db-2ab8-4238-b1c0-f302c6581f00', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='77797cc0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q006 ACIUM
UPDATE attribute_kv SET str_v='16a6b3b0-0b78-44a8-be98-beca64597d5f', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='4b54d400-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q011 Gi Celulares
UPDATE attribute_kv SET str_v='6b91da50-ce74-473c-8556-6205e50ade83', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='733933a0-b68c-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q013 piticas
UPDATE attribute_kv SET str_v='2a45455c-c5c7-4177-a252-3389ff1af4b1', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='6552e180-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q022 London Bus
UPDATE attribute_kv SET str_v='1fda2c13-7a9c-4f1c-bd0a-7d4b8d77f2c0', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='6bb232b0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q024 Gold Spell
UPDATE attribute_kv SET str_v='0c275542-f7f2-43d7-a355-0bf8ccddcaec', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='4cca0ee0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q027 QDonuts
UPDATE attribute_kv SET str_v='946a4ebb-223b-4b7c-a855-6500ebde7206', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='1d41a1b0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q039 Touti
UPDATE attribute_kv SET str_v='edca7c8c-7162-47cf-8aee-9795dd91b789', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='b70c8300-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q040 Kids Race
UPDATE attribute_kv SET str_v='5d7fb037-7438-46f4-bd17-6f5cee1a6519', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='75ae32a0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q111 Showcolate
UPDATE attribute_kv SET str_v='907d4776-5ca3-4802-9afa-2972c104cb5a', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='68d6b110-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Q205 Massage Express
UPDATE attribute_kv SET str_v='d42169d8-c06e-4d8b-b574-1fbd0081b07b', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='1a7dc6c0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0QXXX Global 4
UPDATE attribute_kv SET str_v='165ac885-e60e-44b4-976e-6012d343aa22', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='e41e71f0-b689-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Qxxx Doce Mimo( Sem Lista)
UPDATE attribute_kv SET str_v='9f8577a9-7b10-48b9-b83b-fe8b0c75c8c6', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='4b515c20-b68a-11ef-9d80-0f53bf3519bb' AND attribute_key=731 AND attribute_type=2;
-- 3F SCP0Qxxx KeyMaster G2
UPDATE attribute_kv SET str_v='06c83403-2448-407d-a77d-4833e4dccc1b', last_update_ts=(extract(epoch from now())*1000)::bigint, version=version+1 WHERE entity_id='383b1a90-b004-11ef-9e25-b7f6e6d4253b' AND attribute_key=731 AND attribute_type=2;

-- ===== INSERT (3) =====
-- 3F SCP00061 Sicoob
INSERT INTO attribute_kv (entity_id,attribute_type,attribute_key,str_v,last_update_ts,version) VALUES ('23e1c7c0-5467-11f1-ab52-9b3e4c8bcc59',2,731,'2a341d08-d70c-440f-82d7-af8b91b109d1',(extract(epoch from now())*1000)::bigint,1);
-- 3F SCP0D002 Havaianas 2
INSERT INTO attribute_kv (entity_id,attribute_type,attribute_key,str_v,last_update_ts,version) VALUES ('4b0b13c0-5475-11f1-ab52-9b3e4c8bcc59',2,731,'3dc8f0a3-9a87-47da-a9ca-5163497cf949',(extract(epoch from now())*1000)::bigint,1);
-- 3F SCP0D009 Havaianas 1
INSERT INTO attribute_kv (entity_id,attribute_type,attribute_key,str_v,last_update_ts,version) VALUES ('4b0aecb0-5475-11f1-ab52-9b3e4c8bcc59',2,731,'d9d543b9-1b34-4551-a0f3-2f20ee95f4a3',(extract(epoch from now())*1000)::bigint,1);

COMMIT;
