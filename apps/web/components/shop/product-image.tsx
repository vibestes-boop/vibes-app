'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function ProductImage({
  cover,
  title,
  category,
  priority = false,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  fallbackClassName = 'text-6xl',
}: {
  cover: string | null;
  title: string;
  category: string;
  priority?: boolean;
  sizes?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [cover]);

  if (!cover || failed) {
    return (
      <div className={`flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10 ${fallbackClassName}`}>
        {category === 'digital' ? '💾' : category === 'service' ? '✨' : '📦'}
      </div>
    );
  }

  return (
    <>
      <Image
        src={cover}
        alt=""
        fill
        priority={priority}
        className="scale-110 object-cover blur-xl"
        sizes={sizes}
        aria-hidden
        onError={() => setFailed(true)}
      />
      <div className="absolute inset-0 bg-black/30" />
      <Image
        src={cover}
        alt={title}
        fill
        priority={priority}
        className="object-contain"
        sizes={sizes}
        onError={() => setFailed(true)}
      />
    </>
  );
}
