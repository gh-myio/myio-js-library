#!/usr/bin/env node
// RFC-0242 — refreshes tests/myio-bot/gcdr-bot-openapi.snapshot.json from the
// GCDR OpenAPI (read locally from a sibling checkout; never fetched).
//
//   node scripts/snapshot-gcdr-bot-openapi.mjs [path/to/gcdr.git/docs/openapi.yaml]
//
// Default path: ../gcdr.git/docs/openapi.yaml (relative to this repo root).
// The snapshot keeps only what the bot client depends on: the property names of
// the Bot* component schemas, the inline `GET /bot/status` data, the /bot/*
// (method, path) pairs and the request-body fields of the bodies it sends.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml'; // transitive devDependency (eslint); only this script uses it

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(root, process.argv[2] || '../gcdr.git/docs/openapi.yaml');
const out = path.join(root, 'tests/myio-bot/gcdr-bot-openapi.snapshot.json');

const doc = yaml.load(fs.readFileSync(src, 'utf8'));
const schemas = doc.components?.schemas || {};

const props = (s) => Object.keys(s?.properties || {}).sort();
/** properties of a `allOf: [SuccessResponse, { properties: { data } }]` 200 response */
const dataProps = (op) => {
  const sch = op?.responses?.['200']?.content?.['application/json']?.schema;
  const data = (sch?.allOf || []).map((x) => x?.properties?.data).find(Boolean);
  return data ? props(data) : [];
};
const bodyProps = (op) => props(op?.requestBody?.content?.['application/json']?.schema);

const components = {};
for (const name of Object.keys(schemas).sort()) {
  if (!name.startsWith('Bot')) continue;
  const s = schemas[name];
  components[name] = s.properties ? { properties: props(s), required: [...(s.required || [])].sort() } : { enum: s.enum || null };
}

const paths = {};
const requestBodies = {};
for (const p of Object.keys(doc.paths || {}).sort()) {
  if (!p.startsWith('/bot')) continue;
  const item = doc.paths[p];
  const methods = ['get', 'post', 'put', 'patch', 'delete'].filter((m) => item[m]);
  paths[p] = methods;
  for (const m of methods) {
    const b = bodyProps(item[m]);
    if (b.length) requestBodies[`${m.toUpperCase()} ${p}`] = b;
    const q = (item[m].parameters || []).filter((x) => x && x.in === 'query').map((x) => x.name).sort();
    if (q.length) requestBodies[`${m.toUpperCase()} ${p} ?query`] = q;
  }
}

const snapshot = {
  source: 'gcdr.git/docs/openapi.yaml',
  generatedBy: 'scripts/snapshot-gcdr-bot-openapi.mjs',
  info: { title: doc.info?.title ?? null, version: doc.info?.version ?? null },
  components,
  inline: { 'GET /bot/status': dataProps(doc.paths?.['/bot/status']?.get) },
  paths,
  requestBodies,
};
fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`[snapshot-gcdr-bot-openapi] ${Object.keys(components).length} schemas, ${Object.keys(paths).length} paths → ${path.relative(root, out)}`);
