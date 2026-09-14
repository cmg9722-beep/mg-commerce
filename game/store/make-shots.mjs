/* 스토어 스크린샷 — 실제 게임에서 찍는다. 합성하거나 꾸미지 않는다.
   플레이 스토어: 폰 세로 1080×1920, 가로 1920×1080.

   node game/store/make-shots.mjs */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = 'file://' + resolve(HERE, '..', 'rush.html');
const SAVE = { career:3200, lv:{hp:2,spd:1}, best:9400, score:9400, days:12,
               cleared:true, rank:2, last:'win', runs:15, ach:{first:1,k100:1,k500:1,combo50:1,noon:1},
               char:'office' };

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const errs = [];

/* 폰은 1080×1920 을 배율 2로 잡아 540×960 뷰포트로 찍는다 —
   그래야 UI가 실제 폰에서 보이는 크기로 나온다 */
async function page({ w, h, dsr = 2, save = SAVE, lang = 'ko', tut = false }){
  const p = await b.newPage({ viewport:{ width:Math.round(w/dsr), height:Math.round(h/dsr) }, deviceScaleFactor:dsr });
  p.on('pageerror', e => errs.push(String(e.message||e)));
  await p.addInitScript(([s,l,t]) => {
    try{
      localStorage.setItem('jeongsi.save.v1', JSON.stringify(s));
      localStorage.setItem('jeongsi.lang', l);
      if(!t) localStorage.setItem('jeongsi.tut.v1','1');    // 안내는 스크린샷에서 뺀다
    }catch(e){}
  }, [save, lang, tut]);
  await p.goto(GAME);
  await p.waitForSelector('#go');
  return p;
}
const play = async p => { await p.click('#go');
  await p.waitForFunction(()=>!!window.__g(), null, {timeout:10000}); };

/* 화면을 「보여줄 만한 순간」으로 만든다 — 실제 규칙으로 채운다 */
/* 무리를 깐다. 스크린샷은 「몰려오는 중」이어야 한다 —
   처음엔 1.6초를 기다렸더니 다 죽어서 시체만 남은 화면이 나왔다.
   체력을 올려 두고 짧게 기다린다. 몫도 남겨 둬야 「문 열림」 안내가 안 뜬다. */
const crowd = (p, n, zone, kills=0, todo=90) => p.evaluate(([n,zone,kills,todo])=>{
  const g=window.__g(), A=window.__api;
  /* HUD 숫자도 실제 판처럼 보여야 한다 — 「처리 0 · 미결 470」은
     아무도 안 믿는다. 처리량을 채우고, 남은 몫을 todo 로 맞춘다. */
  g.tut=null; g.zone=zone; g.kills=kills; g.zoneK0=kills;
  g.zoneBonus=-(todo - A.quotaOf(g));
  g.gate=null; g.toast=""; g.toastT=0;
  g.t = 60 + zone*44;                                  // 시계도 구역에 맞춘다
  g.foes.length=0; g.bodies.length=0;
  const Z=A.ZONES[zone], kinds=Z.kinds;
  for(let i=0;i<n;i++) A.spawnRing(g, kinds[i%kinds.length], 1);
  for(const f of g.foes){
    const a=Math.random()*6.283, r=78+Math.random()*430;
    f.x=g.P.x+Math.cos(a)*r; f.y=g.P.y+Math.sin(a)*r;
    f.hp=f.maxhp=f.maxhp*14;        // 한 컷 동안은 안 죽는다
  }
}, [n,zone,kills,todo]);
const gear = (p, w, lv, level=17) => p.evaluate(([w,lv,level])=>{
  const g=window.__g(), A=window.__api;
  /* 없는 id 를 넘기면 그리는 쪽이 터지고 화면은 조용히 빈 채로 나온다.
     실제로 'union'(특성)을 무기로 넘겨서 가로 컷이 통째로 비었다. */
  const bad = w.filter(k => !A.WEAPONS[k]);
  if(bad.length) throw new Error('없는 무기 id: ' + bad.join(','));
  g.weapons={}; w.forEach((k,i)=>g.weapons[k]=lv[i]);
  g.lv=level; window.__applyPerks(g);
  /* 무리를 깔면 경험치가 쏟아져서 레벨업 카드가 화면을 덮는다.
     스크린샷은 「플레이 중」을 보여야 하므로 다음 레벨을 멀리 밀어 둔다. */
  g.xp=0; g.next=1e9;
}, [w,lv,level]);

const shots = [];

/* 1 — 몰려오는 사무실 (세로) */
{
  const p = await page({ w:1080, h:1920 });
  await play(p);
  await gear(p, ['stamp','copy','mail','coffee','printer','peer'], [5,4,4,3,3,2]);
  await crowd(p, 210, 2, 318, 112);
  await p.waitForTimeout(550);
  await p.screenshot({ path: resolve(HERE,'shot-1-phone.png') });
  shots.push('shot-1-phone.png'); await p.close();
}
/* 2 — 레벨업 카드 (세로) */
{
  const p = await page({ w:1080, h:1920 });
  await play(p);
  await gear(p, ['stamp','coffee','mail'], [4,3,2]);
  await crowd(p, 130, 3, 486, 74);
  await p.waitForTimeout(450);
  await p.evaluate(()=>{ const g=window.__g(); g.lv=12; g.xp=0; g.next=1; window.__gainXp(g,5); });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: resolve(HERE,'shot-2-phone.png') });
  shots.push('shot-2-phone.png'); await p.close();
}
/* 3 — 로비 · 직군 (세로) */
{
  const p = await page({ w:1080, h:1920 });
  await p.waitForTimeout(500);
  await p.screenshot({ path: resolve(HERE,'shot-3-phone.png') });
  shots.push('shot-3-phone.png'); await p.close();
}
/* 4 — 가로 (태블릿·PC 목록용) */
{
  const p = await page({ w:1920, h:1080, dsr:1.6 });
  await play(p);
  await gear(p, ['stamp','elev','msg','printer','quit','unionist'], [5,3,4,3,3,2]);
  await crowd(p, 300, 5, 1042, 148);
  await p.waitForTimeout(550);
  await p.screenshot({ path: resolve(HERE,'shot-4-wide.png') });
  shots.push('shot-4-wide.png'); await p.close();
}
/* 5 — 영어 화면 (글로벌 목록용) */
{
  const p = await page({ w:1080, h:1920, lang:'en' });
  await play(p);
  await gear(p, ['stamp','copy','mail','coffee'], [5,4,3,3]);
  await crowd(p, 200, 6, 1284, 96);
  await p.waitForTimeout(550);
  await p.screenshot({ path: resolve(HERE,'shot-5-phone-en.png') });
  shots.push('shot-5-phone-en.png'); await p.close();
}
await b.close();
console.log('찍은 것:', shots.join(' · '));
if(errs.length){ console.log('❌ 화면 오류:', [...new Set(errs)].slice(0,4).join(' / ')); process.exit(1); }
console.log('JS 에러 없음 ✅');
