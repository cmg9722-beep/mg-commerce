/* 오프라인 — 앱스토어 게임이 지하철에서 열리면 안 되는 게 아니다.
   바깥으로 나가는 요청이 하나라도 있으면 그 자원은 없는 셈 치고 굴러야 하는데,
   글꼴은 없으면 화면이 통째로 달라 보인다. 그래서 아예 안 나가게 한다. */
import { open, startRun, suite } from '../lib.mjs';

export default async function run(){
  const s = suite('오프라인');
  const p = await open();

  /* 바깥으로 나간 요청을 전부 모은다 */
  const external = [];
  p.on('request', r => {
    const u = r.url();
    if(!/^(file|data|blob):/.test(u)) external.push(u);
  });
  await p.goto(p.url());
  await p.waitForSelector('#go');
  await startRun(p);
  await p.waitForTimeout(1500);

  s.eq('바깥으로 나가는 요청 없음', external.length, 0,
       [...new Set(external)].slice(0,6).join('\n       '));

  /* 글꼴이 실제로 붙었는가 — 선언만 있고 파일이 없으면 조용히 대체된다 */
  const fonts = await p.evaluate(async () => {
    await document.fonts.ready;
    /* 게임이 실제로 쓰는 굵기 넷. 안 실은 굵기를 쓰면 브라우저가 제멋대로
         대체해서, 화면은 「되는 것처럼」 보이고 자간만 어긋난다. */
      const want = [['400 30px "Black Han Sans"','정시 퇴근'],
                    ['400 14px "Gothic A1"','미결'],
                    ['700 14px "Gothic A1"','처리'],
                    ['800 14px "Gothic A1"','퇴근']];
    return want.map(([f,t]) => ({ f, ok: document.fonts.check(f, t) }));
  });
  for(const f of fonts) s.ok(`글꼴이 붙었다 — ${f.f}`, f.ok);

  /* 글꼴이 실제로 다르게 그려지는가 — check()는 통과해도 폭이 같으면 대체된 것이다*/
  const widths = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    const m = f => { c.font = f; return Math.round(c.measureText('정시 퇴근 18:00').width); };
    return { bhs:m('400 30px "Black Han Sans", monospace'),
             sys:m('400 30px monospace'),
             g1 :m('400 16px "Gothic A1", monospace'),
             g2 :m('800 16px "Gothic A1", monospace') };
  });
  s.ok('Black Han Sans 가 시스템 글꼴과 다르게 그려진다',
       widths.bhs !== widths.sys, JSON.stringify(widths));
  s.ok('Gothic A1 굵기가 실제로 구분된다', widths.g1 !== widths.g2, JSON.stringify(widths));

  /* 없는 글자는 시스템 글꼴로 떨어져야 한다 — 서브셋이라 두부가 뜨면 안 된다 */
  const missing = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '400 16px "Gothic A1", "Malgun Gothic", sans-serif';
    return Math.round(c.measureText('쀍쀓쮋').width) > 0;
  });
  s.ok('서브셋에 없는 글자도 폭을 갖는다(대체 동작)', missing);

  /* CSS가 선언한 굵기와 코드가 쓰는 굵기가 어긋나면 안 된다 —
     안 실은 굵기는 조용히 대체돼서 눈으로는 못 잡는다 */
  const used = await p.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const faces = new Set([...html.matchAll(/@font-face[^}]*?font-weight:\s*(\d+)/g)].map(m => m[1]));
    const css   = new Set([...html.matchAll(/font-weight:\s*(\d00)/g)].map(m => m[1]));
    const ctx   = new Set([...html.matchAll(/font\s*=\s*\(?["'`](\d00)/g)].map(m => m[1]));
    return { faces:[...faces], want:[...new Set([...css, ...ctx])] };
  });
  const notShipped = used.want.filter(w => !used.faces.includes(w));
  s.eq('쓰는 굵기가 전부 실려 있다', notShipped.length, 0,
       `안 실린 굵기 ${notShipped.join(',')} · 실린 것 ${used.faces.join(',')}`);

  s.eq('오프라인 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
