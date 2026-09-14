/* 결과 카드 — 마케팅 예산이 0이면 퍼지는 길은 하나뿐이다.
   하고 난 사람이 보여 주는 것. 그런데 보여 줄 것이 없었다 —
   스크린샷은 화면 전체라 무엇이 자랑인지 안 읽힌다.

   퍼지는 건 게임이 아니라 대사다. 그날 들은 말 한 줄과 나온 시각이
   정사각형 한 장에 들어가야 한다. 이 검사는 그 한 장이 실제로
   구워지는지, 그리고 바깥으로 아무것도 나가지 않는지를 본다. */
import { open, driveRun, suite } from '../lib.mjs';

const SAVE = { career:0, lv:{}, best:0, days:9, cleared:true, rank:3,
               last:'win', grudge:'우리 팀은 가족이야' };

export default async function(){
  const s = suite('결과 카드');

  const p = await open({ mute:true, save:SAVE });
  /* 바깥으로 나가는 요청이 하나라도 생기면 안 된다 */
  const out = [];
  p.on('request', r => {
    const u = r.url();
    if(!/^(file|data|blob):/.test(u) && !u.startsWith('http://127.0.0.1')) out.push(u);
  });
  await p.waitForSelector('#go');
  await driveRun(p, { seed:2, ticks:3000 });

  const r = await p.evaluate(() => {
    const g = window.__g();
    g.tut=null; g.over=null; g.t=250; g.kills=1042; g.comboBest=88; g.lv=14;
    window.__finish(g, 'win');
    const c = window.__shareCard(g);
    const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for(let i=0;i<px.length;i+=4*97) if(px[i]+px[i+1]+px[i+2] > 200) ink++;
    return { w:c.width, h:c.height, ink,
             btn: !!document.getElementById('toShare'),
             label: (document.getElementById('toShare')||{}).textContent };
  });
  s.eq('정사각형 한 장', `${r.w}x${r.h}`, '1080x1080');
  s.ok('빈 그림이 아니다', r.ink > 200, `밝은 점 ${r.ink}`);
  s.ok('결과 화면에 단추가 있다', r.btn, String(r.btn));
  s.ok('단추 문구가 있다', (r.label||'').length > 2, r.label);

  /* 눌러도 터지지 않는가 — 헤드리스엔 공유 시트가 없으니 내려받기로 떨어진다 */
  const before = p.errors.length;
  await p.evaluate(() => document.getElementById('toShare').click());
  await p.waitForTimeout(600);
  s.eq('눌러도 JS 에러가 없다', p.errors.length, before, p.errors.join(' / '));
  const label = await p.evaluate(() => document.getElementById('toShare').textContent);
  s.ok('단추가 원래 문구로 돌아온다', /남기기|Save/.test(label), label);

  /* 결말마다 다른 한 줄이 들어간다 */
  const lines = await p.evaluate(() => {
    const g = window.__g(), got = {};
    for(const how of ['win','late','lose','union','replaced']){
      g.over = how;
      const c = window.__shareCard(g);
      got[how] = c.width;                       // 터지지 않고 그려지면 된다
    }
    return got;
  });
  s.eq('다섯 결말 전부 그려진다', Object.keys(lines).length, 5, JSON.stringify(lines));

  /* 영어 */
  await p.close();
  const q = await open({ mute:true, save:SAVE, lang:'en' });
  await q.waitForSelector('#go');
  await driveRun(q, { seed:2, ticks:1200 });
  const en = await q.evaluate(() => {
    const g = window.__g(); g.tut=null; g.over=null; g.t=250;
    window.__finish(g,'win');
    return (document.getElementById('toShare')||{}).textContent || '';
  });
  s.ok('영어 단추에 한글이 없다', en.length>2 && !/[가-힣]/.test(en), en);
  await q.close();

  s.eq('카드를 만드는 동안 바깥으로 나간 요청 없음', out.length, 0, out.join(' / '));
  return s;
}
