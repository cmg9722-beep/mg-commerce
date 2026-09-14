/* 폰에서 실제로 쓸 수 있는가 — 외부 검토가 「출시 불가」로 잡은 네 가지.

   3. 「다시 출근」이 화면 밖  (375×667에서 다섯 결말 전부 top 658~798 vs 667)
   4. HUD가 화면 밖         (#rnd 가 뷰포트와 무관하게 right=436)
   5. 승리 문구가 시계와 모순 (13:25에 이기고 "18:00"이라고 말했다)
   7. 안드로이드 뒤로가기 = 즉시 종료 (popstate·visibilitychange 없음)

   숫자로 잡힌 것이라 숫자로 지킨다. */
import { open, openServed, serve, startRun, suite } from '../lib.mjs';

const PHONES = [{width:375,height:667},{width:390,height:844},{width:412,height:915}];
const ENDS   = ['win','dead','late','replaced','union'];

export default async function(){
  const s = suite('phone');

  for(const vp of PHONES){
    const tag = `${vp.width}×${vp.height}`;
    const p = await open({ viewport: vp });
    await startRun(p);
    await p.evaluate(() => { const g = window.__g(); if(g) g.tut = null; });

    /* 4 — HUD. 대체율과 무작위 사건이 둘 다 떠 있을 때가 가장 넓다 */
    const hud = await p.evaluate(() => {
      const r = document.getElementById('repl'), n = document.getElementById('rnd');
      r.style.display = ''; n.style.display = ''; n.textContent = '정기 회의 12초';
      const out = {};
      for(const id of ['clock','daybar','zone','todo','repl','rnd']){
        const b = document.getElementById(id).getBoundingClientRect();
        out[id] = { left: Math.round(b.left), right: Math.round(b.right) };
      }
      out.vw = innerWidth;
      return out;
    });
    for(const id of ['clock','daybar','zone','todo','repl','rnd']){
      s.ok(`${tag} HUD #${id} 가 화면 안`, hud[id].right <= hud.vw && hud[id].left >= 0,
           `left ${hud[id].left} · right ${hud[id].right} · 뷰포트 ${hud.vw}`);
    }

    /* 3 — 결과 화면의 「다시 출근」. 다섯 결말을 다 본다 */
    for(const how of ENDS){
      const r = await p.evaluate(h => {
        const g = window.__g();
        g.over = null; g.kills = 800; g.lv = 15; g.dmgDealt = 90000; g.comboBest = 40;
        window.__finish(g, h);
        const a = document.getElementById('again').getBoundingClientRect();
        const t = document.getElementById('toShop').getBoundingClientRect();
        return { top: Math.round(a.top), bottom: Math.round(a.bottom),
                 shopBottom: Math.round(t.bottom), vh: innerHeight };
      }, how);
      s.ok(`${tag} ${how} — 「다시 출근」이 화면 안`,
           r.top >= 0 && r.bottom <= r.vh, `top ${r.top} · bottom ${r.bottom} · 뷰포트 ${r.vh}`);
      s.ok(`${tag} ${how} — 「자기계발」도 화면 안`,
           r.shopBottom <= r.vh, `bottom ${r.shopBottom} · 뷰포트 ${r.vh}`);
      await p.reload(); await p.waitForSelector('#go'); await startRun(p);
      await p.evaluate(() => { const g = window.__g(); if(g) g.tut = null; });
    }
    s.ok(`${tag} JS 에러 없음`, p.errors.length === 0, p.errors.join(' · '));
    await p.close();
  }

  /* 5 — 나온 시각은 진짜 시계여야 한다 */
  {
    const p = await open({ viewport: PHONES[1] });
    await startRun(p);
    const r = await p.evaluate(() => {
      const g = window.__g(), A = window.__api;
      g.tut = null; g.t = 250; g.ot = false; g.over = null;
      const want = A.clockStr(g.t);
      window.__finish(g, 'win');
      return { want, sub: document.querySelector('#card .sub').textContent };
    });
    s.ok('승리 문구가 그 판의 시계를 쓴다', r.sub.startsWith(r.want + '.'),
         `시계 ${r.want} · 문구 "${r.sub}"`);
    s.ok('18:00 을 그대로 박아 두지 않는다', !r.sub.startsWith('18:00'), r.sub);
    s.ok('얼마나 일찍 나왔는지 말해 준다', /일찍/.test(r.sub), r.sub);
    await p.close();

    /* 영어로도 같은 문장이 나와야 한다 — 자리표시자를 새로 만들었으니 */
    const e = await open({ viewport: PHONES[1], lang: 'en' });
    await startRun(e);
    const en = await e.evaluate(() => {
      const g = window.__g(); g.tut = null; g.t = 250; g.ot = false; g.over = null;
      window.__finish(g, 'win');
      return document.querySelector('#card .sub').textContent;
    });
    s.ok('영어 결과 문구에 한글이 없다', !/[가-힣]/.test(en), en);
    s.ok('영어 결과 문구도 시계를 쓴다', en.startsWith('14:20.'), en);
    await e.close();
  }

  /* 7 — 뒤로가기와 화면 내림. pushState 는 file:// 에서 막히니 http 로 띄운다 */
  {
    const srv = await serve();
    const p = await openServed(srv.url, { viewport: PHONES[1] });
    await startRun(p);
    await p.evaluate(() => { const g = window.__g(); if(g) g.tut = null; });

    const pushed = await p.evaluate(() => history.state && history.state.jeongsi === 1);
    s.ok('판이 시작되면 히스토리에 가드가 들어간다', pushed === true, String(pushed));

    await p.goBack();
    await p.waitForTimeout(220);
    const back1 = await p.evaluate(() => {
      const g = window.__g();
      return { paused: !!(g && g.paused), user: !!(g && g.userPaused),
               ov: document.getElementById('ov').classList.contains('on'),
               gone: !g, url: location.href };
    });
    s.ok('뒤로가기 한 번 = 즉시 종료가 아니라 멈춤', back1.paused && back1.user, JSON.stringify(back1));
    s.ok('멈춤 화면이 실제로 떠 있다', back1.ov, JSON.stringify(back1));
    s.ok('판이 사라지지 않았다', !back1.gone, JSON.stringify(back1));

    /* 화면을 내리면 (전화가 오면) 알아서 멈춘다 */
    await p.evaluate(() => { document.getElementById('resume').click(); });
    await p.waitForTimeout(120);
    const running = await p.evaluate(() => { const g = window.__g(); return !g.paused; });
    s.ok('계속하기로 다시 돈다', running, String(running));

    const hid = await p.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable:true, get:()=>true });
      document.dispatchEvent(new Event('visibilitychange', { bubbles:true }));
      await new Promise(r => setTimeout(r, 80));
      const g = window.__g();
      return { paused: !!g.paused, user: !!g.userPaused };
    });
    s.ok('화면을 내리면 알아서 멈춘다', hid.paused, JSON.stringify(hid));

    s.ok('뒤로가기 검사 중 JS 에러 없음', p.errors.length === 0, p.errors.join(' · '));
    await p.ctx.close();
    await srv.close();
  }

  return s;
}
