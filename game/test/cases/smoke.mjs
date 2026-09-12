/* 가장 기본 — 열리는가, 화면이 그려지는가, 폰에서도 되는가.
   CLAUDE.md 체크리스트 1번(로컬 실행 + 에러 없음)이 이것이다. */
import { open, startRun, suite } from '../lib.mjs';

const PC    = { width:1180, height:760 };
const PHONE = { width:390,  height:844 };

export default async function run(){
  const s = suite('기본 동작');

  for(const [label, viewport] of [['PC', PC], ['폰', PHONE]]){
    const p = await open({ viewport });
    s.ok(`${label} 로비가 뜬다`, !!(await p.$('#go')));
    await startRun(p);
    await p.waitForTimeout(1600);
    const st = await p.evaluate(() => {
      const g = window.__g(), cv = document.getElementById('cv');
      return { live:!!g, t:g?g.t:0, foes:g?g.foes.length:0,
               w:cv.width, h:cv.height,
               hud: !!document.querySelector('#hud').offsetParent };
    });
    s.ok(`${label} 판이 굴러간다`, st.live && st.t > 0.5, JSON.stringify(st));
    s.ok(`${label} 캔버스가 잡혔다`, st.w > 0 && st.h > 0, `${st.w}×${st.h}`);
    s.ok(`${label} HUD가 보인다`, st.hud);
    s.ge(`${label} 적이 나온다`, st.foes, 1);

    /* 일시정지 — 전화가 오면 멈출 수 있어야 한다 */
    await p.keyboard.press('KeyP'); await p.waitForTimeout(250);
    const paused = await p.evaluate(() => {
      const g = window.__g();
      return { p:!!g.paused, card:/멈춤|Paused/.test(document.querySelector('#card').innerText) };
    });
    s.ok(`${label} P로 멈춘다`, paused.p && paused.card, JSON.stringify(paused));
    await p.keyboard.press('KeyP'); await p.waitForTimeout(200);
    s.ok(`${label} 다시 P로 풀린다`, !(await p.evaluate(() => window.__g().paused)));

    /* 소리 끄기 */
    await p.keyboard.press('KeyM'); await p.waitForTimeout(120);
    s.ok(`${label} M으로 음소거`, await p.evaluate(() => !!(window.SFX && window.SFX.muted)));
    await p.keyboard.press('KeyM'); await p.waitForTimeout(120);

    s.eq(`${label} JS 에러 없음`, p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }
  return s;
}
