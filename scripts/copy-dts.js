import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const from = resolve(__dirname, '../src/types/index.d.ts');
const to = resolve(__dirname, '../dist/index.d.ts');

mkdirSync(resolve(__dirname, '../dist'), { recursive: true });
cpSync(from, to);
console.log('[postbuild] Copied types to dist/index.d.ts');
