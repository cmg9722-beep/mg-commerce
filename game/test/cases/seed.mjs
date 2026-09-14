/* 런 시드 코드 — 서버도 계정도 없이 「이 판 해 봐」가 성립하는 유일한 길.

   결과 화면에 여섯 자가 뜨고, 로비에 그걸 넣으면 같은 하루가 열린다.
   되려면 게임 로직의 난수가 시각·소리·로비와 갈라져 있어야 한다 —
   그리기가 같은 스트림을 먹으면 화면 흔들림 한 번에 판이 어긋난다.
   실제로 그것 때문에 밸런스 측정이 세 번 무효가 된 적이 있다. */
import { open, suite } from '../lib.mjs';

/* 시드를 주고 판을 열어 정해진 틱만큼 돌린다. 렌더는 안 부른다 */
const run = (p, seed, ticks) => p.evaluate(([seed, ticks]) => {
  const A = window.__api;
  if(raf){ cancelAnimationFrame(raf); raf = null; }
  A.start('검사', seed);
  if(raf){ cancelAnimationFrame(raf); raf = null; }
  const g = window.__g(); g.tut = null;
  for(let i=0;i<ticks;i++){
    let dt = 1/60;
    if(g.hitstop > 0){ g.hitstop -= dt; dt *= 0.12; }
    if(!g.paused) step(g, dt);
    if(g.over) break;
  }
  return { seed:g.seed, code:A.seedCode(g.seed), kills:g.kills, zone:g.zone,
           lv:g.lv, hp:Math.round(g.P.hp), foes:g.foes.length,
           dmg:Math.round(g.dmgDealt) };
}, [seed, ticks]);

export default async function(){
  const s = suite('런 시드');
  const p = await open({ mute:true });
  await p.waitForSelector('#go');

  /* 코드 ↔ 시드 왕복 */
  const rt = await p.evaluate(() => {
    const A = window.__api, bad = [];
    for(const v of [1, 7, 12345, 999999, 1073741823])
      if(A.codeSeed(A.seedCode(v)) !== v) bad.push(v);
    return { bad, sample:A.seedCode(12345), len:A.seedCode(7).length,
             /* 헷갈리는 글자는 안 쓴다 — 손으로 옮겨 적는 물건이다 */
             confusing:/[01OI]/.test(A.seedCode(123456789)),
             junk:[A.codeSeed(''), A.codeSeed('ABC'), A.codeSeed('!!!!!!')] };
  });
  s.eq('코드를 넣으면 같은 시드로 돌아온다', rt.bad.join(','), '');
  s.eq('여섯 자다', rt.len, 6, rt.sample);
  s.eq('헷갈리는 글자를 안 쓴다', rt.confusing, false);
  s.eq('엉뚱한 입력은 0 이다', rt.junk.join(','), '0,0,0');
  /* 0·1 을 넣어도 O·I 로 읽어 준다 — 손으로 옮겨 적으면 반드시 생기는 일 */
  const lenient = await p.evaluate(() => {
    const A = window.__api, c = A.seedCode(12345);
    return { same: A.codeSeed(c.toLowerCase()) === A.codeSeed(c) };
  });
  s.ok('소문자로 넣어도 같다', lenient.same, '');

  /* 같은 코드 = 같은 판 */
  const a = await run(p, 12345, 1800);
  const b = await run(p, 12345, 1800);
  const c = await run(p, 54321, 1800);
  s.eq('같은 시드는 같은 판', JSON.stringify(a), JSON.stringify(b));
  s.ok('다른 시드는 다른 판', JSON.stringify(a) !== JSON.stringify(c), JSON.stringify(c));
  s.eq('판이 자기 코드를 안다', a.code, rt.sample);
  s.ge('판이 실제로 굴러갔다', a.kills, 20, JSON.stringify(a));

  /* 시드를 안 주면 매번 다른 판이어야 한다 — 안 그러면 늘 같은 하루가 된다 */
  const r1 = await run(p, 0, 900), r2 = await run(p, 0, 900);
  s.ok('시드를 안 주면 새로 뽑는다', r1.seed !== r2.seed, `${r1.seed} / ${r2.seed}`);
  s.ok('그래도 코드는 남는다', !!r1.code && r1.code.length === 6, r1.code);

  /* 로비 입력칸이 실제로 그 판을 연다 */
  const ui = await p.evaluate(code => {
    renderStart();
    const inp = document.getElementById('seedin');
    if(!inp) return { none:true };
    inp.value = code.toLowerCase();
    inp.oninput();
    const shown = inp.value;
    document.getElementById('goseed').click();
    const g = window.__g();
    return { shown, seed: g ? g.seed : 0 };
  }, rt.sample);
  s.eq('입력칸이 대문자로 고쳐 준다', ui.shown, rt.sample);
  s.eq('그 코드의 판이 열린다', ui.seed, 12345, JSON.stringify(ui));

  /* 화면 흔들림은 판을 흔들면 안 된다 — 시각은 Math.random 으로 남겨 뒀다 */
  const shake = await p.evaluate(() => {
    const A = window.__api;
    const one = () => {
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      A.start('검사', 777);
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      const g = window.__g(); g.tut = null;
      for(let i=0;i<600;i++){
        g.shake = 20;                       // 매 틱 흔든다 — 그려도 판이 안 바뀌어야
        draw(g);
        let dt = 1/60; if(!g.paused) step(g, dt);
      }
      return `${g.kills}/${Math.round(g.P.hp)}/${g.foes.length}`;
    };
    return { a:one(), b:one() };
  });
  s.eq('그리기가 판을 흔들지 않는다', shake.a, shake.b);

  s.eq('시드 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
