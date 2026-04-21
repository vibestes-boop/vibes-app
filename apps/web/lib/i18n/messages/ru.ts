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
    login: 'Войти',
    signup: 'Создать аккаунт',
    logout: 'Выйти',
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
} satisfies Messages;

export default ruMessages;
