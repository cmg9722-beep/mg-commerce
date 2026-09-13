/* 오늘의 사내 공지 — 「내일 또 켤 이유」.

   이야기는 15일차에 끝나고 상점은 18~35판이면 다 산다. 그 뒤로
   15판과 60판 사이에 새로 생기는 게 없었다 — 멀리 보는 목표 셋은
   내용이 아니라 카운터였다.

   날짜가 그날의 사건 계획표를 정한다. 서버도 계정도 없이, 날짜 하나로
   전 세계가 같은 회사가 된다. 그래서 이 검사는 두 가지를 본다:
   같은 날이면 언제 열어도 같은가, 그리고 그 계획이 실제로 판에 걸리는가. */
import { open, driveRun, suite, SAVE_KEY } from '../lib.mjs';

const notice = p => p.evaluate(() => {
  const r = [...document.querySelectorAll('#card .achrow')]
    .find(x => /오늘의 공지|Today's notice/.test(x.innerText));
  return r ? r.innerText.replace(/\s+/g, ' ').trim() : '';
});

export default async function(){
  const s = suite('오늘의 공지');

  /* 같은 날이면 같은 공지, 다른 날이면 다른 공지 */
  {
    const a = await open({ mute:true, dayKey:'20260913' });
    const b = await open({ mute:true, dayKey:'20260913' });
    const c = await open({ mute:true, dayKey:'20260914' });
    for(const q of [a,b,c]) await q.waitForSelector('#go');
    const [ta, tb, tc] = [await notice(a), await notice(b), await notice(c)];
    s.ok('공지가 로비에 뜬다', ta.length > 10, ta);
    s.eq('같은 날이면 같은 공지', ta, tb);
    s.ok('다른 날이면 다른 공지', ta !== tc, `${ta}\n     ${tc}`);
    await a.close(); await b.close(); await c.close();
  }

  /* 계획표 규칙 — 200일치를 굴려 본다 */
  {
    const p = await open({ mute:true });
    await p.waitForSelector('#go');
    const r = await p.evaluate(() => {
      const A = window.__api;
      const BOSS = [5,7,8];
      let bad=0, dup=0, range=0, count=0;
      const seen = new Set();
      for(let i=0;i<200;i++){
        const key = 20260101 + i;
        const d = A.dailyPlan(key);
        const zs = Object.keys(d.plan).map(Number);
        if(zs.length<2 || zs.length>3) count++;
        const ids = zs.map(z=>d.plan[z].id);
        if(new Set(ids).size !== ids.length) dup++;
        for(const z of zs){
          if(z<1 || z>8) range++;
          if(BOSS.indexOf(z)>=0 && d.plan[z].kind==='bad') bad++;
        }
        seen.add(JSON.stringify(zs)+ids.join(','));
      }
      /* 순수한가 — 같은 키를 두 번 불러도 같고, 게임 난수를 먹지 않는다 */
      const r1 = JSON.stringify(A.dailyPlan(20260401).plan);
      const r2 = JSON.stringify(A.dailyPlan(20260401).plan);
      return { bad, dup, range, count, variety:seen.size, pure:r1===r2 };
    });
    s.eq('공지는 하루 2~3개', r.count, 0);
    s.eq('구역은 2~9구역 안', r.range, 0);
    s.eq('같은 사건이 두 번 나지 않는다', r.dup, 0);
    s.eq('보스 구역에 나쁜 공지를 두지 않는다', r.bad, 0);
    s.ge('날마다 충분히 다르다', r.variety, 100);
    s.ok('같은 날짜는 항상 같은 계획', r.pure, String(r.pure));
    await p.close();
  }

  /* 계획이 실제로 판에 걸리는가 */
  {
    const p = await open({ mute:true, dayKey:'20260913' });
    await p.waitForSelector('#go');
    await driveRun(p, { seed:2, ticks:600 });
    const r = await p.evaluate(() => {
      const g = window.__g(), A = window.__api;
      const plan = g.daily.plan;
      const zs = Object.keys(plan).map(Number);
      const z = zs[0];
      g.zone = z; g.rndName = ''; A.rollEvent(g);
      const hit = g.rndName;
      /* 계획에 없는 구역은 아무 일도 없어야 한다 */
      let empty = null;
      for(let k=1;k<=8;k++) if(!plan[k]){ empty=k; break; }
      let none = '(없음)';
      if(empty!=null){ g.zone=empty; g.rndName=''; A.rollEvent(g); none=g.rndName; }
      return { want: plan[z].name, hit, none, key:g.daily.key };
    });
    s.eq('판이 오늘 날짜를 쓴다', r.key, '20260913');
    s.eq('계획한 구역에서 계획한 사건이 난다', r.hit, r.want);
    s.eq('계획에 없는 구역은 조용하다', r.none, '');
    await p.close();
  }

  /* 오늘의 기록 — 자정에 스스로 비워진다 */
  {
    const base = { career:0, lv:{}, best:0, days:5, cleared:false, rank:0, last:null };
    /* 전체 최고를 높게 둔다 — 전체 신기록이면 그 문구가 우선이라
       「오늘의 기록」 줄은 일부러 안 나온다. 그 경계를 여기서 본다. */
    const p = await open({ mute:true, dayKey:'20260913',
      save:{ ...base, score:9999999, daily:{ key:'20260913', score:5000, runs:2 } } });
    await p.waitForSelector('#go');
    s.ok('오늘의 기록이 로비에 뜬다', /5,000/.test(await notice(p)), await notice(p));
    await driveRun(p, { seed:2, ticks:400 });
    const r = await p.evaluate(k => {
      const g = window.__g();
      g.tut=null; g.kills=9000; g.t=380; g.comboBest=200; g.over=null;
      window.__finish(g,'win');
      const sv = JSON.parse(localStorage.getItem(k));
      return { key:sv.daily.key, score:sv.daily.score, runs:sv.daily.runs,
               card:document.querySelector('#card').innerText };
    }, SAVE_KEY);
    s.eq('오늘 출근 수가 는다', r.runs, 3);
    s.ok('오늘의 기록이 갱신된다', r.score > 5000, String(r.score));
    s.ok('결과 화면이 오늘의 기록을 말한다', /오늘의 기록/.test(r.card), '');
    await p.close();

    /* 어제 기록은 오늘 0 부터 */
    const q = await open({ mute:true, dayKey:'20260914',
      save:{ ...base, daily:{ key:'20260913', score:5000, runs:2 } } });
    await q.waitForSelector('#go');
    s.ok('날이 바뀌면 오늘 첫 출근', /오늘 첫 출근/.test(await notice(q)), await notice(q));
    await driveRun(q, { seed:2, ticks:400 });
    const r2 = await q.evaluate(k => {
      const g = window.__g(); g.tut=null; g.kills=100; g.t=100; g.over=null;
      window.__finish(g,'lose');
      const sv = JSON.parse(localStorage.getItem(k));
      return { key:sv.daily.key, runs:sv.daily.runs };
    }, SAVE_KEY);
    s.eq('오늘 날짜로 새로 센다', r2.key, '20260914');
    s.eq('출근 수도 1부터', r2.runs, 1);
    await q.close();
  }

  /* 영어 */
  {
    const p = await open({ mute:true, dayKey:'20260913', lang:'en' });
    await p.waitForSelector('#go');
    const t = await notice(p);
    s.ok('영어 공지에 한글이 없다', t.length>10 && !/[가-힣]/.test(t), t);
    s.eq('공지 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
    await p.close();
  }

  return s;
}
