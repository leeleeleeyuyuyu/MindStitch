// api/gemini/[...path].ts —— 后端代理:真实 key 只留在服务端,并对 503/429 自动重试
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // 去掉 /api/gemini 前缀,拿到 Google 真正的路径
  const path = url.pathname.replace(/^\/api\/gemini/, '');
  url.searchParams.delete('key'); // 前端不再带 key,统一走服务端 header
  const qs = url.searchParams.toString();
  const target =
    'https://generativelanguage.googleapis.com' + path + (qs ? '?' + qs : '');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server GEMINI_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('x-goog-api-key', apiKey);

  // 遇到 503(过载)/429(限流)自动重试 3 次,每次多等一会
  let resp: Response | null = null;
  for (let i = 0; i < 3; i++) {
    resp = await fetch(target, { method: req.method, headers, body });
    if (resp.status !== 503 && resp.status !== 429) break;
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }

  return new Response(resp!.body, {
    status: resp!.status,
    headers: {
      'Content-Type': resp!.headers.get('Content-Type') || 'application/json',
    },
  });
}
