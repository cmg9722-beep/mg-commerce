/* 출근 직급 — 승진이 되돌릴 수 없는 벌이 되지 않게.

   그동안 SAVE.rank 는 오르기만 했다. 이사가 되면 같은 1구역도 몫이 1.48배라,
   오래 한 사람일수록 매일 더 어려워지고 내려올 방법이 없었다.
   이제 천장(SAVE.rank)과 오늘 출근하는 자리(SAVE.rankPick)가 따로다.

   직군 선택이 loadSave 화이트리스트에서 한 줄 빠져 조용히 사라진 적이 있다.
   같은 사고를 막으려고 「고른 것이 다음 판에 실제로 반영되는가」를 직접 본다. */
import { open, startRun, suite, SAVE_KEY } from '../lib.mjs';

const pick = p => p.evaluate(k => JSON.parse(localStorage.getItem(k)||'{}'), SAVE_KEY);
const cards = p => p.evaluate(() =>
  [...document.querySelectorAll('.chcard[data-rk]')].map(b => ({
    rk:+b.dataset.rk, name:b.querySelector('.chn').textContent.trim(),
    on:b.getAttribute('aria-pressed')==='true', locked:b.disabled })));

export default async function(){
  const s = suite('출근 직급');

  /* 승진이 없으면 이 줄도 없다 — 고를 게 하나뿐인 선택지는 화면만 복잡하게 한다 */
  {
    const p = await open({ save:{ rank:0, days:3 } });
    s.eq('승진 전에는 직급 줄이 없다', (await cards(p)).length, 0);
    await p.close();
  }

  /* 차장(4)까지 올라간 사람 — 사원~차장 다섯 칸이 열리고 둘은 잠긴다 */
  {
    const p = await open({ save:{ rank:4, days:12 } });
    const c = await cards(p);
    s.eq('직급 칸이 일곱 개', c.length, 7);
    s.eq('천장까지 열린다', c.filter(x=>!x.locked).length, 5);
    s.eq('그 위는 잠긴다', c.filter(x=>x.locked).map(x=>x.rk).join(','), '5,6');
    s.eq('처음엔 천장이 골라져 있다', c.find(x=>x.on)?.rk, 4);
    const dayLine = () => p.evaluate(() => {
      const m = document.querySelector('#card').innerText.match(/\d+일차 · (\S+)/);
      return m ? m[1] : '';
    });
    s.eq('로비 머리글이 출근 직급을 말한다', await dayLine(), '차장');

    /* 대리(2)로 내려 출근 — 저장되고, 다음 판에 실제로 반영돼야 한다 */
    await p.evaluate(() => document.querySelector('.chcard[data-rk="2"]').click());
    await p.waitForTimeout(80);
    const sv = await pick(p);
    s.eq('고른 직급이 저장된다', sv.rankPick, 2);
    s.eq('천장은 그대로다', sv.rank, 4);
    s.eq('머리글도 따라 바뀐다', await dayLine(), '대리');

    await startRun(p);
    const run = await p.evaluate(() => {
      const g = window.__g(), A = window.__api;
      return { rank0:g.rank0, rank:A.rankOf?A.rankOf(g):null, quota:A.quotaOf(g),
               base:A.ZONES[0].quota, load:A.RANK_LOAD };
    });
    s.eq('판이 고른 직급으로 시작한다', run.rank0, 2);
    s.eq('구역 몫이 그 직급으로 잡힌다', run.quota,
         Math.round(run.base*(1+2*run.load)));
    await p.close();
  }

  /* 판이 끝나면 — 천장은 안 내려가고, 받은 승진은 내일 자리가 되고, 기록이 남는다 */
  {
    const p = await open({ save:{ rank:4, rankPick:2, days:12 } });
    await startRun(p);
    const r = await p.evaluate(() => {
      const g = window.__g();
      g.tut=null; g.kills=600; g.lv=12; g.t=250; g.over=null;
      window.__finish(g,'win');
      const sv = JSON.parse(localStorage.getItem('jeongsi.save.v1'));
      return { rank:sv.rank, pick:sv.rankPick, best:sv.rankBest,
               card:document.querySelector('#card').innerText };
    });
    s.eq('천장은 내려오지 않는다', r.rank, 4);
    s.eq('오늘 자리가 내일 자리가 된다', r.pick, 2);
    s.ok('직급별 기록이 남는다', !!(r.best && r.best['2'] && r.best['2'].score > 0),
         JSON.stringify(r.best));
    s.eq('그 직급 정시 퇴근이 세어진다', r.best?.['2']?.wins, 1);
    s.ok('결과 화면이 그 직급 신기록을 말한다', /신기록/.test(r.card), '');
    await p.close();
  }

  /* 승진을 받으면 천장도 내일 자리도 함께 오른다 */
  {
    const p = await open({ save:{ rank:2, rankPick:2, days:9 } });
    await startRun(p);
    const r = await p.evaluate(() => {
      const g = window.__g();
      g.tut=null; g.rank=3; g.kills=400; g.t=300; g.over=null;   // 판 중 승진 3회
      window.__finish(g,'win');
      const sv = JSON.parse(localStorage.getItem('jeongsi.save.v1'));
      return { rank:sv.rank, pick:sv.rankPick };
    });
    s.eq('천장이 올라간다', r.rank, 5);
    s.eq('내일도 그 자리로 출근한다', r.pick, 5);
    await p.close();
  }

  /* 어제 쓰러진 사람에게만 「내려도 된다」고 말한다 — 늘 띄우면 잔소리다 */
  for(const [last, want] of [['lose', true], ['win', false]]){
    const p = await open({ save:{ rank:3, rankPick:3, days:10, last } });
    const has = await p.evaluate(() =>
      /낮춰 출근|clock in one rank lower/i.test(document.querySelector('#card').innerText));
    s.eq(`어제 ${last} — 낮춰 출근 안내 ${want?'보임':'안 보임'}`, has, want);
    await p.close();
  }

  /* 영어 — 자리표시자를 새로 만들었으니 */
  {
    const p = await open({ save:{ rank:4, rankPick:2, days:12 }, lang:'en' });
    const txt = await p.evaluate(() => {
      const r = [...document.querySelectorAll('.chrow')].pop();
      return r ? r.innerText : '';
    });
    s.ok('직급 줄에 한글이 없다', txt.length>0 && !/[가-힣]/.test(txt), txt);
    s.ok('영어 문구가 들어 있다', /Clock-in rank/.test(txt), txt);
    s.eq('직급 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }

  return s;
}
