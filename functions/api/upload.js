/**
 * Cloudflare Pages Function: /api/upload
 * 
 * Handles file uploads to Cloudflare R2 Object Storage (`context.env.BUCKET`).
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
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const bucket = context.env?.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cloudflare R2 bucket not bound (bind BUCKET in Cloudflare Pages settings)' 
      }), { status: 500, headers: JSON_HEADERS });
    }

    const url = new URL(context.request.url);
    const filename = url.searchParams.get('name') || `file_${Date.now()}`;
    const ext = filename.includes('.') ? filename.split('.').pop() : 'bin';
    const key = `uploads/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const contentType = context.request.headers.get('content-type') || 'application/octet-stream';
    const fileData = await context.request.arrayBuffer();

    await bucket.put(key, fileData, {
      httpMetadata: { contentType }
    });

    const fileUrl = `${url.origin}/api/files/${encodeURIComponent(key)}`;
    return new Response(JSON.stringify({
      success: true,
      key,
      url: fileUrl,
      size: fileData.byteLength,
      contentType
    }), { headers: JSON_HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS });
  }
}
