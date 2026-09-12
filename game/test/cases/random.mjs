/* 무작위로 골라도 굴러가는가 — 검증한다면서 늘 첫 번째 카드만 고르면
   스물몇 가지 조합 중 하나만 본 것이다. 실제로 그렇게 놓친 버그가 있었다.
   play 와 같은 방식(실제 키)으로 돌리되, 카드는 매번 무작위로 고른다.

   RUNS=8 node game/test/run.mjs random  으로 판수를 늘릴 수 있다. */
import { open, startRun, autoplay, suite } from '../lib.mjs';

const RUNS = Number(process.env.RUNS || 3);

export default async function run(){
  const s = suite('무작위 선택으로 여러 판');
  let good = 0, stalled = 0, errored = 0;

  for(let i = 0; i < RUNS; i++){
    const p = await open();
    await startRun(p);
    await p.waitForTimeout(300);
    const r = await autoplay(p, { ticks:1200, pick:'random', budgetMs:95000 });
    const ok = !!r.over || (r.zone|0) >= 2;
    if(ok) good++;
    if(r.stalls) stalled++;
    if(p.errors.length){ errored++; console.log('     에러:', p.errors[0]); }
    console.log(`  ${i+1}판 ${(r.over||'진행중').padEnd(6)} ${(r.zone|0)+1}구역 Lv${r.lv} ` +
                `처리 ${r.kills} 선택 ${r.picks}회 ${ok && !r.stalls && !p.errors.length ? '✅' : '❌'}`);
    await p.close();
  }
  s.eq(`${RUNS}판 전부 앞으로 나아간다`, good, RUNS);
  s.eq('공격이 멎는 판 없음', stalled, 0);
  s.eq('JS 에러가 난 판 없음', errored, 0);
  return s;
}
