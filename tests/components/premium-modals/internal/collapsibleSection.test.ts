import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderCollapsibleSectionHeader,
  renderCollapsibleLeafRow,
  injectCollapsibleSectionStyles,
  escapeHtml,
} from '../../../../src/components/premium-modals/internal/collapsible-section';

function parseRow(html: string): HTMLTableRowElement {
  const table = document.createElement('table');
  table.innerHTML = `<tbody>${html}</tbody>`;
  return table.querySelector('tr')!;
}

describe('CollapsibleSection header renderer', () => {
  it('renders the collapsed state: right caret, aria-expanded=false, ancestors joined', () => {
    const row = parseRow(
      renderCollapsibleSectionHeader({
        sectionKey: 'dev:123',
        ancestorKeys: ['grp:Lojas'],
        level: 1,
        title: 'McDonalds (SCMAL1230B)',
        meta: '16 dias',
        totalLabel: '1.204,53 kWh',
        collapsed: true,
        colSpan: 3,
      })
    );
    expect(row.dataset.sectionToggle).toBe('dev:123');
    expect(row.dataset.ancestors).toBe('grp:Lojas');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.querySelector('.rp-section-caret')?.textContent).toBe('▶');
    expect(row.querySelector('.rp-section-title')?.textContent).toBe('McDonalds (SCMAL1230B)');
    expect(row.querySelector('.rp-section-meta')?.textContent).toBe('16 dias');
    expect(row.querySelector('.rp-section-total')?.textContent).toBe('1.204,53 kWh');
    expect(row.querySelector('.rp-section-badge')).toBeNull();
  });

  it('renders the expanded state and the AC19 "dados incompletos" badge when incomplete', () => {
    const row = parseRow(
      renderCollapsibleSectionHeader({
        sectionKey: 'dev:999',
        ancestorKeys: [],
        level: 1,
        title: 'Broken Sensor',
        meta: '0 dias',
        totalLabel: '—',
        collapsed: false,
        colSpan: 3,
        incomplete: true,
      })
    );
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.querySelector('.rp-section-caret')?.textContent).toBe('▼');
    expect(row.querySelector('.rp-section-badge')?.textContent).toBe('dados incompletos');
  });

  it('escapes device names/labels to prevent HTML injection from API-sourced strings', () => {
    const row = parseRow(
      renderCollapsibleSectionHeader({
        sectionKey: 'dev:1',
        ancestorKeys: [],
        level: 1,
        title: '<img src=x onerror=alert(1)>',
        totalLabel: '0',
        collapsed: false,
        colSpan: 3,
      })
    );
    expect(row.querySelector('.rp-section-title')?.innerHTML).not.toContain('<img');
    expect(row.querySelector('.rp-section-title')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('CollapsibleSection leaf row renderer', () => {
  it('joins ancestor keys and renders caller-provided cells verbatim', () => {
    const row = parseRow(
      renderCollapsibleLeafRow({
        ancestorKeys: ['grp:Lojas', 'dev:123'],
        level: 2,
        cells: ['<td>15/07</td>', '<td>10,00</td>'],
      })
    );
    expect(row.dataset.ancestors).toBe('grp:Lojas dev:123');
    expect(row.classList.contains('rp-section-row--level-2')).toBe(true);
    expect(row.children.length).toBe(2);
    expect(row.children[0].textContent).toBe('15/07');
  });

  it('H1 (code review): an encoded ancestor key round-trips through the space-joined data-ancestors serialization even when the source label contains a space', () => {
    // The renderer itself just joins ancestorKeys with ' ' — callers (e.g.
    // AllReportModal.sectionGroupKey) are responsible for encoding any key
    // built from a label. A group label like "Área Comum" must be passed in
    // pre-encoded (grp:%C3%81rea%20Comum), never as the raw "grp:Área Comum"
    // — the latter would split into ['grp:Área', 'Comum'], two tokens that
    // match nothing.
    const groupLabel = 'Área Comum';
    const encodedGroupKey = `grp:${encodeURIComponent(groupLabel)}`;
    const row = parseRow(
      renderCollapsibleLeafRow({
        ancestorKeys: [encodedGroupKey, 'dev:123'],
        level: 2,
        cells: ['<td>15/07</td>', '<td>10,00</td>'],
      })
    );
    const tokens = (row.dataset.ancestors || '').split(' ').filter(Boolean);
    expect(tokens).toEqual([encodedGroupKey, 'dev:123']);
    expect(tokens.length).toBe(2);
  });
});

describe('escapeHtml', () => {
  it('escapes the five reserved HTML characters', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });
});

describe('injectCollapsibleSectionStyles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects styles idempotently', () => {
    injectCollapsibleSectionStyles();
    injectCollapsibleSectionStyles();
    expect(document.querySelectorAll('#myio-collapsible-section-styles').length).toBe(1);
  });
});
