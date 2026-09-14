/* 바퀴 의자 — 사무실에서 탈 수 있는 유일한 것.
   타면 빨라지고, 부딪치는 사람을 민다. 8초 뒤 내린다. */
import { open, startRun, suite } from '../lib.mjs';

const arena = (p, n) => p.evaluate(cnt => {
  const g = window.__g(), A = window.__api;
  g.tut = null; g.foes.length = 0; g.drops.length = 0;
  for(let i = 0; i < cnt; i++){
    A.spawnRing(g, 'staff', 1);
    const f = g.foes[g.foes.length-1], a = Math.random()*6.283;
    f.x = g.P.x + Math.cos(a)*(70+Math.random()*240);
    f.y = g.P.y + Math.sin(a)*(70+Math.random()*240);
    f.hp = f.maxhp = 1e7; f.spd = 0;      // 안 죽고 안 움직이는 표적
  }
}, n);

export default async function run(){
  const s = suite('바퀴 의자');
  const p = await open();
  await startRun(p);
  await arena(p, 70);
  await p.waitForTimeout(300);

  /* ── 줍기 ── */
  const before = await p.evaluate(() => ({ ride: window.__g().P.ride|0 }));
  s.eq('처음엔 타고 있지 않다', before.ride, 0);

  await p.evaluate(() => {
    const g = window.__g();
    g.drops.push({ kind:'chair', x:g.P.x, y:g.P.y, t:0 });
  });
  await p.waitForTimeout(400);
  const on = await p.evaluate(() => {
    const g = window.__g();
    return { ride:+g.P.ride.toFixed(1), toast:g.toast };
  });
  s.ok('의자를 주우면 탄다', on.ride > 6, JSON.stringify(on));
  s.ok('탔다고 알려 준다', /의자/.test(on.toast), on.toast);

  /* ── 빨라지는가 — 실제 키로 같은 시간 달려 거리를 잰다 ── */
  const dash = async () => p.evaluate(() => {
    const g = window.__g();
    return { x:g.P.x, y:g.P.y, dmg:g.dmgDealt };
  });
  const a0 = await dash();
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1000); await p.keyboard.up('KeyD');
  const a1 = await dash();
  const rideDist = Math.abs(a1.x - a0.x);
  s.ok('타고 있으면 사람을 밀어 피해가 들어간다', a1.dmg > a0.dmg + 50,
       `${Math.round(a0.dmg)} → ${Math.round(a1.dmg)}`);

  /* 내린 뒤 같은 시간 달려 비교 */
  await p.evaluate(() => { const g = window.__g(); g.P.ride = 0; g.P.rideHit = null; });
  await p.waitForTimeout(150);
  const b0 = await dash();
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1000); await p.keyboard.up('KeyD');
  const b1 = await dash();
  const walkDist = Math.abs(b1.x - b0.x);
  s.ok(`타면 더 빠르다 (${Math.round(rideDist)}px vs ${Math.round(walkDist)}px)`,
       rideDist > walkDist * 1.4, `${rideDist.toFixed(0)} / ${walkDist.toFixed(0)}`);

  /* ── 같은 사람을 계속 갈지는 않는가 — 탈것이지 무기가 아니다 ── */
  await p.evaluate(() => {
    const g = window.__g();
    g.foes.length = 0; g.P.ride = 8; g.P.rideHit = {};
    const A = window.__api; A.spawnRing(g, 'staff', 1);
    const f = g.foes[0]; f.x = g.P.x + 6; f.y = g.P.y; f.hp = f.maxhp = 1e7; f.spd = 0;
    g.weapons = {};                       // 무기 피해를 섞지 않는다
    g.__d0 = g.dmgDealt;
  });
  await p.waitForTimeout(1500);
  const stuck = await p.evaluate(() => {
    const g = window.__g();
    return Math.round(g.dmgDealt - g.__d0);
  });
  s.ok(`붙어 있어도 한 번만 민다 (1.5초에 ${stuck})`, stuck > 0 && stuck < 120, String(stuck));

  /* ── 시간이 다 되면 내리는가 ── */
  await p.evaluate(() => { const g = window.__g(); g.P.ride = 0.05; });
  await p.waitForTimeout(400);
  const off = await p.evaluate(() => {
    const g = window.__g();
    return { ride:g.P.ride, toast:g.toast, hit:g.P.rideHit };
  });
  s.eq('시간이 다 되면 내린다', off.ride, 0);
  s.ok('내렸다고 알려 준다', /내렸/.test(off.toast) || /chair/i.test(off.toast), off.toast);
  s.eq('내리면 기록도 비운다', off.hit, null);

  /* ── 내리면 다시 맞는다 ── */
  await p.evaluate(() => {
    const g = window.__g();
    g.P.inv = 0; g.P.hp = g.P.maxhp;
    const A = window.__api; g.foes.length = 0; A.spawnRing(g, 'staff', 1);
    const f = g.foes[0]; f.x = g.P.x + 4; f.y = g.P.y; f.spd = 0; f.hp = f.maxhp = 1e7;
  });
  await p.waitForTimeout(600);
  const hurt = await p.evaluate(() => {
    const g = window.__g();
    return g.P.hp < g.P.maxhp;
  });
  s.ok('내린 뒤에는 다시 맞는다', hurt);

  s.eq('의자 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
