'use client';

// NOTE: Radix Tabs wrapper currently disabled wegen React 19 + Radix 1.1.1
// Type-Mixup (zwei @types/react Versionen im Tree: Workspace-Root 19.x,
// nested peer-dep 18.x). Home-Feed-Shell nutzt stattdessen native Buttons.
// Diese Datei bleibt als Platzhalter bestehen, damit spätere Imports nicht 404en.
// Wenn ein echter Tabs-Use-Case aufkommt → Radix-Version heben und sauberen
// Wrapper mit `React.ComponentProps<typeof Root>` statt `ComponentPropsWithoutRef`
// schreiben.

export {};
