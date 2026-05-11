'use client';

export function createLiveRealtimeTopic(prefix: string, id: string) {
  return `${prefix}-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
