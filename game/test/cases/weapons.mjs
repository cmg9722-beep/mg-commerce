/* 무기 — 여섯 칸뿐이라, 아무것도 안 하는 무기가 하나라도 있으면
   그걸 뽑은 판은 통째로 약해진다. 진화는 원본 칸을 대체하니까
   진화가 무효과면 눈앞에서 공격이 사라진다.

   실제로 이 검사가 퇴근 시계·정시 퇴근·동기 셋이 피해 0인 걸 잡았다.
   그게 「13레벨에 뭘 선택했는데 자동공격이 안 되네」의 정체였다. */
import { open, startRun, suite } from '../lib.mjs';

export default async function run(){
  const s = suite('무기');
  const p = await open();
  await startRun(p);
  await p.waitForTimeout(700);

  const rows = await p.evaluate(async () => {
    const g = window.__g(), A = window.__api, W = A.WEAPONS;
    g.next = 1e9;                                  // 검사 중엔 레벨업 창이 안 뜨게
    if(g.tut){ g.tut = null; }
    const arena = () => {
      g.foes.length = 0; g.shots.length = 0; g.pools.length = 0;
      g.builds.length = 0; g.allies.length = 0; g.cards.length = 0; g.paper.length = 0;
      g.cds = {};
      for(let i = 0; i < 26; i++){
        A.spawnRing(g, 'staff', 1);
        const f = g.foes[g.foes.length - 1], a = Math.random() * 6.283;
        /* 40~200px — 근접형(야근 Lv1 반경 75)도 닿는 거리에 둔다.
           예전엔 90~200px에 둬서 야근이 「고장」으로 잡혔다. 검사가 틀린 거였다. */
        const rr = 40 + Math.random() * 160;
        f.x = g.P.x + Math.cos(a) * rr; f.y = g.P.y + Math.sin(a) * rr;
        f.hp = 1e7; f.maxhp = 1e7; f.spd = 0;      // 안 죽고 안 움직이는 표적
      }
    };
    const out = [];
    for(const id of Object.keys(W)){
      const w = W[id];
      for(const lv of [1, w.max]){
        g.weapons = {}; g.weapons[id] = lv; arena();
        const d0 = g.dmgDealt, a0 = g.allies.length, b0 = g.builds.length;
        await new Promise(r => setTimeout(r, Math.min(2600, 1200 + (w.lv(lv).cd || 0) * 1100)));
        const dealt = Math.round(g.dmgDealt - d0);
        const acted = dealt > 0 || g.allies.length > a0 || g.builds.length > b0
                   || g.pools.length > 0 || g.shots.length > 0
                   || g.cards.length > 0 || g.paper.length > 0;
        out.push({ id, name: w.name, evo: !!w.evo, lv, dealt, acted,
                   allies: g.allies.length, builds: g.builds.length, shots: g.shots.length });
      }
    }
    return out;
  });

  const by = {};
  for(const r of rows) (by[r.id] = by[r.id] || []).push(r);
  const ids = Object.keys(by);
  const dead = ids.filter(id => !by[id].every(r => r.acted));

  s.ge('검사한 무기·진화 수', ids.length, 25);
  s.ok(`${ids.length}종 전부 무언가를 한다`, dead.length === 0,
       dead.map(id => {
         const a = by[id];
         return `${a[0].name}${a[0].evo ? '(진화)' : ''} ` +
                a.map(r => `Lv${r.lv}: 피해${r.dealt}/동료${r.allies}/설치${r.builds}/탄${r.shots}`).join('  ');
       }).join('\n       '));
  s.eq('무기 검사 중 JS 에러 없음', p.errors.length, 0);
  await p.close();
  return s;
}
