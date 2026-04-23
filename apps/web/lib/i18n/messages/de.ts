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
    profile: 'Profil',
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

  profile: {
    // Metadata (wird von Social-Previews gezogen)
    metaNotFoundTitle: '@{username} nicht gefunden',
    metaGenericDescription: '{name} auf Serlo — {count} Follower.',

    // Hero
    verifiedBadge: 'Verifiziert',
    statPosts: 'Posts',
    statFollower: 'Follower',
    statFollowing: 'Folgt',

    // Tabs
    tablistLabel: 'Profil-Inhalte',
    tabPosts: 'Posts',
    tabLikes: 'Likes',
    tabShop: 'Shop',
    tabBattles: 'Battles',

    // Panel-Inhalte
    emptyPostsTitle: 'Noch keine Videos',
    emptyPostsSelf:
      'Deine Videos erscheinen hier — lade dein erstes Video in der App hoch.',
    emptyPostsOther: '@{username} hat noch keine öffentlichen Videos.',
    panelLikesTitle: 'Gelikte Videos sind privat',
    panelLikesHintSelf: 'Nur du siehst deine Like-Historie — und aktuell nur in der App.',
    panelLikesHintOther:
      'Likes sind privat — nur der Account-Inhaber selbst kann sie sehen.',
    panelShopTitle: 'Shop kommt in Phase 4',
    panelShopHint: 'Storefront, Sale-Management und Checkout laufen gerade im Build.',
    panelBattlesTitle: 'Live-Battles sind in der App',
    panelBattlesHint: 'Battle-History und Replays landen mit Phase 6 im Web.',

    // 404
    nfTitle: 'Account nicht gefunden',
    nfHint:
      "Diesen Usernamen gibt's auf Serlo (noch) nicht — vielleicht ein Tippfehler, oder der Account wurde gelöscht.",
    nfHome: 'Zur Startseite',
    nfSignup: 'Eigenen Account erstellen',
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

  billing: {
    metaTitle: 'Bezahlungen — Serlo',
    title: 'Bezahlungen',
    subtitle: 'Dein Coin-Guthaben, Bestellhistorie und Rechnungen.',

    walletCoinsLabel: 'Coins',
    walletCoinsHint: 'für Gifts + Shop-Käufe',
    walletCoinsCta: 'Aufladen',
    walletDiamondsLabel: 'Diamanten',
    walletDiamondsHint: 'von Fans erhalten',
    walletGiftedLabel: 'Verschenkt',
    walletGiftedHint: 'Coins insgesamt',

    historyTitle: 'Bestellhistorie',
    newOrder: 'Neue Bestellung',
    emptyTitle: 'Noch keine Bestellungen',
    emptyHint: 'Wenn du Coins kaufst, erscheinen die Rechnungen hier.',
    emptyCta: 'Zum Coin-Shop',

    colDate: 'Datum',
    colPackage: 'Paket',
    colPrice: 'Preis',
    colStatus: 'Status',
    colDocs: 'Belege',
    coinsUnit: 'Coins',

    // Status-Pills — spiegeln `CoinOrderStatus`-Werte aus lib/data/payments.ts
    statusPending: 'Ausstehend',
    statusPaid: 'Bezahlt',
    statusFailed: 'Fehlgeschlagen',
    statusRefunded: 'Erstattet',
    statusCancelled: 'Abgebrochen',

    docInvoice: 'Rechnung',
    docReceipt: 'Beleg',

    legalTitle: 'Rechtliches',
    legalHint:
      'Käufe sind endgültig nach Verwendung nicht erstattbar. Rechnungen und Belege werden von Stripe automatisch erstellt und per E-Mail an deine hinterlegte Adresse gesendet. Bei Fragen zu Zahlungen schreib uns an {supportEmail}.',
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

  studio: {
    // Sub-Nav (StudioSubNav Client-Component — liest per useI18n())
    navAria: 'Studio-Navigation',
    navDashboard: 'Dashboard',
    navAnalytics: 'Analytics',
    navRevenue: 'Einnahmen',
    navScheduled: 'Geplant',
    navDrafts: 'Entwürfe',
    navLive: 'Live',
    navShop: 'Shop',
    navOrders: 'Bestellungen',
    navModeration: 'Moderation',

    // Meta
    metaTitle: 'Creator Studio',
    metaDescription: 'Dein Dashboard — Views, Einnahmen, Follower-Wachstum.',

    // Header (Hi, {name})
    badge: 'Creator Studio',
    greeting: 'Hi, {name}',
    subtitle: 'Dein Dashboard — alles auf einen Blick.',
    creatorFallback: 'Creator',

    // Reichweite / KPI-Grid
    reachTitle: 'Reichweite',
    kpiViews: 'Views',
    kpiLikes: 'Likes',
    kpiComments: 'Kommentare',
    kpiNewFollowers: 'Neue Follower',
    kpiPrev: 'vorher: {value}',

    // Diamonds-Hero
    diamondBalance: 'Diamanten-Balance',
    periodGiftsLine: '+{amount} in diesem Zeitraum ({gifts} Gifts)',
    noGiftsPeriod: 'Keine Gifts im gewählten Zeitraum',
    earningsDetails: 'Einnahmen-Details',

    // Engagement / Earnings / Follower Summary-Cards
    engagementRate: 'Engagement-Rate',
    engagementHint: '{interactions} Interaktionen auf {views} Views',
    topGift: 'Top-Gift',
    topSupporter: 'Top-Supporter: {name}',
    noGiftsPeriodShort: 'Noch keine Gifts in diesem Zeitraum',
    followerLabel: 'Follower',
    followerAdded: '+{added} neu im Zeitraum',

    // Content-Planning-Section
    planningTitle: 'Content-Planung',
    planScheduledLabel: 'Geplant',
    planScheduledActive: 'aktiv',
    planScheduledErrors: '{count} Fehler',
    planDraftsLabel: 'Entwürfe',
    planDraftsHint: 'gespeichert',
    planLiveLabel: 'Live-Sessions',
    planLiveHint: 'in {days} T',
    planShopLabel: 'Shop-Umsatz',
    planShopHint: '{count} Verkäufe',

    // Top-Posts-Panel
    topPostsTitle: 'Top-Posts (Views)',
    allLink: 'Alle',
    topPostsEmpty:
      'Noch keine Daten. Poste Content und schau hier in ein paar Stunden wieder vorbei.',
    noCaption: 'Ohne Caption',

    // Recent-Gifts-Panel
    recentGiftsTitle: 'Letzte Gifts',
    recentGiftsEmpty: 'Noch keine Gifts empfangen. Gehe live — dann kommen sie.',
    giftFrom: 'von {name} · {relative}',

    // CTA-Row
    moreDetails: 'Mehr Details?',
    moreDetailsHint:
      'Die Analytics-Seite zeigt Follower-Wachstum, Peak-Hours und Watch-Time Estimates.',
    toAnalytics: 'Zu Analytics',

    // Relative-Time-Helper (formatRelative)
    timeJustNow: 'gerade eben',
    timeMinAgo: 'vor {n} Min',
    timeHourAgo: 'vor {n} Std',
    timeDayAgo: 'vor {n} T',

    // Period-Tabs (PeriodTabs Client-Component)
    period7: '7 Tage',
    period28: '28 Tage',
    period90: '90 Tage',
  },
};

// Hinweis: KEIN `as const` auf dem Object. Sonst würde `typeof deMessages`
// die Werte als Literal-Types einfrieren (`'Feed'` statt `string`), wodurch
// andere Locales nicht mehr assignbar wären (`'Лента'` ist nicht vom Typ
// `'Feed'`). Die Object-Struktur wird trotzdem vollständig für `PathInto`
// inferiert — Keys sind schließlich Struktur, keine Werte.
export type Messages = typeof deMessages;
export default deMessages;
