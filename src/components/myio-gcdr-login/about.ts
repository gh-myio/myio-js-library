/**
 * RFC-0236 §4.2 — built-in aside contents: GCDR's "Sobre a MYIO" panel
 * (AuthAboutPanel.tsx at d71179b) and the signed-out prompt (QrSignInPrompt.tsx).
 * Content links to public MYIO sites are constants copied from GCDR; GCDR-web
 * routes need an explicit `webUrl` and are hidden without it. No environment
 * API URL is defaulted here (the health URL comes from the caller).
 */
import { h, icon } from './dom';
import { ICONS } from './icons';
import type { MyioGcdrSlotContext } from './types';

type T = (key: string, vars?: Record<string, string | number>) => string;

interface Item { key: string; to?: string; web?: boolean; health?: boolean }
interface Category { key: string; icon: keyof typeof ICONS; items: Item[] }

const CATEGORIES: Category[] = [
  { key: 'wiki', icon: 'book', items: [
    { key: 'wikiHome', to: '/wiki/p', web: true },
    { key: 'wikiSearch', to: '/wiki/p/search', web: true },
    { key: 'accountGuide', to: '/wiki/p/User-Guides/acesso-a-conta', web: true },
  ] },
  { key: 'support', icon: 'headset', items: [
    { key: 'openTicket', to: '/support', web: true },
    { key: 'forgotPassword', to: '/forgot-password', web: true },
  ] },
  { key: 'integrations', icon: 'plug', items: [
    { key: 'docsAlarms', to: 'https://alarms-api.a.myio-bas.com/docs' },
    { key: 'docsGcdr', to: 'https://gcdr-api.a.myio-bas.com/docs/' },
    { key: 'docsIngestion', to: 'https://api.data.apps.myio-bas.com/api/docs/' },
    { key: 'docsThingsboard', to: 'https://dashboard.myio-bas.com/swagger-ui/index.html' },
    { key: 'integrationsGuide', to: '/wiki/p/Integrations/index', web: true },
    { key: 'newIntegration', to: '/wiki/p/integrations/new', web: true },
  ] },
  { key: 'systems', icon: 'grid', items: [
    { key: 'app', to: 'https://app.apps.myio-bas.com' },
    { key: 'dashboards', to: 'https://dashboard.myio-bas.com' },
    { key: 'alarms', to: 'https://alarms-web.a.myio-bas.com' },
  ] },
  { key: 'institutional', icon: 'building', items: [
    { key: 'site', to: 'https://myio.com.br' },
    { key: 'privacy', to: 'https://myio.com.br/politica-de-privacidade' },
    { key: 'terms' },
  ] },
  { key: 'status', icon: 'activity', items: [{ key: 'gcdrHealth', health: true }] },
];

/** The "Atendimento → Abrir chamado" target, used as the default support link. */
export function defaultSupportHref(webUrl?: string): string | undefined {
  return webUrl ? `${webUrl.replace(/\/+$/, '')}/support` : undefined;
}

export interface AboutOptions {
  healthUrl?: string | false;
  webUrl?: string;
  fetchImpl?: typeof fetch;
  bandColor?: string;
}

export function renderAbout(el: HTMLElement, ctx: MyioGcdrSlotContext, t: T, opts: AboutOptions): () => void {
  const doc = el.ownerDocument;
  const { body } = ctx.panel({ eyebrow: t('about.eyebrow'), fill: true, logo: false, bandColor: opts.bandColor ?? '#2E8B57' });
  const web = opts.webUrl?.replace(/\/+$/, '');
  const visibleCats = CATEGORIES.filter((c) => (c.key === 'status' ? !!opts.healthUrl : true));
  let healthAbort: AbortController | null = null;

  const showGrid = () => {
    body.textContent = '';
    const title = h(doc, 'h2', { class: 'myio-gcdr-about__title' }, `${t('about.title')} `, h(doc, 'em', { text: t('about.titleHighlight') }));
    const intro = h(doc, 'p', { class: 'myio-gcdr-about__intro', text: t('about.text') });
    const grid = h(doc, 'div', { class: 'myio-gcdr-about__grid' });
    for (const c of visibleCats) {
      const btn = h(doc, 'button', { type: 'button', class: 'myio-gcdr-about__tile' },
        icon(doc, ICONS[c.icon](22), 'myio-gcdr-about__tileicon'),
        h(doc, 'span', { class: 'myio-gcdr-about__tiletitle', text: t(`about.cat.${c.key}`) }),
        h(doc, 'span', { class: 'myio-gcdr-about__tiletext', text: t(`about.cat.${c.key}.text`) }));
      btn.addEventListener('click', () => showCategory(c));
      grid.appendChild(btn);
    }
    body.append(title, intro, grid, h(doc, 'p', { class: 'myio-gcdr-about__tagline', text: t('about.tagline') }));
  };

  const showCategory = (c: Category) => {
    body.textContent = '';
    const back = h(doc, 'button', { type: 'button', class: 'myio-gcdr-login__link myio-gcdr-about__back' }, icon(doc, ICONS.arrowLeft(14)), ` ${t('about.back')}`);
    back.addEventListener('click', () => { showGrid(); (body.querySelector('button') as HTMLElement | null)?.focus(); });
    const title = h(doc, 'h2', { class: 'myio-gcdr-about__title', text: t(`about.cat.${c.key}`) });
    const grid = h(doc, 'div', { class: 'myio-gcdr-about__grid' });
    for (const it of c.items) {
      const label = t(`about.item.${it.key}`);
      if (it.health) {
        const dot = h(doc, 'span', { class: 'myio-gcdr-about__dot', 'data-state': 'checking' });
        const state = h(doc, 'span', { class: 'myio-gcdr-about__health', role: 'status' }, dot, h(doc, 'span', { text: t('about.health.checking') }));
        grid.appendChild(h(doc, 'div', { class: 'myio-gcdr-about__tile', 'aria-disabled': 'true' },
          h(doc, 'span', { class: 'myio-gcdr-about__tiletitle', text: label }), state));
        checkHealth(dot, state.lastChild as HTMLElement);
        continue;
      }
      const href = it.to ? (it.web ? (web ? `${web}${it.to}` : undefined) : it.to) : undefined;
      if (it.web && !href) continue; // GCDR-web route without an explicit web URL: hidden
      if (!href) {
        grid.appendChild(h(doc, 'div', { class: 'myio-gcdr-about__tile', 'aria-disabled': 'true' },
          h(doc, 'span', { class: 'myio-gcdr-about__tiletitle', text: label }),
          h(doc, 'span', { class: 'myio-gcdr-about__tiletext', text: t('about.soon') })));
        continue;
      }
      grid.appendChild(h(doc, 'a', { class: 'myio-gcdr-about__tile', href, target: '_blank', rel: 'noopener noreferrer' },
        h(doc, 'span', { class: 'myio-gcdr-about__tiletitle', text: label }),
        h(doc, 'span', { class: 'myio-gcdr-about__tiletext' }, `${t('about.open')} `, icon(doc, ICONS.external(12)))));
    }
    body.append(back, title, grid);
    back.focus();
  };

  const checkHealth = (dot: HTMLElement, label: HTMLElement) => {
    if (!opts.healthUrl) return;
    const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
    if (!f) return;
    healthAbort?.abort();
    const ac = new AbortController();
    healthAbort = ac;
    const timer = setTimeout(() => ac.abort(), 5000);
    f(opts.healthUrl, { signal: ac.signal, credentials: 'omit' })
      .then((r) => r.ok)
      .catch(() => false)
      .then((up) => {
        clearTimeout(timer);
        if (ac.signal.aborted && healthAbort !== ac) return;
        dot.setAttribute('data-state', up ? 'online' : 'offline');
        label.textContent = t(up ? 'about.health.online' : 'about.health.offline');
      });
  };

  showGrid();
  return () => healthAbort?.abort();
}

export function renderSignedOutPrompt(el: HTMLElement, ctx: MyioGcdrSlotContext, text: string): void {
  const doc = el.ownerDocument;
  const { body } = ctx.panel({ eyebrow: '', fill: true, logo: false });
  const band = body.parentElement?.querySelector('.myio-gcdr-panel__band');
  band?.remove();
  body.appendChild(
    h(doc, 'div', { class: 'myio-gcdr-prompt' },
      icon(doc, ICONS.lock(28), 'myio-gcdr-prompt__icon'),
      h(doc, 'p', { class: 'myio-gcdr-prompt__text', text }))
  );
}
