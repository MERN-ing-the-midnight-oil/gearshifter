// Public GET (?t=): signed token → HTML receipt with check-in photo, item tag QR, and receipt URL QR for exit staff.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import QRCode from 'https://esm.sh/qrcode@1.5.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHECK_IN_BUCKET = 'item-check-in-photos';

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function parseSignedTransactionId(token: string): { transactionId: string; sig: string } | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === token.length - 1) return null;
  const transactionId = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!/^[0-9a-f]{64}$/i.test(sig)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) {
    return null;
  }
  return { transactionId, sig: sig.toLowerCase() };
}

async function verifySignedTransactionId(token: string, secret: string): Promise<string | null> {
  const parsed = parseSignedTransactionId(token.trim());
  if (!parsed) return null;
  const expected = await hmacSha256Hex(parsed.transactionId, secret);
  if (!timingSafeEqualHex(expected, parsed.sig)) return null;
  return parsed.transactionId;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('BUYER_RECEIPT_HMAC_SECRET')?.trim();
  if (!secret) {
    return new Response('Receipt links are not configured.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('t')?.trim() ?? '';
  if (!token) {
    return new Response('Missing receipt link.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const transactionId = await verifySignedTransactionId(token, secret);
  if (!transactionId) {
    return new Response('Invalid or expired receipt link.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: txnRow, error: txnErr } = await service
    .from('transactions')
    .select('id, sold_price, buyer_name, sold_at, item_id, event_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txnErr || !txnRow) {
    return new Response('Receipt not found.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const { data: item, error: itemErr } = await service
    .from('items')
    .select('item_number, qr_code, check_in_photo_storage_path, status')
    .eq('id', txnRow.item_id)
    .maybeSingle();

  if (itemErr || !item || item.status !== 'sold') {
    return new Response('Receipt not available.', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  }

  const { data: ev } = await service.from('events').select('name').eq('id', txnRow.event_id).maybeSingle();

  let photoUrl: string | null = null;
  const path = item.check_in_photo_storage_path?.trim();
  if (path) {
    const { data: signed } = await service.storage.from(CHECK_IN_BUCKET).createSignedUrl(path, 60 * 60 * 24);
    photoUrl = signed?.signedUrl ?? null;
  }

  let itemQrDataUrl = '';
  try {
    itemQrDataUrl = await QRCode.toDataURL(item.qr_code, { width: 220, margin: 1, errorCorrectionLevel: 'M' });
  } catch (e) {
    console.error('buyer-sale-receipt: item QR generation failed', e);
  }

  const receiptPageUrl = `${url.origin}${url.pathname}?t=${encodeURIComponent(token)}`;
  let receiptUrlQrDataUrl = '';
  try {
    receiptUrlQrDataUrl = await QRCode.toDataURL(receiptPageUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' });
  } catch (e) {
    console.error('buyer-sale-receipt: receipt URL QR generation failed', e);
  }

  const soldPrice =
    typeof txnRow.sold_price === 'number' ? txnRow.sold_price : Number(txnRow.sold_price);
  const priceStr = Number.isFinite(soldPrice) ? soldPrice.toFixed(2) : String(txnRow.sold_price);
  const eventName = ev?.name?.trim() || 'Event';
  const itemNum = item.item_number ?? '—';
  const buyer = txnRow.buyer_name?.trim() || 'Buyer';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escHtml(eventName)} — exit pass</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 16px; background: #f6f7f9; color: #111; }
    main { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 1.1rem; margin: 0 0 8px; }
    .muted { color: #555; font-size: 0.9rem; margin-bottom: 16px; }
    .row { margin: 8px 0; font-size: 0.95rem; }
    .label { color: #666; display: inline-block; min-width: 7rem; }
    .section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e8e8ec; }
    .section h2 { font-size: 0.95rem; margin: 0 0 10px; color: #333; }
    img.photo { width: 100%; border-radius: 8px; display: block; background: #eee; }
    img.qr { width: 220px; height: 220px; display: block; margin: 0 auto; }
    .hint { font-size: 0.85rem; color: #555; margin-top: 12px; line-height: 1.4; }
    .paste { word-break: break-all; font-size: 0.75rem; color: #444; background: #f0f1f4; padding: 8px; border-radius: 6px; margin-top: 8px; }
  </style>
</head>
<body>
  <main>
    <h1>Purchase — show at exit</h1>
    <p class="muted">${escHtml(eventName)}</p>
    <div class="row"><span class="label">Item #</span><strong>${escHtml(itemNum)}</strong></div>
    <div class="row"><span class="label">Paid</span><strong>$${escHtml(priceStr)}</strong></div>
    <div class="row"><span class="label">Buyer</span>${escHtml(buyer)}</div>
    <div class="section">
      <h2>Exit scan — this receipt</h2>
      ${
        receiptUrlQrDataUrl
          ? `<img class="qr" src="${receiptUrlQrDataUrl}" alt="QR code linking to this receipt" width="220" height="220"/>
      <p class="hint">Volunteers at the exit can scan this code to open this same page (check-in photo and item QR).</p>`
          : `<p class="muted">Receipt QR unavailable.</p>`
      }
    </div>
    <div class="section">
      <h2>Check-in photo (match the item)</h2>
      ${
        photoUrl
          ? `<img class="photo" src="${escHtml(photoUrl)}" alt="Check-in reference photo" width="400" height="400"/>`
          : `<p class="muted">No check-in photo on file for this item.</p>`
      }
    </div>
    <div class="section">
      <h2>Item QR (same as tag)</h2>
      ${itemQrDataUrl ? `<img class="qr" src="${itemQrDataUrl}" alt="Item QR code" width="220" height="220"/>` : `<p class="muted">QR unavailable.</p>`}
      <p class="hint">Staff can scan the QR above or open the organizer app and use the same code as on the printed tag.</p>
      <div class="paste">${escHtml(item.qr_code)}</div>
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
  });
});
