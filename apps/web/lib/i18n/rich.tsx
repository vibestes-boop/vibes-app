// Rich-Text-Interpolation: `trans()` nimmt ein Template mit `{vars}` und eine
// Map wo Werte React-Nodes sein dürfen. Nützlich für Übersetzungen mit
// eingebetteten Links oder hervorgehobenen Teilen, z.B.:
//
//   {trans(t('auth.acceptTerms'), {
//     terms:   <Link href="/terms">{t('auth.terms')}</Link>,
//     privacy: <Link href="/privacy">{t('auth.privacy')}</Link>,
//   })}
//
// Unterstützt dieselbe `{name}`-Syntax wie der String-Resolver, damit beide
// konsistent bleiben und das `PathInto`-TypeScript-Dictionary passt.
//
// Rendert als Array von Strings und ReactElements — nicht als einzelner Node.
// Aufrufer kann das direkt in JSX `{...}`-Expression einsetzen; React
// rendert Arrays nativ. Jeder Teil bekommt einen stabilen Key damit React
// bei Re-Renders nicht alles neu mountet.

import { Fragment, type ReactNode } from 'react';

export function trans(
  template: string,
  vars: Record<string, ReactNode>,
): ReactNode[] {
  // `split` mit Capturing-Group behält die Tokens selbst im Ergebnis-Array —
  // `"a {x} b".split(/(\{\w+\})/)` → `["a ", "{x}", " b"]`.
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\{(\w+)\}$/);
    if (m) {
      const name = m[1];
      if (name in vars) {
        return <Fragment key={idx}>{vars[name]}</Fragment>;
      }
      // Unbekannter Platzhalter — original beibehalten (hilft beim Debuggen).
      return part;
    }
    return part;
  });
}
