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
    inbox: 'Inbox',
    live: 'Live',
    messages: 'Messages',
    create: 'Upload',
    guilds: 'Guilds',
    studio: 'Creator Studio',
    profile: 'Profile',
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

  profile: {
    metaNotFoundTitle: '@{username} not found',
    metaGenericDescription: '{name} on Serlo — {count} followers.',

    verifiedBadge: 'Verified',
    statPosts: 'Posts',
    statFollower: 'Followers',
    statFollowing: 'Following',
    // v1.w.UI.16: gradient-ring + LIVE-badge when the user is currently hosting
    liveBadge: 'LIVE',
    liveNow: '{name} is live — watch now',

    tablistLabel: 'Profile content',
    tabPosts: 'Posts',
    tabLikes: 'Likes',
    tabShop: 'Shop',
    tabBattles: 'Battles',

    emptyPostsTitle: 'No videos yet',
    emptyPostsSelf:
      'Your videos will appear here — upload your first one in the app.',
    emptyPostsOther: '@{username} doesn\u2019t have any public videos yet.',
    panelLikesTitle: 'Liked videos are private',
    panelLikesHintSelf:
      'Only you can see your like history — and right now only in the app.',
    panelLikesHintOther:
      'Likes are private — only the account owner can see them.',
    panelShopTitle: 'Shop is coming in phase 4',
    panelShopHint: 'Storefront, sale management and checkout are being built.',
    panelBattlesTitle: 'Live battles are in the app',
    panelBattlesHint: 'Battle history and replays arrive on web in phase 6.',

    nfTitle: 'Account not found',
    nfHint:
      'This username doesn\u2019t exist on Serlo (yet) — could be a typo, or the account was deleted.',
    nfHome: 'Go to home',
    nfSignup: 'Create your own account',
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
    suggestedPeople: 'Discover accounts',
    noSuggestedPeople: 'No suggestions available.',
    follow: 'Follow',
    following: 'Following',
  },

  billing: {
    metaTitle: 'Payments — Serlo',
    title: 'Payments',
    subtitle: 'Your coin balance, order history and invoices.',

    walletCoinsLabel: 'Coins',
    walletCoinsHint: 'for gifts + shop purchases',
    walletCoinsCta: 'Top up',
    walletDiamondsLabel: 'Diamonds',
    walletDiamondsHint: 'received from fans',
    walletGiftedLabel: 'Gifted',
    walletGiftedHint: 'coins total',

    historyTitle: 'Order history',
    newOrder: 'New order',
    emptyTitle: 'No orders yet',
    emptyHint: 'When you buy coins, your invoices will show up here.',
    emptyCta: 'To coin shop',

    colDate: 'Date',
    colPackage: 'Package',
    colPrice: 'Price',
    colStatus: 'Status',
    colDocs: 'Docs',
    coinsUnit: 'Coins',

    statusPending: 'Pending',
    statusPaid: 'Paid',
    statusFailed: 'Failed',
    statusRefunded: 'Refunded',
    statusCancelled: 'Cancelled',

    docInvoice: 'Invoice',
    docReceipt: 'Receipt',

    legalTitle: 'Legal',
    legalHint:
      'Purchases are non-refundable after use. Invoices and receipts are generated automatically by Stripe and emailed to your address on file. Payment questions: {supportEmail}.',
  },

  settings: {
    navOverview: 'Overview',
    navProfile: 'Profile',
    navBilling: 'Payments',
    navNotifications: 'Notifications',
    navPrivacy: 'Privacy',
    phaseHint: 'Phase 11',

    overviewMetaTitle: 'Settings — Serlo',
    overviewTitle: 'Settings',
    overviewSubtitle: 'Account, app, and everything in between.',
    sectionAccount: 'Account',
    sectionApp: 'App',
    sectionDanger: 'Danger zone',
    rowProfileSubtitle: 'Name, bio, avatar',
    rowBillingSubtitle: 'Coins, wallet, invoices',
    rowNotificationsSubtitle: 'Push, DMs, Go-Live',
    rowPrivacySubtitle: 'Data, consents, export',
    rowBlockedLabel: 'Blocked users',
    rowBlockedSubtitle: 'Manage blocks',
    rowLanguageLabel: 'Language',
    rowThemeLabel: 'Theme',
    rowThemeLight: 'Light',
    rowThemeDark: 'Dark',
    rowSignOutLabel: 'Sign out',
    rowDeleteLabel: 'Delete account',
    rowDeleteSubtitle: 'Permanent — all data removed',
    comingSoonBadge: 'Soon',

    // v1.w.UI.20 — Profile editor
    profileMetaTitle: 'Profile — Settings — Serlo',
    profileTitle: 'Profile',
    profileSubtitle: 'How you appear on Serlo — name, bio, and handle.',
    profileBackToOverview: 'Back to Settings',
    profileFieldDisplayName: 'Display name',
    profileFieldDisplayNameHint: 'How your name appears on posts and your profile.',
    profileFieldBio: 'Bio',
    profileFieldBioHint: 'A short intro shown on your profile. Links and @-mentions are auto-detected.',
    profileFieldUsername: 'Username',
    profileFieldUsernameHint: "Your handle can't be changed here — it's linked to all your URLs and mentions.",
    profileSave: 'Save',
    profileSaving: 'Saving…',
    profileSaved: 'Profile updated.',
    profileErrorFallback: 'Could not save — please try again.',

    // v1.w.UI.21 — Avatar upload
    profileAvatarTitle: 'Profile picture',
    profileAvatarHint: 'Square, at least 200 × 200 px works best. JPG, PNG or WebP up to 10 MB.',
    profileAvatarUpload: 'Choose image',
    profileAvatarUploading: 'Uploading…',
    profileAvatarRemove: 'Remove',
    profileAvatarErrorTooLarge: 'File is too large (max. 10 MB).',
    profileAvatarErrorType: 'Only image files allowed.',
    profileAvatarErrorUpload: 'Upload failed — please try again.',
    profileAvatarErrorSign: 'Could not prepare upload.',
    profileAvatarErrorSave: 'Could not save profile picture.',

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

  studio: {
    navAria: 'Studio navigation',
    navDashboard: 'Dashboard',
    navAnalytics: 'Analytics',
    navRevenue: 'Revenue',
    navScheduled: 'Scheduled',
    navDrafts: 'Drafts',
    navLive: 'Live',
    navShop: 'Shop',
    navOrders: 'Orders',
    navModeration: 'Moderation',

    metaTitle: 'Creator Studio',
    metaDescription: 'Your dashboard — views, earnings, follower growth.',

    badge: 'Creator Studio',
    greeting: 'Hi, {name}',
    subtitle: 'Your dashboard — everything at a glance.',
    creatorFallback: 'Creator',

    reachTitle: 'Reach',
    kpiViews: 'Views',
    kpiLikes: 'Likes',
    kpiComments: 'Comments',
    kpiNewFollowers: 'New followers',
    kpiPrev: 'before: {value}',

    diamondBalance: 'Diamond balance',
    periodGiftsLine: '+{amount} this period ({gifts} gifts)',
    noGiftsPeriod: 'No gifts in the selected period',
    earningsDetails: 'Earnings details',

    engagementRate: 'Engagement rate',
    engagementHint: '{interactions} interactions on {views} views',
    topGift: 'Top gift',
    topSupporter: 'Top supporter: {name}',
    noGiftsPeriodShort: 'No gifts yet in this period',
    followerLabel: 'Followers',
    followerAdded: '+{added} new in period',

    planningTitle: 'Content planning',
    planScheduledLabel: 'Scheduled',
    planScheduledActive: 'active',
    planScheduledErrors: '{count} errors',
    planDraftsLabel: 'Drafts',
    planDraftsHint: 'saved',
    planLiveLabel: 'Live sessions',
    planLiveHint: 'in {days}d',
    planShopLabel: 'Shop revenue',
    planShopHint: '{count} sales',

    topPostsTitle: 'Top posts (views)',
    allLink: 'All',
    topPostsEmpty:
      'No data yet. Post something and check back in a few hours.',
    noCaption: 'No caption',

    recentGiftsTitle: 'Recent gifts',
    recentGiftsEmpty: 'No gifts received yet. Go live — they will come.',
    giftFrom: 'from {name} · {relative}',

    moreDetails: 'Want more detail?',
    moreDetailsHint:
      'The analytics page shows follower growth, peak hours and watch-time estimates.',
    toAnalytics: 'To analytics',

    timeJustNow: 'just now',
    timeMinAgo: '{n} min ago',
    timeHourAgo: '{n}h ago',
    timeDayAgo: '{n}d ago',

    period7: '7 days',
    period28: '28 days',
    period90: '90 days',
  },
} satisfies Messages;

export default enMessages;
