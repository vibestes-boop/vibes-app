'use client';

// -----------------------------------------------------------------------------
// LiveShoppingViewer — thin client wrapper used by the viewer page (Server
// Component). Houses the useLiveShopping hook so the hook can't be called
// from the RSC directly.
//
// v1.w.UI.180
// -----------------------------------------------------------------------------

import {
  useLiveShopping,
  LivePinnedProductPill,
  ProductSoldBanner,
} from './live-shopping';

export function LiveShoppingViewer({
  sessionId,
  viewerUsername,
}: {
  sessionId: string;
  viewerUsername: string | null;
}) {
  const { pinnedProduct, soldEvents, broadcastSold } = useLiveShopping(sessionId);

  return (
    <>
      {/* Sold-Banners — stack at top-right below the poll watcher */}
      {soldEvents.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-28 z-30 flex flex-col items-end gap-1.5">
          {soldEvents.map((ev) => (
            <div key={`${ev.productId}-${ev.buyerUsername}`} className="pointer-events-auto">
              <ProductSoldBanner event={ev} />
            </div>
          ))}
        </div>
      )}

      {/* Pinned product pill — above action bar, left side */}
      {pinnedProduct && (
        <div className="pointer-events-auto absolute bottom-[72px] left-3 z-20">
          <LivePinnedProductPill
            product={pinnedProduct}
            viewerUsername={viewerUsername}
            onSold={broadcastSold}
          />
        </div>
      )}
    </>
  );
}
