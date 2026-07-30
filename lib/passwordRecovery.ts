/**
 * Passwort-Reset-Zustand, geteilt zwischen AuthGuard und dem Reset-Screen.
 *
 * Bewusst ein einfaches Objekt statt Zustand/Context: der Wert wird nur im
 * Navigations-Guard gelesen und darf KEIN Re-Render auslösen — er entscheidet
 * lediglich, ob der Guard gerade wegnavigieren darf.
 *
 * Ablauf: Der Recovery-Link aus der E-Mail bringt Tokens im URL-Fragment mit.
 * `src/_layout.full.tsx` setzt damit eine Sitzung — ab diesem Moment ist der
 * Nutzer technisch eingeloggt, hat aber noch das ALTE (vergessene) Passwort.
 * Ohne diese Sperre würde der Guard ihn sofort in die Tabs schicken und der
 * Reset-Screen wäre nie erreichbar.
 */
export const passwordRecovery = { active: false };
