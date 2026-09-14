/* 한 판을 실제 키로 — 봇에게 g.P.x 를 옮기게 하면 이동 규칙과 충돌과
   입력 처리를 건너뛴다. 그렇게 「검증했다」고 하면 실제로 해 봤을 때
   깨진다. 여기서는 진짜 키보드 이벤트만 쓴다(lib 의 autoplay). */
import { open, startRun, autoplay, suite } from '../lib.mjs';

export default async function run(){
  const s = suite('실제 조작으로 한 판');
  const p = await open();
  await startRun(p);
  await p.waitForTimeout(400);

  const r = await autoplay(p, { ticks:1400, pick:'random' });
  console.log(`     → ${r.over||'진행중'} · ${(r.zone|0)+1}구역 · Lv${r.lv} · ` +
              `처리 ${r.kills} · 카드 ${r.picks}회 · ${r.secs}초`);

  s.ge('구역을 넘어간다', (r.zone|0)+1, 3);
  s.ge('레벨이 오른다', r.lv|0, 6);
  s.ge('처리가 쌓인다', r.kills|0, 150);
  s.ge('카드를 고른다', r.picks, 5);
  s.eq('공격이 멎는 구간 없음', r.stalls, 0);
  s.eq('한 판 내내 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
