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
  /* ── 직군 전용 특성 ──────────────────────────────────────────
     직군 다섯이 능력치만 달랐다. 반응이 생긴 뒤로는 그 위에 한 겹을 더
     얹었다 — 같은 무기를 들어도 직군마다 다른 반응으로 싸운다.
     그 직군으로 출근한 판에서만 카드에 나와야 한다. 안 그러면 직군이
     성격이 아니라 그냥 시작 수치가 된다. */
  {
    const p = await open({ mute:true });
    await p.waitForSelector('#go');
    await startRun(p);                      // __g() 가 있어야 특성을 걸어 볼 수 있다
    await p.evaluate(() => { const g = window.__g(); if(g) g.tut = null; });
    const CP = await p.evaluate(() => {
      const A = window.__api;
      return Object.entries(A.CHAR_PERKS).map(([c, v]) => [c, v.id, v.max]);
    });
    s.eq('직군마다 전용 특성이 하나씩', CP.length, 5, JSON.stringify(CP));

    for(const [charId, perkId] of CP){
      const r = await p.evaluate(([cid, pid]) => {
        const g = window.__g(), A = window.__api;
        g.charId = cid; g.perks = {};
        const mine = A.PERKS[pid];
        /* 내 직군이면 카드 풀에 있고, 남의 직군이면 없어야 한다 */
        const inPool = () => {
          for(let i=0;i<40;i++){
            const o = window.__offers(g);
            if(o.some(x => x.kind==='p' && x.id===pid)) return true;
          }
          return false;
        };
        const own = inPool();
        g.charId = cid === 'office' ? 'sales' : 'office';
        const other = inPool();
        return { own, other, name: mine.name };
      }, [charId, perkId]);
      s.ok(`${r.name} — 그 직군에서 나온다`, r.own, `${charId}/${perkId}`);
      s.ok(`${r.name} — 다른 직군에선 안 나온다`, !r.other, `${charId}/${perkId}`);
    }

    /* 효과가 실제로 반응에 걸리는가 — 안 걸리면 설명만 있는 특성이다 */
    const eff = await p.evaluate(() => {
      const g = window.__g(), A = window.__api;
      const probe = (cid, pid, n) => {
        g.charId = cid; g.perks = {}; if(pid) g.perks[pid] = n;
        const P = A.stats(g);
        return { wetT:P.wetT, buildHold:P.buildHold, ccR:P.ccR,
                 holdDmg:P.holdDmg, splash:P.splash };
      };
      return { base: probe('office', null, 0),
               sales: probe('sales', 'outfield', 3),
               dev:   probe('dev',   'deploy',   3),
               hr:    probe('hr',    'talk',     3),
               field: probe('field', 'helmet',   3),
               office:probe('office','routine',  3) };
    });
    s.ok('영업 — 젖음이 길어진다',  eff.sales.wetT  > eff.base.wetT,  JSON.stringify(eff.sales));
    s.ok('개발 — 설치기가 묶는다',  eff.dev.buildHold > 0,            JSON.stringify(eff.dev));
    s.ok('인사 — 참조가 멀리 간다', eff.hr.ccR     > eff.base.ccR,    JSON.stringify(eff.hr));
    s.ok('현장 — 묶인 적이 더 아프다', eff.field.holdDmg > eff.base.holdDmg, JSON.stringify(eff.field));
    s.ok('사무직 — 번짐이 넓어진다', eff.office.splash > eff.base.splash, JSON.stringify(eff.office));

    /* 현장 특성이 실제 피해로 이어지는가 — stats 만 바뀌고 damage 가 안 쓰면 소용없다 */
    const dmg = await p.evaluate(() => {
      const g = window.__g(), A = window.__api;
      const hitHeld = () => {
        g.foes.length = 0;
        A.spawnAt(g, 'staff', g.P.x + 300, g.P.y);
        const f = g.foes[0]; f.hold = 2;
        const h0 = f.hp;
        A.damage(g, f, 100, g.P.x, g.P.y, 0, 'stamp');
        return Math.round(h0 - f.hp);
      };
      g.charId = 'office'; g.perks = {}; A.applyPerks ? 0 : 0;
      window.__applyPerks(g);
      const plain = hitHeld();
      g.charId = 'field'; g.perks = { helmet: 3 };
      window.__applyPerks(g);
      const helmet = hitHeld();
      return { plain, helmet };
    });
    s.eq('안전모 없이 묶인 적은 1.6배', dmg.plain, 160);
    s.ok('안전모를 쓰면 더 아프다', dmg.helmet > dmg.plain, JSON.stringify(dmg));

    s.eq('직군 특성 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }

  return s;
}
