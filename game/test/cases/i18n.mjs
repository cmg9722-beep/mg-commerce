/* 언어 — 영어로 돌렸을 때 화면에 한글이 남아 있으면 안 된다.
   화면을 하나씩 열고 글자 노드를 훑는다. 남은 건 번역이 빠진 자리다. */
import { open, startRun, pickCard, suite } from '../lib.mjs';

const SAVE_PLAYED = { career:2400, lv:{hp:2,spd:1}, best:8800, score:8800, days:9,
                      cleared:true, rank:2, last:'win', runs:12,
                      ach:{first:1,k100:1,combo50:1}, opt:{} };

/* 화면에 실제로 보이는 글자만 본다 — 숨은 노드는 제외 */
/* 일부러 한국어로 남기는 것들 — 언어 선택 자체는 두 언어로 보여야 한다.
   영어 화면에 갇힌 한국어 사용자가 「한국어」를 못 찾으면 빠져나올 수 없다. */
const KEEP = ['한국어', 'Language · 언어', '언어 · Language'];
const SCAN = () => {
  const KEEP = ['한국어', 'Language · 언어', '언어 · Language'];
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  for(let n=w.nextNode(); n; n=w.nextNode()){
    const t = (n.nodeValue||'').trim();
    if(!t || !/[가-힣]/.test(t) || KEEP.includes(t)) continue;
    const el = n.parentElement;
    if(!el || !el.offsetParent && el.tagName!=='BODY') continue;
    out.push(t);
  }
  for(const el of document.querySelectorAll('[aria-label]')){
    const v = el.getAttribute('aria-label');
    if(v && /[가-힣]/.test(v)) out.push('@aria-label ' + v);
  }
  return [...new Set(out)];
};

export default async function run(){
  const s = suite('언어');
  const leftovers = new Map();
  const note = (screen, list) => { for(const t of list) if(!leftovers.has(t)) leftovers.set(t, screen); };

  /* ── 한국어: 영어가 새어 나오면 안 된다 ── */
  {
    const p = await open({ save: SAVE_PLAYED, lang:'ko' });
    const lobby = await p.evaluate(() => document.querySelector('#card').innerText);
    s.ok('한국어 로비가 한국어', /출근/.test(lobby), lobby.slice(0,80));
    s.eq('한국어 JS 에러 없음', p.errors.length, 0);
    await p.close();
  }

  /* ── 영어: 각 화면을 열고 남은 한글을 모은다 ── */
  const p = await open({ save: SAVE_PLAYED, lang:'en' });
  s.eq('영어 부팅 JS 에러 없음', p.errors.length, 0);

  note('로비', await p.evaluate(SCAN));
  for(const [btn, label] of [['#shop','자기계발'], ['#recs','기록'], ['#opts','설정']]){
    await p.click(btn); await p.waitForTimeout(180);
    note(label, await p.evaluate(SCAN));
    const back = await p.$('#back'); if(back){ await back.click(); await p.waitForTimeout(180); }
    else await p.evaluate(() => window.__api && document.querySelector('#card') && null);
  }

  /* 첫 판 로비(설명 3단계)도 본다 */
  {
    const q = await open({ lang:'en' });
    note('첫 판 로비', await q.evaluate(SCAN));
    await q.close();
  }

  /* 판 안 — HUD·레벨업 카드·일시정지 */
  await p.goto(p.url());
  await p.waitForSelector('#go');
  await startRun(p);
  await p.waitForTimeout(1500);
  note('전투 HUD', await p.evaluate(SCAN));

  await p.evaluate(() => window.__gainXp(window.__g(), 900));
  await p.waitForTimeout(250);
  note('레벨업 카드', await p.evaluate(SCAN));
  await pickCard(p);

  await p.keyboard.press('KeyP'); await p.waitForTimeout(250);
  note('일시정지', await p.evaluate(SCAN));
  await p.keyboard.press('KeyP'); await p.waitForTimeout(150);

  /* 결과 화면 — 이기고 끝냈을 때 */
  await p.evaluate(() => window.__finish(window.__g(), 'win'));
  await p.waitForTimeout(400);
  note('결과(퇴근)', await p.evaluate(SCAN));

  s.eq('영어 진행 중 JS 에러 없음', p.errors.length, 0);
  await p.close();

  const miss = [...leftovers.entries()];
  s.ok(`영어 화면에 남은 한글 ${miss.length}개`, miss.length===0,
       miss.slice(0,40).map(([t,w]) => `[${w}] ${t}`).join('\n       '));
  if(miss.length) {
    console.log('\n  ── 번역이 빠진 문자열 ──');
    for(const [t,w] of miss) console.log(`    ${JSON.stringify(t)},   // ${w}`);
  }
  return s;
}
