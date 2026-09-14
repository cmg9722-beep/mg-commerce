/* 스토어 자산 — 크기가 어긋나면 심사에서 반려되고, 개인정보처리방침이
   코드와 어긋나면 그건 거짓 신고다. 둘 다 사람 눈으로는 안 잡힌다. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open, suite, ROOT } from '../lib.mjs';

const S = p => resolve(ROOT, 'store', p);

/* PNG 머리 24바이트에서 크기를 읽는다 — 라이브러리 없이 충분하다 */
function png(path){
  const b = readFileSync(path);
  if(b.toString('ascii',1,4) !== 'PNG') throw new Error('PNG 아님: ' + path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

export default async function run(){
  const s = suite('스토어 자산');

  /* ── 크기 ── */
  const want = [
    ['icon-512.png', 512, 512], ['icon-1024.png', 1024, 1024],
    ['icon-192.png', 192, 192], ['icon-180.png', 180, 180], ['icon-32.png', 32, 32],
    ['feature-1024x500.png', 1024, 500],
    ['shot-1-phone.png', 1080, 1920], ['shot-2-phone.png', 1080, 1920],
    ['shot-3-phone.png', 1080, 1920], ['shot-5-phone-en.png', 1080, 1920],
    ['shot-4-wide.png', 1920, 1080],
  ];
  for(const [f, w, h] of want){
    if(!existsSync(S(f))){ s.ok(`${f} 있음`, false, '파일이 없습니다'); continue; }
    const g = png(S(f));
    s.ok(`${f} ${w}×${h}`, g.w === w && g.h === h, `실제 ${g.w}×${g.h}`);
    /* 구글 플레이는 스크린샷 8MB, 그래픽 15MB 를 넘기면 안 받는다 */
    s.ok(`${f} 용량 8MB 이하`, g.bytes < 8*1024*1024, `${(g.bytes/1e6).toFixed(2)}MB`);
  }

  /* ── 문서 ── */
  for(const f of ['LISTING.ko.md','LISTING.en.md','PRIVACY.ko.md','PRIVACY.en.md',
                  'RATING.md','README.md'])
    s.ok(`${f} 있음`, existsSync(S(f)));

  const ko = readFileSync(S('LISTING.ko.md'), 'utf8');
  const short = (ko.match(/## 짧은 설명[^\n]*\n```\n([^\n]*)\n```/) || [])[1] || '';
  s.ok(`짧은 설명 80자 이하 (${short.length}자)`, short.length > 0 && short.length <= 80, short);

  /* ── 매니페스트가 실제 파일을 가리키는가 ── */
  const mf = JSON.parse(readFileSync(resolve(ROOT, 'manifest.webmanifest'), 'utf8'));
  const refs = [...mf.icons.map(i => i.src), ...(mf.screenshots || []).map(i => i.src)];
  const missing = refs.filter(r => !existsSync(resolve(ROOT, r)));
  s.eq('매니페스트가 가리키는 파일이 전부 있다', missing.length, 0, missing.join(', '));
  for(const i of mf.icons){
    const g = png(resolve(ROOT, i.src));
    s.ok(`매니페스트 ${i.src} 크기가 맞다`, `${g.w}x${g.h}` === i.sizes, `실제 ${g.w}x${g.h} 선언 ${i.sizes}`);
  }
  for(const sc of (mf.screenshots || [])){
    const g = png(resolve(ROOT, sc.src));
    s.ok(`매니페스트 ${sc.src} 크기가 맞다`, `${g.w}x${g.h}` === sc.sizes, `실제 ${g.w}x${g.h} 선언 ${sc.sizes}`);
  }
  s.ok('매니페스트가 게임을 시작점으로 잡는다', /rush\.html$/.test(mf.start_url), mf.start_url);

  /* ── 개인정보처리방침이 코드와 어긋나지 않는가 ──
     방침에 「수집하지 않는다」고 써 놓고 코드가 수집하면 거짓 신고다. */
  const src = readFileSync(resolve(ROOT, 'rush.html'), 'utf8');
  const banned = [
    [/googletagmanager|google-analytics|gtag\(|firebase|amplitude|mixpanel|sentry/i, '분석·크래시 도구'],
    [/adsbygoogle|admob|unityads|applovin/i, '광고 SDK'],
    [/navigator\.geolocation/, '위치정보'],
    [/sendBeacon|new WebSocket|new EventSource/, '외부 전송'],
  ];
  for(const [re, what] of banned)
    s.ok(`${what} 를 쓰지 않는다`, !re.test(src));

  /* 링크 미리보기 — 마케팅 예산이 0 이면 퍼지는 길은 사람이 붙여 주는
     링크뿐이다. 그 링크가 제목 한 줄로만 뜨면 아무도 안 누른다.
     그리고 og:image 가 실제로 있는 파일을 가리켜야 한다 — 깨진 미리보기는
     없는 것보다 나쁘다. */
  for(const [re, what] of [
    [/property="og:title"/, 'og:title'],
    [/property="og:description"/, 'og:description'],
    [/property="og:image"/, 'og:image'],
    [/name="twitter:card"\s+content="summary_large_image"/, '트위터 큰 카드'],
  ]) s.ok(`${what} 가 있다`, re.test(src), '');
  {
    const m = src.match(/property="og:image"\s+content="([^"]+)"/);
    s.ok('og:image 가 실제 파일을 가리킨다',
         !!m && existsSync(resolve(ROOT, m[1])), m ? m[1] : '없음');
    s.ok('og:image 가 상대 경로다 — 어느 도메인에 올려도 맞는다',
         !!m && !/^https?:/.test(m[1]), m ? m[1] : '없음');
  }

  /* 방침이 적어 둔 저장 키 = 코드가 실제로 쓰는 키 */
  const used = [...new Set([...src.matchAll(/localStorage\.\w+\(\s*"([^"]+)"/g)].map(m => m[1]))];
  const constKeys = [...src.matchAll(/(?:SAVE_KEY|LANG_KEY|TUT_KEY|LS_KEY)\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  const all = [...new Set([...used, ...constKeys])].sort();
  const policy = readFileSync(S('PRIVACY.ko.md'), 'utf8');
  const undocumented = all.filter(k => !policy.includes(k));
  s.eq('저장하는 키가 전부 방침에 적혀 있다', undocumented.length, 0,
       `방침에 없는 키: ${undocumented.join(', ')} · 코드가 쓰는 키: ${all.join(', ')}`);
  s.ge('방침이 실제 키를 적고 있다', all.length, 3);

  /* ── 실제로 열리고, 매니페스트가 붙어 있는가 ── */
  const p = await open();
  const head = await p.evaluate(() => ({
    manifest: !!document.querySelector('link[rel=manifest]'),
    theme: (document.querySelector('meta[name=theme-color]')||{}).content,
    icon: !!document.querySelector('link[rel=icon]'),
    apple: !!document.querySelector('link[rel=apple-touch-icon]'),
    title: document.title,
  }));
  s.ok('매니페스트가 연결돼 있다', head.manifest);
  s.ok('테마색이 있다', !!head.theme, String(head.theme));
  s.ok('아이콘이 연결돼 있다', head.icon && head.apple, JSON.stringify(head));
  s.ok('제목이 있다', /정시 퇴근/.test(head.title), head.title);
  s.eq('스토어 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();

  /* ── 서비스워커가 실제 파일만 가리키는가 ── */
  const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
  const shell = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(x => x && !x.endsWith('/'));
  const swMissing = shell.filter(f => !existsSync(resolve(ROOT, f)));
  s.eq('서비스워커가 받으려는 파일이 전부 있다', swMissing.length, 0, swMissing.join(', '));

  return s;
}
