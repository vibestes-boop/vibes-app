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
  Footprints,
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
  mode: { icon: Shirt, tint: '#E8E5E9' },
  // ⚠️ Nicht `Package`. Bis zum 24.08.2026 stand hier dieselbe Kiste wie bei
  // `sonstiges` und im Rückfall — auf dem Raster sahen Schuhe damit aus wie der
  // Rest-Topf, also nach „uns ist nichts eingefallen". Für `sonstiges` ist die
  // Kiste richtig; für eine benannte Kategorie ist sie eine Auskunft, die keine
  // ist.
  schuhe: { icon: Footprints, tint: '#E5E5E9' },
  taschen: { icon: ShoppingBag, tint: '#E9E5E8' },
  schmuck: { icon: Gem, tint: '#E9E5E6' },
  beauty: { icon: Sparkles, tint: '#E9E5E5' },
  uhren: { icon: Watch, tint: '#E5E6E9' },
  haus: { icon: House, tint: '#E5E9E8' },
  islamica: { icon: Moon, tint: '#E5E8E9' },
  buecher: { icon: BookOpen, tint: '#E7E5E9' },
  kinder: { icon: Baby, tint: '#E9E5E5' },
  sammeln: { icon: Coins, tint: '#E9E8E5' },
  sonstiges: { icon: Package, tint: '#E7E7E7' },
};

const FALLBACK: CategoryArt = { icon: Package, tint: '#E7E7E7' };

/** Nie `undefined`: Eine unbekannte Kategorie bekommt das neutrale Paket. */
export function categoryArt(slug: string): CategoryArt {
  return ART[slug] ?? FALLBACK;
}
