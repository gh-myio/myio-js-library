// ModalHeader.generateInlineHTML — opção `solid`: cor primária também no tema light.
import { describe, it, expect } from 'vitest';
import { ModalHeader } from '../../src/utils/ModalHeader';

const base = { icon: '🌡️', title: 'Teste', modalId: 'm1', primaryColor: '#2f5e46' };

describe('ModalHeader.generateInlineHTML — solid', () => {
  it('light sem solid: gradiente cinza (comportamento antigo preservado)', () => {
    const html = ModalHeader.generateInlineHTML({ ...base, theme: 'light' });
    expect(html).toContain('linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%)');
    expect(html).not.toContain('background: #2f5e46');
  });

  it('light com solid: cor do dashboard + texto branco; toggle segue o tema light (🌙)', () => {
    const html = ModalHeader.generateInlineHTML({ ...base, theme: 'light', solid: true });
    expect(html).toContain('background: #2f5e46');
    expect(html).toContain('color: white');
    expect(html).toContain('🌙');
  });
});
