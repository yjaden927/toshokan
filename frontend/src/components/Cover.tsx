import clsx from "clsx";
import { useState } from "react";
import type { Book } from "../lib/api";

/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The real cover when the book has one. Otherwise, or if the image fails to load, a plain
 * cover in the book's binding color with the title and author set on it, in whichever ink
 * reads on that color. Type is sized in container units so it scales with the cover.
 */
export function Cover({ book, className }: { book: Pick<Book, "title" | "author" | "color" | "coverUrl">; className?: string }) {
  // Not every Google Books volume has a large scan, so a failed zoom=3 image retries at zoom=1
  // before falling back to the typeset cover.
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = book.coverUrl ? [book.coverUrl, book.coverUrl.replace("&zoom=3", "&zoom=1")] : [];
  const src = candidates.find((url) => !failed.includes(url));
  const showImage = src !== undefined;
  const ink = luminance(book.color) > 0.35 ? "#1c1d22" : "#f5f1e8";

  return (
    <div
      className={clsx("@container relative aspect-[2/3] overflow-hidden rounded-[2px_4px_4px_2px] shadow-[var(--shadow-book)]", className)}
      style={{ backgroundColor: book.color }}
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed((f) => [...f, src])} className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-x-[11%] bottom-[9%] top-[11%] flex flex-col justify-between" style={{ color: ink }}>
          <p className="font-serif text-[12cqw] leading-[1.08] text-balance">{book.title}</p>
          <p className="text-[6.5cqw] leading-snug opacity-80">{book.author}</p>
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_4px_0_6px_-2px_rgb(0_0_0/0.3)]" />
    </div>
  );
}
