#!/usr/bin/env node
/**
 * classification-baseline.mjs — RFC-0207 baseline miner (retrospective vector).
 *
 * Answers John's question: "how many times in the last 6 months did a
 * misclassified device require a widget deploy?" — by mining the git history
 * and the DEVICE-CLASSIFICATION-MAP.md errata for past classification fixes.
 *
 * This covers the RETROSPECTIVE vector of Mary's measurement plan (RFC-0207
 * Addendum). The PROSPECTIVE vector (the A1 migration-snapshot move-count) is
 * NOT computed here — it requires the A1 resolver to exist. When A1 lands,
 * run the migration snapshot and add its move-count alongside this number.
 *
 * Counting discipline (Mary's anti-over-count rule): a commit is STRONG
 * (classification-specific) only when its SUBJECT signals classification intent
 * OR it touches a narrow classifier util file. Touching the 27k-LOC
 * MAIN_VIEW/TELEMETRY controllers is necessary-but-not-sufficient — those files
 * change constantly for unrelated reasons — so controller-only commits are
 * reported as CONTEXT, never as the headline number.
 *
 * Usage:
 *   node scripts/classification-baseline.mjs            # last 6 months
 *   node scripts/classification-baseline.mjs --months 12
 *   node scripts/classification-baseline.mjs --json     # machine-readable
 *
 * Read-only: runs `git log` and reads one markdown file. Writes nothing.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const monthsIdx = args.indexOf('--months');
const MONTHS = monthsIdx !== -1 ? Number(args[monthsIdx + 1]) || 6 : 6;

// --- config ----------------------------------------------------------------
// A commit counts as a *classification-specific* change (John's number) when
// its SUBJECT signals classification intent OR it touches one of the narrow
// classifier util files. The mega-controllers are CONTEXT only (see header).
const COMMIT_SUBJECT_PATTERNS = [
  /classif/i, /categoriz/i, /\bCAG\b/i, /climatiza/i, /elevador/i,
  /escada[s]?\s*rolante/i, /[áa]rea\s*comum/i, /areacomum/i, /3F_MEDIDOR/i,
  /deviceProfile/i, /breakdown/i, /ocultos/i, /labelWidget/i, /inferLabel/i,
];

// Narrow util files: a change here is almost certainly about classification.
const SPECIFIC_FILE_PATTERNS = [
  /utils\/equipmentCategory\.(js|ts)$/i,
  /utils\/deviceInfo\.(js|ts)$/i,
  /utils\/deviceClassification(Profile)?\.(ts|js)$/i,
];

// Broad controllers: touching these is necessary-but-not-sufficient. Context only.
const CONTROLLER_FILE_PATTERNS = [
  /main-dashboard-shopping\/.*\/(MAIN_VIEW|TELEMETRY|TELEMETRY_INFO)\/controller\.js$/i,
];

const MAP_DOC = resolve(
  REPO_ROOT,
  'src/thingsboard/main-dashboard-shopping/v-5.2.0/WIDGET/DEVICE-CLASSIFICATION-MAP.md',
);

// --- helpers ---------------------------------------------------------------
function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function matchesAny(str, patterns) {
  return patterns.some((re) => re.test(str));
}

// --- 1. retrospective: git log mining --------------------------------------
function mineGitLog() {
  // Robust per-commit parsing: a unique leading marker per commit header, then
  // --name-only files on their own lines. We parse line-by-line so the
  // header/file interleave can't desync. %x1f is git's own field separator
  // (interpolated by git, not the shell), so it survives subjects with spaces.
  const MARK = '__COMMIT__';
  const raw = git(
    `log --since="${MONTHS} months ago" --no-merges ` +
      `--pretty=format:"${MARK}%x1f%h%x1f%ad%x1f%an%x1f%s" --date=short --name-only`,
  );

  const hits = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const subjectHit = matchesAny(cur.subject || '', COMMIT_SUBJECT_PATTERNS);
    const specificFiles = cur.files.filter((f) => matchesAny(f, SPECIFIC_FILE_PATTERNS));
    const controllerFiles = cur.files.filter((f) => matchesAny(f, CONTROLLER_FILE_PATTERNS));
    // STRONG = classification-specific. Controller-only = CONTEXT.
    const strong = subjectHit || specificFiles.length > 0;
    if (strong || controllerFiles.length > 0) {
      hits.push({
        hash: cur.hash,
        date: cur.date,
        author: cur.author,
        subject: cur.subject,
        specificFiles,
        controllerFiles,
        strength: strong ? 'strong' : 'context',
        reason: subjectHit ? 'subject' : specificFiles.length ? 'util-file' : 'controller-only',
      });
    }
    cur = null;
  };

  for (const line of raw.split('\n')) {
    if (line.startsWith(MARK)) {
      flush();
      const [, hash, date, author, subject] = line.split('\x1f');
      cur = { hash, date, author, subject, files: [] };
    } else if (cur && line.trim()) {
      cur.files.push(line.trim());
    }
  }
  flush();
  return hits;
}

// --- 2. retrospective: MAP doc errata mining -------------------------------
function mineMapDoc() {
  if (!existsSync(MAP_DOC)) {
    return { found: false, knownBugs: [], note: `MAP doc not found at ${MAP_DOC}` };
  }
  const text = readFileSync(MAP_DOC, 'utf8');

  // Count the documented bugs in "## 3. Bugs / inconsistências conhecidas".
  // Each is an ordered list item under that heading.
  const bugSection = text.split(/##\s*3\.\s*Bugs/i)[1] || '';
  const stop = bugSection.search(/\n##\s/); // next H2
  const scoped = stop !== -1 ? bugSection.slice(0, stop) : bugSection;
  const bugItems = (scoped.match(/^\s*\d+\.\s+\*\*/gm) || []).length;

  // Cross-referenced RFCs anywhere in the doc.
  const rfcRefs = [...new Set((text.match(/RFC-\d{4}/g) || []))].sort();

  return { found: true, knownBugs: bugItems, rfcRefs };
}

// --- run -------------------------------------------------------------------
const gitHits = mineGitLog();
const strong = gitHits.filter((h) => h.strength === 'strong');
const context = gitHits.filter((h) => h.strength === 'context');
const bySubject = strong.filter((h) => h.reason === 'subject');
const byUtil = strong.filter((h) => h.reason === 'util-file');
const mapDoc = mineMapDoc();

if (asJson) {
  console.log(
    JSON.stringify(
      {
        windowMonths: MONTHS,
        retrospective: {
          classificationSpecificCommits: strong.length,
          bySubjectSignal: bySubject.length,
          byUtilFile: byUtil.length,
          controllerOnlyContext: context.length,
          strongCommits: strong,
        },
        mapDocErrata: mapDoc,
        prospectiveVector:
          'NOT computed — run the A1 migration-snapshot move-count once A1 lands.',
      },
      null,
      2,
    ),
  );
} else {
  const line = (s = '') => console.log(s);
  line('═══════════════════════════════════════════════════════════════');
  line(` RFC-0207 baseline — retrospective vector (last ${MONTHS} months)`);
  line('═══════════════════════════════════════════════════════════════');
  line();
  line('1) git log — classification-SPECIFIC commits (John\'s number)');
  line(`   STRONG total: ${strong.length}`);
  line(`     ├ subject signals classification intent: ${bySubject.length}`);
  line(`     └ touched a narrow classifier util file:  ${byUtil.length}`);
  line(`   CONTEXT (controller-only, NOT counted): ${context.length}`);
  line();
  line('   Each STRONG commit is a code change about classification that');
  line('   shipped to production = a misclassification that required a deploy.');
  line();
  if (strong.length) {
    line('   Strong commits:');
    for (const h of strong) {
      line(`     ${h.date}  ${h.hash}  [${h.reason}]  ${h.subject}`);
      for (const f of h.specificFiles) line(`                                   └ ${f}`);
    }
    line();
  }
  line('2) DEVICE-CLASSIFICATION-MAP.md errata');
  if (mapDoc.found) {
    line(`   Documented known bugs (§3): ${mapDoc.knownBugs}`);
    line(`   Cross-referenced RFCs: ${mapDoc.rfcRefs.join(', ') || '(none)'}`);
  } else {
    line(`   ${mapDoc.note}`);
  }
  line();
  line('3) Prospective vector (NOT computed here)');
  line('   The A1 migration-snapshot move-count is the direct proxy for');
  line('   accumulated misclassification. Run it once PR A1 exists and report');
  line('   it next to the STRONG count above. Convergence of the two numbers');
  line('   is the evidence John asked for.');
  line();
  line('───────────────────────────────────────────────────────────────');
  line(' Headline: ' +
    `${strong.length} classification-specific deploys in ${MONTHS} months` +
    (mapDoc.found ? `, ${mapDoc.knownBugs} known bugs still open in the map doc.` : '.'));
  line('───────────────────────────────────────────────────────────────');
}
