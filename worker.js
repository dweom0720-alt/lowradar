// 최저가 레이더 중계서버 (Cloudflare Worker) — v2
// 네이버 쇼핑 검색 API가 2026-07-31 종료되어, 네이버쇼핑 화면이 쓰는 공개 데이터 주소를 읽어 옵니다.
// API 키가 필요 없습니다. 비공식 주소라 네이버가 형식을 바꾸거나 막으면 동작이 멈출 수 있습니다.
// 개인 용도로 적게 쓰도록 결과를 10분간 보관(캐시)하고, 같은 요청을 반복해 우회하지 않습니다.

const ALLOWED_ORIGINS = [
  'https://dweom0720-alt.github.io', // 내 GitHub Pages 주소
];
const BFF = 'https://ns-portal.shopping.naver.com/api/v2/shopping-paged-slot';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'forbidden' }, 403);

    const u = new URL(request.url);
    const query = (u.searchParams.get('query') || '').trim().slice(0, 60);
    if (query.length < 2) return reply({ error: 'query', message: '검색어를 2글자 이상 넣어 주세요' }, 400);
    const page = Math.min(10, Math.max(1, parseInt(u.searchParams.get('page'), 10) || 1));
    const sort = ['sim', 'asc', 'dsc', 'review'].includes(u.searchParams.get('sort')) ? u.searchParams.get('sort') : 'sim';

    // 10분 캐시
    const cache = caches.default;
    const cacheKey = new Request(`https://cache.lowradar/${encodeURIComponent(query)}/${page}`);
    let data = null;
    const hit = await cache.match(cacheKey);
    if (hit) data = await hit.json();

    if (!data) {
      const url = new URL(BFF);
      url.searchParams.set('query', query);
      url.searchParams.set('source', 'shp_gui');
      if (page > 1) url.searchParams.set('page', String(page));
      let r;
      try {
        r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-F966N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
            'Accept': 'application/json,text/plain;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': 'https://search.shopping.naver.com/ns/search?query=' + encodeURIComponent(query),
          },
        });
      } catch (e) {
        return reply({ error: 'network', message: '네이버에 연결하지 못했습니다' }, 502);
      }
      const body = await r.text();
      if (!r.ok) return reply({ error: 'blocked', status: r.status, message: `네이버가 요청을 거절했습니다 (${r.status})` }, 502);
      let json;
      try { json = JSON.parse(body); } catch { return reply({ error: 'format', message: '네이버 응답 형식이 바뀌었습니다' }, 502); }
      data = { items: extract(json, page), at: new Date().toISOString() };
      if (data.items.length) ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(data), { headers: { 'Cache-Control': 'max-age=600' } })));
    }

    let items = data.items.slice();
    if (sort === 'asc') items.sort((a, b) => a.price - b.price);
    if (sort === 'dsc') items.sort((a, b) => b.price - a.price);
    if (sort === 'review') items.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
    return reply({ source: 'naver-shopping', page, sort, count: items.length, at: data.at, items });
  },
};

// ---------- 응답에서 상품만 골라내기 ----------
function extract(payload, page) {
  const pages = Array.isArray(payload?.data) ? payload.data : [];
  const num = p => { const n = parseInt(p?.page ?? p?.pageNo ?? p?.pageNumber ?? p?.pagingIndex, 10); return Number.isFinite(n) ? n : null; };
  let sel = pages.filter(p => num(p) === page);
  if (!sel.length && page === 1) sel = pages.filter(p => num(p) === null).length ? pages.filter(p => num(p) === null) : pages.slice(0, 1);
  const out = [], seen = new Set();
  for (const p of sel) for (const slot of (Array.isArray(p?.slots) ? p.slots : [])) {
    const it = normalize(slot?.data);
    if (!it) continue;
    const key = it.id || (it.title + it.price + it.mall);
    if (seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  return out;
}
function first(o, keys) { for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; } return null; }
function text(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/<[^>]+>/g, ' ').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function digits(v) { if (typeof v === 'number') return Math.trunc(v); const d = text(v).replace(/[^0-9]/g, ''); return d ? parseInt(d, 10) : null; }
function link(v) {
  if (Array.isArray(v)) { for (const x of v) { const r = link(x); if (r) return r; } return null; }
  if (v && typeof v === 'object') return link(first(v, ['pcUrl', 'mobileUrl', 'url', 'link', 'href', 'imageUrl', 'image', 'thumbnailUrl', 'src']));
  const s = text(v);
  if (!s || /^javascript:/i.test(s)) return null;
  if (s.startsWith('//')) return 'https:' + s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return 'https://search.shopping.naver.com' + s;
  return null;
}
function normalize(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const title = text(first(c, ['productNameOrg', 'productName', 'productTitle', 'mallProductName', 'title', 'name']));
  const disc = digits(first(c, ['discountedSalePrice', 'discountedKRWSalePrice', 'couponDiscountedPrice', 'discountedPrice', 'mobileLowPrice', 'lowPrice', 'price']));
  const sale = digits(first(c, ['salePrice', 'saleKRWPrice', 'originPrice', 'originalPrice', 'hprice']));
  const price = disc ?? sale;
  if (!title || !price) return null;
  const isAd = Boolean(first(c, ['isAd', 'ad', 'adId', 'adcrUrl', 'adProduct'])) || /ad/i.test(String(c.cardType || '')) || /ad/i.test(String(c.sourceType || ''));
  return {
    id: text(first(c, ['nvMid', 'productId', 'id', 'catalogId', 'channelProductId'])) || null,
    title, price,
    before: sale && sale > price ? sale : null,
    mall: text(first(c, ['mallName', 'mallNm', 'storeName', 'sellerName', 'channelName', 'adMallName'])) || null,
    link: link(first(c, ['productUrl', 'mallProductUrl', 'productClickUrl', 'crUrl', 'adcrUrl', 'url', 'link'])),
    image: link(c.images) || link(first(c, ['imageUrl', 'imgUrl', 'image', 'thumbnail', 'thumbnailUrl', 'imgSrc'])),
    reviews: digits(first(c, ['totalReviewCount', 'reviewCount', 'reviewCnt'])),
    ad: isAd,
  };
}
