// English translation.

import type { Messages } from './de';

const enMessages = {
  common: {
    loading: 'Loading…',
    error: 'Error',
    retry: 'Try again',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    close: 'Close',
    back: 'Back',
  },

  nav: {
    feed: 'Feed',
    explore: 'Explore',
    shop: 'Shop',
    live: 'Live',
    messages: 'Messages',
    create: 'Upload',
    guilds: 'Guilds',
    studio: 'Creator Studio',
    openMenu: 'Open menu',
    main: 'Main navigation',
  },

  header: {
    accountMenu: 'Account menu',
    coinsAria: '{count} coins — top up',
    topUpCoins: 'Top up coins',
  },

  menu: {
    myProfile: 'My profile',
    creatorStudio: 'Creator Studio',
    guilds: 'Guilds',
    payments: 'Payments',
    settings: 'Settings',
    language: 'Language',
    logout: 'Log out',
  },

  auth: {
    login: 'Log in',
    signup: 'Create account',
    logout: 'Log out',
  },

  messages: {
    title: 'Messages',
    noConversations: 'No conversations yet.',
    emptyTitle: 'No messages yet',
    emptyHint: 'Find a creator, profile or shop seller and start a conversation.',
    searchUser: 'Search users',
    new: 'New',
  },

  empty: {
    generic: 'Nothing to see here yet.',
  },
} satisfies Messages;

export default enMessages;
