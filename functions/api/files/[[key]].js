/**
 * Cloudflare Pages Function: /api/files/*
 * 
 * Streams file objects stored in Cloudflare R2 bucket (`context.env.BUCKET`).
 */

export async function onRequestGet(context) {
  try {
    const bucket = context.env?.BUCKET;
    if (!bucket) {
      return new Response(JSON.stringify({ error: 'R2 bucket not bound' }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      });
    }

    const url = new URL(context.request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/api\/files\//, ''));
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing file key' }), { status: 400 });
    }

    const object = await bucket.get(key);
    if (!object) {
      return new Response(JSON.stringify({ error: 'File not found' }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
