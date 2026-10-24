// 최저가 레이더 중계서버 (Cloudflare Worker)
// 네이버 쇼핑 검색 API 키를 숨겨 두고, 내 웹앱에서만 결과를 받아 가도록 중계합니다.
// 키는 코드에 쓰지 말고 Cloudflare 설정의 비밀 변수 NAVER_ID, NAVER_SECRET 에 넣으세요.

const ALLOWED_ORIGINS = [
  'https://dweom0720-alt.github.io', // 내 GitHub Pages 주소
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const reply = (body, status = 200) =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });

    // 다른 사이트에서 내 서버를 몰래 쓰지 못하게 막기
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'forbidden' }, 403);

    const u = new URL(request.url);
    const query = (u.searchParams.get('query') || '').trim();
    if (!query) return reply({ error: 'query required' }, 400);

    const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, parseInt(v, 10) || d));
    const sort = ['sim', 'date', 'asc', 'dsc'].includes(u.searchParams.get('sort')) ? u.searchParams.get('sort') : 'sim';
    const p = new URLSearchParams({
      query,
      display: clamp(u.searchParams.get('display'), 1, 100, 40),
      start: clamp(u.searchParams.get('start'), 1, 1000, 1),
      sort,
    });
    const exclude = u.searchParams.get('exclude');
    if (exclude && /^[a-z:]+$/.test(exclude)) p.set('exclude', exclude);

    const r = await fetch('https://openapi.naver.com/v1/search/shop.json?' + p, {
      headers: { 'X-Naver-Client-Id': env.NAVER_ID, 'X-Naver-Client-Secret': env.NAVER_SECRET },
    });
    return reply(await r.text(), r.status);
  },
};
