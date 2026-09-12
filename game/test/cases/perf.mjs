/* 성능 — 이 장르는 화면에 수백 명이 찬다. 그 순간 프레임이 무너지면
   가장 통쾌해야 할 장면이 가장 답답해진다. 폰에서도 재야 한다. */
import { open, startRun, suite } from '../lib.mjs';

async function fps(p, n){
  await p.evaluate(cnt => {
    const g = window.__g(), A = window.__api;
    g.tut = null;
    g.foes.length = 0;
    for(let i = 0; i < cnt; i++) A.spawnRing(g, i % 7 === 0 ? 'gm' : 'staff', 1);
  }, n);
  await p.waitForTimeout(600);                       // 스프라이트 굽는 시간은 빼고 잰다
  return await p.evaluate(() => new Promise(res => {
    let frames = 0; const t0 = performance.now();
    const tick = () => {
      frames++;
      if(performance.now() - t0 < 2000) requestAnimationFrame(tick);
      else res(Math.round(frames / ((performance.now() - t0) / 1000)));
    };
    requestAnimationFrame(tick);
  }));
}

export default async function run(){
  const s = suite('성능');
  for(const [label, viewport, floor] of [
      ['PC', { width:1180, height:760 }, 50],
      ['폰', { width:390,  height:844 }, 50]]){
    const p = await open({ viewport });
    await startRun(p);
    await p.waitForTimeout(700);
    for(const n of [200, 420]){
      const f = await fps(p, n);
      s.ge(`${label} ${n}명에서 ${f} FPS`, f, floor);
    }
    s.eq(`${label} 성능 검사 중 JS 에러 없음`, p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }
  return s;
}
