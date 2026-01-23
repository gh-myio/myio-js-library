/**
 * MYIO Academy Onboard Modal
 * Opens a reusable modal with premium "MYIO Academy" footer
 */

import type { OnboardModalConfig, OnboardModalHandle } from './types';
import { OnboardModalView } from './OnboardModalView';

/**
 * Opens an onboard modal with MYIO Academy premium footer
 *
 * @param config - Modal configuration
 * @returns Handle to control the modal
 *
 * @example
 * // Open with iframe
 * const modal = openOnboardModal({
 *   title: 'Tutorial: Primeiros Passos',
 *   iframeUrl: 'https://academy.myio.com.br/tutorial/intro'
 * });
 *
 * @example
 * // Open with HTML content
 * const modal = openOnboardModal({
 *   title: 'Bem-vindo ao MYIO',
 *   content: '<div>Conteúdo personalizado aqui</div>',
 *   width: 600
 * });
 *
 * @example
 * // Custom footer links
 * const modal = openOnboardModal({
 *   title: 'Ajuda',
 *   content: 'Conteúdo de ajuda...',
 *   footerLinks: [
 *     { label: 'FAQ', url: 'https://academy.myio.com.br/faq', icon: '❓' },
 *     { label: 'Contato', url: 'https://academy.myio.com.br/contato', icon: '📧' }
 *   ]
 * });
 */
export function openOnboardModal(config: OnboardModalConfig): OnboardModalHandle {
  const view = new OnboardModalView(config);
  view.render();

  return {
    close: () => view.close(),
    setContent: (content: string | HTMLElement) => view.setContent(content),
    getElement: () => view.getElement(),
  };
}

/**
 * Opens a tutorial modal with iframe content
 * Convenience function for common tutorial use case
 *
 * @param title - Modal title
 * @param tutorialUrl - URL to load in iframe
 * @param options - Additional options
 */
export function openTutorialModal(
  title: string,
  tutorialUrl: string,
  options?: Partial<Omit<OnboardModalConfig, 'title' | 'iframeUrl'>>
): OnboardModalHandle {
  return openOnboardModal({
    title,
    iframeUrl: tutorialUrl,
    width: 900,
    ...options,
  });
}

/**
 * Opens a help/documentation modal
 * Convenience function with documentation-focused defaults
 *
 * @param title - Modal title
 * @param content - HTML content or string
 * @param options - Additional options
 */
export function openHelpModal(
  title: string,
  content: string | HTMLElement,
  options?: Partial<Omit<OnboardModalConfig, 'title' | 'content'>>
): OnboardModalHandle {
  return openOnboardModal({
    title,
    content,
    width: 700,
    footerLinks: [
      { label: 'Documentação', url: 'https://academy.myio.com.br/docs', icon: '📖' },
      { label: 'FAQ', url: 'https://academy.myio.com.br/faq', icon: '❓' },
      { label: 'Suporte', url: 'https://academy.myio.com.br/suporte', icon: '💬' },
    ],
    ...options,
  });
}
