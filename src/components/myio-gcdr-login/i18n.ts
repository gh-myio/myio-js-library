/**
 * RFC-0236 — built-in dictionaries. Wording copied from gcdr-frontend
 * `src/i18n/locales/{pt-BR,en}/auth.json` and `qrCode.json` at d71179b,
 * plus the keys this RFC adds (marked "new").
 */
import type { Localized, MyioGcdrLocale } from './types';

type Dict = Record<string, string>;

const PT: Dict = {
  'login.eyebrow': 'Acesso',
  'login.title': 'Login',
  'login.email': 'E-mail',
  'login.password': 'Senha',
  'login.rememberMe': 'Lembrar de mim',
  'login.forgotPassword': 'Esqueceu a senha?',
  'login.signIn': 'Entrar',
  'login.signingIn': 'Entrando...',
  'login.noAccount': 'Não tem uma conta?',
  'login.createAccount': 'Criar conta',
  'login.emailRequired': 'Informe o seu e-mail.',
  'login.emailInvalid': 'Informe um e-mail válido, como nome@empresa.com.',
  'login.emailPlaceholder': 'nome@empresa.com',
  // new
  'login.passwordRequired': 'Informe a sua senha.',
  'login.showPassword': 'Mostrar senha',
  'login.hidePassword': 'Ocultar senha',
  'login.capsLockOn': 'Caps Lock está ativado.',
  'login.notYou': 'Não é você?',
  'login.askAdmin': 'Precisa de acesso? Fale com o administrador do sistema.',
  'login.newTab': '(abre em nova aba)',
  'login.gcdrWeb': 'Entrar pelo GCDR Web',
  'login.support': 'Falar com o suporte',
  'login.leaving': 'Saindo...',

  'errors.invalidCredentials': 'E-mail ou senha inválidos',
  'errors.networkError': 'Erro de conexão. Verifique sua internet.',
  'errors.loginFailed': 'Não foi possível entrar no momento. Tente novamente em instantes.',
  'errors.lockedTitle': 'Conta bloqueada',
  'errors.lockedText':
    'Esta conta foi bloqueada após 6 tentativas de login com senha incorreta (ou por um administrador). Por segurança, somente um administrador pode liberar o acesso — os administradores já foram avisados por e-mail.',
  'errors.attemptsLeft_one': 'Senha incorreta — resta {{count}} tentativa.',
  'errors.attemptsLeft_other': 'Senha incorreta — restam {{count}} tentativas.',
  'errors.lastAttempt': 'Senha incorreta — esta é a sua última tentativa.',
  'errors.lockWarning':
    'Na 6ª senha errada a conta é bloqueada e só um administrador consegue liberar. Se não lembra a senha, redefina agora em vez de tentar de novo.',
  'errors.goToForgot': 'Esqueci minha senha — redefinir agora',
  'errors.invalidWithAttempts_one': 'E-mail ou senha inválidos. Resta {{count}} tentativa antes do bloqueio.',
  'errors.invalidWithAttempts_other': 'E-mail ou senha inválidos. Restam {{count}} tentativas antes do bloqueio.',
  'errors.captchaFailed':
    'Não foi possível confirmar que você não é um robô. Aguarde a verificação e tente de novo.',
  // new
  'errors.tooManyRequests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'errors.timeout': 'O servidor demorou para responder. Tente novamente.',
  'errors.integrationError': 'Não foi possível entrar no momento. Tente novamente em instantes.',
  'errors.mfaUnsupported':
    'Esta conta exige verificação em duas etapas, ainda não disponível nesta tela.',
  'errors.postLoginFailed': 'Não foi possível concluir a entrada. Tente novamente.',
  'errors.leaveFailed': 'Não foi possível sair agora. Tente novamente.',
  'errors.captchaLoadFailed': 'Não foi possível carregar a verificação.',
  'errors.invalidCredentialsHelp':
    'Confira o e-mail digitado. Se estiver correto e você tiver certeza da senha, sua conta pode ainda não estar liberada — {{who}}.',
  'errors.helpSupport': 'fale com o suporte',
  'errors.helpAdmin': 'fale com o administrador do sistema',

  'notice.sessionExpired': 'Sua sessão expirou. Por favor, entre novamente.',
  'notice.sessionExpiredModal': 'Sua sessão expirou. Entre novamente — esta tela será mantida.',

  'aside.signedOutPrompt': 'Faça o login para ter acesso às funcionalidades.',
  'about.eyebrow': 'Sobre a MYIO',
  'about.title': 'Medição e atuação remota',
  'about.titleHighlight': 'IoT',
  'about.text': 'Escolha um assunto para ver o que você pode acessar sem entrar na conta.',
  'about.tagline': 'Eficiência | Segurança | Sustentabilidade',
  'about.health.checking': 'Verificando…',
  'about.health.online': 'No ar',
  'about.health.offline': 'Indisponível',
  'about.back': 'Voltar',
  'about.open': 'Abrir',
  'about.soon': 'Em breve',
  'about.cat.wiki': 'Wiki',
  'about.cat.wiki.text': 'Base de conhecimento, guias e respostas.',
  'about.cat.support': 'Atendimento',
  'about.cat.support.text': 'Chamados, tickets e dúvidas.',
  'about.cat.integrations': 'Integrações',
  'about.cat.integrations.text': 'Documentação das APIs e guias de integração.',
  'about.cat.systems': 'Sistemas',
  'about.cat.systems.text': 'Acesso aos sistemas MYIO.',
  'about.cat.institutional': 'Institucional',
  'about.cat.institutional.text': 'Sobre a MYIO, site, privacidade e termos.',
  'about.cat.status': 'Status',
  'about.cat.status.text': 'Situação dos sistemas agora.',
  'about.item.wikiHome': 'Wiki pública',
  'about.item.wikiSearch': 'Buscar na wiki',
  'about.item.accountGuide': 'Acesso à conta',
  'about.item.openTicket': 'Abrir chamado',
  'about.item.forgotPassword': 'Esqueci minha senha',
  'about.item.docsAlarms': 'Alarms',
  'about.item.docsGcdr': 'GCDR',
  'about.item.docsIngestion': 'Ingestion',
  'about.item.docsThingsboard': 'ThingsBoard',
  'about.item.integrationsGuide': 'Guia de integrações',
  'about.item.newIntegration': 'Cadastrar integração',
  'about.item.app': 'App MYIO',
  'about.item.dashboards': 'Dashboards',
  'about.item.alarms': 'Alarmes',
  'about.item.site': 'Site da MYIO',
  'about.item.privacy': 'Privacidade',
  'about.item.terms': 'Termos de serviço',
  'about.item.gcdrHealth': 'GCDR',

  'toolbar.toDark': 'Usar tema escuro',
  'toolbar.toLight': 'Usar tema claro',
  'toolbar.language': 'Idioma',
  'modal.close': 'Fechar',
};

const EN: Dict = {
  'login.eyebrow': 'Access',
  'login.title': 'Login',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.rememberMe': 'Remember me',
  'login.forgotPassword': 'Forgot password?',
  'login.signIn': 'Sign In',
  'login.signingIn': 'Signing in...',
  'login.noAccount': "Don't have an account?",
  'login.createAccount': 'Create account',
  'login.emailRequired': 'Enter your e-mail.',
  'login.emailInvalid': 'Enter a valid e-mail, like name@company.com.',
  'login.emailPlaceholder': 'name@company.com',
  'login.passwordRequired': 'Enter your password.',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.capsLockOn': 'Caps Lock is on.',
  'login.notYou': 'Not you?',
  'login.askAdmin': 'Need access? Contact your system administrator.',
  'login.newTab': '(opens in a new tab)',
  'login.gcdrWeb': 'Sign in on GCDR Web',
  'login.support': 'Contact support',
  'login.leaving': 'Leaving...',

  'errors.invalidCredentials': 'Invalid e-mail or password',
  'errors.networkError': 'Network error. Please check your connection.',
  'errors.loginFailed': 'Unable to sign in right now. Please try again shortly.',
  'errors.lockedTitle': 'Account locked',
  'errors.lockedText':
    'This account was locked after 6 sign-in attempts with a wrong password (or by an administrator). For security, only an administrator can unlock it — the administrators were already notified by e-mail.',
  'errors.attemptsLeft_one': 'Wrong password — {{count}} attempt left.',
  'errors.attemptsLeft_other': 'Wrong password — {{count}} attempts left.',
  'errors.lastAttempt': 'Wrong password — this is your last attempt.',
  'errors.lockWarning':
    "On the 6th wrong password the account is locked and only an administrator can unlock it. If you don't remember the password, reset it now instead of trying again.",
  'errors.goToForgot': 'Forgot my password — reset now',
  'errors.invalidWithAttempts_one': 'Invalid e-mail or password. {{count}} attempt left before the lock.',
  'errors.invalidWithAttempts_other': 'Invalid e-mail or password. {{count}} attempts left before the lock.',
  'errors.captchaFailed': 'Could not confirm you are not a robot. Wait for the check and try again.',
  'errors.tooManyRequests': 'Too many attempts. Wait a few minutes and try again.',
  'errors.timeout': 'The server took too long to answer. Please try again.',
  'errors.integrationError': 'Unable to sign in right now. Please try again shortly.',
  'errors.mfaUnsupported': 'This account requires two-step verification, not yet available on this screen.',
  'errors.postLoginFailed': 'Could not finish signing in. Please try again.',
  'errors.leaveFailed': 'Could not leave right now. Please try again.',
  'errors.captchaLoadFailed': 'Could not load the verification.',
  'errors.invalidCredentialsHelp':
    'Check the e-mail you typed. If it is right and you are sure of the password, your account may not be enabled yet — {{who}}.',
  'errors.helpSupport': 'contact support',
  'errors.helpAdmin': 'contact your system administrator',

  'notice.sessionExpired': 'Your session has expired. Please sign in again.',
  'notice.sessionExpiredModal': 'Your session has expired. Sign in again — this screen will be kept.',

  'aside.signedOutPrompt': 'Sign in to access the features.',
  'about.eyebrow': 'About MYIO',
  'about.title': 'Remote metering and control',
  'about.titleHighlight': 'IoT',
  'about.text': 'Pick a subject to see what you can reach without signing in.',
  'about.tagline': 'Efficiency | Safety | Sustainability',
  'about.health.checking': 'Checking…',
  'about.health.online': 'Up',
  'about.health.offline': 'Unavailable',
  'about.back': 'Back',
  'about.open': 'Open',
  'about.soon': 'Coming soon',
  'about.cat.wiki': 'Wiki',
  'about.cat.wiki.text': 'Knowledge base, guides and answers.',
  'about.cat.support': 'Support',
  'about.cat.support.text': 'Tickets and questions.',
  'about.cat.integrations': 'Integrations',
  'about.cat.integrations.text': 'API documentation and integration guides.',
  'about.cat.systems': 'Systems',
  'about.cat.systems.text': 'Access to the MYIO systems.',
  'about.cat.institutional': 'About us',
  'about.cat.institutional.text': 'About MYIO, website, privacy and terms.',
  'about.cat.status': 'Status',
  'about.cat.status.text': 'How the systems are right now.',
  'about.item.wikiHome': 'Public wiki',
  'about.item.wikiSearch': 'Search the wiki',
  'about.item.accountGuide': 'Account access',
  'about.item.openTicket': 'Open a ticket',
  'about.item.forgotPassword': 'Forgot my password',
  'about.item.docsAlarms': 'Alarms',
  'about.item.docsGcdr': 'GCDR',
  'about.item.docsIngestion': 'Ingestion',
  'about.item.docsThingsboard': 'ThingsBoard',
  'about.item.integrationsGuide': 'Integrations guide',
  'about.item.newIntegration': 'Submit an integration',
  'about.item.app': 'MYIO App',
  'about.item.dashboards': 'Dashboards',
  'about.item.alarms': 'Alarms',
  'about.item.site': 'MYIO website',
  'about.item.privacy': 'Privacy',
  'about.item.terms': 'Terms of service',
  'about.item.gcdrHealth': 'GCDR',

  'toolbar.toDark': 'Use dark theme',
  'toolbar.toLight': 'Use light theme',
  'toolbar.language': 'Language',
  'modal.close': 'Close',
};

export const DICTIONARIES: Record<MyioGcdrLocale, Dict> = { 'pt-BR': PT, en: EN };

export type Overrides = Partial<Record<MyioGcdrLocale, Partial<Record<string, string>>>> | undefined;

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (vars[k] != null ? String(vars[k]) : ''));
}

/** Translate `key`; `count` selects `_one`/`_other` with Intl.PluralRules. */
export function translate(
  locale: MyioGcdrLocale,
  key: string,
  vars?: Record<string, string | number>,
  overrides?: Overrides
): string {
  let k = key;
  if (vars && typeof vars.count === 'number') {
    const cat = new Intl.PluralRules(locale).select(vars.count);
    k = `${key}_${cat === 'one' ? 'one' : 'other'}`;
  }
  const text =
    overrides?.[locale]?.[k] ??
    DICTIONARIES[locale][k] ??
    overrides?.['pt-BR']?.[k] ??
    DICTIONARIES['pt-BR'][k] ??
    k;
  return interpolate(text, vars);
}

export function localize(value: Localized | undefined, locale: MyioGcdrLocale): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[locale] ?? value['pt-BR'] ?? value.en ?? '';
}

export function detectLocale(stored: string | null): MyioGcdrLocale {
  if (stored === 'pt-BR' || stored === 'en') return stored;
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
}
