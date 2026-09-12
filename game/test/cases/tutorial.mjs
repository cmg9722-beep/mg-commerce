/* 첫 판 안내 — 처음 여는 사람에게만 뜨고, 실제로 했을 때 넘어가고,
   건너뛰면 다시 안 뜬다. 이 셋이 어긋나면 첫 인상이 망가진다. */
import { open, startRun, suite } from '../lib.mjs';

const tut = p => p.evaluate(() => {
  const box = document.getElementById('tut');
  const st  = window.__tut && window.__tut();
  return { on: !!(box && !box.hidden), i: st ? st.i : -1,
           title: (document.getElementById('tutt')||{}).textContent || '',
           step:  (document.getElementById('tutn')||{}).textContent || '',
           point: [...document.querySelectorAll('.tutpoint')].map(e=>'#'+e.id) };
});
const hold = async (p, keys, ms) => {
  for(const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(ms);
  for(const k of keys) await p.keyboard.up(k);
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

  /* 처리하면 계속 넘어간다 */
  await p.evaluate(() => { const g=window.__g(); g.kills = 40; });
  await p.waitForTimeout(1400);
  t = await tut(p);
  s.ok('처리하면 더 넘어간다', t.i >= 2, `i=${t.i} ${t.title}`);

  /* 건너뛰기 */
  await p.click('#tutskip');
  await p.waitForTimeout(200);
  t = await tut(p);
  s.ok('건너뛰면 사라진다', !t.on, JSON.stringify(t));
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
  s.ok('두 번째 판부터는 안 뜬다', !t2.on, JSON.stringify(t2));
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
