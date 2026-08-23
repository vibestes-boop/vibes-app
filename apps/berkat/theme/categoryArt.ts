// Das Bild einer Kategorie — an EINER Stelle für alle Flächen.
//
// Zwei Oberflächen zeigen dasselbe: die Entdeckungs-Leiste auf der Startseite
// und das Raster im Kategorien-Reiter. Bis zum 18.08.2026 stand die Zuordnung
// nur im Reiter, die Leiste hatte gar kein Bild — sie war eine reine Textzeile.
//
// ÜBERGANGSZUSTAND, bewusst so:
// Whatnots Kacheln tragen ein FREIGESTELLTES PRODUKTFOTO auf einem eigenen
// Farbverlauf — ein Sneaker auf Beige, eine Pflanze auf Lila. Das ist der
// größte sichtbare Abstand zu Berkat und in der Analyse belegt
// (WHATNOT-ANALYSE, Nachtrag zur vierten Analyse). Solange die Fotos fehlen,
// steht an genau derselben Stelle das Symbol.
//
// WER DIE FOTOS EINSETZT, ÄNDERT NUR DIESE DATEI:
// `photo` je Kategorie füllen (`require('../assets/categories/mode.png')` oder
// eine URL). Beide Flächen lesen es über `categoryArt()`, Kachelgröße, Raster
// und Textanordnung bleiben unberührt. Freistellen genügt — 3D-Renderings sind
// es bei Whatnot nur teilweise.

import {
  Baby,
  BookOpen,
  Coins,
  Gem,
  House,
  Moon,
  Package,
  Shirt,
  ShoppingBag,
  Sparkles,
  Watch,
  type LucideIcon,
} from 'lucide-react-native';
import type { ImageSourcePropType } from 'react-native';

export type CategoryArt = {
  /** Das Symbol — gilt, solange `photo` fehlt. */
  icon: LucideIcon;
  /**
   * Der Farbton hinter dem Bild. Bei Whatnot trägt jede Kategorie einen
   * eigenen; hier hält er die Kacheln auseinander, ohne bunt zu werden — alle
   * Töne sind gedeckte Verwandte der Sandfläche, keine Signalfarben.
   */
  tint: string;
  /** Das freigestellte Produktfoto. Fehlt noch — siehe Kopf der Datei. */
  photo?: ImageSourcePropType;
};

const ART: Record<string, CategoryArt> = {
  mode: { icon: Shirt, tint: '#EAE2EC' },
  schuhe: { icon: Package, tint: '#E7E2EC' },
  taschen: { icon: ShoppingBag, tint: '#ECE2EA' },
  schmuck: { icon: Gem, tint: '#ECE2E7' },
  beauty: { icon: Sparkles, tint: '#ECE2E4' },
  uhren: { icon: Watch, tint: '#E4E2EC' },
  haus: { icon: House, tint: '#E2E8EC' },
  islamica: { icon: Moon, tint: '#E2E4EC' },
  buecher: { icon: BookOpen, tint: '#ECE2EC' },
  kinder: { icon: Baby, tint: '#ECE2E3' },
  sammeln: { icon: Coins, tint: '#ECE8E2' },
  sonstiges: { icon: Package, tint: '#E9E2EC' },
};

const FALLBACK: CategoryArt = { icon: Package, tint: '#EBE6EE' };

/** Nie `undefined`: Eine unbekannte Kategorie bekommt das neutrale Paket. */
export function categoryArt(slug: string): CategoryArt {
  return ART[slug] ?? FALLBACK;
}
