// -----------------------------------------------------------------------------
// /settings/voice loading skeleton — v1.w.UI.217
// -----------------------------------------------------------------------------

export default function VoiceSettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-md animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white/10" />
        <div className="space-y-1.5">
          <div className="h-5 w-40 rounded-md bg-white/10" />
          <div className="h-3.5 w-56 rounded-md bg-white/8" />
        </div>
      </div>

      {/* Info card */}
      <div className="h-16 rounded-xl bg-white/8" />

      {/* Waveform */}
      <div className="flex h-14 items-center justify-center gap-[3px]">
        {Array.from({ length: 28 }, (_, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-white/15"
            style={{ height: `${4 + ((i * 7) % 20)}px` }}
          />
        ))}
      </div>

      {/* Record button */}
      <div className="flex flex-col items-center gap-4">
        <div className="h-[88px] w-[88px] rounded-full bg-white/10" />
        <div className="h-4 w-48 rounded-md bg-white/8" />
      </div>
    </div>
  );
}
