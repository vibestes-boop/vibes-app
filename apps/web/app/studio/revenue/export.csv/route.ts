import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/session';
import { getShopOrdersDetailed, type Period } from '@/lib/data/studio';

// -----------------------------------------------------------------------------
// GET /studio/revenue/export.csv?period=7|28|90
//
// Liefert die detaillierten Shop-Orders des aktuellen Sellers als CSV mit
// UTF-8-BOM-Prefix (Excel-Kompatibilität). Keine Cache, weil Per-User-Daten.
//
// Spalten: Datum, Order-ID, Produkt, Menge, Käufer, Coins, Status
//
// Rate-Limit: Kein eigener Rate-Limit nötig — die zugrunde liegende
// `getShopOrdersDetailed`-RLS-geschützte Query wird natürlich gedrosselt.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const VALID_PERIODS: Period[] = [7, 28, 90];

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedPeriod = Number(searchParams.get('period'));
  const period: Period = VALID_PERIODS.includes(requestedPeriod as Period)
    ? (requestedPeriod as Period)
    : 28;

  const orders = await getShopOrdersDetailed(period, 5000); // CSV: generöses Limit

  const header = [
    'Datum',
    'Order-ID',
    'Produkt',
    'Menge',
    'Kaeufer',
    'Coins',
    'Status',
  ];

  const rows = orders.map((o) => [
    new Date(o.createdAt).toISOString(),
    o.id,
    o.productTitle ?? '',
    String(o.quantity),
    o.buyerUsername ?? '',
    String(o.totalCoins),
    o.status,
  ]);

  const csv = [header, ...rows].map(toCsvLine).join('\r\n');
  const body = `\uFEFF${csv}`; // UTF-8 BOM für Excel

  const filename = `serlo-shop-orders-${period}t-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function toCsvLine(fields: string[]): string {
  return fields.map(csvEscape).join(',');
}

function csvEscape(field: string): string {
  // RFC 4180: Felder mit Komma, Anführungszeichen oder Zeilenumbruch müssen
  // in doppelte Anführungszeichen gehüllt werden, interne "" verdoppelt.
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
