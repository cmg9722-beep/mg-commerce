/* 위협 읽기 — 누가 나를 때리는지가 무리 속에서 보여야 한다.

   외부 검토: 「적 12종이 검은 머리·재킷 색으로만 갈린다. 누가 나를
   때리는지, 어느 게 원거리인지 무리 속에서 안 보인다.」

   전부 다시 그리는 게 아니라 위협 셋만 본다:
     원거리 둘(인사팀·협력사) — 보스는 예비동작이 있는데 이쪽은 없었다.
       예고 없이 날아오니 맞아도 「어디서 왔지」로 끝났다.
     부장 — 간섭 반경을 가진 유일한 일반 적인데 무리에 섞이면 안 보였다.
     빠른 적 — 속도가 숫자가 아니라 눈으로 읽혀야 피한다. */
import { open, driveRun, suite } from '../lib.mjs';

export default async function(){
  const s = suite('위협 읽기');
  const p = await open({ mute:true });
  await p.waitForSelector('#go');
  await driveRun(p, { seed:5, ticks:900 });

  /* 원거리는 던지기 전에 겨눈다 */
  const aim = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.foes.length = 0; g.eshots.length = 0;
    A.spawnAt(g, 'hrteam', g.P.x + 300, g.P.y);
    const f = g.foes[0];
    f.shT = 0;
    step(g, 1/60);                       // 사거리 안이고 쿨이 됐다 → 겨눈다
    const aiming = f.aim > 0, shotsWhileAiming = g.eshots.length;
    for(let i=0;i<40;i++) step(g, 1/60); // 0.66초 — 겨눔이 끝나고 던진다
    return { aiming, shotsWhileAiming, fired: g.eshots.length, aimLeft: f.aim };
  });
  s.ok('던지기 전에 겨눈다', aim.aiming, JSON.stringify(aim));
  s.eq('겨누는 동안은 안 날아온다', aim.shotsWhileAiming, 0);
  s.ge('겨눔이 끝나면 날아온다', aim.fired, 1, JSON.stringify(aim));

  /* 겨누는 동안은 멈춰 선다 — 그래야 "저 사람이 던진다"가 읽힌다 */
  const still = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.foes.length = 0; g.eshots.length = 0;
    A.spawnAt(g, 'vendor', g.P.x + 300, g.P.y);
    const f = g.foes[0]; f.shT = 0;
    step(g, 1/60);
    const x0 = f.x, y0 = f.y;
    for(let i=0;i<12;i++) step(g, 1/60);
    return { moved: Math.round(Math.hypot(f.x-x0, f.y-y0)), aim: f.aim > 0 };
  });
  s.ok('겨누는 동안 멈춰 선다', still.moved <= 2, JSON.stringify(still));

  /* 묶이거나 밀리면 겨눔이 풀린다 — 안 그러면 회의 소집이 헛돈다 */
  const broken = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.foes.length = 0;
    A.spawnAt(g, 'hrteam', g.P.x + 300, g.P.y);
    const f = g.foes[0]; f.shT = 0;
    step(g, 1/60);
    const was = f.aim > 0;
    f.hold = 2; step(g, 1/60);
    return { was, now: f.aim };
  });
  s.ok('겨누던 중 묶이면 풀린다', broken.was && broken.now === 0, JSON.stringify(broken));

  /* 부장 — 간섭 반경을 가진 유일한 일반 적이라 무리와 갈려야 한다.
     BODY 는 모듈 안이라 못 읽는다. 대신 실제로 구운 스프라이트 폭을 잰다. */
  const wide = await p.evaluate(() => {
    const w = k => {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      const x = c.getContext('2d');
      window.__bodyScale(x, k, 52, 48, 24, () => window.__icon && 0);
      return 1;
    };
    /* 그리기 경로 대신 몸 배율을 직접 본다 — bodyScale 이 BODY 를 쓴다 */
    const probe = k => {
      let sx = 1, sy = 1;
      const fake = { save(){}, restore(){}, translate(){},
                     scale(a,b){ sx = a; sy = b; } };
      window.__bodyScale(fake, k, 52, 0, 0, () => {});
      return [sx, sy];
    };
    return { staff:probe('staff'), gm:probe('gm'),
             hrteam:probe('hrteam'), vendor:probe('vendor') };
  });
  s.ok('부장이 사무직보다 눈에 띄게 넓다', wide.gm[0] >= wide.staff[0] * 1.35,
       JSON.stringify(wide));
  s.ok('부장이 사무직보다 크다', wide.gm[1] > wide.staff[1], JSON.stringify(wide));
  s.ok('원거리 둘이 서로 다른 체형이다',
       Math.abs(wide.hrteam[0] - wide.vendor[0]) > 0.3, JSON.stringify(wide));

  /* 빠른 적은 잔상을 남긴다 — 그리기가 터지지 않는지 */
  const trail = await p.evaluate(() => {
    const g = window.__g(), A = window.__api;
    g.foes.length = 0;
    A.spawnAt(g, 'rookie', g.P.x + 60, g.P.y);   // spd 190
    A.spawnAt(g, 'drunk',  g.P.x - 60, g.P.y);   // spd 145
    A.spawnAt(g, 'staff',  g.P.x, g.P.y + 60);   // spd 92 — 잔상 없음
    draw(g);
    return { fast: A.E.rookie.spd, slow: A.E.staff.spd };
  });
  s.ok('빠른 적과 느린 적의 기준이 갈린다', trail.fast >= 140 && trail.slow < 140,
       JSON.stringify(trail));

  s.eq('위협 읽기 검사 중 JS 에러 없음', p.errors.length, 0, p.errors.join(' / '));
  await p.close();
  return s;
}
