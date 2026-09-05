/**
 * Cloudflare Pages Function: /api/files/*
 * 
 * Streams stored files directly from Cloudflare R2 (`context.env.BUCKET`)
 */

export async function onRequestGet(context) {
  try {
    const bucket = context.env?.BUCKET;
    if (!bucket) {
      return new Response('R2 bucket not configured', { status: 500 });
    }

    const url = new URL(context.request.url);
    const key = decodeURIComponent(url.pathname.replace('/api/files/', ''));

    if (!key) {
      return new Response('File key is required', { status: 400 });
    }

    const object = await bucket.get(key);
    if (!object) {
      return new Response('File not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
