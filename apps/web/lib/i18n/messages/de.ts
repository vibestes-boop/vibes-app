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
    login: 'Einloggen',
    signup: 'Account erstellen',
    logout: 'Abmelden',
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
};

// Hinweis: KEIN `as const` auf dem Object. Sonst würde `typeof deMessages`
// die Werte als Literal-Types einfrieren (`'Feed'` statt `string`), wodurch
// andere Locales nicht mehr assignbar wären (`'Лента'` ist nicht vom Typ
// `'Feed'`). Die Object-Struktur wird trotzdem vollständig für `PathInto`
// inferiert — Keys sind schließlich Struktur, keine Werte.
export type Messages = typeof deMessages;
export default deMessages;
