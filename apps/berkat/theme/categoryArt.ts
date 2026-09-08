// Das Bild einer Kategorie — an EINER Stelle für alle Flächen.
//
// Zwei Oberflächen zeigen dasselbe: die Entdeckungs-Leiste auf der Startseite
// und das Raster im Kategorien-Reiter. Bis zum 18.08.2026 stand die Zuordnung
// nur im Reiter, die Leiste hatte gar kein Bild — sie war eine reine Textzeile.
//
// Serie vom 06.09.2026: Alle zwölf Oberkategorien tragen freigestellte,
// materialnahe 3D-Motive. Die lokalen 576-px-Ausgaben enthalten echte Transparenz.
// Symbole bleiben als Rückfall für unbekannte Kategorien verfügbar.
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
  /** Freigestelltes Kategorie-Motiv; kein Foto eines kaufbaren Angebots. */
  photo?: ImageSourcePropType;
};

const ART: Record<string, CategoryArt> = {
  mode: { icon: Shirt, tint: '#E8E5E9', photo: require('../assets/categories/mode-3d-v1.png') },
  // ⚠️ Nicht `Package`. Bis zum 24.08.2026 stand hier dieselbe Kiste wie bei
  // `sonstiges` und im Rückfall — auf dem Raster sahen Schuhe damit aus wie der
  // Rest-Topf, also nach „uns ist nichts eingefallen". Für `sonstiges` ist die
  // Kiste richtig; für eine benannte Kategorie ist sie eine Auskunft, die keine
  // ist.
  schuhe: { icon: Footprints, tint: '#E5E5E9', photo: require('../assets/categories/schuhe-3d-v1.png') },
  taschen: { icon: ShoppingBag, tint: '#E9E5E8', photo: require('../assets/categories/taschen-3d-v1.png') },
  schmuck: { icon: Gem, tint: '#E9E5E6', photo: require('../assets/categories/schmuck-3d-v1.png') },
  beauty: { icon: Sparkles, tint: '#E9E5E5', photo: require('../assets/categories/beauty-3d-v1.png') },
  uhren: { icon: Watch, tint: '#E5E6E9', photo: require('../assets/categories/uhren-3d-v1.png') },
  haus: { icon: House, tint: '#E5E9E8', photo: require('../assets/categories/haus-3d-v1.png') },
  islamica: { icon: Moon, tint: '#E5E8E9', photo: require('../assets/categories/islamica-3d-v1.png') },
  buecher: { icon: BookOpen, tint: '#E7E5E9', photo: require('../assets/categories/buecher-3d-v1.png') },
  kinder: { icon: Baby, tint: '#E9E5E5', photo: require('../assets/categories/kinder-3d-v1.png') },
  sammeln: { icon: Coins, tint: '#E9E8E5', photo: require('../assets/categories/sammeln-3d-v1.png') },
  sonstiges: { icon: Package, tint: '#E7E7E7', photo: require('../assets/categories/sonstiges-3d-v1.png') },
};

const FALLBACK: CategoryArt = { icon: Package, tint: '#E7E7E7' };

/** Nie `undefined`: Eine unbekannte Kategorie bekommt das neutrale Paket. */
export function categoryArt(slug: string): CategoryArt {
  return ART[slug] ?? FALLBACK;
}
