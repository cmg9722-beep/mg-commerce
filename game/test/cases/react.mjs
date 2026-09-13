/* 반응 — 무기가 서로를 알게 만드는 층.

   스물한 종이 서로를 모르고 있었다. 쏟은 커피가 적을 적셔도 반려 도장은
   젖은 적과 마른 적을 똑같이 찍었고, 회의에 묶인 적에게 사직서가 더
   아프지도 않았다. 그래서 빌드가 「좋은 무기 여섯을 고른다」였지
   「조합을 만든다」가 아니었다 — 이 장르가 사람을 붙잡는 축이 비어 있었다.

   무기를 백 개 만드는 대신 태그 셋(젖음·묶임·참조)과 반응 셋(번짐·지적·전달)을
   둔다. 전부 damage() 한 곳에서 난다. 이 검사는 셋이 각각 나는지,
   태그가 없으면 안 나는지, 보스에는 안 걸리는지를 본다. */
import { open, driveRun, suite } from '../lib.mjs';

/* 적을 놓고 한 대 때린다. 반응은 damage() 안에서만 나므로 그 관문을 직접 본다 */
const hit = (p, setup) => p.evaluate(cfg => {
  const g = window.__g(), A = window.__api;
  g.foes.length = 0;
  const put = (dx, kind) => { A.spawnAt(g, kind||'staff', g.P.x+dx, g.P.y); return g.foes[g.foes.length-1]; };
  const a = put(300, cfg.kind), b = put(300 + (cfg.gap||30), cfg.kind);
  if(cfg.wet)  a.wet  = 3;
  if(cfg.hold) a.hold = 2;
  if(cfg.cc){  a.cc = 3; b.cc = 3; }
  const a0 = a.hp, b0 = b.hp;
  if(cfg.kill) A.killFoe(g, a, g.foes.indexOf(a));
  else A.damage(g, a, 100, g.P.x, g.P.y, 0, cfg.src);
  return { target: Math.round((a0 - a.hp)*10)/10, splash: Math.round((b0 - b.hp)*10)/10 };
}, setup);

export default async function(){
  const s = suite('반응');
  const p = await open({ mute:true });
  await p.waitForSelector('#go');
  await driveRun(p, { seed:4, ticks:900 });

  /* 아무 태그도 없으면 그냥 100 이다 — 기준선 */
  const base = await hit(p, { src:'stamp' });
  s.eq('태그가 없으면 그냥 맞는다', base.target, 100);
  s.eq('옆 사람은 안 맞는다', base.splash, 0);

  /* 지적 — 묶인 적은 1.6배 */
  const called = await hit(p, { src:'stamp', hold:true });
  s.eq('회의에 묶인 적은 더 아프다', called.target, 160);

  /* 번짐 — 젖은 적을 서류로 때리면 60% 가 둘레에 */
  const bleed = await hit(p, { src:'stamp', wet:true });
  s.eq('젖은 적을 서류로 때리면 옆으로 번진다', bleed.splash, 60);
  const dry = await hit(p, { src:'meeting', wet:true });
  s.eq('서류가 아니면 안 번진다', dry.splash, 0);
  const far = await hit(p, { src:'stamp', wet:true, gap:300 });
  s.eq('멀면 안 번진다', far.splash, 0);

  /* 전달 — 참조된 적이 처리되면 같이 참조된 사람에게 */
  const fwd = await hit(p, { cc:true, kill:true });
  s.ok('참조된 적이 처리되면 옆으로 간다', fwd.splash > 0, String(fwd.splash));
  const noCc = await hit(p, { kill:true });
  s.eq('참조가 없으면 전달도 없다', noCc.splash, 0);

  /* 보스에는 안 걸린다 — 걸리면 보스전이 반응 한 번에 끝난다 */
  const boss = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.foes.length = 0;
    A.spawnAt(g, 'chief', g.P.x+300, g.P.y);
    const f = g.foes[0], h0 = f.hp;
    f.hold = 2; f.wet = 3;
    A.damage(g, f, 100, g.P.x, g.P.y, 0, 'stamp');
    return { took: Math.round(h0 - f.hp), wet: f.wet };
  });
  s.eq('보스에겐 반응이 안 걸린다', boss.took, 100, JSON.stringify(boss));

  /* 태그가 실제로 무기 표에 붙어 있는가 */
  const tags = await p.evaluate(() => {
    const W = window.__api.WEAPONS;
    const by = t => Object.keys(W).filter(k => W[k].tag === t);
    return { wet:by('wet'), hold:by('hold'), cc:by('cc'),
             paper:Object.keys(W).filter(k => W[k].paper) };
  });
  for(const [t, n] of [['wet',3], ['hold',3], ['cc',3], ['paper',4]])
    s.ge(`${t} 무기가 여럿이다`, tags[t].length, n, tags[t].join(','));

  /* 힌트가 카드에 뜨는가 — 안 보이면 태그를 넣어도 아무도 모른다 */
  const hints = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.weapons = { coffee:1 };
    const a = A.reactHint(g, 'w', 'stamp');     // 젖음을 들고 서류 카드
    g.weapons = { stamp:1 };
    const b = A.reactHint(g, 'w', 'coffee');    // 서류를 들고 젖음 카드
    g.weapons = { stamp:1 };
    const c = A.reactHint(g, 'w', 'overtime');  // 태그 없는 카드
    return { a, b, c };
  });
  s.ok('서류 카드에 번짐 힌트가 뜬다', /번짐|Bleed/.test(hints.a), hints.a);
  s.ok('젖음 카드에도 뜬다', /번짐|Bleed/.test(hints.b), hints.b);
  s.eq('관계없는 카드엔 안 뜬다', hints.c, '');

  s.eq('반응 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();

  /* 영어 */
  const q = await open({ mute:true, lang:'en' });
  await q.waitForSelector('#go');
  await driveRun(q, { seed:4, ticks:600 });
  const en = await q.evaluate(() => {
    const g = window.__g(); g.weapons = { coffee:1 };
    return window.__api.reactHint(g, 'w', 'stamp');
  });
  s.ok('영어 힌트에 한글이 없다', en.length > 3 && !/[가-힣]/.test(en), en);
  await q.close();

  return s;
}
