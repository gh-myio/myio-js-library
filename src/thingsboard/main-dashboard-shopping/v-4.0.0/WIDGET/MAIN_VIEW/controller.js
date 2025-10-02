/*********************************************************
 * MYIO – Container 2 states (menu/content)
 * - Ajusta alturas automaticamente
 * - Suporta "menu compacto" via evento global
 * - Mantém simples: os tb-dashboard-state renderizam os
 * dashboards configurados no próprio ThingsBoard.
 *********************************************************/

let globalStartDateFilter = null; // ISO ex.: '2025-09-01T00:00:00-03:00'
let globalEndDateFilter   = null; // ISO ex.: '2025-09-30T23:59:59-03:00'

(function () {
  // Utilitários DOM
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  let rootEl;

  // Atualiza a altura útil do conteúdo e garante que os elementos estão bem posicionados
  function applySizing() {
    try {
      const sidebarW = getCssVar('--sidebar-w');

      // Força recálculo do layout se necessário
      if (rootEl) {
        rootEl.style.display = 'grid';

        // Garante que os tb-child elementos não tenham overflow issues
        const tbChildren = $$('.tb-child', rootEl);
        tbChildren.forEach(child => {
          child.style.overflow = 'hidden';
          child.style.width = '100%';
          child.style.height = '100%';
        });

        // Especial tratamento para o conteúdo principal
        const content = $('.myio-content', rootEl);
        if (content) {
          const contentChild = $('.tb-child', content);
          if (contentChild) {
            contentChild.style.overflow = 'visible';
            contentChild.style.minHeight = '100%';
          }
        }
      }
    } catch (e) {
      console.warn('[myio-container] sizing warn:', e);
    }
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '0px';
  }

  // Alterna o modo "menu compacto" acrescentando/removendo classe no root
  function setMenuCompact(compact) {
    if (!rootEl) return;
    rootEl.classList.toggle('menu-compact', !!compact);

    // Força recálculo após mudança de modo
    setTimeout(() => {
      applySizing();
    }, 50);
  }

  // Exponha dois eventos globais simples (opcionais):
  // window.dispatchEvent(new CustomEvent('myio:menu-compact', { detail: { compact: true } }))
  // window.dispatchEvent(new CustomEvent('myio:menu-expand'))
  function registerGlobalEvents() {
    on(window, 'myio:menu-compact', (ev) => {
      setMenuCompact(ev?.detail?.compact ?? true);
    });
    on(window, 'myio:menu-expand', () => {
      setMenuCompact(false);
    });

    // Adiciona suporte para toggle via evento
    on(window, 'myio:menu-toggle', () => {
      const isCompact = rootEl?.classList.contains('menu-compact');
      setMenuCompact(!isCompact);
    });
  }

  // Detecta mudanças de viewport para aplicar sizing
  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && rootEl) {
      const resizeObserver = new ResizeObserver(() => {
        applySizing();
      });
      resizeObserver.observe(rootEl);
    }
  }

  // ThingsBoard lifecycle
  self.onInit = function () {

    rootEl = $('#myio-root');
    registerGlobalEvents();
    setupResizeObserver();

    // Log útil para conferir se os states existem
    try {
      const states = (ctx?.dashboard?.configuration?.states) || {};
     // console.log('[myio-container] states disponíveis:', Object.keys(states));
      // Esperados: "menu", "telemetry_content"
    } catch (e) {
      console.warn('[myio-container] não foi possível listar states:', e);
    }
  };

  self.onResize = function () {
    applySizing();
  };

  self.onDataUpdated = function () {
    // Normalmente não é necessário aqui, pois cada state cuida do próprio dado.
    // Mas podemos garantir que o layout está correto
    setTimeout(() => {
      applySizing();
    }, 50);
  };

  self.onDestroy = function () {
    // Limpa event listeners se necessário
    if (typeof window !== 'undefined') {
      // Remove custom event listeners se foram adicionados
    }
  };
})();