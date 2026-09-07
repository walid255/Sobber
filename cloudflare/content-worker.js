/**
 * Standalone SerenityCare Cloudflare Worker: /api/content
 * 
 * Supports reading and writing JSON state or content from/to Cloudflare Workers KV
 * with CORS headers and edge-cache bypassing.
 * 
 * KV Binding:
 * In wrangler.toml or Cloudflare Worker Dashboard -> Settings -> Variables -> KV Namespace Bindings:
 * - Variable Name: MY_KV_NAMESPACE (or SOBBER_KV / KV)
 * - Key: "site_data"
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Set up CORS and strict edge-cache bypass headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma",
      "Access-Control-Max-Age": "0",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Surrogate-Control": "no-store",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Resolve KV namespace: supports MY_KV_NAMESPACE, SOBBER_KV, or KV
    const kv = env.MY_KV_NAMESPACE || env.SOBBER_KV || env.KV;

    // Optional Bearer token validation if ADMIN_SECRET or AUTH_SECRET is set
    const secret = env.ADMIN_SECRET || env.AUTH_SECRET || env.SOBBER_ADMIN_SECRET;
    if (secret && request.method === "POST") {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (token !== secret.trim()) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized: Invalid or missing Bearer token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // READ ENDPOINT (GET)
    if (request.method === "GET" && url.pathname === "/api/content") {
      if (!kv) {
        return new Response(JSON.stringify({ error: "KV namespace not bound. Bind MY_KV_NAMESPACE or SOBBER_KV." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      // Read site_data bypassing edge cache
      let data = await kv.get("site_data", { type: "text", cacheTtl: 0 });
      if (!data) {
        data = await kv.get("sobber_content", { type: "text", cacheTtl: 0 });
      }
      return new Response(data || "{}", {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // WRITE ENDPOINT (POST)
    if (request.method === "POST" && url.pathname === "/api/content") {
      if (!kv) {
        return new Response(JSON.stringify({ success: false, error: "KV namespace not bound" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const body = await request.text();

      // Store in site_data (and mirror to sobber_content for compatibility)
      await kv.put("site_data", body);
      await kv.put("sobber_content", body);

      // If body is valid JSON containing application state, mirror to sobber_state
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === "object" && (Array.isArray(parsed.users) || Array.isArray(parsed.patients))) {
          await kv.put("sobber_state", body);
        }
      } catch (e) {}

      return new Response(JSON.stringify({ success: true, message: "Updated globally in KV" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Health check ping
    if (url.pathname === "/api/health" || url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "online",
        system: "SerenityCare Cloud Content Edge Worker",
        kvBound: Boolean(kv),
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};
