'use client';

import { useState } from 'react';
import { Camera, Radio } from 'lucide-react';
import { LiveSetupForm } from './live-setup-form';
import { OBSSetupForm } from './obs-setup-form';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// LiveModeTabs — Tab-Switcher in /live/start zwischen Browser-Stream und
// OBS-Stream. Native Buttons (kein Radix wegen React-19-Konflikt — siehe
// components/ui/tabs.tsx).
// -----------------------------------------------------------------------------

type Mode = 'browser' | 'obs';

export function LiveModeTabs() {
  const [mode, setMode] = useState<Mode>('browser');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Stream-Modus wählen"
        className="mb-6 inline-flex rounded-lg bg-muted p-1"
      >
        <ModeButton
          active={mode === 'browser'}
          onClick={() => setMode('browser')}
          icon={<Camera className="h-4 w-4" />}
          label="Browser"
          sublabel="Schnell starten"
        />
        <ModeButton
          active={mode === 'obs'}
          onClick={() => setMode('obs')}
          icon={<Radio className="h-4 w-4" />}
          label="OBS / Externe Software"
          sublabel="Pro-Setup"
        />
      </div>

      {mode === 'browser' ? <LiveSetupForm /> : <OBSSetupForm />}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col items-start">
        <span>{label}</span>
        <span className="text-[10px] font-normal opacity-70">{sublabel}</span>
      </span>
    </button>
  );
}
