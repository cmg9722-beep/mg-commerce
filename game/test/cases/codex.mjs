/* 무기 도감 — 태그 넷·반응 셋·진화 열둘이 생기면서 「알아야 할 것」이 늘었다.
   그걸 한 판 안에서 카드 힌트로만 배우기엔 느리다 — 반려 도장을 여덟까지
   올려 본 사람도 그게 노트북과 짝이라는 걸 그 순간에야 안다.

   도감은 답지가 아니라 지도다. 무엇이 있는지와 무엇이 무엇과 맞물리는지를
   보여 준다. 이 검사는 그 지도가 실제 데이터와 어긋나지 않는지를 본다 —
   무기를 더하고 도감을 안 고치면 도감이 거짓말이 된다. */
import { open, suite } from '../lib.mjs';

const open_ = p => p.evaluate(() => {
  document.getElementById('recs').click();
  document.getElementById('toCodex').click();
  return document.querySelector('#card').innerText;
});

export default async function(){
  const s = suite('무기 도감');
  const p = await open({ mute:true, save:{ career:0, lv:{}, best:0, days:9,
                         cleared:true, rank:0, last:'win' } });
  await p.waitForSelector('#go');

  const txt = await open_(p);
  s.ok('기록에서 도감으로 들어간다', /무기 도감/.test(txt), txt.slice(0,80));

  const n = await p.evaluate(() => {
    const A = window.__api;
    const evo = Object.keys(A.WEAPONS).filter(k => A.WEAPONS[k].evo).length;
    const base = Object.keys(A.WEAPONS).length - evo;
    return { evo, base, total: Object.keys(A.WEAPONS).length,
             evoCards: document.querySelectorAll('#cxevo .achcard').length,
             wCards:   document.querySelectorAll('#cxw .achcard').length,
             reacts:   document.querySelectorAll('.cxr').length,
             tagRows:  document.querySelectorAll('.cxt2').length };
  });
  /* 도감이 데이터를 빠뜨리면 안 된다 — 무기를 더하고 도감을 안 고치면 거짓말이 된다 */
  s.eq('진화 칸이 진화 수와 같다', n.evoCards, n.evo);
  s.eq('무기 칸이 진화 뺀 수와 같다', n.wCards, n.base);
  s.eq('반응 셋이 전부 적혀 있다', n.reacts, 3);
  s.eq('태그 넷이 전부 적혀 있다', n.tagRows, 4);
  s.ge('진화가 열둘 이상', n.evo, 12, String(n.evo));

  /* 진화 조건이 실제 EVO 표와 맞는가 — 여기가 어긋나면 사람이 헛수고한다 */
  const recipe = await p.evaluate(() => {
    const A = window.__api, W = A.WEAPONS, P = A.PERKS;
    const want = [];
    for(const b in A.EVO)
      for(const e of A.evoPairs(b))
        want.push(`${W[b].name} ${W[b].max} + ${P[e.perk].name} ${P[e.perk].max}`);
    const got = [...document.querySelectorAll('#cxevo .achcard .d')].map(x => x.textContent.trim());
    return { missing: want.filter(w => !got.includes(w)), want: want.length, got: got.length };
  });
  s.eq('진화 조건이 표와 정확히 같다', recipe.missing.join(' / '), '', JSON.stringify(recipe));

  /* 태그가 붙은 무기가 도감에 그대로 나오는가 */
  const tagged = await p.evaluate(() => {
    const A = window.__api, W = A.WEAPONS;
    const wet = Object.keys(W).filter(k => W[k].tag === 'wet' && !W[k].evo).map(k => W[k].name);
    const row = [...document.querySelectorAll('.cxt2')]
      .map(x => x.textContent).find(t => /젖음|Wet/.test(t)) || '';
    return { wet, missing: wet.filter(nm => !row.includes(nm)) };
  });
  s.eq('젖음 무기가 전부 적혀 있다', tagged.missing.join(','), '', JSON.stringify(tagged));

  s.eq('도감 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();

  /* 영어 */
  const q = await open({ mute:true, lang:'en', save:{ career:0, lv:{}, best:0, days:9,
                         cleared:true, rank:0, last:'win' } });
  await q.waitForSelector('#go');
  const en = await open_(q);
  s.ok('영어 도감에 한글이 없다', en.length > 50 && !/[가-힣]/.test(en), en.slice(0, 160));
  await q.close();
  return s;
}
