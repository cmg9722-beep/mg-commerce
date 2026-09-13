/* 첫 판 안내 — 처음 여는 사람에게만 뜨고, 실제로 했을 때 넘어가고,
   건너뛰면 다시 안 뜬다. 이 셋이 어긋나면 첫 인상이 망가진다. */
import { open, startRun, pickCard, suite } from '../lib.mjs';

const tut = p => p.evaluate(() => {
  const box = document.getElementById('tut');
  const st  = window.__tut && window.__tut();
  /* 속성만 보면 안 된다 — hidden 이 걸려 있어도 CSS 가 이기면 화면에는 떠 있다.
     실제로 그렇게 났다: #tut{display:flex} 가 UA 의 [hidden] 을 이겨서
     안내가 영원히 안 사라졌고, 속성만 보던 검사는 통과했다. */
  const shown = !!box && getComputedStyle(box).display !== 'none' && !!box.offsetParent;
  return { on: shown, attr: !!(box && !box.hidden), i: st ? st.i : -1,
           title: (document.getElementById('tutt')||{}).textContent || '',
           step:  (document.getElementById('tutn')||{}).textContent || '',
           point: [...document.querySelectorAll('.tutpoint')].map(e=>'#'+e.id) };
});
const hold = async (p, keys, ms) => {
  for(const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(ms);
  for(const k of keys) await p.keyboard.up(k);
};
/* 1구역이 빽빽해진 뒤로 안내 중에도 레벨업 카드가 뜬다. 그건 정상이다 —
   4단계가 「카드가 싸우는 방식을 정합니다」이므로 오히려 맞다.
   다만 카드가 떠 있으면 화면을 덮어서 건너뛰기를 못 누른다. 먼저 치운다. */
const clearCard = async p => {
  for(let i=0;i<4;i++){
    const on = await p.evaluate(() => {
      const ov = document.getElementById('ov');
      return !!(ov && ov.classList.contains('on'));
    });
    if(!on) return;
    if(!(await pickCard(p, 'first'))) return;
    await p.waitForTimeout(150);
  }
};

export default async function run(){
  const s = suite('첫 판 안내');

  /* ── 처음 여는 사람 ── */
  const p = await open();
  await startRun(p);
  await p.waitForTimeout(400);
  let t = await tut(p);
  s.ok('첫 판에 안내가 뜬다', t.on, JSON.stringify(t));
  s.eq('1단계부터', t.step, '1');
  s.ok('1단계는 이동 안내', /움직/.test(t.title), t.title);

  /* 움직이면 넘어간다 — 시간이 아니라 「했는가」로 */
  /* 이동 150px(약 0.9초) + 읽을 시간 0.9초 — 둘을 다 채워야 넘어간다 */
  await hold(p, ['KeyD'], 1600);
  await hold(p, ['KeyA'], 1200);
  await p.waitForTimeout(400);
  t = await tut(p);
  s.ok('움직이면 2단계로', t.i >= 1, `i=${t.i} ${t.title}`);
  s.ok('2단계는 처리 칸을 가리킨다', t.point.includes('#kills') || t.i>1, JSON.stringify(t.point));

  /* 처리하면 계속 넘어간다 — 그 사이 레벨업 카드가 뜨면 게임이 멈추니
     카드를 치우면서 기다린다. 카드가 뜨는 것 자체는 정상이다. */
  await p.evaluate(() => { const g=window.__g(); g.kills = 40; });
  for(let i=0; i<20; i++){
    await clearCard(p);
    await p.waitForTimeout(250);
    t = await tut(p);
    if(t.i >= 2) break;
  }
  s.ok('처리하면 더 넘어간다', t.i >= 2, `i=${t.i} ${t.title}`);

  /* 건너뛰기 */
  await clearCard(p);
  await p.click('#tutskip');
  await p.waitForTimeout(200);
  t = await tut(p);
  s.ok('건너뛰면 화면에서 사라진다', !t.on, JSON.stringify(t));
  s.ok('건너뛰면 hidden 속성도 걸린다', !t.attr, JSON.stringify(t));
  const marked = await p.evaluate(() => localStorage.getItem('jeongsi.tut.v1'));
  s.ok('건너뛴 것이 저장된다', !!marked, String(marked));
  s.eq('안내 중 JS 에러 없음', p.errors.length, 0);
  await p.close();

  /* ── 두 번째 판 — 다시 뜨면 안 된다 ── */
  const q = await open({ save:{ career:100, lv:{}, best:200, days:1, cleared:false,
                                rank:0, last:'win', runs:1 } });
  await startRun(q);
  await q.waitForTimeout(500);
  const t2 = await tut(q);
  s.ok('두 번째 판부터는 화면에 안 뜬다', !t2.on, JSON.stringify(t2));
  s.eq('두 번째 판 JS 에러 없음', q.errors.length, 0);
  await q.close();

  /* ── 영어로도 뜬다 ── */
  const r = await open({ lang:'en' });
  await startRun(r);
  await r.waitForTimeout(400);
  const t3 = await tut(r);
  s.ok('영어로도 안내가 뜬다', t3.on, JSON.stringify(t3));
  s.ok('영어 안내에 한글이 없다', !/[가-힣]/.test(t3.title), t3.title);
  const skip = await r.evaluate(() => document.getElementById('tutskip').textContent);
  s.ok('건너뛰기 단추도 영어', !/[가-힣]/.test(skip), skip);
  await r.close();

  return s;
}
