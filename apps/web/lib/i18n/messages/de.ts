// Deutsch — Source-of-Truth für alle übersetzten Strings.
// Shape dieses Objects ist der type-contract für alle anderen Locales (siehe
// `messages/ru.ts`, `ce.ts`, `en.ts` — die referenzieren `typeof deMessages`).
//
// Konvention: Keys sind dot-accessible via `t('nav.feed')`. Verschachtelung
// nach UI-Domäne (nav, auth, header, menu, messages, empty, common).
// Platzhalter: `{varName}` — werden zur Laufzeit via `interpolate()` ersetzt.

const deMessages = {
  common: {
    loading: 'Lädt…',
    error: 'Fehler',
    retry: 'Erneut versuchen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    close: 'Schließen',
    back: 'Zurück',
  },

  nav: {
    feed: 'Feed',
    explore: 'Entdecken',
    shop: 'Shop',
    live: 'Live',
    messages: 'Nachrichten',
    create: 'Hochladen',
    guilds: 'Guilds',
    studio: 'Creator-Studio',
    openMenu: 'Menü öffnen',
    main: 'Hauptnavigation',
  },

  header: {
    accountMenu: 'Account-Menü',
    coinsAria: '{count} Coins — aufladen',
    topUpCoins: 'Coins aufladen',
  },

  menu: {
    myProfile: 'Mein Profil',
    creatorStudio: 'Creator-Studio',
    guilds: 'Guilds',
    payments: 'Bezahlungen',
    settings: 'Einstellungen',
    language: 'Sprache',
    logout: 'Abmelden',
  },

  auth: {
    // Top-Level Actions (auch im Header verwendet)
    login: 'Einloggen',
    signup: 'Account erstellen',
    logout: 'Abmelden',

    // Page-Headings + Subtitles
    loginTitle: 'Einloggen',
    loginWelcome: 'Willkommen zurück bei Serlo.',
    signupTitle: 'Account erstellen',
    signupHint: 'Einmal Email eingeben, einmal auf den Link klicken — fertig.',

    // Magic-Link-Form
    emailLabel: 'Email',
    emailPlaceholder: 'du@example.com',
    emailInvalid: 'Bitte gib eine gültige Email ein.',
    sendMagicLink: 'Anmelde-Link senden',
    submitSignup: 'Account erstellen',

    // Success-State nach Magic-Link-Versand
    linkSentTitle: 'Link unterwegs',
    // Interpolation via trans(): {email} wird durch <span> ersetzt
    linkSentHint:
      'Wir haben dir einen Anmelde-Link an {email} geschickt. Klick drauf und du bist drin.',
    linkSentSpam: 'Nichts bekommen? Check Spam, oder {resend}.',
    linkSentResend: 'nochmal senden',
    linkSentToastDefault: 'Email ist unterwegs.',

    // OAuth
    continueWithGoogle: 'Mit Google weiter',
    continueWithApple: 'Mit Apple weiter',

    // Divider zwischen Magic-Link und OAuth
    or: 'oder',

    // Cross-Links Login ↔ Signup
    noAccount: 'Noch kein Account?',
    createNow: 'Jetzt erstellen',
    hasAccount: 'Schon einen Account?',
    backToHome: '← Zurück zur Startseite',

    // Terms/Privacy-Zeile im Signup (trans() mit Link-Platzhaltern)
    acceptTerms:
      'Mit der Erstellung akzeptierst du unsere {terms} und unsere {privacy}.',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutzerklärung',
  },

  messages: {
    title: 'Nachrichten',
    noConversations: 'Noch keine Unterhaltungen.',
    emptyTitle: 'Noch keine Nachrichten',
    emptyHint: 'Suche einen Creator, ein Profil oder einen Shop-Seller und starte eine Unterhaltung.',
    searchUser: 'Nutzer suchen',
    new: 'Neu',
  },

  empty: {
    generic: 'Hier ist noch nichts zu sehen.',
  },

  explore: {
    metaTitle: 'Explore — Trending auf Serlo',
    metaDescription:
      'Entdecke Trending-Hashtags, beliebte Videos und Top-Creator auf Serlo.',
    title: 'Explore',
    subtitle: 'Was auf Serlo gerade abgeht — Hashtags, Themen, Accounts.',
    trendingHashtags: 'Trending Hashtags',
    noHashtags: 'Keine aktiven Hashtags — schau in ein paar Tagen wieder rein.',
    popularPosts: 'Populäre Posts',
    posts: 'Posts',
    views: 'Views',
  },

  settings: {
    // Layout-Nav (in `/settings/layout.tsx` und auf jeder Sub-Page sichtbar)
    navProfile: 'Profil',
    navBilling: 'Bezahlungen',
    navNotifications: 'Benachrichtigungen',
    navPrivacy: 'Privatsphäre',
    phaseHint: 'Phase 11',

    // /settings/notifications
    notifMetaTitle: 'Benachrichtigungen — Serlo',
    notifTitle: 'Benachrichtigungen',
    notifSubtitle:
      'Entscheide, wie wir dich erreichen — Browser-Push für Desktop und Handy.',
    notifComingSoon:
      'E-Mail-Digest und feinere Kanal-Einstellungen (DM / Go-Live / Geschenke einzeln togglen) kommen mit einem der nächsten Updates.',
  },

  shop: {
    title: 'Shop',
    metaTitle: 'Shop — Entdecke kuratierte Produkte',
    metaDescription:
      'Digital, physisch, Services und Collectibles — direkt von Creatorn der Serlo-Community. Mit Coins oder (in Kürze) per Karte bezahlen.',
    ogTitle: 'Serlo Shop',
    ogDescription: 'Kuratierte Produkte direkt von Creatorn.',
    // Interpolation {count} — Pluralformen muss jede Locale selbst im String regeln
    productCount: '{count} Produkte',
    noMatches: 'Keine Produkte passen auf deine Filter.',
    saved: 'Gemerkt',
    emptyTitle: 'Keine Treffer',
    emptyHint:
      'Lockere die Filter oder probiere eine andere Kategorie. Die Sidebar links hat einen „Zurücksetzen"-Button.',
  },
};

// Hinweis: KEIN `as const` auf dem Object. Sonst würde `typeof deMessages`
// die Werte als Literal-Types einfrieren (`'Feed'` statt `string`), wodurch
// andere Locales nicht mehr assignbar wären (`'Лента'` ist nicht vom Typ
// `'Feed'`). Die Object-Struktur wird trotzdem vollständig für `PathInto`
// inferiert — Keys sind schließlich Struktur, keine Werte.
export type Messages = typeof deMessages;
export default deMessages;
