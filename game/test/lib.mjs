/* 테스트 공용 도구 — 브라우저를 띄우고, 저장소를 정하고, 페이지를 연다.
   게임은 파일 한 개라 file:// 로 바로 연다. 서버가 필요 없다. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GAME = 'file://' + resolve(ROOT, 'rush.html');
export const SAVE_KEY = 'jeongsi.save.v1';
export const LANG_KEY = 'jeongsi.lang';

let _browser = null;
export async function browser(){
  if(!_browser) _browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  return _browser;
}
export async function shutdown(){ if(_browser){ await _browser.close(); _browser=null; } }

export const BLANK = { career:0, lv:{}, best:0, days:0, cleared:false, rank:0, last:null };

/* 페이지 하나 — 에러를 모으고, 저장소를 심고, 게임을 연다 */
export async function open({ save=BLANK, lang='ko', viewport={width:1180,height:760} }={}){
  const b = await browser();
  const p = await b.newPage({ viewport, deviceScaleFactor:1 });
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
