/* 오프라인 — 앱스토어 게임이 지하철에서 열리면 안 되는 게 아니다.
   바깥으로 나가는 요청이 하나라도 있으면 그 자원은 없는 셈 치고 굴러야 하는데,
   글꼴은 없으면 화면이 통째로 달라 보인다. 그래서 아예 안 나가게 한다. */
import { open, startRun, suite, serve, openServed, ROOT, gameHash } from '../lib.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function run(){
  const s = suite('오프라인');
  const p = await open();

  /* 바깥으로 나간 요청을 전부 모은다 */
  const external = [];
  p.on('request', r => {
    const u = r.url();
    if(!/^(file|data|blob):/.test(u)) external.push(u);
  });
  await p.goto(p.url());
  await p.waitForSelector('#go');
  await startRun(p);
  await p.waitForTimeout(1500);

  s.eq('바깥으로 나가는 요청 없음', external.length, 0,
       [...new Set(external)].slice(0,6).join('\n       '));

  /* 글꼴이 실제로 붙었는가 — 선언만 있고 파일이 없으면 조용히 대체된다 */
  const fonts = await p.evaluate(async () => {
    await document.fonts.ready;
    /* 게임이 실제로 쓰는 굵기 넷. 안 실은 굵기를 쓰면 브라우저가 제멋대로
         대체해서, 화면은 「되는 것처럼」 보이고 자간만 어긋난다. */
      const want = [['400 30px "Black Han Sans"','정시 퇴근'],
                    ['400 14px "Gothic A1"','미결'],
                    ['700 14px "Gothic A1"','처리'],
                    ['800 14px "Gothic A1"','퇴근']];
    return want.map(([f,t]) => ({ f, ok: document.fonts.check(f, t) }));
  });
  for(const f of fonts) s.ok(`글꼴이 붙었다 — ${f.f}`, f.ok);

  /* 글꼴이 실제로 다르게 그려지는가 — check()는 통과해도 폭이 같으면 대체된 것이다*/
  const widths = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const m = f => { c.font = f; return Math.round(c.measureText('정시 퇴근 18:00').width); };
    return { bhs:m('400 30px "Black Han Sans", monospace'),
             sys:m('400 30px monospace'),
             g1 :m('400 16px "Gothic A1", monospace'),
             g2 :m('800 16px "Gothic A1", monospace') };
  });
  s.ok('Black Han Sans 가 시스템 글꼴과 다르게 그려진다',
       widths.bhs !== widths.sys, JSON.stringify(widths));
  s.ok('Gothic A1 굵기가 실제로 구분된다', widths.g1 !== widths.g2, JSON.stringify(widths));

  /* 없는 글자는 시스템 글꼴로 떨어져야 한다 — 서브셋이라 두부가 뜨면 안 된다 */
  const missing = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '400 16px "Gothic A1", "Malgun Gothic", sans-serif';
    return Math.round(c.measureText('쀍쀓쮋').width) > 0;
  });
  s.ok('서브셋에 없는 글자도 폭을 갖는다(대체 동작)', missing);

  /* CSS가 선언한 굵기와 코드가 쓰는 굵기가 어긋나면 안 된다 —
     안 실은 굵기는 조용히 대체돼서 눈으로는 못 잡는다 */
  const used = await p.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const faces = new Set([...html.matchAll(/@font-face[^}]*?font-weight:\s*(\d+)/g)].map(m => m[1]));
    const css   = new Set([...html.matchAll(/font-weight:\s*(\d00)/g)].map(m => m[1]));
    const ctx   = new Set([...html.matchAll(/font\s*=\s*\(?["'`](\d00)/g)].map(m => m[1]));
    return { faces:[...faces], want:[...new Set([...css, ...ctx])] };
  });
  const notShipped = used.want.filter(w => !used.faces.includes(w));
  s.eq('쓰는 굵기가 전부 실려 있다', notShipped.length, 0,
       `안 실린 굵기 ${notShipped.join(',')} · 실린 것 ${used.faces.join(',')}`);

  s.eq('오프라인 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();

  /* ── 진짜 서버로 띄워 서비스워커까지 본다 ──
     file:// 로는 서비스워커가 등록되지 않으니, 여기서만 http 로 띄운다. */
  const srv = await serve();
  try{
    const q = await openServed(srv.url);
    await q.waitForTimeout(2500);
    const sw = await q.evaluate(async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      return { n:rs.length, active:!!(rs[0] && rs[0].active),
               err: window.__swErr || null };
    });
    s.ok('서비스워커가 등록된다', sw.n > 0, JSON.stringify(sw));
    s.ok('서비스워커가 살아 있다', sw.active, JSON.stringify(sw));
    s.eq('등록 실패 이유가 없다', sw.err, null);

    const cache = await q.evaluate(async () => {
      const ks = await caches.keys();
      if(!ks.length) return { keys:[], n:0, has:false };
      const c = await caches.open(ks[0]);
      const urls = (await c.keys()).map(r => r.url);
      return { keys:ks, n:urls.length,
               has: urls.some(u => /rush\.html$/.test(u)),
               font: urls.some(u => /\.woff2$/.test(u)),
               sfx:  urls.some(u => /\.ogg$/.test(u)) };
    });
    s.ge('설치할 때 파일을 받아 둔다', cache.n, 10, JSON.stringify(cache));
    s.ok('게임 화면이 캐시에 있다', cache.has, JSON.stringify(cache));
    s.ok('글꼴이 캐시에 있다', cache.font, JSON.stringify(cache));
    s.ok('소리가 캐시에 있다', cache.sfx, JSON.stringify(cache));

    /* 네트워크를 끊고 다시 열어도 게임이 떠야 한다 — 이게 오프라인의 전부다 */
    await q.ctx.setOffline(true);
    await q.reload({ waitUntil:'domcontentloaded' }).catch(() => {});
    const off = await q.evaluate(() => ({
      title: document.title, go: !!document.getElementById('go') })).catch(() => ({}));
    s.ok('네트워크를 끊어도 게임이 열린다', !!off.go, JSON.stringify(off));
    await q.ctx.setOffline(false);
    s.eq('서버로 띄웠을 때 JS 에러 없음', q.errors.length, 0, q.errors.join(' / '));
    await q.close();

    /* 판올림이 실제로 사용자에게 가는가 —
       브라우저는 sw.js 가 한 바이트도 안 바뀌면 서비스워커를 다시 설치하지
       않는다. 캐시는 「히트하면 네트워크를 안 본다」라, 게임만 고치고
       CACHE 를 그대로 두면 고친 것이 이미 설치한 사람에게 영영 안 간다.
       실제로 여섯 커밋 동안 그 상태였다(sw.js 커밋 1회 vs rush.html 6회).
       그래서 CACHE 에 rush.html 의 내용 해시를 박고 여기서 대조한다. */
    const swSrc = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
    const want = gameHash();
    const m = swSrc.match(/const CACHE\s*=\s*['"]([^'"]+)['"]/);
    s.ok('sw.js 에 CACHE 가 있다', !!m, swSrc.slice(0, 200));
    s.ok('CACHE 가 지금 rush.html 을 가리킨다', !!m && m[1].includes(want),
         `sw.js: ${m ? m[1] : '없음'} · rush.html 해시: ${want}\n` +
         `     → game/sw.js 의 CACHE 를 'jeongsi-v2-${want}' 로 바꿔야 합니다`);
    s.ok('rush.html 이 열 때마다 판올림을 확인한다',
         readFileSync(resolve(ROOT, 'rush.html'), 'utf8').includes('r.update()'),
         'navigator.serviceWorker.register 뒤에 r.update() 가 없습니다');
  } finally { await srv.close(); }
  return s;
}
