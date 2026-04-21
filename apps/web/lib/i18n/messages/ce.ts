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
    cancel: 'Соцо',                // "stopp / abbrechen"
    save: 'КIелдила',             // "speichern"
    delete: 'ДIадаккха',         // "wegnehmen / löschen"
    close: 'Къовла',              // "schließen"
    back: 'Юхадерза',             // "zurück"
  },

  nav: {
    feed: 'Хаамаш',              // "Nachrichten/News-Feed"
    explore: 'Лаха',              // "suchen / entdecken"
    shop: 'Туькан',               // "Laden / Shop"
    live: 'Дийна',                // "live (wörtl. am-Leben)"
    messages: 'Кехаташ',         // "Briefe / Nachrichten"
    create: 'Латта',              // "hochladen / legen"
    guilds: 'ТобанаIаш',         // "Gemeinschaften"
    studio: 'Студи',               // Lehnwort
    openMenu: 'Меню схьайилла', // "Menü öffnen"
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
    guilds: 'ТобанаIаш',
    payments: 'Деш',               // "Zahlungen" (vereinfacht)
    settings: 'НисдаршIан',      // "Einstellungen"
    language: 'Мотт',               // "Sprache"
    logout: 'Аравала',             // "hinausgehen"
  },

  auth: {
    login: 'Чуваха',              // "hineingehen"
    signup: 'Аккаунт йаккха',   // "Account erstellen"
    logout: 'Аравала',
  },

  messages: {
    title: 'Кехаташ',
    noConversations: 'Хилла йолу къамелаш дацIа.',
    emptyTitle: 'Цкъа а кехат дацIа',
    emptyHint: 'Лаха креатор, профиль, йа туьканан дечо, а къамел дIадолаа.',
    searchUser: 'Декъашхо лаха',
    new: 'Керла',
  },

  empty: {
    generic: 'Кхузахь хIумма дацIа.',
  },
} satisfies Messages;

export default ceMessages;
