/**
 * Cloudflare Pages Function: /api/upload
 * 
 * Handles file uploads to Cloudflare R2 (`context.env.BUCKET`)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma',
  'Access-Control-Max-Age': '0'
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const bucket = context.env?.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound. Configure env.BUCKET in Cloudflare Pages.' }), { status: 500, headers: JSON_HEADERS });
    }

    const key = `uploads/${Date.now()}-${crypto.randomUUID()}`;
    const data = await context.request.arrayBuffer();
    const contentType = context.request.headers.get('content-type') || 'application/octet-stream';

    await bucket.put(key, data, {
      httpMetadata: { contentType }
    });

    const url = new URL(context.request.url);
    const fileUrl = `${url.origin}/api/files/${key}`;

    return new Response(JSON.stringify({ success: true, key, url: fileUrl }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
