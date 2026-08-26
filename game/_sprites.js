/* _sprites.js — 출근 저지 벡터 스프라이트
   아트 디렉션: design/Units.dc.html, design/Foes.dc.html (「형광등 꺼진 사무실」)
   전 함수 시그니처: (ctx, cx, cy, s) — cx,cy 중심, s = 정사각 박스 한 변(px).
   순수 Canvas2D 패스만 사용. 이모지/텍스트/이미지 없음. */
(function () {
  "use strict";

  /* ── 팔레트 ── */
  var PAPER = "#f2f5fa", PAPER2 = "#dfe6f2", PAPER3 = "#c3ccdb";
  var G1 = "#98a4b8", G2 = "#74829a", G3 = "#5d6a7f", G4 = "#4c5769", INK = "#2f3542";
  var BLUE = "#9ec8ff", BLUE2 = "#6f9fd8";
  var YEL = "#f5c451", YEL2 = "#d9a94e";
  var RED = "#ff6b6b", DRED = "#b93b3b";
  var SKIN = "#e8d3bd", HAIR = "#2f3542";

  /* 둥근 사각형 패스 (roundRect 폴리필 불요) */
  function rr(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function frr(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = fill;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  }

  /* 72×72 디자인 좌표계로 진입 (Units.dc.html의 viewBox와 동일) */
  function in72(ctx, cx, cy, s) {
    ctx.save();
    ctx.translate(cx, cy);
    var k = s / 72;
    ctx.scale(k, k);
    ctx.translate(-36, -36);
  }

  /* ══════════ 설치 사물 (오른쪽을 향함) ══════════ */

  /* 정수기 — 흰 본체, 파란 물통, 파란 꼭지(오른쪽) */
  function water(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    frr(ctx, 20, 30, 32, 34, 3, PAPER2);          // 본체
    frr(ctx, 20, 30, 32, 8, 2, G1);               // 상단 밴드
    ctx.fillStyle = BLUE;                          // 거꾸로 꽂힌 물통
    ctx.beginPath();
    ctx.moveTo(28, 8); ctx.lineTo(44, 8);
    ctx.lineTo(41, 28); ctx.lineTo(31, 28);
    ctx.closePath(); ctx.fill();
    frr(ctx, 27, 4, 18, 6, 2, BLUE2);             // 물통 목
    frr(ctx, 38, 44, 8, 9, 2, BLUE2);             // 꼭지 — 진행 방향(오른쪽)
    ctx.restore();
  }

  /* 파티션 — 3단 접이식, 가운데가 가장 큼 */
  function wall(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    frr(ctx, 6, 18, 20, 42, 2, G3);
    frr(ctx, 46, 22, 18, 38, 2, G4);
    frr(ctx, 26, 12, 20, 48, 2, G2);
    ctx.restore();
  }

  /* 복사기 — 회색 몸통, 세워진 원고, 노란 배출 트레이(오른쪽) */
  function copy(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    frr(ctx, 10, 26, 48, 30, 4, PAPER3);          // 몸통
    frr(ctx, 10, 26, 48, 9, 3, G1);               // 상단 패널
    frr(ctx, 20, 8, 28, 18, 2, PAPER);            // 원고
    frr(ctx, 24, 13, 20, 2.5, 1, G1);
    frr(ctx, 24, 18, 14, 2.5, 1, G1);
    frr(ctx, 30, 44, 26, 14, 2, YEL);             // 배출 트레이 — 오른쪽
    ctx.restore();
  }

  /* 스테이플러 — 비스듬한 2단 몸체 + 파란 윗팔 */
  function stap(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    ctx.fillStyle = G4;                            // 받침
    ctx.beginPath();
    ctx.moveTo(8, 44); ctx.lineTo(56, 44);
    ctx.arcTo(61, 44, 61, 49, 5);
    ctx.lineTo(61, 55); ctx.lineTo(8, 55);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = G2;                            // 중간 몸체
    ctx.beginPath();
    ctx.moveTo(12, 26); ctx.lineTo(52, 26);
    ctx.arcTo(58, 26, 58, 32, 6);
    ctx.lineTo(58, 42); ctx.lineTo(12, 42);
    ctx.closePath(); ctx.fill();
    frr(ctx, 14, 18, 36, 8, 3, BLUE);             // 윗팔
    frr(ctx, 20, 46, 22, 4, 1, PAPER2);           // 심 배출구
    ctx.restore();
  }

  /* 사직서 — 흰 종이, 3줄 텍스트, 우하단 빨간 도장 */
  function quit(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    frr(ctx, 14, 6, 38, 52, 3, PAPER);
    frr(ctx, 21, 16, 24, 3, 1.5, G1);
    frr(ctx, 21, 24, 24, 3, 1.5, G1);
    frr(ctx, 21, 32, 16, 3, 1.5, G1);
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(44, 46, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2.4;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(40, 46); ctx.lineTo(43, 49); ctx.lineTo(49, 43);
    ctx.stroke();
    ctx.restore();
  }

  /* ══════════ 적 (왼쪽을 향해 걸어옴) ══════════ */
  /* 공통 몸: 발밑 그림자 + 몸통 라운드렉트 + 살색 머리 + 반원 머리카락.
     시선(눈 두 점)을 왼쪽으로 몰아 진행 방향을 표시. 소품도 왼쪽 손에. */

  function foeBase(ctx, torso, wide) {
    var tx = wide ? 18 : 22, tw = wide ? 40 : 32;   // 보스는 어깨가 넓다
    ctx.fillStyle = "rgba(0,0,0,.35)";               // 그림자
    ctx.beginPath();
    ctx.ellipse(38, 90, wide ? 24 : 21, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    frr(ctx, tx, 36, tw, 44, 9, torso);              // 몸통
    ctx.fillStyle = SKIN;                            // 머리
    ctx.beginPath(); ctx.arc(38, 22, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                            // 머리카락(윗 반원)
    ctx.beginPath(); ctx.arc(38, 20, 14, Math.PI, 0, false); ctx.closePath(); ctx.fill();
    ctx.fillStyle = INK;                             // 눈 — 왼쪽을 본다
    ctx.beginPath(); ctx.arc(29, 25, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(36, 25, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  /* 76×96 디자인 좌표계로 진입 (Foes.dc.html의 viewBox와 동일) */
  function makeFoe(torso, wide, prop) {
    return function (ctx, cx, cy, s) {
      ctx.save();
      ctx.translate(cx, cy);
      var k = s / 96;
      ctx.scale(k, k);
      ctx.translate(-38, -48);
      foeBase(ctx, torso, wide);
      if (prop) prop(ctx);
      ctx.restore();
    };
  }

  var foes = {
    /* 인턴 — 목걸이 사원증 */
    intern: makeFoe("#8b97ab", false, function (ctx) {
      frr(ctx, 30, 40, 16, 5, 2, G4);               // 스트랩 클립
      frr(ctx, 34, 44, 8, 14, 2, BLUE);             // 카드
    }),
    /* 사원 — 빨간 넥타이 */
    staff: makeFoe("#6d7d96", false, function (ctx) {
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.moveTo(38, 40); ctx.lineTo(43, 45); ctx.lineTo(38, 63); ctx.lineTo(33, 45);
      ctx.closePath(); ctx.fill();
    }),
    /* 대리 — 옆구리의 노란 서류철 (진행 방향 손) */
    senior: makeFoe("#5b7bab", false, function (ctx) {
      frr(ctx, 12, 50, 20, 16, 2, YEL);
      frr(ctx, 12, 50, 20, 4, 2, YEL2);
    }),
    /* 과장 — 앞에 든 운전대 */
    manager: makeFoe("#a8703f", false, function (ctx) {
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(38, 56, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(38, 56, 3, 0, Math.PI * 2); ctx.fill();
    }),
    /* 부장 — 어두운 서류가방 (진행 방향 손) */
    gm: makeFoe("#a04a4a", false, function (ctx) {
      frr(ctx, 15, 48, 8, 5, 2, INK);               // 손잡이
      frr(ctx, 8, 52, 22, 18, 3, INK);              // 가방
      ctx.fillStyle = "#1f232c";                    // 가방 이음선
      ctx.fillRect(8, 59, 22, 3);
    }),
    /* 회식조 — 치켜든 맥주잔 + 발그레한 볼 */
    drunk: makeFoe("#c99a3f", false, function (ctx) {
      frr(ctx, 16, 44, 14, 18, 2, YEL);             // 잔
      frr(ctx, 16, 44, 14, 5, 2, PAPER);            // 거품
      ctx.save();
      ctx.globalAlpha = 0.7; ctx.fillStyle = RED;    // 볼터치
      ctx.beginPath(); ctx.arc(30, 27, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(46, 27, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }),
    /* 점검단(보스) — 줄 그어진 흰 클립보드, 어깨 넓음 */
    audit: makeFoe(DRED, true, function (ctx) {
      frr(ctx, 6, 44, 24, 30, 2, PAPER);            // 보드
      frr(ctx, 6, 44, 24, 6, 2, G1);                // 클립
      ctx.fillStyle = G1;
      ctx.fillRect(11, 55, 14, 2.5);
      ctx.fillRect(11, 61, 14, 2.5);
      ctx.fillRect(11, 67, 9, 2.5);
    })
  };

  /* ══════════ 내 자리 — 옆에서 본 사무용 의자 (오른쪽을 향함) ══════════ */
  function seat(ctx, cx, cy, s) {
    in72(ctx, cx, cy, s);
    frr(ctx, 16, 8, 11, 34, 5, BLUE2);              // 등받이 (왼쪽 = 뒤)
    frr(ctx, 16, 36, 36, 11, 5, BLUE2);             // 좌판 — 오른쪽으로 열림
    frr(ctx, 30, 47, 7, 12, 2, G4);                 // 기둥
    frr(ctx, 16, 58, 36, 5, 2.5, G4);               // 다리
    ctx.fillStyle = INK;                            // 바퀴
    ctx.beginPath(); ctx.arc(20, 65, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(48, 65, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  window.SPRITES = {
    units: { water: water, wall: wall, copy: copy, stap: stap, quit: quit },
    foes: foes,
    seat: seat
  };
})();
