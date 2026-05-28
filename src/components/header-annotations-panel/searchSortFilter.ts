/**
 * RFC-0203 M5 — Pure helpers for search / sort / filter on the panel.
 *
 * - nfdNormalize: NFD + diacritic strip + lowercase (AC-21)
 * - highlightMatches: wraps matched substrings in <mark> (AC-22)
 * - sortGroups: 6 sort modes (AC-23)
 * - SORT_OPTIONS: dropdown metadata
 * - DEFAULT_FILTER: empty filter state
 * - countAnnotationsInGroups: total non-archived items (drives "N anotações") (AC-26)
 */

import type {
  AnnotationFilter,
  AnnotationGroup,
  AnnotationSortKey,
  AnnotationType,
  AnnotationStatus,
} from '../../services/annotations/types';

// ─── Search helpers ────────────────────────────────────────────────────────

/**
 * Normalize a string for accent/case-insensitive comparison.
 * AC-21: applied symmetrically to needle and haystack.
 */
export function nfdNormalize(s: string): string {
  if (!s) return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Wrap matches of `term` in `text` with `<mark>` tags. Returns ALREADY-ESCAPED
 * HTML. Caller MUST pass already-escaped text (do not double-escape).
 *
 * Implementation: walks the normalized text to find ranges, then maps the
 * ranges back to the original text positions (1:1 since normalize keeps
 * codepoint count for our typical inputs).
 *
 * AC-22.
 */
export function highlightMatches(escapedText: string, term: string): string {
  if (!term) return escapedText;
  const needle = nfdNormalize(term);
  if (!needle) return escapedText;

  // Operate on the ORIGINAL text codepoints so positions line up with
  // the escapedText we received. Build a parallel lowercase-stripped version
  // sized to the same length.
  const lowered = nfdNormalize(escapedText);

  let result = '';
  let i = 0;
  while (i < escapedText.length) {
    const found = lowered.indexOf(needle, i);
    if (found === -1) {
      result += escapedText.slice(i);
      break;
    }
    result += escapedText.slice(i, found);
    result +=
      '<mark>' + escapedText.slice(found, found + needle.length) + '</mark>';
    i = found + needle.length;
  }
  return result;
}

// ─── Sort helpers ──────────────────────────────────────────────────────────

export interface SortOption {
  key: AnnotationSortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: 'alpha-asc', label: 'Alfabética (A → Z)' },
  { key: 'alpha-desc', label: 'Alfabética (Z → A)' },
  { key: 'count-desc', label: 'Mais anotações' },
  { key: 'count-asc', label: 'Menos anotações' },
  { key: 'importance-desc', label: 'Maior importância' },
  { key: 'recent-desc', label: 'Mais recente' },
];

export const DEFAULT_SORT: AnnotationSortKey = 'alpha-asc';

/**
 * Returns a new array with the groups sorted according to `key`. Original
 * order is preserved as the tiebreaker (stable).
 *
 * AC-23.
 */
export function sortGroups(
  groups: AnnotationGroup[],
  key: AnnotationSortKey
): AnnotationGroup[] {
  const arr = groups.slice();
  const cmp = _comparator(key);
  arr.sort((a, b) => cmp(a, b));
  return arr;
}

function _comparator(
  key: AnnotationSortKey
): (a: AnnotationGroup, b: AnnotationGroup) => number {
  switch (key) {
    case 'alpha-asc':
      return (a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
    case 'alpha-desc':
      return (a, b) => b.label.localeCompare(a.label, 'pt-BR', { sensitivity: 'base' });
    case 'count-desc':
      return (a, b) => (b.totalAnnotations - a.totalAnnotations) ||
        a.label.localeCompare(b.label, 'pt-BR');
    case 'count-asc':
      return (a, b) => (a.totalAnnotations - b.totalAnnotations) ||
        a.label.localeCompare(b.label, 'pt-BR');
    case 'importance-desc':
      return (a, b) => (b.maxImportance - a.maxImportance) ||
        (b.totalAnnotations - a.totalAnnotations);
    case 'recent-desc':
      return (a, b) => _compareIsoDesc(a.mostRecentAt, b.mostRecentAt);
    default:
      return () => 0;
  }
}

function _compareIsoDesc(a: string | null, b: string | null): number {
  // Most recent first; nulls last
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

// ─── Filter helpers ────────────────────────────────────────────────────────

/**
 * Default filter (RFC-0203 follow-up):
 *   - statuses pre-checks {'created','modified'}; 'archived' stays UNchecked
 *     so the panel hides archived by default. User toggles 'archived' to
 *     include archived items (re-fetch is automatic via re-render).
 */
export function createDefaultFilter(): AnnotationFilter {
  return {
    types: new Set<AnnotationType>(),
    statuses: new Set<AnnotationStatus>(['created', 'modified']),
    importance: new Set<1 | 2 | 3 | 4 | 5>(),
    actionableOnly: false,
    searchTerm: '',
  };
}

export const FILTER_TYPE_OPTIONS: { id: AnnotationType; label: string; icon: string }[] = [
  { id: 'observation', label: 'Observação', icon: '📝' },
  { id: 'pending', label: 'Pendência', icon: '⚠️' },
  { id: 'maintenance', label: 'Manutenção', icon: '🔧' },
  { id: 'activity', label: 'Atividade', icon: '✓' },
];

export const FILTER_STATUS_OPTIONS: { id: AnnotationStatus; label: string }[] = [
  { id: 'created', label: 'Criada' },
  { id: 'modified', label: 'Modificada' },
  { id: 'archived', label: 'Arquivada' }, // AC-27: off by default; toggle exposes it
];

// ─── Stats ─────────────────────────────────────────────────────────────────

/**
 * Sums non-archived annotations across groups. The orchestrator already
 * filters when called with a `filter` arg; this is just a defensive total
 * for the visible groups in the panel header (AC-26).
 */
export function countAnnotationsInGroups(groups: AnnotationGroup[]): number {
  let n = 0;
  for (const g of groups) n += g.totalAnnotations;
  return n;
}

// ─── Toggle helpers (immutable for predictable state updates) ──────────────

export function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function withSearchTerm(filter: AnnotationFilter, term: string): AnnotationFilter {
  return { ...filter, searchTerm: term };
}
