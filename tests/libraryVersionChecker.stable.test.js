// tests/libraryVersionChecker.stable.test.js
//
// RFC-0137 follow-up: the version checker must resolve the latest NON-homolog
// (stable) release, never the `homolog` dist-tag / `-homolog` build.

import { describe, it, expect } from 'vitest';
import {
  isHomologVersion,
  resolveLatestStableVersion,
} from '../src/components/library-version-checker/index.js';

describe('libraryVersionChecker — stable (non-homolog) resolution', () => {
  it('isHomologVersion flags the homolog dist-tag value and any -homolog suffix', () => {
    expect(isHomologVersion('0.1.515-homolog.0', '0.1.515-homolog.0')).toBe(true);
    expect(isHomologVersion('0.1.515-homolog.0')).toBe(true); // by suffix alone
    expect(isHomologVersion('0.1.523', '0.1.515-homolog.0')).toBe(false);
    expect(isHomologVersion('', '0.1.515-homolog.0')).toBe(true); // empty -> treat as non-stable
  });

  it('uses the latest dist-tag when it is stable (the real registry shape today)', () => {
    const data = {
      'dist-tags': { homolog: '0.1.515-homolog.0', latest: '0.1.523' },
      versions: { '0.1.515-homolog.0': {}, '0.1.522': {}, '0.1.523': {} },
    };
    expect(resolveLatestStableVersion(data)).toBe('0.1.523');
  });

  it('NEVER returns homolog even if it is numerically higher than latest', () => {
    const data = {
      'dist-tags': { homolog: '0.2.0-homolog.3', latest: '0.1.523' },
      versions: { '0.1.523': {}, '0.2.0-homolog.3': {} },
    };
    expect(resolveLatestStableVersion(data)).toBe('0.1.523');
  });

  it('falls back to the highest stable version if latest dist-tag points to a homolog build', () => {
    const data = {
      'dist-tags': { homolog: '0.1.524-homolog.0', latest: '0.1.524-homolog.0' },
      versions: {
        '0.1.522': {},
        '0.1.523': {},
        '0.1.524-homolog.0': {},
      },
    };
    expect(resolveLatestStableVersion(data)).toBe('0.1.523');
  });

  it('returns null when there is no stable version at all', () => {
    const data = {
      'dist-tags': { homolog: '0.1.0-homolog.0', latest: '0.1.0-homolog.0' },
      versions: { '0.1.0-homolog.0': {} },
    };
    expect(resolveLatestStableVersion(data)).toBeNull();
  });
});
