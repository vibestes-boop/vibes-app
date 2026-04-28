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
    inbox: 'Уведомления',
    live: 'Эфир',
    messages: 'Сообщения',
    create: 'Загрузить',
    guilds: 'Сообщества',
    studio: 'Студия',
    profile: 'Профиль',
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

  profile: {
    metaNotFoundTitle: '@{username} не найден',
    metaGenericDescription: '{name} на Serlo — {count} подписчиков.',

    verifiedBadge: 'Верифицирован',
    statPosts: 'Постов',
    statFollower: 'Подписчиков',
    statFollowing: 'Подписок',
    // v1.w.UI.16: gradient-ring + LIVE-badge когда пользователь стримит
    liveBadge: 'ЛАЙВ',
    liveNow: '{name} сейчас в эфире — смотреть',

    tablistLabel: 'Содержимое профиля',
    tabPosts: 'Посты',
    tabLikes: 'Лайки',
    tabReposts: 'Репосты',
    tabShop: 'Магазин',
    tabBattles: 'Баттлы',
    emptyRepostsTitle: 'Нет репостов',
    emptyRepostsSelf: 'Посты, которые ты репостишь, появятся здесь.',
    emptyRepostsOther: '@{username} ещё ничего не репостил.',
    emptyRepostsHint: 'Нет репостов.',

    emptyPostsTitle: 'Пока нет видео',
    emptyPostsSelf:
      'Твои видео будут здесь — загрузи первое через приложение.',
    emptyPostsOther: 'У @{username} пока нет публичных видео.',
    panelLikesTitle: 'Лайки — приватные',
    panelLikesHintSelf: 'Только ты видишь свою историю лайков — сейчас только в приложении.',
    panelLikesHintOther:
      'Лайки приватные — видит только владелец аккаунта.',
    panelShopTitle: 'Магазин в фазе 4',
    panelShopHint: 'Витрина, скидки и оплата собираются прямо сейчас.',
    panelBattlesTitle: 'Live-баттлы — в приложении',
    panelBattlesHint: 'История и повторы баттлов придут в вебе в фазе 6.',

    nfTitle: 'Аккаунт не найден',
    nfHint:
      'Такого юзернейма на Serlo (пока) нет — возможно, опечатка или аккаунт удалён.',
    nfHome: 'На главную',
    nfSignup: 'Создать свой аккаунт',
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
    suggestedPeople: 'Новые аккаунты',
    noSuggestedPeople: 'Нет предложений.',
    follow: 'Подписаться',
    following: 'Вы подписаны',
  },

  billing: {
    metaTitle: 'Платежи — Serlo',
    title: 'Платежи',
    subtitle: 'Твой баланс монет, история заказов и счета.',

    walletCoinsLabel: 'Монеты',
    walletCoinsHint: 'на подарки и покупки',
    walletCoinsCta: 'Пополнить',
    walletDiamondsLabel: 'Бриллианты',
    walletDiamondsHint: 'получены от фанатов',
    walletGiftedLabel: 'Подарено',
    walletGiftedHint: 'монет всего',

    historyTitle: 'История заказов',
    newOrder: 'Новый заказ',
    emptyTitle: 'Заказов пока нет',
    emptyHint: 'Когда ты купишь монеты, счета появятся здесь.',
    emptyCta: 'В магазин монет',

    colDate: 'Дата',
    colPackage: 'Пакет',
    colPrice: 'Цена',
    colStatus: 'Статус',
    colDocs: 'Документы',
    coinsUnit: 'монет',

    statusPending: 'Ожидание',
    statusPaid: 'Оплачено',
    statusFailed: 'Ошибка',
    statusRefunded: 'Возвращено',
    statusCancelled: 'Отменено',

    docInvoice: 'Счёт',
    docReceipt: 'Чек',

    legalTitle: 'Юридическое',
    legalHint:
      'Покупки после использования не подлежат возврату. Счета и чеки создаются Stripe автоматически и отправляются на указанный email. Вопросы по оплате — {supportEmail}.',
  },

  settings: {
    navOverview: 'Обзор',
    navProfile: 'Профиль',
    navBilling: 'Платежи',
    navNotifications: 'Уведомления',
    navPrivacy: 'Приватность',
    phaseHint: 'Этап 11',

    overviewMetaTitle: 'Настройки — Serlo',
    overviewTitle: 'Настройки',
    overviewSubtitle: 'Аккаунт, приложение и всё между ними.',
    sectionAccount: 'Аккаунт',
    sectionApp: 'Приложение',
    sectionDanger: 'Опасная зона',
    rowProfileSubtitle: 'Имя, био, аватар',
    rowBillingSubtitle: 'Coins, кошелёк, счета',
    rowNotificationsSubtitle: 'Пуши, ЛС, эфиры',
    rowPrivacySubtitle: 'Данные, согласия, экспорт',
    rowBlockedLabel: 'Заблокированные',
    rowBlockedSubtitle: 'Управление блокировками',
    rowMutedHostsLabel: 'Отключённые эфиры',
    rowMutedHostsSubtitle: 'Уведомления о начале стримов',
    rowCohostBlocksLabel: 'Блок-лист со-хостов',
    rowCohostBlocksSubtitle: 'Кто может стримить вместе с тобой',
    rowCreatorStudioLabel: 'Creator Studio',
    rowCreatorStudioSubtitle: 'Доходы, аналитика, топ-посты',
    rowCreatorActivateLabel: 'Стать Creator ✦',
    rowCreatorActivateSubtitle: 'Бесплатно · Мгновенный доступ · Монетизация',
    rowLanguageLabel: 'Язык',
    rowThemeLabel: 'Тема',
    rowThemeLight: 'Светлая',
    rowThemeDark: 'Тёмная',
    rowSignOutLabel: 'Выйти',
    rowDeleteLabel: 'Удалить аккаунт',
    rowDeleteSubtitle: 'Необратимо — все данные стираются',
    comingSoonBadge: 'Скоро',

    // v1.w.UI.189 — WOZ row + Account Security
    sectionWoz: 'Women-Only Zone 🌸',
    rowWozLabel: 'Women-Only Zone',
    rowWozSubtitle: 'Верифицируйся для доступа к контенту только для женщин',
    rowWozActiveSubtitle: 'У тебя есть доступ к Women-Only контенту',
    rowWozActiveBadge: 'Активно ✓',
    sectionSecurity: 'Безопасность аккаунта',
    rowChangeEmailLabel: 'Изменить email',
    rowChangeEmailSubtitle: 'Письмо подтверждения отправят на новый адрес',
    rowChangePasswordLabel: 'Изменить пароль',
    rowChangePasswordSubtitle: 'Минимум 8 символов',
    securityEmailPlaceholder: 'новый@email.ru',
    securityEmailSubmit: 'Изменить email',
    securityEmailSubmitting: 'Отправка…',
    securityEmailSuccess: 'Письмо подтверждения отправлено — проверь почту.',
    securityPasswordPlaceholder: 'Новый пароль (мин. 8 символов)',
    securityPasswordConfirmPlaceholder: 'Подтверди пароль',
    securityPasswordSubmit: 'Изменить пароль',
    securityPasswordSubmitting: 'Сохраняю…',
    securityPasswordSuccess: 'Пароль изменён.',
    securityPasswordMismatch: 'Пароли не совпадают.',
    securityPasswordTooShort: 'Необходимо минимум 8 символов.',
    securityCancel: 'Отмена',

    // v1.w.UI.20 — Редактор профиля
    profileMetaTitle: 'Профиль — Настройки — Serlo',
    profileTitle: 'Профиль',
    profileSubtitle: 'Каким тебя видят на Serlo — имя, био и ник.',
    profileBackToOverview: 'Назад к Настройкам',
    profileFieldDisplayName: 'Имя',
    profileFieldDisplayNameHint: 'Так твоё имя показывается под постами и на профиле.',
    profileFieldBio: 'Био',
    profileFieldBioHint: 'Короткое интро на твоём профиле. Ссылки и @-упоминания определяются автоматически.',
    profileFieldUsername: 'Ник',
    profileFieldUsernameHint: 'Ник здесь нельзя изменить — он связан со всеми твоими URL и упоминаниями.',
    profileSave: 'Сохранить',
    profileSaving: 'Сохраняю…',
    profileSaved: 'Профиль обновлён.',
    profileErrorFallback: 'Не удалось сохранить — попробуй ещё раз.',

    // v1.w.UI.21 — Загрузка аватара
    profileAvatarTitle: 'Аватар',
    profileAvatarHint: 'Лучше квадрат от 200 × 200 px. JPG, PNG или WebP до 10 МБ.',
    profileAvatarUpload: 'Выбрать фото',
    profileAvatarUploading: 'Загружаю…',
    profileAvatarRemove: 'Удалить',
    profileAvatarAiGenerate: 'ИИ-изображение',
    profileAvatarErrorTooLarge: 'Файл слишком большой (макс. 10 МБ).',
    profileAvatarErrorType: 'Разрешены только изображения.',
    profileAvatarErrorUpload: 'Загрузка не удалась — попробуй ещё раз.',
    profileAvatarErrorSign: 'Не удалось подготовить загрузку.',
    profileAvatarErrorSave: 'Не удалось сохранить аватар.',

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
    browseCatalog: 'Открой товары от крейторов.',
    saved: 'Сохранённое',
    myOrders: 'Заказы',
    emptyTitle: 'Ничего не найдено',
    emptyHint:
      'Ослабь фильтры или попробуй другую категорию. В сайдбаре слева есть кнопка «Сбросить».',
  },

  studio: {
    navAria: 'Навигация студии',
    navDashboard: 'Дашборд',
    navAnalytics: 'Аналитика',
    navRevenue: 'Доходы',
    navScheduled: 'Запланировано',
    navDrafts: 'Черновики',
    navLive: 'Эфир',
    navShop: 'Магазин',
    navOrders: 'Заказы',
    navModeration: 'Модерация',

    metaTitle: 'Студия автора',
    metaDescription: 'Твой дашборд — просмотры, доходы, рост подписчиков.',

    badge: 'Студия автора',
    greeting: 'Привет, {name}',
    subtitle: 'Твой дашборд — всё на одном экране.',
    creatorFallback: 'Автор',

    reachTitle: 'Охват',
    kpiViews: 'Просмотры',
    kpiLikes: 'Лайки',
    kpiComments: 'Комментарии',
    kpiNewFollowers: 'Новые подписчики',
    kpiPrev: 'ранее: {value}',

    diamondBalance: 'Баланс бриллиантов',
    periodGiftsLine: '+{amount} за этот период ({gifts} подарков)',
    noGiftsPeriod: 'За выбранный период подарков нет',
    earningsDetails: 'Детали доходов',

    engagementRate: 'Engagement-Rate',
    engagementHint: '{interactions} взаимодействий на {views} просмотров',
    topGift: 'Топ-подарок',
    topSupporter: 'Топ-саппортер: {name}',
    noGiftsPeriodShort: 'Пока нет подарков в этом периоде',
    followerLabel: 'Подписчики',
    followerAdded: '+{added} новых за период',

    planningTitle: 'Планирование контента',
    planScheduledLabel: 'Запланировано',
    planScheduledActive: 'активно',
    planScheduledErrors: '{count} ошибок',
    planDraftsLabel: 'Черновики',
    planDraftsHint: 'сохранено',
    planLiveLabel: 'Live-сессии',
    planLiveHint: 'за {days} дн',
    planShopLabel: 'Оборот магазина',
    planShopHint: '{count} продаж',

    topPostsTitle: 'Топ-посты (просмотры)',
    allLink: 'Все',
    topPostsEmpty:
      'Данных пока нет. Опубликуй контент и загляни сюда через пару часов.',
    noCaption: 'Без подписи',

    recentGiftsTitle: 'Последние подарки',
    recentGiftsEmpty: 'Подарков пока нет. Иди в эфир — и они появятся.',
    giftFrom: 'от {name} · {relative}',

    moreDetails: 'Нужно больше деталей?',
    moreDetailsHint:
      'Страница аналитики покажет рост подписчиков, пиковые часы и оценку watch-time.',
    toAnalytics: 'К аналитике',

    timeJustNow: 'только что',
    timeMinAgo: '{n} мин назад',
    timeHourAgo: '{n} ч назад',
    timeDayAgo: '{n} дн назад',

    period7: '7 дней',
    period28: '28 дней',
    period90: '90 дней',
  },
} satisfies Messages;

export default ruMessages;
