/**
 * ED-1354 — integração dos indicadores B1/B2/S com o card V5 e a modal do reservatório.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderCardComponentV5 } from '../../../src/components/cards/main-view/v5.2.0/template-card-v5.js';
import { WaterTankModalView } from '../../../src/components/premium-modals/water-tank/WaterTankModalView';
import { renderWellPumpsBodyHTML } from '../../../src/components/well-pumps/WellPumpsModal';
import {
  indicatorsFromModalData,
  indicatorsFromSharedWellValves,
  sharedWellValveIds,
} from '../../../src/components/well-pumps/equipmentState';
import type { EquipmentIndicator } from '../../../src/components/well-pumps/types';

const INDS: EquipmentIndicator[] = [
  { code: 'B1', label: 'Bomba Poço 3', kind: 'pump', active: true, since: Date.now() - 60000 },
  { code: 'B2', label: 'Bomba Poço 4', kind: 'pump', active: false },
  { code: 'S', label: 'Solenoide Sabesp', kind: 'valve', active: false },
];

const wellEntity = (extra: Record<string, unknown> = {}) => ({
  entityId: 'poco-3',
  labelOrName: 'POÇO 3',
  deviceProfile: 'CAIXA_DAGUA',
  deviceIdentifier: 'POÇO 3',
  val: 312,
  deviceStatus: 'power_on',
  waterLevel: 312,
  waterPercentage: 0.72,
  ...extra,
});

function cardEl(ret: any): HTMLElement {
  return ret instanceof Node ? (ret as HTMLElement) : ret[0];
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('card V5 — entityObject.equipmentIndicators', () => {
  it('sem indicadores → card inalterado', () => {
    const el = cardEl(renderCardComponentV5({ entityObject: wellEntity(), enableDragDrop: false }));
    expect(el.querySelector('.myio-eq-strip')).toBeNull();
  });

  it('card principal Sabesp reflete a solenoide compartilhada por tbId, inclusive SEM LEITURA', () => {
    const unknownValve = {
      tbId: 'sabesp-solenoid',
      code: 'S',
      label: 'Solenoide Sabesp',
      history: null,
    };
    const unknown = indicatorsFromSharedWellValves([
      { pumps: [], valves: [unknownValve, { ...unknownValve }, { ...unknownValve, tbId: 'local-valve' }] },
      { pumps: [], valves: [{ ...unknownValve }] },
    ]);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].active).toBeNull();
    expect(sharedWellValveIds([
      { pumps: [], valves: [unknownValve, { ...unknownValve }, { ...unknownValve, tbId: 'local-valve' }] },
      { pumps: [], valves: [{ ...unknownValve }] },
    ])).toEqual(['sabesp-solenoid']);
    expect(indicatorsFromSharedWellValves([
      { pumps: [], valves: [unknownValve, { ...unknownValve, tbId: 'local-valve' }] },
    ])).toEqual([]);

    const principalCard = (equipmentIndicators: EquipmentIndicator[]) =>
      cardEl(
        renderCardComponentV5({
          entityObject: {
            ...wellEntity({
              entityId: 'sabesp-water-entry',
              labelOrName: 'Hidrômetro principal',
              deviceProfile: 'HIDROMETRO_SHOPPING',
              equipmentIndicators,
            }),
          },
          enableDragDrop: false,
        })
      );
    const card = principalCard(unknown);
    expect(card.querySelector('.myio-eq-b.unk')?.getAttribute('data-code')).toBe('S');

    const open = indicatorsFromSharedWellValves([
      {
        pumps: [],
        valves: [
          { ...unknownValve, history: [[Date.now() - 1000, null] as [number, null]] },
          { ...unknownValve, tbId: 'local-valve', history: [[Date.now() - 1000, null] as [number, null]] },
        ],
      },
      {
        pumps: [],
        valves: [{ ...unknownValve, history: [[Date.now() - 1000, null] as [number, null]] }],
      },
    ]);
    const updatedCard = principalCard(open);
    expect(updatedCard.querySelector('.myio-eq-b.open')?.getAttribute('data-code')).toBe('S');
  });

  it('com indicadores → coluna B1/B2/S; clique chama handleActionEquipment com o entityObject', () => {
    const handleActionEquipment = vi.fn();
    const handleClickCard = vi.fn();
    const entity = wellEntity({ equipmentIndicators: INDS });
    const el = cardEl(
      renderCardComponentV5({ entityObject: entity, enableDragDrop: false, handleActionEquipment, handleClickCard })
    );
    const strip = el.querySelector('.device-card-centered .myio-eq-strip') as HTMLElement;
    expect(strip).not.toBeNull();
    expect([...strip.querySelectorAll('.myio-eq-b')].map((b) => b.getAttribute('data-code'))).toEqual(['B1', 'B2', 'S']);
    strip.click();
    expect(handleActionEquipment).toHaveBeenCalledWith(entity);
    expect(handleClickCard).not.toHaveBeenCalled(); // clique não vaza para o card
  });
});

describe('modal do reservatório — equipmentIndicators / headerActions', () => {
  const baseParams = () => ({
    deviceId: 'poco-3',
    tbJwtToken: 'x',
    startTs: Date.now() - 86400000,
    endTs: Date.now(),
    label: 'POÇO 3',
    currentLevel: 72,
  });
  const data = {
    deviceId: 'poco-3',
    telemetry: [],
    summary: { avgLevel: 0, minLevel: 0, maxLevel: 0, totalReadings: 0 },
    metadata: { keys: [], aggregation: 'NONE', limit: 1000 },
  };
  const open = (params: Record<string, unknown>) => {
    const view = new WaterTankModalView({
      context: {
        device: { id: 'poco-3', label: 'POÇO 3', currentLevel: 72 },
        metadata: {},
        timeRange: { startTs: 0, endTs: 1, timezone: 'America/Sao_Paulo' },
      },
      params: { ...baseParams(), ...params } as any,
      data,
      onExport: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    });
    view.render();
    return view;
  };

  it('sem opções → sem tiles nem atalho', () => {
    open({});
    expect(document.querySelector('.myio-water-tank-equipment')).toBeNull();
    expect(document.querySelector('[data-header-action]')).toBeNull();
  });

  it('tiles sob o ícone + atalho no header que chama onClick; update sem re-render', () => {
    const onClick = vi.fn();
    const view = open({
      equipmentIndicators: INDS,
      headerActions: [{ label: 'Bombas', title: 'Abrir status das bombas', indicators: INDS, onClick }],
    });
    const panel = document.querySelector('.myio-water-tank-tank-panel')!;
    expect([...panel.querySelectorAll('.myio-eq-ti')].map((t) => t.className.replace('myio-eq-ti ', ''))).toEqual([
      'on',
      'off',
      'closed',
    ]);

    const btn = document.querySelector('.myio-water-tank-modal-header [data-header-action="0"]') as HTMLElement;
    expect(btn.textContent).toContain('Bombas');
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();

    const next = INDS.map((i) => ({ ...i, active: i.code === 'S' ? true : i.active }));
    view.updateEquipmentIndicators(next);
    expect(panel.querySelector('.myio-eq-ti:last-child')!.className).toContain('open');
    expect(btn.innerHTML).toContain('<i class="open">S</i>');
  });

  it('propaga sem leitura para card, modal do reservatório e modal de automação', () => {
    const data = {
      pumps: [{ code: 'B1', label: 'Bomba sem leitura', history: null }],
      valves: [{ code: 'S', label: 'Solenoide sem leitura', history: null }],
    };
    const indicators = indicatorsFromModalData(data);
    const card = cardEl(
      renderCardComponentV5({
        entityObject: wellEntity({ equipmentIndicators: indicators }),
        enableDragDrop: false,
      })
    );
    expect(card.querySelectorAll('.myio-eq-b.unk')).toHaveLength(2);

    open({ equipmentIndicators: indicators });
    expect(document.querySelectorAll('.myio-water-tank-equipment .myio-eq-ti.unk')).toHaveLength(2);

    const modal = document.createElement('div');
    modal.innerHTML = renderWellPumpsBodyHTML(data);
    expect(modal.querySelectorAll('.myio-wp-state.unk')).toHaveLength(2);
    expect(modal.textContent).toContain('SEM LEITURA');
  });
});
