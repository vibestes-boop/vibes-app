// Русский — Russische Übersetzung.
//
// Shape muss 1:1 `Messages` (= typeof deMessages) entsprechen — TypeScript
// erzwingt das über den `satisfies`-Operator am Ende. Fehlende/überflüssige
// Keys sind Compile-Errors.

import type { Messages } from './de';

const ruMessages = {
  common: {
    loading: 'Загрузка…',
    error: 'Ошибка',
    retry: 'Повторить',
    cancel: 'Отмена',
    save: 'Сохранить',
    delete: 'Удалить',
    close: 'Закрыть',
    back: 'Назад',
  },

  nav: {
    feed: 'Лента',
    explore: 'Обзор',
    shop: 'Магазин',
    live: 'Эфир',
    messages: 'Сообщения',
    create: 'Загрузить',
    guilds: 'Сообщества',
    studio: 'Студия',
    openMenu: 'Открыть меню',
    main: 'Главная навигация',
  },

  header: {
    accountMenu: 'Меню аккаунта',
    coinsAria: '{count} монет — пополнить',
    topUpCoins: 'Пополнить монеты',
  },

  menu: {
    myProfile: 'Мой профиль',
    creatorStudio: 'Студия автора',
    guilds: 'Сообщества',
    payments: 'Платежи',
    settings: 'Настройки',
    language: 'Язык',
    logout: 'Выйти',
  },

  auth: {
    // Top-Level Actions
    login: 'Войти',
    signup: 'Создать аккаунт',
    logout: 'Выйти',

    // Page-Headings + Subtitles
    loginTitle: 'Войти',
    loginWelcome: 'С возвращением в Serlo.',
    signupTitle: 'Создать аккаунт',
    signupHint: 'Введи email один раз, нажми на ссылку — готово.',

    // Magic-Link-Form
    emailLabel: 'Email',
    emailPlaceholder: 'ты@example.com',
    emailInvalid: 'Введи корректный email.',
    sendMagicLink: 'Отправить ссылку для входа',
    submitSignup: 'Создать аккаунт',

    // Success-State nach Magic-Link-Versand
    linkSentTitle: 'Ссылка отправлена',
    linkSentHint:
      'Мы отправили ссылку для входа на {email}. Нажми на неё и ты внутри.',
    linkSentSpam: 'Ничего не пришло? Проверь спам или {resend}.',
    linkSentResend: 'отправь ещё раз',
    linkSentToastDefault: 'Письмо отправлено.',

    // OAuth
    continueWithGoogle: 'Продолжить с Google',
    continueWithApple: 'Продолжить с Apple',

    // Divider
    or: 'или',

    // Cross-Links Login ↔ Signup
    noAccount: 'Нет аккаунта?',
    createNow: 'Создать сейчас',
    hasAccount: 'Уже есть аккаунт?',
    backToHome: '← На главную',

    // Terms/Privacy
    acceptTerms:
      'Создавая аккаунт, ты принимаешь наши {terms} и нашу {privacy}.',
    terms: 'Условия использования',
    privacy: 'Политика конфиденциальности',
  },

  messages: {
    title: 'Сообщения',
    noConversations: 'Пока нет переписок.',
    emptyTitle: 'Пока нет сообщений',
    emptyHint: 'Найди автора, профиль или продавца и начни переписку.',
    searchUser: 'Поиск пользователей',
    new: 'Новый',
  },

  empty: {
    generic: 'Здесь пока ничего нет.',
  },

  explore: {
    metaTitle: 'Обзор — тренды на Serlo',
    metaDescription:
      'Трендовые хештеги, популярные видео и топ-авторы на Serlo.',
    title: 'Обзор',
    subtitle: 'Что сейчас на Serlo — хештеги, темы, аккаунты.',
    trendingHashtags: 'Трендовые хештеги',
    noHashtags: 'Активных хештегов пока нет — загляни через пару дней.',
    popularPosts: 'Популярные посты',
    posts: 'постов',
    views: 'просмотров',
  },

  settings: {
    navProfile: 'Профиль',
    navBilling: 'Платежи',
    navNotifications: 'Уведомления',
    navPrivacy: 'Приватность',
    phaseHint: 'Этап 11',

    notifMetaTitle: 'Уведомления — Serlo',
    notifTitle: 'Уведомления',
    notifSubtitle:
      'Выбери, как мы будем до тебя доставать — браузер-пуши для десктопа и телефона.',
    notifComingSoon:
      'Email-дайджест и точечные настройки (DM / Эфиры / Подарки — по отдельности) появятся в одном из ближайших обновлений.',
  },

  shop: {
    title: 'Магазин',
    metaTitle: 'Магазин — Подборка товаров',
    metaDescription:
      'Цифровое, физическое, услуги и коллекционное — напрямую от авторов Serlo-комьюнити. Оплата монетами или (скоро) картой.',
    ogTitle: 'Serlo Shop',
    ogDescription: 'Подборка товаров напрямую от авторов.',
    productCount: '{count} товаров',
    noMatches: 'Под эти фильтры товаров нет.',
    saved: 'Сохранённое',
    emptyTitle: 'Ничего не найдено',
    emptyHint:
      'Ослабь фильтры или попробуй другую категорию. В сайдбаре слева есть кнопка «Сбросить».',
  },
} satisfies Messages;

export default ruMessages;
