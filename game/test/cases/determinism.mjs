/* 같은 시드면 같은 판이 나오는가 — 밸런스를 재려면 이게 먼저다.

   시드를 고정해 놓고도 재현이 안 돼서 축 두 개를 잘못 판정했다.
   같은 코드·같은 시드로 돌린 두 판이 승패까지 달랐고, 아무도 안 건드린
   1구역 최저 체력이 83~97 로 흔들렸다. 원인은 셋이었다.

     ① 그리기가 게임 난수를 먹는다 — drawWorld 는 화면 흔들림에
        Math.random() 을 프레임마다 둘 쓰는데, draw() 는 일시정지 중에도
        매 rAF 돌고 g.shake 는 step 안에서만 줄어든다. 레벨업 창이 떠
        있는 시간(= 실시간)만큼 난수 스트림이 밀렸다.
     ② 효과음이 같은 스트림을 먹는다 — gate() 가 벽시계 스로틀이라
        호출 횟수가 실시간에 묶인다.
     ③ 판을 여는 클릭과 루프를 세우는 사이에 프레임이 몇 장 돈다.

   driveRun 이 셋을 다 막는다(draw 안 부름 · 음소거 · 클릭과 정지를 한
   evaluate 안에서). 이 검사는 그게 계속 사실인지를 지킨다.
   ❌ 가 뜨면 게임 어딘가에 벽시계나 새 Math.random 이 들어온 것이다. */
import { open, driveRun, suite } from '../lib.mjs';

const KEYS = ['over','zone','lv','kills','t','dmgDealt','picks'];
const slim = r => JSON.stringify(Object.fromEntries(KEYS.map(k => [k, r[k]])));

export default async function(){
  const s = suite('결정론');

  const run = async seed => {
    const p = await open({ mute:true });
    await p.waitForSelector('#go');
    const r = await driveRun(p, { seed, ticks:12000 });
    const errs = p.errors.slice();
    await p.close();
    return { r, errs };
  };

  const a = await run(1), b = await run(1), c = await run(2);

  s.eq('같은 시드는 같은 판', slim(a.r), slim(b.r));
  s.ok('다른 시드는 다른 판', slim(a.r) !== slim(c.r), slim(c.r));

  /* 구역별 기록까지 같아야 한다 — 요약만 같고 속이 다르면 지표를 못 믿는다 */
  const zs = r => Object.keys(r.rec).sort().map(z => {
    const x = r.rec[z];
    return `${z}:${Math.round(x.minHp)}/${Math.round(x.dmgTaken)}/${x.ticks}`;
  }).join(' ');
  s.eq('구역별 기록까지 같다', zs(a.r), zs(b.r));

  /* 판이 실제로 굴러갔는지 — 0틱짜리가 「같다」로 통과하면 의미가 없다 */
  s.ge('판이 실제로 진행됐다', a.r.kills, 100, JSON.stringify(slim(a.r)));
  s.ge('구역을 넘어간다', a.r.zone, 2, String(a.r.zone));
  s.ge('카드를 고른다', a.r.picks, 4, String(a.r.picks));

  s.eq('결정론 검사 중 JS 에러 없음', a.errs.length + b.errs.length + c.errs.length, 0,
       [...a.errs, ...b.errs, ...c.errs].join(' / '));
  return s;
}
