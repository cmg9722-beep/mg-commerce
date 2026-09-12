/* 직군 — 고르는 게 실제로 판을 바꾸는가. 스킨이면 두 번째 판부터 안 고른다.
   시작 무기·능력치·고유 규칙 셋이 전부 달라야 한다. */
import { open, startRun, suite } from '../lib.mjs';

const OPEN_ALL = { career:3200, lv:{}, best:9400, score:9400, days:12,
                   cleared:true, rank:0, last:'win', runs:15, ach:{} };

const snap = p => p.evaluate(() => {
  const g = window.__g(), A = window.__api, P = g.P;
  return { id:g.charId, weapons:Object.keys(g.weapons),
           maxhp:P.maxhp, spd:Math.round(P.spd), haste:+P.haste.toFixed(3),
           magnet:+P.magnet.toFixed(3), xpMul:+P.xpMul.toFixed(3),
           dmgMul:P.dmgMul, push:P.push, buildLife:P.buildLife, offers:P.offers };
});

export default async function run(){
  const s = suite('직군');

  /* ── 첫 판에는 사무직만 열려 있다 ── */
  {
    const p = await open();
    const cards = await p.evaluate(() =>
      [...document.querySelectorAll('.chcard')].map(b => ({
        id:b.dataset.ch, lock:b.disabled, on:b.classList.contains('on') })));
    s.ge('직군이 다섯 이상', cards.length, 5);
    s.eq('첫 판엔 사무직 하나만 열린다', cards.filter(c => !c.lock).length, 1);
    s.ok('열린 것이 사무직', cards.find(c => !c.lock)?.id === 'office');
    s.ok('잠긴 칸에 남은 날이 뜬다',
         await p.evaluate(() => /\d/.test(document.querySelector('.chcard.lock .cht').textContent)));
    await p.close();
  }

  /* ── 12일차 — 전부 열린다 ── */
  const p = await open({ save: OPEN_ALL });
  const all = await p.evaluate(() =>
    [...document.querySelectorAll('.chcard')].map(b => ({ id:b.dataset.ch, lock:b.disabled })));
  s.eq('12일차엔 전부 열린다', all.filter(c => c.lock).length, 0,
       all.filter(c => c.lock).map(c => c.id).join(','));

  /* ── 직군마다 시작이 다른가 ── */
  const got = {};
  for(const id of ['office','sales','dev','hr','field']){
    await p.goto(p.url()); await p.waitForSelector('#go');
    await p.evaluate(c => document.querySelector(`[data-ch="${c}"]`).click(), id);
    await p.waitForTimeout(180);
    await startRun(p);
    await p.waitForTimeout(500);
    got[id] = await snap(p);
    s.eq(`${id} 로 시작한다`, got[id].id, id);
  }

  const base = got.office;
  const startWeapons = new Set(Object.values(got).map(g => g.weapons.slice().sort().join('+')));
  s.eq('직군마다 시작 무기가 다르다', startWeapons.size, 5,
       Object.entries(got).map(([k,v]) => `${k}:${v.weapons}`).join(' / '));

  s.ok('영업은 빠르고 넓고 약하다',
       got.sales.spd > base.spd && got.sales.magnet > base.magnet && got.sales.maxhp < base.maxhp,
       JSON.stringify(got.sales));
  s.ok('개발은 손이 빠르고 설치가 오래 간다',
       got.dev.haste < base.haste && got.dev.buildLife > 1, JSON.stringify(got.dev));
  s.ok('인사는 경험치가 많고 덜 아프게 때린다',
       got.hr.xpMul > base.xpMul && got.hr.dmgMul < 1, JSON.stringify(got.hr));
  s.ok('현장은 튼튼하고 세게 민다',
       got.field.maxhp > base.maxhp && got.field.push > 1, JSON.stringify(got.field));

  /* ── 고유 규칙이 실제로 걸리는가 ── */
  s.eq('사무직은 선택지 셋', base.offers, 3);
  s.eq('인사는 선택지 넷', got.hr.offers, 4);
  /* 카드가 정말 넷 뜨는가 — 위 반복의 마지막은 현장이라, 인사로 다시 들어간다 */
  const cardCount = async id => {
    await p.goto(p.url()); await p.waitForSelector('#go');
    await p.evaluate(c => document.querySelector(`[data-ch="${c}"]`).click(), id);
    await p.waitForTimeout(180);
    await startRun(p); await p.waitForTimeout(500);
    return p.evaluate(() => {
      const g = window.__g(); g.tut = null;
      window.__gainXp(g, 500);
      return new Promise(r => setTimeout(() =>
        r(document.querySelectorAll('#card .pick').length), 1200));
    });
  };
  s.eq('인사 레벨업 카드가 실제로 넷', await cardCount('hr'), 4);
  s.eq('사무직 레벨업 카드는 셋', await cardCount('office'), 3);

  /* ── 고른 직군이 남는가 ── */
  /* 판 안이라 로비로 먼저 돌아간다 */
  await p.goto(p.url()); await p.waitForSelector('#go');
  await p.evaluate(() => document.querySelector('[data-ch="field"]').click());
  await p.waitForTimeout(200);
  await p.goto(p.url()); await p.waitForSelector('#go');
  const kept = await p.evaluate(() => document.querySelector('.chcard.on')?.dataset.ch);
  s.eq('새로고침해도 고른 직군이 남는다', kept, 'field');

  s.eq('직군 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
