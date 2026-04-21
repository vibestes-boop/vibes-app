// Нохчийн — Tschetschenische Übersetzung.
//
// Hinweis: Best-effort Übersetzungen für die Zielgruppe (tschetschenische
// Community). Native-Speaker-Review sehr empfohlen, insbesondere für:
//   - Technische Lehnwörter (Feed, Shop, Live, Studio) — manche sind auf
//     Nohchiyn üblich transliteriert, andere werden als englisches Loan-Word
//     geführt. Hier Mischung gewählt: UI-Kern-Begriffe auf Chechen, eng
//     technische Begriffe (Feed/Live/Studio) bleiben international erkennbar.
//   - Grammatik bei Platzhaltern: `{count} монет` ist russisches Muster,
//     auf Nohchiyn stellt sich die Zählform anders (Singular/Plural-System
//     ist simpler als im Russischen, aber es gibt Noun-Classes).
//
// TODO(i18n/ce): Review durch Muttersprachler. Bis dahin markieren wir diese
// Datei als v0-Stand; Keys die mangels Sicherheit unübersetzt bleiben,
// fallen bei der Source-Änderung automatisch per TypeScript-Check auf.

import type { Messages } from './de';

const ceMessages = {
  common: {
    loading: 'Чудоьрзу…',        // "lädt sich"
    error: 'ГIалат',               // "Fehler"
    retry: 'Юха хьажа',           // "nochmal probieren"
    cancel: 'Сaцe',                // "stopp / abbrechen"
    save: 'Ӏалашдe',             // "speichern"
    delete: 'ДIадаккха',         // "wegnehmen / löschen"
    close: 'ДIаКъовла',              // "schließen"
    back: 'Юхадерза',             // "zurück"
  },

  nav: {
    feed: 'Хаамаш',              // "Nachrichten/News-Feed"
    explore: 'Лаха',              // "suchen / entdecken"
    shop: 'Туькан',               // "Laden / Shop"
    live: 'Дийна',                // "live (wörtl. am-Leben)"
    messages: 'Кехаташ',         // "Briefe / Nachrichten"
    create: 'хьала йакха',              // "hochladen / legen"
    guilds: 'Тобанаш',         // "Gemeinschaften"
    studio: 'Студи',               // Lehnwort
    openMenu: 'Меню схьайeлла', // "Menü öffnen"
    main: 'Коьрта навигаци',    // "Haupt-Navigation"
  },

  header: {
    accountMenu: 'Аккаунтан меню',
    coinsAria: '{count} ахча — юха хьалаяхита',
    topUpCoins: 'Ахча тоха',
  },

  menu: {
    myProfile: 'Сан профиль',
    creatorStudio: 'Студи',
    guilds: 'Тобанаш',
    payments: 'Ахчанаш дӀадалар',               // "Zahlungen" (vereinfacht)
    settings: 'Нисдареш',      // "Einstellungen"
    language: 'Мотт',               // "Sprache"
    logout: 'Аравала',             // "hinausgehen"
  },

  auth: {
    // Top-Level Actions
    login: 'Чуваха',              // "hineingehen"
    signup: 'Аккаунт йаккха',   // "Account erstellen"
    logout: 'Аравала',

    // Page-Headings + Subtitles
    loginTitle: 'Чуваха',
    loginWelcome: 'Serlo-хьа юхадирзина.',   // "Bei Serlo zurückgekehrt"
    signupTitle: 'Аккаунт йаккха',
    signupHint: 'Цкъа email йазйe, цкъа линка тӀе хьаьжа — кхачийна.',

    // Magic-Link-Form
    emailLabel: 'Email',
    emailPlaceholder: 'хьо@example.com',
    emailInvalid: 'Нийса email йазйe.',
    sendMagicLink: 'Чудахара линк дIахьажае',
    submitSignup: 'Аккаунт йаккха',

    // Success-State
    linkSentTitle: 'Линк дIахьажина',
    linkSentHint:
      '{email}-ца чудахара линк дIахьажина. Цу тIe хьаьжа — хьо чу ву.',
    linkSentSpam: 'ХIума ца кхаьчна? Спам-папка хьажа, я {resend}.',
    linkSentResend: 'кхин цкъа дIахьажае',
    linkSentToastDefault: 'Кехат дIахьажина.',

    // OAuth
    continueWithGoogle: 'Google-ца дIахIотта',
    continueWithApple: 'Apple-ца дIахIотта',

    // Divider
    or: 'я',

    // Cross-Links
    noAccount: 'Аккаунт йац?',
    createNow: 'ХIинца йaккхa',
    hasAccount: 'Аккаунт йу?',
    backToHome: '← Юхадерза коьрта агIонe',

    // Terms/Privacy
    acceptTerms:
      'Аккаунт йaккхаш, хьуна тӀеэцина долу {terms} а, тхан {privacy} а ю.',
    terms: 'Пайдаэцаран бакъонаш',
    privacy: 'Къайлахaлла ларйаран политика',
  },

  messages: {
    title: 'Кехаташ',
    noConversations: 'Къамелаш дац.',
    emptyTitle: 'яьсса цӀе',
    emptyHint: 'еса хаам',
    searchUser: 'Декъашхо лаха',
    new: 'Керла',
  },

  empty: {
    generic: 'Кхузахь хIумма дацIа.',
  },

  profile: {
    metaNotFoundTitle: '@{username} ца каравелла',
    metaGenericDescription: '{name} Serlo-хь — {count} фолловер.',

    verifiedBadge: 'Тӏеэцна',
    statPosts: 'Постаныш',
    statFollower: 'Фолловераш',
    statFollowing: 'Тӏехьа',

    tablistLabel: 'Профилан чулацамаш',
    tabPosts: 'Постаныш',
    tabLikes: 'Лайкаш',
    tabShop: 'Туькан',
    tabBattles: 'Баттлаш',

    emptyPostsSelf:
      'Хьан видеош кхузахь гучуьра — хьалхара видео апп чохь хьала йaккхa.',
    emptyPostsOther: '@{username}-ан билгалдаьлла видеош дац.',
    panelLikesTitle: 'Лайкаш — къайлаха',
    panelLikesHintSelf: 'Хьуна хьайн лайк-исторе ю — хӀинццалц апп чохь бен.',
    panelLikesHintOther:
      'Лайкаш къайлаха ю — аккаунтан дa бен ца гo.',
    panelShopTitle: 'Туькан 4-чу фазехь',
    panelShopHint: 'Витрина, чекин а кечдеш ду.',
    panelBattlesTitle: 'Дийна баттлаш — апп чохь',
    panelBattlesHint: 'Баттлан исторе а юха хьажар а вебехь 6-чу фазехь.',

    nfTitle: 'Аккаунт ца каравелла',
    nfHint:
      'Иза юзернейм Serlo-хь (хӀинццалц) дац — тӀеэцна цӀe ю, я аккаунт дӀаяккхна.',
    nfHome: 'Коьрта агIонe',
    nfSignup: 'Шен аккаунт йаккхa',
  },

  explore: {
    metaTitle: 'Лаха — Serlo-хь тренд',
    metaDescription:
      'Трендехь йолу хештегаш, кхечу постаныш а коьрта кечдархой а Serlo-хь.',
    title: 'Лаха',
    subtitle: 'Serlo-хь хӀинца хьолан — хештегаш, темаш, аккаунташ.',
    trendingHashtags: 'Трендехь хештегаш',
    noHashtags: 'Хештегаш дац — кхо де даьлча юха хьажа.',
    popularPosts: 'Кхечу постаныш',
    posts: 'постаныш',
    views: 'хьаьжнарш',
  },

  billing: {
    metaTitle: 'Ахчанаш дӀадалар — Serlo',
    title: 'Ахчанаш дӀадалар',
    subtitle: 'Хьан ахчанан баланс, заказан исторе а счеташ а.',

    walletCoinsLabel: 'Ахчанаш',
    walletCoinsHint: 'Совгаташна а туькана а',
    walletCoinsCta: 'Тоха',
    walletDiamondsLabel: 'Аьхалнаш',
    walletDiamondsHint: 'фанаташкара тӀееана',
    walletGiftedLabel: 'Совгӏана',
    walletGiftedHint: 'ерригге ахчанаш',

    historyTitle: 'Заказан исторе',
    newOrder: 'Керла заказ',
    emptyTitle: 'Заказаш хӀинццалц дац',
    emptyCta: 'Ахчанан туькана',
    emptyHint: 'Ахчанаш эцча, счеташ кхузахь гур ю.',

    colDate: 'Де',
    colPackage: 'Пакет',
    colPrice: 'Мах',
    colStatus: 'Статус',
    colDocs: 'Кехаташ',
    coinsUnit: 'ахчанаш',

    statusPending: 'Сeцна',
    statusPaid: 'Дeлла',
    statusFailed: 'ГIалат',
    statusRefunded: 'Юхадeлла',
    statusCancelled: 'ДIадаьккхина',

    docInvoice: 'Счёт',
    docReceipt: 'Чек',

    legalTitle: 'Бакъонаш',
    legalHint:
      'ДӀaдeхна ахчанаш юхадоьхкур дацара. Счеташ а чекаш а Stripe-ца автоматан кеча а бо, билгалдина email-а тӀe дӀахьажа а бо. Хаттарш нийса {supportEmail} тӀехь дӀахьожо.',
  },

  settings: {
    navProfile: 'Профиль',
    navBilling: 'Ахчанаш дӀадалар',
    navNotifications: 'Хаамаш',
    navPrivacy: 'Къайлахалла',
    phaseHint: 'Пхьоьхьа 11',

    notifMetaTitle: 'Хаамаш — Serlo',
    notifTitle: 'Хаамаш',
    notifSubtitle:
      'Харжа, муха оха хьоьгa кхача — браузер-пуш десктопан а, тeлефонан а.',
    notifComingSoon:
      'Email-дайджест а, кхин ойланаш (DM / Дийна / Совгӏаташ — цхьаццца) а тӀаьхьарчу хаамашца кхочур ю.',
  },

  shop: {
    title: 'Туькан',
    metaTitle: 'Туькан — тӀехьежнарг хIуманаш',
    metaDescription:
      'Цифраш, хIуманаш, ларамаш а коллекцеш а — нийса Serlo-тобанехь кечдархошкара. Ахчанца я (сиха) картица тӀелаца.',
    ogTitle: 'Serlo Туькан',
    ogDescription: 'ТӀехьежнарг хIуманаш нийса кечдархошкара.',
    productCount: '{count} хIуманаш',
    noMatches: 'Хьан фильтрашна хIумма дац.',
    saved: 'ДӀаялорна',
    emptyTitle: 'ХIумма ца каравелла',
    emptyHint:
      'Фильтрашкара цхьаъ дӀадаккхал, я кхин категори хьажал. Аьрру агIонехь „Юхадаха"-кнопка ю.',
  },

  studio: {
    // TODO(i18n/ce): Native-Speaker-Review — technische Studio-Begriffe mischen
    // englische Loanwords (Analytics, Live) mit Chechenischen Alltagswörtern.
    navAria: 'Студин навигаци',
    navDashboard: 'Дашборд',
    navAnalytics: 'Аналитика',
    navRevenue: 'Мах-хаам',
    navScheduled: 'Дагадеш',
    navDrafts: 'Черновикш',
    navLive: 'Дийна',
    navShop: 'Туькан',
    navOrders: 'Заказаш',
    navModeration: 'Модераци',

    metaTitle: 'Кечдархочун студи',
    metaDescription: 'Хьан дашборд — хьаьжнарш, ахчанаш, фолловер-ӀалашхӀум.',

    badge: 'Кечдархочун студи',
    greeting: 'Салам, {name}',
    subtitle: 'Хьан дашборд — дерриге цхьана агӀонехь.',
    creatorFallback: 'Кечдархо',

    reachTitle: 'Кхачар',
    kpiViews: 'Хьаьжнарш',
    kpiLikes: 'Лайкаш',
    kpiComments: 'Комментари',
    kpiNewFollowers: 'Керла фолловераш',
    kpiPrev: 'хьалха: {value}',

    diamondBalance: 'Аьхалнин баланс',
    periodGiftsLine: '+{amount} цу муьрехь ({gifts} совгӀаташ)',
    noGiftsPeriod: 'Хаьржина мур чохь совгӀаташ дац',
    earningsDetails: 'Мах-хаамаш довзийтар',

    engagementRate: 'Engagement-Rate',
    engagementHint: '{interactions} тӀехьожам — {views} хьаьжнарш',
    topGift: 'Топ-совгӀат',
    topSupporter: 'Топ-саппортер: {name}',
    noGiftsPeriodShort: 'Цу муьрехь совгӀаташ хӀинца дац',
    followerLabel: 'Фолловераш',
    followerAdded: '+{added} керла муьре',

    planningTitle: 'Контент-план',
    planScheduledLabel: 'Дагадеш',
    planScheduledActive: 'активан',
    planScheduledErrors: '{count} гӀалат',
    planDraftsLabel: 'Черновикш',
    planDraftsHint: 'Ӏалашдина',
    planLiveLabel: 'Live-сесси',
    planLiveHint: '{days} де чохь',
    planShopLabel: 'Туькан-оборот',
    planShopHint: '{count} дӀадехкарш',

    topPostsTitle: 'Топ-постаныш (хьаьжнарш)',
    allLink: 'Дерриге',
    topPostsEmpty:
      'Хаамаш хӀинццалц дац. Контент хаттий, кхин сохьтахь кхузахь хьажа.',
    noCaption: 'Капцица йоцуш',

    recentGiftsTitle: 'ТӀаьххьара совгӀаташ',
    recentGiftsEmpty: 'СовгӀаташ хӀинццалц дац. Дийна хӀотта — карайоьдур ю.',
    giftFrom: '{name}-ра · {relative}',

    moreDetails: 'Кхин дукха хаамаш?',
    moreDetailsHint:
      'Аналитикан агӀона фолловер-ӀалашхӀум, пиковни сахьташ а watch-time оцена а гойту.',
    toAnalytics: 'Аналитика',

    timeJustNow: 'хӀинца',
    timeMinAgo: '{n} минот хьалха',
    timeHourAgo: '{n} сохь хьалха',
    timeDayAgo: '{n} де хьалха',

    period7: '7 де',
    period28: '28 де',
    period90: '90 де',
  },
} satisfies Messages;

export default ceMessages;
