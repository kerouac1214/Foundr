/**
 * Foundr API Proxy Worker
 * 
 * This Cloudflare Worker acts as a middleware to:
 * 1. Bypass CORS restrictions for RunningHub API calls from the browser.
 * 2. Proxy requests to Google Gemini/OpenAI to bypass GFW restrictions.
 * 
 * Usage:
 * - RunningHub: POST https://your-worker.dev/runninghub/task -> https://www.runninghub.cn/task
 * - Gemini: POST https://your-worker.dev/google/v1beta/models/... -> https://generativelanguage.googleapis.com/v1beta/models/...
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, apikey',
};

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            let targetUrl = '';

            // --- Route 1: RunningHub Proxy ---
            if (path.startsWith('/runninghub/')) {
                const targetPath = path.replace('/runninghub', '');
                targetUrl = `https://www.runninghub.cn${targetPath}${url.search}`;
            }
            // --- Route 2: Google Gemini Proxy ---
            else if (path.startsWith('/google/')) {
                const targetPath = path.replace('/google', '');
                targetUrl = `https://generativelanguage.googleapis.com${targetPath}${url.search}`;
            }
            // --- Route 3: OpenAI Proxy ---
            else if (path.startsWith('/openai/')) {
                const targetPath = path.replace('/openai', '');
                targetUrl = `https://api.openai.com${targetPath}${url.search}`;
            }
            else {
                return new Response('Foundr Proxy: Unknown Route. Use /runninghub/... or /google/...', { status: 404, headers: CORS_HEADERS });
            }

            const newRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
            });

            const response = await fetch(newRequest);

            // Handle error responses from upstream
            if (!response.ok) {
                const errorText = await response.text();
                return new Response(`Proxy Upstream Error (${response.status}): ${errorText}`, {
                    status: response.status,
                    headers: CORS_HEADERS
                });
            }

            const data = await response.blob();

            // Reconstruct headers to ensure no CORS duplication
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, apikey');

            return new Response(data, {
                status: response.status,
                headers: newHeaders,
            });

        } catch (err) {
            return new Response(`Proxy Internal Error: ${err.message}`, { status: 500, headers: CORS_HEADERS });
        }
    },
};
