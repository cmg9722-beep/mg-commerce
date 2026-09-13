/* 야근 엔드리스 — 한 판이 4분이라 빌드가 완성되기 전에 하루가 끝난다.
   이 장르가 주는 「후반에 화면이 터지는 순간」이 이 게임엔 없었다.

   정문 앞에서 한 번 더 묻는다: 나갈 것인가, 오늘은 안 나갈 것인가.
   단 이미 한 번 나가 본 사람에게만 묻는다 — 첫 퇴근의 순간에
   선택지를 들이밀면 이야기가 깨진다. 그 경계를 여기서 지킨다. */
import { open, driveRun, suite } from '../lib.mjs';

const CLEARED = { career:0, lv:{}, best:0, days:9, cleared:true, rank:0, last:'win' };
const FIRST   = { career:0, lv:{}, best:0, days:3, cleared:false, rank:0, last:null };

const atGate = async (p, save) => {
  const q = await open({ mute:true, save });
  await q.waitForSelector('#go');
  await driveRun(q, { seed:3, ticks:1200 });
  return q;
};

export default async function(){
  const s = suite('야근 엔드리스');

  /* 첫 퇴근은 그대로 끝난다 — 물어보지 않는다 */
  {
    const p = await atGate(null, FIRST);
    const r = await p.evaluate(() => {
      const g = window.__g(); g.tut=null; g.over=null;
      g.zone = window.__api.ZONES.length - 1;
      window.__api.gateReady ? 0 : 0;
      g.zone = window.__api.ZONES.length;          // 정문에 선 상태를 흉내낸다
      const before = document.getElementById('ov').classList.contains('on');
      window.__finish(g, 'win');                   // 첫 클리어 경로
      return { before, over:g.over };
    });
    s.eq('첫 퇴근은 그냥 끝난다', r.over, 'win');
    await p.close();
  }

  /* 이미 나가 본 사람에게는 묻는다 */
  {
    const p = await atGate(null, CLEARED);
    const card = await p.evaluate(() => {
      const g = window.__g(); g.tut=null;
      window.__askLoop(g);
      return { on: document.getElementById('ov').classList.contains('on'),
               n: document.querySelectorAll('#card .pick').length,
               txt: document.querySelector('#card').innerText,
               paused: !!g.paused };
    });
    s.ok('정문에서 묻는다', card.on && card.n === 2, JSON.stringify(card));
    s.ok('묻는 동안 판이 멈춘다', card.paused, String(card.paused));
    s.ok('나가는 쪽이 먼저다', /퇴근한다/.test(card.txt), card.txt.slice(0,120));
    s.ok('남는 쪽도 있다', /안 나간다/.test(card.txt), '');
    s.ok('무엇이 달라지는지 숫자로 말한다', /35%/.test(card.txt) && /55%/.test(card.txt), card.txt);

    /* 남는 쪽 — 6구역으로 돌아가고 야근이 된다 */
    const after = await p.evaluate(() => {
      document.querySelectorAll('#card .pick')[1].click();
      const g = window.__g(), A = window.__api;
      return { loop:g.loop, zone:g.zone, ot:g.ot, paused:g.paused, over:g.over,
               from:A.LOOP_FROM, mul:A.loopMul(g), pay:A.loopPay(g),
               ovOn: document.getElementById('ov').classList.contains('on') };
    });
    s.eq('한 바퀴가 는다', after.loop, 1);
    s.eq('6구역부터 다시', after.zone, after.from);
    s.ok('야근으로 바뀐다', after.ot, String(after.ot));
    s.ok('판이 안 끝났다', !after.over, String(after.over));
    s.ok('창이 닫히고 다시 돈다', !after.ovOn && !after.paused, JSON.stringify(after));
    s.ok('적이 세진다', after.mul > 1.3, String(after.mul));
    s.ok('남기는 것도 커진다', after.pay > 1.5, String(after.pay));

    /* 실제로 굴러가는가 — 한 바퀴를 돌려 본다 */
    const ran = await driveRun(p, { seed:3, ticks:4000 });
    s.ge('엔드리스에서도 진행된다', ran.kills, 1, JSON.stringify(ran));
    s.eq('엔드리스 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }

  /* 바퀴가 점수와 경력에 걸린다 */
  {
    const p = await atGate(null, CLEARED);
    const r = await p.evaluate(() => {
      const g = window.__g(); g.tut=null; g.kills=800; g.t=300; g.comboBest=40;
      const A = window.__api;
      g.loop=0; const a = A.loopPay(g);
      g.loop=3; const b = A.loopPay(g);
      return { a, b };
    });
    s.eq('바퀴가 없으면 배수도 없다', r.a, 1);
    s.ok('세 바퀴면 배수가 붙는다', r.b > 2, String(r.b));
    await p.close();
  }

  /* 영어 */
  {
    const p = await open({ mute:true, save:CLEARED, lang:'en' });
    await p.waitForSelector('#go');
    await driveRun(p, { seed:3, ticks:1200 });
    const txt = await p.evaluate(() => {
      const g = window.__g(); g.tut=null; window.__askLoop(g);
      return document.querySelector('#card').innerText;
    });
    s.ok('영어 선택 카드에 한글이 없다', !/[가-힣]/.test(txt), txt);
    s.ok('영어 문구가 들어 있다', /Not Leaving Today/.test(txt), txt);
    await p.close();
  }

  return s;
}
