// Deutsch — Source-of-Truth für alle übersetzten Strings.
// Shape dieses Objects ist der type-contract für alle anderen Locales (siehe
// `messages/ru.ts`, `ce.ts`, `en.ts` — die referenzieren `typeof deMessages`).
//
// Konvention: Keys sind dot-accessible via `t('nav.feed')`. Verschachtelung
// nach UI-Domäne (nav, auth, header, menu, messages, empty, common).
// Platzhalter: `{varName}` — werden zur Laufzeit via `interpolate()` ersetzt.

const deMessages = {
  common: {
    loading: "Lädt…",
    error: "Fehler",
    retry: "Erneut versuchen",
    cancel: "Abbrechen",
    save: "Speichern",
    delete: "Löschen",
    close: "Schließen",
    back: "Zurück",
  },

  nav: {
    feed: "Feed",
    explore: "Entdecken",
    shop: "Shop",
    inbox: "Inbox",
    live: "Live",
    messages: "Nachrichten",
    create: "Hochladen",
    guilds: "Guilds",
    studio: "Creator-Studio",
    profile: "Profil",
    openMenu: "Menü öffnen",
    main: "Hauptnavigation",
  },

  header: {
    accountMenu: "Account-Menü",
    coinsAria: "{count} Coins — aufladen",
    topUpCoins: "Coins aufladen",
  },

  menu: {
    myProfile: "Mein Profil",
    creatorStudio: "Creator-Studio",
    guilds: "Guilds",
    payments: "Bezahlungen",
    settings: "Einstellungen",
    language: "Sprache",
    logout: "Abmelden",
  },

  auth: {
    // Top-Level Actions (auch im Header verwendet)
    login: "Einloggen",
    signup: "Account erstellen",
    logout: "Abmelden",

    // Page-Headings + Subtitles
    loginTitle: "Einloggen",
    loginWelcome: "Willkommen zurück bei Serlo.",
    signupTitle: "Account erstellen",
    signupHint: "Einmal Email eingeben, einmal auf den Link klicken — fertig.",

    // Magic-Link-Form
    emailLabel: "Email",
    emailPlaceholder: "du@example.com",
    emailInvalid: "Bitte gib eine gültige Email ein.",
    sendMagicLink: "Anmelde-Link senden",
    submitSignup: "Account erstellen",

    // Success-State nach Magic-Link-Versand
    linkSentTitle: "Link unterwegs",
    // Interpolation via trans(): {email} wird durch <span> ersetzt
    linkSentHint:
      "Wir haben dir einen Anmelde-Link an {email} geschickt. Klick drauf und du bist drin.",
    linkSentSpam: "Nichts bekommen? Check Spam, oder {resend}.",
    linkSentResend: "nochmal senden",
    linkSentToastDefault: "Email ist unterwegs.",

    // OAuth
    continueWithGoogle: "Mit Google weiter",
    continueWithApple: "Mit Apple weiter",

    // Divider zwischen Magic-Link und OAuth
    or: "oder",

    // Cross-Links Login ↔ Signup
    noAccount: "Noch kein Account?",
    createNow: "Jetzt erstellen",
    hasAccount: "Schon einen Account?",
    backToHome: "← Zurück zur Startseite",

    // Terms/Privacy-Zeile im Signup (trans() mit Link-Platzhaltern)
    acceptTerms:
      "Mit der Erstellung akzeptierst du unsere {terms} und unsere {privacy}.",
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
  },

  messages: {
    title: "Nachrichten",
    noConversations: "Noch keine Unterhaltungen.",
    emptyTitle: "Noch keine Nachrichten",
    emptyHint:
      "Suche einen Creator, ein Profil oder einen Shop-Seller und starte eine Unterhaltung.",
    searchUser: "Nutzer suchen",
    new: "Neu",
  },

  empty: {
    generic: "Hier ist noch nichts zu sehen.",
  },

  profile: {
    // Metadata (wird von Social-Previews gezogen)
    metaNotFoundTitle: "@{username} nicht gefunden",
    metaGenericDescription: "{name} auf Serlo — {count} Follower.",

    // Hero
    verifiedBadge: "Verifiziert",
    statPosts: "Posts",
    statFollower: "Follower",
    statFollowing: "Folgt",
    // v1.w.UI.16: Gradient-Ring + LIVE-Badge wenn User aktuell live ist
    liveBadge: "LIVE",
    liveNow: "{name} ist live — jetzt reinschauen",

    // Tabs
    tablistLabel: "Profil-Inhalte",
    tabPosts: "Posts",
    tabLikes: "Likes",
    tabReposts: "Reposts",
    tabShop: "Shop",
    tabBattles: "Battles",
    emptyRepostsTitle: "Noch keine Reposts",
    emptyRepostsSelf: "Beiträge, die du repostest, erscheinen hier.",
    emptyRepostsOther: "@{username} hat noch nichts regepostet.",
    emptyRepostsHint: "Keine Reposts vorhanden.",

    // Panel-Inhalte
    emptyPostsTitle: "Noch keine Videos",
    emptyPostsSelf:
      "Deine Videos erscheinen hier — lade dein erstes Video in der App hoch.",
    emptyPostsOther: "@{username} hat noch keine öffentlichen Videos.",
    panelLikesTitle: "Gelikte Videos sind privat",
    panelLikesHintSelf:
      "Nur du siehst deine Like-Historie — und aktuell nur in der App.",
    panelLikesHintOther:
      "Likes sind privat — nur der Account-Inhaber selbst kann sie sehen.",
    panelShopTitle: "Shop kommt in Phase 4",
    panelShopHint:
      "Storefront, Sale-Management und Checkout laufen gerade im Build.",
    panelBattlesTitle: "Live-Battles sind in der App",
    panelBattlesHint: "Battle-History und Replays landen mit Phase 6 im Web.",

    // 404
    nfTitle: "Account nicht gefunden",
    nfHint:
      "Diesen Usernamen gibt's auf Serlo (noch) nicht — vielleicht ein Tippfehler, oder der Account wurde gelöscht.",
    nfHome: "Zur Startseite",
    nfSignup: "Eigenen Account erstellen",

    // Order-Reputation
    sellerRatingLabel: "als Verkäufer",
    buyerRatingLabel: "als Käufer",

    // Tabs (Ergänzung) + Sort-Bar
    tabSaved: "Gespeichert",
    tabLives: "Lives",
    sortAria: "Sortierung",
    sortNewest: "🕐 Neueste",
    sortViews: "▶ Views",
    sortLikes: "♥ Likes",

    // Panel-Empty-States (Ergänzung)
    emptyLikedTitle: "Noch nichts geliked",
    emptyLikedHint:
      "Videos, die du likest, erscheinen hier — nur für dich sichtbar.",
    emptySavedTitle: "Nichts gespeichert",
    emptySavedHint:
      "Bookmarkte Posts erscheinen hier — nur für dich sichtbar.",
    savedPrivateTitle: "Gespeicherte Posts sind privat",
    savedPrivateHint: "Nur der Profilinhaber kann seine gespeicherten Posts sehen.",
    shopHintSelf: "Erstelle dein erstes Produkt im Creator Studio.",
    livesEmptyTitle: "Keine Replays",
    livesEmptySelf: "Deine Live-Streams werden hier als Replay gespeichert.",
    livesEmptyOther: "{username} hat noch keine öffentlichen Replays.",
    liveReplayAlt: "Live Replay",

    // Profil-Komponenten (share-button, post-grid, live-ring-avatar)
    shareAria: "Profil teilen",
    watchVideo: "Video ansehen",
    watchVideoCaption: "Video ansehen: {caption}",
    womenOnlyBadge: "Women Only",
    womenOnlyZone: "Women-Only Zone",
    emptyVideosDefault: "Noch keine Videos",
  },

  // Creator-Tip (creator-tip-button)
  tip: {
    support: "Unterstützen",
    dialogTitle: "@{name} unterstützen",
    dialogDesc: "Sende einmalig Coins — 85% landen als Einnahmen beim Creator.",
    customAmount: "Eigener Betrag",
    customPlaceholder: "z.B. 250",
    messageLabel: "Nachricht (optional, max. 140 Zeichen)",
    messagePlaceholder: "Danke für den Content!",
    balance: "Dein Guthaben",
    coinsUnit: "{count} Coins",
    notEnough: "Nicht genug — jetzt aufladen →",
    minAmount: "Bitte einen Betrag ≥ 1 angeben.",
    sendCoins: "{count} Coins senden",
    sentCoins: "{count} Coins gesendet",
    notified: "@{name} bekommt eine Benachrichtigung.",
    errorTitle: "Konnte nicht gesendet werden",
    unknownError: "Unbekannter Fehler",
  },

  // Post-Detailseite (/p/[postId])
  post: {
    music: "Musik",
    sound: "Sound",
    inPost: "Im Beitrag",
    sharePost: "Beitrag teilen",
    shareVideo: "Video teilen",
    moreFrom: "Mehr von",
    viewAll: "Alle ansehen",
    womenOnly: "Women-Only",
    statViews: "Aufrufe",
    statComments: "Kommentare",
    statShares: "Shares",
    noImage: "Kein Bild hinterlegt.",
  },

  // Post-Aktionen (post-actions-bar: Like/Speichern/Download)
  postActions: {
    save: "Speichern",
    saved: "Gespeichert",
    saveAria: "Post speichern",
    unsaveAria: "Gespeichert — entfernen",
    download: "Download",
    downloadAria: "Video herunterladen",
    likeLoginToast: "Bitte melde dich an, um Posts zu liken.",
    saveLoginToast: "Bitte melde dich an, um Posts zu speichern.",
  },

  // Teilen (share-buttons)
  share: {
    share: "Teilen",
    link: "Link",
    copied: "Kopiert",
    copyAria: "Link kopieren",
    viaDm: "Via DM",
    copiedToast: "Link kopiert",
    copyFailed: "Kopieren fehlgeschlagen",
    shareFailed: "Teilen fehlgeschlagen",
    whatsappAria: "Auf WhatsApp teilen",
    telegramAria: "Auf Telegram teilen",
    xAria: "Auf X teilen",
  },

  // 3-Punkte-Menü für fremde Posts (post-viewer-menu)
  postMenu: {
    moreOptions: "Weitere Optionen",
    notInterested: "Kein Interesse",
    notInterestedToast: "Wir zeigen dir weniger davon.",
    report: "Melden",
    copyLink: "Link kopieren",
    linkCopied: "Link kopiert.",
    copyFailed: "Kopieren fehlgeschlagen.",
    block: "Blockieren",
    blockConfirm:
      "@{username} blockieren?\n\nDieser Account kann dir dann nicht mehr folgen, dir keine Nachrichten schicken und deine Posts nicht sehen.",
    blockedToast: "@{username} wurde blockiert.",
    adminRemove: "Entfernen (Admin)",
    adminRemoveConfirm: "Diesen Beitrag als Admin entfernen? Wird protokolliert.",
    adminRemovedToast: "Beitrag entfernt.",
    adminRemoveFailed: "Entfernen fehlgeschlagen.",
    reportTitle: "Post melden",
    reportDoneTitle: "Meldung eingereicht",
    reportThanksToast: "Danke für deine Meldung. Unser Team prüft das.",
    reportThanksLong: "Danke für deine Meldung. Unser Team prüft sie so schnell wie möglich.",
    reportChooseReason: "Wähle den Grund für deine Meldung:",
    reportSubmitting: "Wird gesendet…",
    reason_spam: "Spam oder Betrug",
    reason_nsfw: "Nacktheit oder sexuelle Inhalte",
    reason_violence: "Gewalt oder gefährliche Inhalte",
    reason_hate_speech: "Hassrede oder Diskriminierung",
    reason_harassment: "Belästigung oder Mobbing",
    reason_copyright: "Copyright-Verstoß",
    reason_other: "Anderer Grund",
  },

  // Profil melden/blockieren (profile-block-button) + Highlights
  userReport: {
    title: "@{username} melden",
    reason_spam: "Spam oder irreführend",
    reason_harassment: "Belästigung oder Mobbing",
    reason_inappropriate: "Unangemessene Inhalte",
    reason_fake_account: "Gefälschtes Konto",
    reason_other: "Anderer Grund",
    thanks: "Danke für deine Meldung. Unser Team wird sie so schnell wie möglich prüfen.",
    highlightDeleteFailed: "Löschen fehlgeschlagen.",
  },

  // 3-Punkte-Menü für eigene Posts + Edit-Dialog (post-author-menu)
  postOwnerMenu: {
    options: "Post-Optionen",
    editPost: "Post bearbeiten",
    pinSaving: "Wird gespeichert…",
    unpin: "Von Profil lösen",
    pin: "Auf Profil anpinnen",
    pinRemovedToast: "Pin entfernt.",
    pinnedToast: "Post angepinnt.",
    actionFailed: "Aktion fehlgeschlagen.",
    deleting: "Wird gelöscht…",
    deletePost: "Post löschen",
    deleteConfirm:
      "Post wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    deletedToast: "Post gelöscht.",
    deleteFailed: "Löschen fehlgeschlagen.",
    savedToast: "Post gespeichert.",
    saveFailed: "Speichern fehlgeschlagen.",
    caption: "Caption",
    captionPlaceholder: "Was möchtest du mitteilen? #hashtag @mention",
    tags: "Tags",
    tagsSelectedSingular: "{count} Tag ausgewählt",
    tagsSelectedPlural: "{count} Tags ausgewählt",
    visibility: "Sichtbarkeit",
    privacyPublic: "Öffentlich",
    privacyPublicDesc: "Alle können diesen Post sehen",
    privacyFriends: "Freunde",
    privacyFriendsDesc: "Nur deine Follower sehen diesen Post",
    privacyPrivate: "Privat",
    privacyPrivateDesc: "Nur du siehst diesen Post",
    format: "Format",
    formatPortrait: "Hochformat",
    formatLandscape: "Querformat",
    formatSquare: "Quadrat",
    interactions: "Interaktionen",
    allowComments: "Kommentare erlauben",
    allowDownload: "Download erlauben",
    allowDuet: "Duett erlauben",
    womenOnly: "Nur für Frauen",
  },

  // Kommentar-System (post-comments / comment-thread / comment-form / load-more)
  comments: {
    disabled: "Kommentare für dieses Video sind deaktiviert.",
    countSingular: "Kommentar",
    countPlural: "Kommentare",
    empty: "Noch keine Kommentare. Sei der Erste!",
    reply: "Antworten",
    replyCountSingular: "{count} Antwort",
    replyCountPlural: "{count} Antworten",
    replyPlaceholder: "Antwort schreiben…",
    writePlaceholder: "Kommentar schreiben… (Enter zum Senden)",
    send: "Senden",
    sending: "Senden…",
    loading: "Lädt…",
    loadMoreSingular: "{count} weiteren Kommentar laden",
    loadMorePlural: "{count} weitere Kommentare laden",
    loginToComment: "um zu kommentieren.",
    charsLeft: "{count} Zeichen übrig",
    likeAria: "Kommentar liken",
    unlikeAria: "Kommentar nicht mehr liken",
    deleteAria: "Kommentar löschen",
    deleteConfirm: "Kommentar wirklich löschen?",
    deleted: "Kommentar gelöscht.",
    deleteFailed: "Löschen fehlgeschlagen.",
    likeFailed: "Like fehlgeschlagen.",
    likeSaveFailed: "Like konnte nicht gespeichert werden.",
    loginFirst: "Bitte zuerst anmelden.",
    loadFailed: "Kommentare konnten nicht geladen werden.",
    loginToReply: "um zu antworten.",
    charsShort: "{count} Zeichen",
    hideReplies: "Antworten ausblenden",
    showRepliesSingular: "{count} Antwort anzeigen",
    showRepliesPlural: "{count} Antworten anzeigen",
    loadingReplies: "Lade Antworten…",
    relJustNow: "gerade eben",
    relMinAgo: "vor {n} Min",
    relHourAgo: "vor {n} Std",
    relYesterday: "gestern",
    relDaysAgo: "vor {n} Tagen",
  },

  // Folgen-Button (profile/follow-button — auch Feed/Profil)
  follow: {
    editProfile: "Profil bearbeiten",
    follow: "Folgen",
    following: "Folgst du",
    requested: "Anfrage gesendet",
    actionFailed: "Aktion fehlgeschlagen",
    toastFollowing: "Du folgst jetzt @{username}",
    toastRequested: "Anfrage an @{username} gesendet",
    toastWithdrawn: "Anfrage an @{username} zurückgezogen",
  },

  explore: {
    metaTitle: "Explore — Trending auf Serlo",
    metaDescription:
      "Entdecke Trending-Hashtags, beliebte Videos und Top-Creator auf Serlo.",
    title: "Explore",
    subtitle: "Was auf Serlo gerade abgeht — Hashtags, Themen, Accounts.",
    trendingHashtags: "Trending Hashtags",
    noHashtags: "Keine aktiven Hashtags — schau in ein paar Tagen wieder rein.",
    popularPosts: "Populäre Posts",
    posts: "Posts",
    views: "Views",
    suggestedPeople: "Accounts entdecken",
    noSuggestedPeople: "Keine Vorschläge verfügbar.",
    follow: "Folgen",
    following: "Folgst du",
  },

  billing: {
    metaTitle: "Bezahlungen — Serlo",
    title: "Bezahlungen",
    subtitle: "Dein Coin-Guthaben, Bestellhistorie und Rechnungen.",

    walletCoinsLabel: "Coins",
    walletCoinsHint: "für Gifts + Shop-Käufe",
    walletCoinsCta: "Aufladen",
    walletDiamondsLabel: "Einnahmen",
    walletDiamondsHint: "von Fans erhalten",
    walletGiftedLabel: "Verschenkt",
    walletGiftedHint: "Coins insgesamt",

    historyTitle: "Bestellhistorie",
    newOrder: "Neue Bestellung",
    emptyTitle: "Noch keine Bestellungen",
    emptyHint: "Wenn du Coins kaufst, erscheinen die Rechnungen hier.",
    emptyCta: "Zum Coin-Shop",

    colDate: "Datum",
    colPackage: "Paket",
    colPrice: "Preis",
    colStatus: "Status",
    colDocs: "Belege",
    coinsUnit: "Coins",

    // Status-Pills — spiegeln `CoinOrderStatus`-Werte aus lib/data/payments.ts
    statusPending: "Ausstehend",
    statusPaid: "Bezahlt",
    statusFailed: "Fehlgeschlagen",
    statusRefunded: "Erstattet",
    statusCancelled: "Abgebrochen",

    docInvoice: "Rechnung",
    docReceipt: "Beleg",

    legalTitle: "Rechtliches",
    legalHint:
      "Käufe sind endgültig nach Verwendung nicht erstattbar. Rechnungen und Belege werden von Stripe automatisch erstellt und per E-Mail an deine hinterlegte Adresse gesendet. Bei Fragen zu Zahlungen schreib uns an {supportEmail}.",
  },

  settings: {
    // Layout-Nav (in `/settings/layout.tsx` und auf jeder Sub-Page sichtbar)
    navOverview: "Übersicht",
    navProfile: "Profil",
    navBilling: "Bezahlungen",
    navNotifications: "Benachrichtigungen",
    navPrivacy: "Privatsphäre",
    phaseHint: "Phase 11",

    // /settings (Root-Overview, v1.w.UI.18 D7)
    overviewMetaTitle: "Einstellungen — Serlo",
    overviewTitle: "Einstellungen",
    overviewSubtitle: "Konto, App und alles dazwischen.",
    sectionAccount: "Konto",
    sectionApp: "App",
    sectionDanger: "Gefahrenzone",
    rowProfileSubtitle: "Name, Bio, Avatar",
    rowBillingSubtitle: "Coins, Wallet, Rechnungen",
    rowNotificationsSubtitle: "Push, DMs, Go-Live",
    rowPrivacySubtitle: "Daten, Einwilligungen, Export",
    rowBlockedLabel: "Geblockte Nutzer",
    rowBlockedSubtitle: "Blocks verwalten",
    rowMutedHostsLabel: "Stumm geschaltete Lives",
    rowMutedHostsSubtitle: "Go-Live-Benachrichtigungen verwalten",
    rowCohostBlocksLabel: "Co-Host-Sperrliste",
    rowCohostBlocksSubtitle: "Wer als Co-Host beitreten darf",
    rowCreatorStudioLabel: "Creator Studio",
    rowCreatorStudioSubtitle: "Einnahmen, Analytics, Top Posts",
    rowCreatorActivateLabel: "Creator werden ✦",
    rowCreatorActivateSubtitle: "Kostenlos · Sofortzugang · Monetarisierung",
    rowLanguageLabel: "Sprache",
    rowThemeLabel: "Design",
    rowThemeLight: "Hell",
    rowThemeDark: "Dunkel",
    rowSignOutLabel: "Abmelden",
    rowDeleteLabel: "Konto löschen",
    rowDeleteSubtitle: "Unwiderruflich — alle Daten löschen",
    comingSoonBadge: "Bald",

    // v1.w.UI.189 — WOZ row + Account Security
    sectionWoz: "Women-Only Zone 🌸",
    rowWozLabel: "Women-Only Zone",
    rowWozSubtitle: "Verifiziere dich um Women-Only Inhalte zu sehen",
    rowWozActiveSubtitle: "Du hast Zugang zu Women-Only Inhalten",
    rowWozActiveBadge: "Aktiv ✓",
    sectionSecurity: "Account-Sicherheit",
    rowChangeEmailLabel: "E-Mail ändern",
    rowChangeEmailSubtitle: "Bestätigungs-E-Mail an neue Adresse",
    rowChangePasswordLabel: "Passwort ändern",
    rowChangePasswordSubtitle: "Mindestens 8 Zeichen",
    securityEmailPlaceholder: "neue@email.de",
    securityEmailSubmit: "E-Mail ändern",
    securityEmailSubmitting: "Sende…",
    securityEmailSuccess:
      "Bestätigungs-E-Mail gesendet — bitte prüfe dein Postfach.",
    securityPasswordPlaceholder: "Neues Passwort (mind. 8 Zeichen)",
    securityPasswordConfirmPlaceholder: "Passwort bestätigen",
    securityPasswordSubmit: "Passwort ändern",
    securityPasswordSubmitting: "Speichere…",
    securityPasswordSuccess: "Passwort wurde geändert.",
    securityPasswordMismatch: "Passwörter stimmen nicht überein.",
    securityPasswordTooShort: "Mindestens 8 Zeichen erforderlich.",
    securityCancel: "Abbrechen",

    // v1.w.UI.20 — Profil-Editor
    profileMetaTitle: "Profil — Einstellungen — Serlo",
    profileTitle: "Profil",
    profileSubtitle: "So erscheinst du auf Serlo — Name, Bio und Handle.",
    profileBackToOverview: "Zurück zu Einstellungen",
    profileFieldDisplayName: "Anzeigename",
    profileFieldDisplayNameHint:
      "So erscheint dein Name unter Posts und auf deinem Profil.",
    profileFieldBio: "Bio",
    profileFieldBioHint:
      "Eine kurze Intro-Zeile auf deinem Profil. Links und @-Erwähnungen werden automatisch erkannt.",
    profileFieldUsername: "Benutzername",
    profileFieldUsernameHint:
      "Dein Handle ist hier nicht änderbar — er ist mit all deinen URLs und Erwähnungen verknüpft.",
    profileSave: "Speichern",
    profileSaving: "Speichere…",
    profileSaved: "Profil aktualisiert.",
    profileErrorFallback:
      "Konnte nicht gespeichert werden — bitte erneut versuchen.",

    // v1.w.UI.21 — Avatar-Upload
    profileAvatarTitle: "Profilbild",
    profileAvatarHint:
      "Quadratisch und mindestens 200 × 200 px funktioniert am besten. JPG, PNG oder WebP bis 10 MB.",
    profileAvatarUpload: "Bild wählen",
    profileAvatarUploading: "Lade hoch…",
    profileAvatarRemove: "Entfernen",
    profileAvatarAiGenerate: "KI-Bild",
    profileAvatarErrorTooLarge: "Die Datei ist zu groß (max. 10 MB).",
    profileAvatarErrorType: "Nur Bilddateien erlaubt.",
    profileAvatarErrorUpload: "Upload fehlgeschlagen — bitte erneut versuchen.",
    profileAvatarErrorSign: "Upload konnte nicht vorbereitet werden.",
    profileAvatarErrorSave: "Profilbild konnte nicht gespeichert werden.",

    // /settings/notifications
    notifMetaTitle: "Benachrichtigungen — Serlo",
    notifTitle: "Benachrichtigungen",
    notifSubtitle:
      "Entscheide, wie wir dich erreichen — Browser-Push für Desktop und Handy.",
    notifComingSoon:
      "E-Mail-Digest und feinere Kanal-Einstellungen (DM / Go-Live / Geschenke einzeln togglen) kommen mit einem der nächsten Updates.",
  },

  shop: {
    title: "Shop",
    metaTitle: "Shop — Entdecke kuratierte Produkte",
    metaDescription:
      "Digital, physisch, Services und Collectibles — direkt aus der Serlo-Community. Mit Coins oder (in Kürze) per Karte bezahlen.",
    ogTitle: "Serlo Shop",
    ogDescription: "Kuratierte Produkte direkt aus der Community.",
    // Interpolation {count} — Pluralformen muss jede Locale selbst im String regeln
    productCount: "{count} Produkte",
    noMatches: "Keine Produkte passen auf deine Filter.",
    browseCatalog: "Entdecke Produkte aus der Community.",
    saved: "Gemerkt",
    myOrders: "Bestellungen",
    emptyTitle: "Keine Treffer",
    emptyHint:
      'Lockere die Filter oder probiere eine andere Kategorie. Die Sidebar links hat einen „Zurücksetzen"-Button.',

    // Produkt-Detailseite (/shop/[id])
    detail: {
      categoryPhysical: "Physisches Produkt",
      categoryDigital: "Digitaler Download",
      categoryService: "Service",
      categoryCollectible: "Collectible",
      womenOnly: "Women-Only",
      soldCount: "{count}× verkauft",
      preorderPayOnArrival: "🤎 Vorbestellung · Zahlung bei Eintreffen",
      preorderSeeDescription: "🤎 Vorbestellung · Preis siehe Beschreibung",
      deliveryFree: "Gratis",
      deliveryDm: "Per DM",
      deliveryInstant: "Sofort",
      deliveryAfterPurchase: "Nach Kauf",
      stockInStock: "Auf Lager",
      stockSoldOut: "Ausverkauft",
      stockOnly: "Nur {count}",
      breadcrumbShop: "Shop",
      infoDelivery: "Lieferung",
      infoRating: "Bewertung",
      infoStock: "Lager",
      ratingNew: "Neu",
      ratingSingular: "Bewertung",
      ratingPlural: "Bewertungen",
      viewProfile: "Profil ansehen →",
      sellerShop: "Shop",
      description: "Beschreibung",
      editProduct: "Produkt bearbeiten",
      reviewsTitle: "Bewertungen",
      reviewsCount: "{count} Bewertungen",
      moreFromSeller: "Mehr von @{username}",
    },

    // Kauf-CTA / BuyBar (components/shop/buy-bar.tsx)
    buy: {
      saveAria: "Merken",
      unsaveAria: "Nicht mehr merken",
      preorderLabel: "Vorbestellung",
      preorderCollectiveWord: "Sammelbestellung",
      preorderCollectiveHint:
        "du zahlst erst, wenn die Ware da ist. Trag dich ein, @{username} meldet sich.",
      preordered: "Vorbestellt",
      ownProduct: "Dein Produkt",
      preorderCta: "Vorbestellen",
      preorderedNote: "Eingetragen — @{username} meldet sich bei dir. 🤎",
      cancelPreorder: "Zurücknehmen",
      soldOut: "Ausverkauft",
      buyNow: "Jetzt kaufen",
      topUpCoins: "Coins aufladen",
      confirmTitle: "Produkt kaufen?",
      currentBalance: "Aktuelles Guthaben",
      afterPurchase: "Nach Kauf",
      insufficient: "Dir fehlen {count} Coins. Lade Guthaben im Coin-Shop auf.",
      confirm: "Bestätigen",
      successTitle: "Kauf erfolgreich",
      successBody:
        "Bestellung für „{title}“ gespeichert. Neues Guthaben: {balance} Coins.",
      myPurchases: "Meine Käufe",
    },

    // Beschreibung-Expand + Bewertungen (product-description / review-list / review-form)
    reviews: {
      toggleMore: "Mehr",
      toggleLess: "Weniger",
      empty:
        "Noch keine Bewertungen. Sei der/die Erste — kauf das Produkt und hinterlasse eine Bewertung.",
      deletedUser: "Gelöschter User",
      agoSec: "vor {n}s",
      agoMin: "vor {n} Min.",
      agoHour: "vor {n} Std.",
      agoDay: "vor {n} Tg.",
      agoWeek: "vor {n} W.",
      agoMonth: "vor {n} Mo.",
      agoYear: "vor {n} J.",
      formTitleEdit: "Deine Bewertung bearbeiten",
      formTitleNew: "Produkt bewerten",
      formHint:
        "Deine Meinung hilft anderen Käufern. Du kannst deine Bewertung später bearbeiten.",
      commentPlaceholder: "Schreib einen kurzen Kommentar (optional)",
      submitEdit: "Bewertung aktualisieren",
      submitNew: "Bewertung abschicken",
    },
  },

  studio: {
    // Sub-Nav (StudioSubNav Client-Component — liest per useI18n())
    navAria: "Studio-Navigation",
    navDashboard: "Startseite",
    navAnalytics: "Analyse",
    navRealtime: "Leistung in Echtzeit",
    navRevenue: "Einnahmen",
    navScheduled: "Geplant",
    navDrafts: "Entwürfe",
    navLive: "Live",
    navShop: "Shop",
    navOrders: "Bestellungen",
    navModeration: "Moderation",

    // Meta
    metaTitle: "Creator Studio",
    metaDescription: "Performance, Einnahmen und Content-Planung.",

    // Header (Hi, {name})
    badge: "Creator-Betrieb",
    greeting: "Hi, {name}",
    subtitle: "Performance, Einnahmen und geplante Inhalte.",
    creatorFallback: "Creator",

    // Reichweite / KPI-Grid
    reachTitle: "Performance",
    kpiViews: "Views",
    kpiLikes: "Likes",
    kpiComments: "Kommentare",
    kpiNewFollowers: "Neue Follower",
    kpiPrev: "vorher: {value}",

    // Diamonds-Hero
    diamondBalance: "Einnahmen",
    periodGiftsLine: "+{amount} in diesem Zeitraum ({gifts} Gifts)",
    noGiftsPeriod: "Keine Gifts in diesem Zeitraum",
    earningsDetails: "Einnahmen öffnen",

    // Engagement / Earnings / Follower Summary-Cards
    engagementRate: "Engagement-Rate",
    engagementHint: "{interactions} Interaktionen auf {views} Views",
    topGift: "Top-Gift",
    topSupporter: "Top-Supporter: {name}",
    noGiftsPeriodShort: "Noch keine Gifts in diesem Zeitraum",
    followerLabel: "Follower",
    followerAdded: "+{added} neu im Zeitraum",

    // Content-Planning-Section
    planningTitle: "Planung",
    planScheduledLabel: "Geplant",
    planScheduledActive: "aktiv",
    planScheduledErrors: "{count} Fehler",
    planDraftsLabel: "Entwürfe",
    planDraftsHint: "gespeichert",
    planLiveLabel: "Live",
    planLiveHint: "in {days} T",
    planShopLabel: "Shop",
    planShopHint: "{count} Verkäufe",

    // Top-Posts-Panel
    topPostsTitle: "Top-Posts (Views)",
    allLink: "Alle",
    topPostsEmpty: "Noch keine auswertbaren Beiträge in diesem Zeitraum.",
    noCaption: "Ohne Caption",

    // Recent-Gifts-Panel
    recentGiftsTitle: "Letzte Gifts",
    recentGiftsEmpty: "Noch keine Gifts empfangen.",
    giftFrom: "von {name} · {relative}",

    // CTA-Row
    moreDetails: "Analytics",
    moreDetailsHint:
      "Vertiefe Reichweite, Peak-Hours und Watch-Time in der Analytics-Ansicht.",
    toAnalytics: "Analytics öffnen",

    // Relative-Time-Helper (formatRelative)
    timeJustNow: "gerade eben",
    timeMinAgo: "vor {n} Min",
    timeHourAgo: "vor {n} Std",
    timeDayAgo: "vor {n} T",

    // Period-Tabs (PeriodTabs Client-Component)
    period7: "7 Tage",
    period28: "28 Tage",
    period90: "90 Tage",
  },
};

// Hinweis: KEIN `as const` auf dem Object. Sonst würde `typeof deMessages`
// die Werte als Literal-Types einfrieren (`'Feed'` statt `string`), wodurch
// andere Locales nicht mehr assignbar wären (`'Лента'` ist nicht vom Typ
// `'Feed'`). Die Object-Struktur wird trotzdem vollständig für `PathInto`
// inferiert — Keys sind schließlich Struktur, keine Werte.
export type Messages = typeof deMessages;
export default deMessages;
