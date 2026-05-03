// Remotion Entry Point — referenziert von allen render-Kommandos
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';
import { loadFonts } from './lib/fonts';

// Inter laden — muss vor dem ersten Render-Frame abgeschlossen sein
loadFonts();

registerRoot(RemotionRoot);
