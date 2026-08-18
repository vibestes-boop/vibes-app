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
  mode: { icon: Shirt, tint: '#EFE7DC' },
  schuhe: { icon: Package, tint: '#E8E4DA' },
  taschen: { icon: ShoppingBag, tint: '#EDE3D6' },
  schmuck: { icon: Gem, tint: '#EAE6DE' },
  beauty: { icon: Sparkles, tint: '#F0E6E2' },
  uhren: { icon: Watch, tint: '#E6E6E0' },
  haus: { icon: House, tint: '#E9EBE3' },
  islamica: { icon: Moon, tint: '#E4EAE6' },
  buecher: { icon: BookOpen, tint: '#ECE7DD' },
  kinder: { icon: Baby, tint: '#F0E9E0' },
  sammeln: { icon: Coins, tint: '#EDE9DC' },
  sonstiges: { icon: Package, tint: '#E9E7E1' },
};

const FALLBACK: CategoryArt = { icon: Package, tint: '#E9E7E1' };

/** Nie `undefined`: Eine unbekannte Kategorie bekommt das neutrale Paket. */
export function categoryArt(slug: string): CategoryArt {
  return ART[slug] ?? FALLBACK;
}
