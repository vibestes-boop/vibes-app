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
    // Top-Level Actions
    login: 'Log in',
    signup: 'Create account',
    logout: 'Log out',

    // Page-Headings + Subtitles
    loginTitle: 'Log in',
    loginWelcome: 'Welcome back to Serlo.',
    signupTitle: 'Create account',
    signupHint: 'Type your email once, click the link once — done.',

    // Magic-Link-Form
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailInvalid: 'Please enter a valid email.',
    sendMagicLink: 'Send sign-in link',
    submitSignup: 'Create account',

    // Success-State
    linkSentTitle: 'Link on its way',
    linkSentHint:
      'We sent a sign-in link to {email}. Click it and you\u2019re in.',
    linkSentSpam: 'Nothing yet? Check spam, or {resend}.',
    linkSentResend: 'send again',
    linkSentToastDefault: 'Email on its way.',

    // OAuth
    continueWithGoogle: 'Continue with Google',
    continueWithApple: 'Continue with Apple',

    // Divider
    or: 'or',

    // Cross-Links
    noAccount: 'No account yet?',
    createNow: 'Create one',
    hasAccount: 'Already have an account?',
    backToHome: '\u2190 Back to home',

    // Terms/Privacy
    acceptTerms:
      'By creating an account you accept our {terms} and our {privacy}.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
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

  explore: {
    metaTitle: 'Explore — Trending on Serlo',
    metaDescription:
      'Discover trending hashtags, popular videos and top creators on Serlo.',
    title: 'Explore',
    subtitle: 'What\u2019s happening on Serlo right now — hashtags, topics, accounts.',
    trendingHashtags: 'Trending hashtags',
    noHashtags: 'No active hashtags — check back in a few days.',
    popularPosts: 'Popular posts',
    posts: 'posts',
    views: 'views',
  },

  settings: {
    navProfile: 'Profile',
    navBilling: 'Payments',
    navNotifications: 'Notifications',
    navPrivacy: 'Privacy',
    phaseHint: 'Phase 11',

    notifMetaTitle: 'Notifications — Serlo',
    notifTitle: 'Notifications',
    notifSubtitle:
      'Decide how we reach you — browser push for desktop and mobile.',
    notifComingSoon:
      'Email digest and finer channel settings (DM / Go-Live / Gifts separately) are coming in a future update.',
  },

  shop: {
    title: 'Shop',
    metaTitle: 'Shop — Discover curated products',
    metaDescription:
      'Digital, physical, services and collectibles — straight from Serlo community creators. Pay with coins or (soon) by card.',
    ogTitle: 'Serlo Shop',
    ogDescription: 'Curated products straight from creators.',
    productCount: '{count} products',
    noMatches: 'No products match your filters.',
    saved: 'Saved',
    emptyTitle: 'No matches',
    emptyHint:
      'Loosen the filters or try another category. The sidebar on the left has a "Reset" button.',
  },
} satisfies Messages;

export default enMessages;
