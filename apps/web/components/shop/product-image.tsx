"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FileText, Gem, Package, Sparkles } from "lucide-react";

export function ProductImage({
  cover,
  title,
  category,
  priority = false,
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  fallbackClassName = "text-6xl",
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
    const Icon =
      category === "digital"
        ? FileText
        : category === "service"
          ? Sparkles
          : category === "collectible"
            ? Gem
            : Package;

    return (
      <div
        className={`flex h-full items-center justify-center bg-muted ${fallbackClassName}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-muted-foreground shadow-sm">
          <Icon className="h-8 w-8" strokeWidth={1.7} />
        </div>
      </div>
    );
  }

  return (
    <Image
      src={cover}
      alt={title}
      fill
      priority={priority}
      className="object-cover"
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}
