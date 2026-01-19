/**
 * MYIO Academy Onboard Modal View
 * Reusable modal component with premium "MYIO Academy" footer
 */

import type { OnboardModalConfig, OnboardFooterLink } from './types';

const DEFAULT_FOOTER_LINKS: OnboardFooterLink[] = [
  { label: 'Tutoriais', url: 'https://academy.myio.com.br/tutoriais', icon: '📚' },
  { label: 'Documentação', url: 'https://academy.myio.com.br/docs', icon: '📖' },
  { label: 'Suporte', url: 'https://academy.myio.com.br/suporte', icon: '💬' },
];

export class OnboardModalView {
  private config: OnboardModalConfig;
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  constructor(config: OnboardModalConfig) {
    this.config = {
      width: 800,
      closeOnBackdrop: true,
      showFooter: true,
      footerLinks: DEFAULT_FOOTER_LINKS,
      ...config,
    };
  }

  public render(): void {
    this.injectStyles();
    this.createModal();
    this.attachEventListeners();
  }

  public close(): void {
    if (this.overlay) {
      this.overlay.classList.add('myio-onboard-modal--closing');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
        this.modal = null;
        this.styleElement?.remove();
        this.config.onClose?.();
      }, 200);
    }
  }

  public setContent(content: string | HTMLElement): void {
    const body = this.modal?.querySelector('.myio-onboard-modal__body');
    if (body) {
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else {
        body.innerHTML = '';
        body.appendChild(content);
      }
    }
  }

  public getElement(): HTMLElement | null {
    return this.modal;
  }

  private injectStyles(): void {
    if (document.getElementById('myio-onboard-modal-styles')) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'myio-onboard-modal-styles';
    this.styleElement.textContent = this.getStyles();
    document.head.appendChild(this.styleElement);
  }

  private createModal(): void {
    const width = typeof this.config.width === 'number'
      ? `${this.config.width}px`
      : this.config.width;

    this.overlay = document.createElement('div');
    this.overlay.className = 'myio-onboard-modal-overlay';
    this.overlay.innerHTML = `
      <div class="myio-onboard-modal" style="width: ${width}">
        <div class="myio-onboard-modal__header">
          <div class="myio-onboard-modal__header-content">
            <span class="myio-onboard-modal__logo">🎓</span>
            <h2 class="myio-onboard-modal__title">${this.config.title}</h2>
          </div>
          <button class="myio-onboard-modal__close" aria-label="Fechar">&times;</button>
        </div>
        <div class="myio-onboard-modal__body">
          ${this.renderContent()}
        </div>
        ${this.config.showFooter ? this.renderFooter() : ''}
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.modal = this.overlay.querySelector('.myio-onboard-modal');
  }

  private renderContent(): string {
    if (this.config.iframeUrl) {
      return `
        <iframe
          class="myio-onboard-modal__iframe"
          src="${this.config.iframeUrl}"
          frameborder="0"
          allowfullscreen
        ></iframe>
      `;
    }

    if (this.config.content) {
      if (typeof this.config.content === 'string') {
        return this.config.content;
      }
      return '';
    }

    return '<p>Conteúdo não disponível</p>';
  }

  private renderFooter(): string {
    const links = this.config.footerLinks || DEFAULT_FOOTER_LINKS;
    const linksHtml = links.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="myio-onboard-footer__link">
        ${link.icon ? `<span class="myio-onboard-footer__link-icon">${link.icon}</span>` : ''}
        <span>${link.label}</span>
      </a>
    `).join('');

    return `
      <div class="myio-onboard-footer">
        <div class="myio-onboard-footer__brand">
          <span class="myio-onboard-footer__brand-icon">🎓</span>
          <span class="myio-onboard-footer__brand-text">MYIO Academy</span>
          <span class="myio-onboard-footer__brand-badge">Premium</span>
        </div>
        <div class="myio-onboard-footer__links">
          ${linksHtml}
        </div>
        <div class="myio-onboard-footer__copyright">
          © ${new Date().getFullYear()} MYIO - Todos os direitos reservados
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Close button
    this.overlay?.querySelector('.myio-onboard-modal__close')?.addEventListener('click', () => {
      this.close();
    });

    // Backdrop click
    if (this.config.closeOnBackdrop) {
      this.overlay?.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    // ESC key
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  private getStyles(): string {
    return `
      .myio-onboard-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: myioOnboardFadeIn 0.2s ease;
      }

      .myio-onboard-modal-overlay.myio-onboard-modal--closing {
        animation: myioOnboardFadeOut 0.2s ease forwards;
      }

      @keyframes myioOnboardFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes myioOnboardFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .myio-onboard-modal {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 95vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: myioOnboardSlideIn 0.3s ease;
      }

      @keyframes myioOnboardSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .myio-onboard-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%);
        color: #fff;
      }

      .myio-onboard-modal__header-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .myio-onboard-modal__logo {
        font-size: 28px;
      }

      .myio-onboard-modal__title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .myio-onboard-modal__close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: #fff;
        font-size: 24px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .myio-onboard-modal__close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .myio-onboard-modal__body {
        flex: 1;
        overflow: auto;
        padding: 24px;
        min-height: 200px;
      }

      .myio-onboard-modal__iframe {
        width: 100%;
        height: 100%;
        min-height: 400px;
        border: none;
      }

      /* Premium Footer - MYIO Academy */
      .myio-onboard-footer {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .myio-onboard-footer__brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .myio-onboard-footer__brand-icon {
        font-size: 24px;
      }

      .myio-onboard-footer__brand-text {
        font-size: 18px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.5px;
      }

      .myio-onboard-footer__brand-badge {
        background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
        color: #1e293b;
        font-size: 10px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .myio-onboard-footer__links {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }

      .myio-onboard-footer__link {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #94a3b8;
        text-decoration: none;
        font-size: 14px;
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        transition: all 0.2s;
      }

      .myio-onboard-footer__link:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-2px);
      }

      .myio-onboard-footer__link-icon {
        font-size: 16px;
      }

      .myio-onboard-footer__copyright {
        font-size: 12px;
        color: #64748b;
        text-align: center;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      /* Responsive */
      @media (max-width: 640px) {
        .myio-onboard-modal-overlay {
          padding: 10px;
        }

        .myio-onboard-modal {
          width: 100% !important;
          max-height: 95vh;
        }

        .myio-onboard-modal__header {
          padding: 16px;
        }

        .myio-onboard-modal__title {
          font-size: 16px;
        }

        .myio-onboard-modal__body {
          padding: 16px;
        }

        .myio-onboard-footer {
          padding: 16px;
        }

        .myio-onboard-footer__links {
          flex-direction: column;
          gap: 8px;
        }

        .myio-onboard-footer__link {
          justify-content: center;
        }
      }
    `;
  }
}
