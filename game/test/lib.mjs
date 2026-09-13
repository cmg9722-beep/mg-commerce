/* 테스트 공용 도구 — 브라우저를 띄우고, 저장소를 정하고, 페이지를 연다.
   게임은 파일 한 개라 file:// 로 바로 연다. 서버가 필요 없다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, normalize } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = 'file://' + resolve(ROOT, 'rush.html');
export const SAVE_KEY = 'jeongsi.save.v1';
/* rush.html 의 내용 해시 — 서비스워커 CACHE 가 이걸 달고 있어야
   판올림이 이미 설치한 사람에게 간다. offline 검사가 대조한다. */
export function gameHash(){
  return createHash('sha256').update(readFileSync(resolve(ROOT,'rush.html'))).digest('hex').slice(0,12);
}
export const LANG_KEY = 'jeongsi.lang';

let _browser = null;
export async function browser(){
  if(!_browser) _browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  return _browser;
}
export async function shutdown(){ if(_browser){ await _browser.close(); _browser=null; } }

export const BLANK = { career:0, lv:{}, best:0, days:0, cleared:false, rank:0, last:null };

/* 페이지 하나 — 에러를 모으고, 저장소를 심고, 게임을 연다 */
export async function open({ save=BLANK, lang='ko', viewport={width:1180,height:760}, seed=null }={}){
  const b = await browser();
  const p = await b.newPage({ viewport, deviceScaleFactor:1 });
  if(seed!=null) await p.addInitScript(seedScript(seed));
  const errors = [];
  p.on('pageerror', e => errors.push(String(e.message||e)));
  /* 네트워크 자원 실패는 JS 에러가 아니다 — 폰트를 못 받은 것뿐이라
     따로 담는다. 게임 로직이 터진 것과 섞으면 진짜 에러를 놓친다. */
  p.resourceErrors = [];
  p.on('console', m => {
    if(m.type()!=='error') return;
    const t = m.text();
    if(/Failed to load resource|net::ERR_/.test(t)) p.resourceErrors.push(t);
    else errors.push('console: ' + t);
  });
  /* 저장소는 첫 로드에만 심는다. 매번 심으면 게임이 스스로 쓴 값
     (언어 바꾸기 → 새로고침)이 지워져서, 멀쩡한 기능이 고장 난 것처럼 보인다. */
  await p.addInitScript(([sk,sv,lk,lv]) => {
    try{
      if(sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded','1');
      localStorage.setItem(sk, JSON.stringify(sv));
      localStorage.setItem(lk, lv);
    }catch(e){}
  }, [SAVE_KEY, save, LANG_KEY, lang]);
  await p.goto(GAME);
  await p.waitForSelector('#go', { timeout: 15000 });
  p.errors = errors;
  return p;
}

/* 같은 시드면 같은 판 — 밸런스를 잴 때 없으면 안 되는 것.
   축 하나를 바꾸고 6판을 재 봤더니, 손도 안 댄 4구역 최저 체력이
   78 → 74 → 54 로 흔들렸다. 노이즈가 신호보다 컸다는 뜻이라 어느 축도
   판정할 수 없었다. 게임 안 난수를 통째로 시드 PRNG 로 갈아 끼워
   스폰 위치·무작위 사건·카드 목록까지 같은 판을 재현한다.
   (봇의 키 입력 타이밍은 실시간이라 완전히 같지는 않지만, 분산의
    가장 큰 몫인 빌드와 스폰이 고정된다.)

   open()·openServed() 의 seed 옵션으로 켠다. 게임 코드는 안 건드린다 —
   검사용 장치가 제품에 새어 들어가면 그게 다음 버그다. */
export function seedScript(seed){
  return `(()=>{ let a=${seed>>>0};
    Math.random=()=>{ a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296; };
  })()`;
}

/* 판 시작 — 로비에서 출근 버튼을 누른다 */
export async function startRun(p){
  await p.click('#go');
  await p.waitForFunction(() => !!window.__g(), null, { timeout: 10000 });
}

/* 레벨업 카드가 떠 있으면 고른다. which: 'first' | 'random' | 인덱스 */
export async function pickCard(p, which='first'){
  const n = await p.evaluate(() => {
    const ov = document.getElementById('ov');
    if(!ov || !ov.classList.contains('on')) return 0;
    return document.querySelectorAll('#card .pick').length;
  });
  if(!n) return false;
  const i = which==='random' ? Math.floor(Math.random()*n)
          : which==='first'  ? 0 : Math.min(which, n-1);
  await p.evaluate(k => document.querySelectorAll('#card .pick')[k].click(), i);
  await p.waitForTimeout(60);
  return true;
}

/* ── 아주 작은 단언 도구 ─────────────────────────────────────── */
export function suite(name){
  const rows = [];
  return {
    name,
    ok(label, cond, detail=''){ rows.push({ label, pass: !!cond, detail }); },
    eq(label, got, want){ rows.push({ label, pass: got===want, detail: `got ${JSON.stringify(got)} want ${JSON.stringify(want)}` }); },
    ge(label, got, want){ rows.push({ label, pass: got>=want, detail: `${got} >= ${want}` }); },
    rows,
    report(){
      const bad = rows.filter(r => !r.pass);
      for(const r of rows) console.log(`  ${r.pass?'✅':'❌'} ${r.label}${r.pass?'':'  — '+r.detail}`);
      return bad.length===0;
    }
  };
}

/* ── 한 판을 실제 키로 굴린다 ─────────────────────────────────
   play 와 random 이 같이 쓴다. g.P.x 를 직접 옮기지 않는 게 핵심 —
   그러면 이동 규칙·충돌·입력 처리를 건너뛴 채로 「검증했다」고 하게 된다. */
const KEY = { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD' };

/* 지금 무엇이 보이고 어디로 가야 하나 — 판단은 게임 안에서 한 번에 읽는다 */
const SENSE = () => {
  const ov = document.getElementById('ov');
  if(ov && ov.classList.contains('on'))
    return { overlay:true, picks: document.querySelectorAll('#card .pick').length };
  const g = window.__g(); if(!g) return { gone:true };
  const A = window.__api;
  let bx = 0, by = 0, live = 0;
  if(g.gate){                                      // 문이 열렸으면 그쪽으로
    const dx = g.gate.x-g.P.x, dy = g.gate.y-g.P.y, d = Math.hypot(dx,dy)||1;
    bx = dx/d*2.4; by = dy/d*2.4;
  } else {
    let nx = 0, ny = 0, n = 0;
    for(const f of g.foes){
      if(A.E[f.kind].prop) continue; live++;
      const d = Math.hypot(f.x-g.P.x, f.y-g.P.y);
      if(d < 560){ nx += f.x; ny += f.y; n++; }
    }
    if(n){ const cx = nx/n-g.P.x, cy = ny/n-g.P.y, d = Math.hypot(cx,cy)||1;
           bx += cx/d*1.1; by += cy/d*1.1; }        // 무리 쪽으로 — 일을 해야 문이 열린다
    for(const f of g.foes){                          // 너무 붙으면 떨어진다
      if(A.E[f.kind].prop) continue;
      const dx = g.P.x-f.x, dy = g.P.y-f.y, d = Math.hypot(dx,dy)||1;
      if(d < 135){ bx += dx/d*(135-d)/135*3.0; by += dy/d*(135-d)/135*3.0; }
    }
    for(const e of g.eshots){                        // 날아오는 건 피한다
      const dx = g.P.x-e.x, dy = g.P.y-e.y, d = Math.hypot(dx,dy)||1;
      if(d < 130){ bx += dx/d*(130-d)/130*2.2; by += dy/d*(130-d)/130*2.2; }
    }
    let best = null, bd = 1e9;                       // 떨어진 건 줍는다
    for(const o of g.orbs){ const d = Math.hypot(o.x-g.P.x,o.y-g.P.y); if(d<bd){ bd=d; best=o; } }
    for(const o of g.drops){ const d = Math.hypot(o.x-g.P.x,o.y-g.P.y); if(d<bd*0.6){ bd=d; best=o; } }
    if(best && bd > 44){ bx += (best.x-g.P.x)/bd*0.7; by += (best.y-g.P.y)/bd*0.7; }
  }
  return { overlay:false, bx, by, live, over:g.over, zone:g.zone, lv:g.lv,
           kills:g.kills, dmg:g.dmgDealt, hp:Math.round(g.P.hp) };
};

export async function autoplay(p, { ticks=1400, pick='first', fast=3, budgetMs=110000 }={}){
  await p.evaluate(f => { window.__fast = f; const g = window.__g(); if(g) g.tut = null; }, fast);
  const held = new Set();
  const hold = async want => {
    for(const k of [...held]) if(!want.has(k)){ await p.keyboard.up(KEY[k]); held.delete(k); }
    for(const k of want) if(!held.has(k)){ await p.keyboard.down(KEY[k]); held.add(k); }
  };
  let picks = 0, stalls = 0, stallT = 0, lastDmg = 0;
  const t0 = Date.now();
  for(let tick = 0; tick < ticks; tick++){
    const st = await p.evaluate(SENSE);
    if(st.gone || st.over) break;
    if(st.overlay){ await hold(new Set()); if(st.picks){ await pickCard(p, pick); picks++; } continue; }
    /* 공격이 멎었나 — 적이 여럿인데 5초 동안 피해가 0이면 무언가 고장난 것 */
    if(st.live > 3 && st.dmg === lastDmg){ stallT += 0.05; if(stallT > 5){ stalls++; stallT = 0; } }
    else stallT = 0;
    lastDmg = st.dmg;
    const want = new Set();
    if(st.by < -0.35) want.add('up'); else if(st.by > 0.35) want.add('down');
    if(st.bx < -0.35) want.add('left'); else if(st.bx > 0.35) want.add('right');
    await hold(want);
    await p.waitForTimeout(50);
    if(Date.now() - t0 > budgetMs) break;
  }
  await hold(new Set());
  const final = await p.evaluate(() => {
    const g = window.__g();
    return g ? { over:g.over, zone:g.zone, lv:g.lv, kills:g.kills } : { gone:true };
  });
  return { ...final, picks, stalls, secs: Math.round((Date.now()-t0)/1000) };
}

/* ── 진짜 서버로 띄우기 ────────────────────────────────────────
   서비스워커는 file:// 에서 등록되지 않는다. 오프라인 동작을 보려면
   http 로 띄워야 한다 — 안 그러면 「등록이 아예 안 되는」 버그를 못 잡는다.
   실제로 그렇게 놓친 적이 있다: 등록 코드가 엉뚱한 함수 안에 파묻혔는데
   구문이 멀쩡해서 모든 검사가 통과했다. */
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.json':'application/json',
  '.webmanifest':'application/manifest+json', '.css':'text/css; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.ogg':'audio/ogg', '.md':'text/plain; charset=utf-8',
};
export async function serve(root = ROOT){
  const srv = createServer(async (req, res) => {
    try{
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p.endsWith('/')) p += 'rush.html';
      const file = resolve(root, '.' + normalize(p));
      if(!file.startsWith(root)){ res.writeHead(403).end(); return; }   // 상위 탈출 금지
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream',
                           'Cache-Control': 'no-store' });
      res.end(body);
    }catch(e){ res.writeHead(404).end('not found'); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  return { url: `http://127.0.0.1:${port}/`,
           close: () => new Promise(r => srv.close(r)) };
}

/* http 로 띄운 게임을 연다 — open() 과 같은 저장소 시딩을 쓴다 */
export async function openServed(url, { save=BLANK, lang='ko', viewport={width:1180,height:760} }={}){
  const b = await browser();
  const ctx = await b.newContext({ viewport, deviceScaleFactor:1 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e.message||e)));
  await p.addInitScript(([sk,sv,lk,lv]) => {
    try{
      if(sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded','1');
      localStorage.setItem(sk, JSON.stringify(sv));
      localStorage.setItem(lk, lv);
      localStorage.setItem('jeongsi.tut.v1','1');
    }catch(e){}
  }, [SAVE_KEY, save, LANG_KEY, lang]);
  await p.goto(url);
  await p.waitForSelector('#go', { timeout: 15000 });
  p.errors = errors; p.ctx = ctx;
  return p;
}
