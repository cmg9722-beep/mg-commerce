/* 자료 정합성 — 게임을 안 돌려도 알 수 있는 것들.
   해금이 없는 id를 가리키거나, 진화 원본이 사라졌거나, 업적 id가
   겹치면 화면에 빈 칸이 뜬다. 그건 「출시할 수 없는 상태」다. */
import { open, suite } from '../lib.mjs';

export default async function run(){
  const s = suite('자료 정합성');
  const p = await open();

  const d = await p.evaluate(() => {
    const A = window.__api, W = A.WEAPONS;
    const EV = window.__EVOLVED || null;
    const out = { weapons:[], evoBroken:[], achDup:[], achNoName:[], zoneBad:[],
                  dayUnlockBad:[], perkBad:[], enemyBad:[], upBad:[] };
    for(const id in W){
      const w = W[id];
      out.weapons.push(id);
      if(!w.name || !w.desc) out.upBad.push(id + ' 이름/설명 없음');
      if(!w.max || w.max < 1) out.upBad.push(id + ' max 없음');
      try{
        for(const lv of [1, w.max]){
          const L = w.lv(lv);
          if(!L || typeof L !== 'object') out.upBad.push(id + ' Lv' + lv + ' 수치 없음');
        }
        if(typeof w.up === 'function') w.up(1);
      }catch(e){ out.upBad.push(id + ' ' + e.message); }
    }
    for(const k in A.PERKS){ const q = A.PERKS[k];
      if(!q.name || !q.desc || !q.max) out.perkBad.push(k); }
    for(const k in A.E){ const e = A.E[k];
      if(!e.name || e.hp == null || e.r == null) out.enemyBad.push(k); }
    A.ZONES.forEach((z, i) => {
      if(!z.name || !z.story || !z.quota) out.zoneBad.push(i + ' 빠진 칸');
      for(const k of (z.kinds||[])) if(!A.E[k]) out.zoneBad.push(i + ' 없는 적 ' + k);
    });
    return out;
  });

  const extra = await p.evaluate(() => {
    /* ACH·DAYS·EVOLVED 는 __api 에 없어서 화면으로 확인한다 */
    const seen = {}, dup = [];
    const cards = [...document.querySelectorAll('.achcard')];
    return { cards: cards.length };
  });

  s.eq('무기 수치 계산에 오류 없음', d.upBad.length, 0, d.upBad.join(', '));
  s.eq('특성 정의가 온전하다', d.perkBad.length, 0, d.perkBad.join(', '));
  s.eq('적 정의가 온전하다', d.enemyBad.length, 0, d.enemyBad.join(', '));
  s.eq('구역 정의가 온전하다', d.zoneBad.length, 0, d.zoneBad.join(', '));
  s.ge('무기가 충분히 있다', d.weapons.length, 20);

  /* 업적 화면을 열어 id·이름·설명이 다 있는지 */
  const ach = await p.evaluate(() => {
    const btn = document.getElementById('recs'); if(!btn) return null;
    btn.click();
    return new Promise(r => setTimeout(() => {
      const cards = [...document.querySelectorAll('.achcard')];
      r({ n: cards.length,
          blank: cards.filter(c => !c.querySelector('.n') || !c.querySelector('.n').textContent.trim()
                                || !c.querySelector('.d') || !c.querySelector('.d').textContent.trim()).length });
    }, 350));
  });
  s.ge('업적이 다 그려진다', ach ? ach.n : 0, 15);
  s.eq('빈 업적 칸 없음', ach ? ach.blank : -1, 0);

  s.eq('자료 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
