/* 멀리 보는 목표와 동기 — 이야기가 끝난 뒤에도 「다음」이 있어야 한다.
   예전엔 15일차 뒤로 로비가 「더 볼 것이 없습니다」라고 말했다. */
import { open, startRun, suite } from '../lib.mjs';

const NEAR = {                      // 셋 다 한 판만 더 하면 닿는 상태
  career:2400, lv:{}, best:1700, score:7800, days:59, cleared:true, rank:0,
  last:'win', runs:59, ach:{}, char:'office',
  earned:19600, goals:{}, unions:9,
  rival:{ name:'박대리', score:8200, beat:2 },
};
const FRESH = { ...NEAR, days:3, runs:3, earned:900, unions:0, score:2100, goals:{},
                rival:{ name:'박대리', score:4800, beat:0 } };

const lobby = p => p.evaluate(() => document.querySelector('#card').innerText);
const endIn = (p, how) => p.evaluate(h => {
  const g = window.__g(), A = window.__api;
  g.tut = null; g.kills = 1900; g.comboBest = 160; g.t = A.DAY; g.zone = 9;
  window.__finish(g, h);
}, how);

export default async function run(){
  const s = suite('목표와 동기');

  /* ── 로비가 진행을 보여 주는가 ── */
  {
    const p = await open({ save: NEAR });
    const t = await lobby(p);
    s.ok('로비에 멀리 보는 목표가 있다', /멀리 보는 목표/.test(t));
    for(const n of ['파이어족','정년','단체협약'])
      s.ok(`목표 ${n} 이 보인다`, t.includes(n));
    s.ok('진행 숫자가 보인다', /19,600 \/ 20,000/.test(t), t.slice(0,200));
    s.ok('동기가 보인다', t.includes('박대리'), t.slice(0,200));
    s.ok('동기와의 차이가 보인다', /400점 차이/.test(t));
    const bars = await p.evaluate(() =>
      [...document.querySelectorAll('.gbar i')].map(e => e.style.width));
    s.eq('막대가 셋', bars.length, 3, JSON.stringify(bars));
    s.eq('첫 판 전에는 목표를 안 보여 준다',
         await (await open({ save:{...FRESH, runs:0, days:0} })).evaluate(
           () => /멀리 보는 목표/.test(document.querySelector('#card').innerText)), false);
    await p.close();
  }

  /* ── 목표에 닿으면 한 번 말해 주고 저장되는가 ── */
  {
    const p = await open({ save: NEAR });
    await startRun(p);
    await endIn(p, 'union');                 // 교섭으로 끝내면 셋 다 닿는다
    await p.waitForTimeout(500);
    const t = await p.evaluate(() => document.querySelector('#card').innerText);
    for(const n of ['안 나가도 되는 날','마지막 출근','규정이 됐다'])
      s.ok(`결과에 「${n}」 이 뜬다`, t.includes(n));
    const saved = await p.evaluate(() =>
      JSON.parse(localStorage.getItem('jeongsi.save.v1')).goals);
    s.eq('세 목표가 전부 저장된다', Object.keys(saved||{}).length, 3, JSON.stringify(saved));
    s.ok('이제 「더 볼 것이 없습니다」라고 하지 않는다', !/더 볼 것이 없습니다/.test(t));
    s.eq('목표 처리 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }

  /* ── 한 번 닿은 목표는 다시 축하하지 않는다 ── */
  {
    const done = { ...NEAR, earned:30000, days:80, unions:20,
                   goals:{fire:1, tenure:1, accord:1} };
    const p = await open({ save: done });
    await startRun(p);
    await endIn(p, 'win');
    await p.waitForTimeout(400);
    const t = await p.evaluate(() => document.querySelector('#card').innerText);
    s.ok('이미 닿은 목표는 다시 안 뜬다', !/안 나가도 되는 날/.test(t));
    s.ok('전부 도달했다고 말한다', /전부 도달/.test(t), t.slice(0,300));
    await p.close();
  }

  /* ── 동기 — 넘으면 한 걸음 올라선다 ── */
  {
    const p = await open({ save: FRESH });
    await startRun(p);
    await endIn(p, 'win');
    await p.waitForTimeout(400);
    const t = await p.evaluate(() => document.querySelector('#card').innerText);
    const r = await p.evaluate(() =>
      JSON.parse(localStorage.getItem('jeongsi.save.v1')).rival);
    s.ok('동기를 넘었다고 말한다', /넘었습니다/.test(t), t.slice(0,260));
    s.ok('조사가 맞다 (「박대리를」)', /박대리를 넘었습니다/.test(t));
    s.ge('동기가 한 걸음 올라선다', r.score, 4801);
    s.eq('넘은 횟수가 는다', r.beat, 1);
    await p.close();
  }

  /* ── 못 넘으면 얼마 남았는지 말해 주는가 ── */
  {
    const hard = { ...FRESH, rival:{ name:'김주임', score:999999, beat:0 } };
    const p = await open({ save: hard });
    await startRun(p);
    await endIn(p, 'win');
    await p.waitForTimeout(400);
    const t = await p.evaluate(() => document.querySelector('#card').innerText);
    s.ok('남은 점수를 말해 준다', /점 남았습니다/.test(t), t.slice(0,260));
    await p.close();
  }

  /* ── 영어로도 한글이 안 남는가 ── */
  {
    const p = await open({ save: NEAR, lang:'en' });
    const t = await lobby(p);
    const ko = t.split('\n').map(x=>x.trim())
                .filter(x => /[가-힣]/.test(x) && !['한국어'].includes(x));
    s.eq('영어 로비에 남은 한글 없음', ko.length, 0, ko.slice(0,6).join(' / '));
    await p.close();
  }
  return s;
}
