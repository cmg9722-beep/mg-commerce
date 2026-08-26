/* _rank_chars.js — 직급 캐릭터 스프라이트 (직장인 팩 적 교체판)
   기존 SPRITES.foes(다섯 직급 동일 체형 + 소품)를 대체하는 '진짜 캐릭터' 7종.
   전 함수 시그니처: (ctx, cx, cy, s) — cx,cy 중심, s = 정사각 박스 한 변(px).
   디자인 공간은 기존 직장인 적과 동일한 76×96 (k = s/96, 중심 38,48).
   순수 Canvas2D 패스만 사용. 이모지/텍스트/이미지 없음. save/restore 짝 맞춤.

   실루엣 원칙 — 직급은 몸으로 구분한다 (색은 보조):
   · intern  작고 좁고 웅크림 (소매가 손을 덮음)
   · staff   기준 체형 — 반듯한 보통 몸
   · senior  앞으로 기울음 + 가슴의 서류 더미
   · manager 어깨 넓고 가슴 폄 + 앞으로 치켜든 손가락
   · gm      압도적으로 크고 둥근 몸, 벗어진 머리
   · audit   (보스 68px) 곧고 뻣뻣한 기둥 + 치켜든 흰 클립보드
   · drunk   통째로 기울어진 몸 + 머리에 묶은 넥타이 + 치켜든 소주잔

   좌표 규칙:
   · y ≈ 13 위(52px 기준 중심−19px)는 부서 배지, y ≈ 81 아래는 HP바 영역 — 비워 둔다.
     보스(68px)는 y 21.5..73 안에 그린다.
   · 부서 소품(SPRITES_DEPT.office)이 왼쪽 가슴(x 2..29 / y 34..69)에 덧그려지고
     안전모가 머리(중심 y≈23) 위에 얹히므로, 정체성 표식(얼굴·치켜든 손·몸 폭)은
     그 바깥에 둔다. 머리 중심은 안전모가 어긋나지 않게 (35±3, 23±2)를 유지한다. */
(function () {
  "use strict";

  /* ── 팔레트 (직장인 팩과 공유) ── */
  var PAPER = "#f2f5fa", PAPER2 = "#dfe6f2", PAPER3 = "#c3ccdb";
  var G1 = "#98a4b8", G2 = "#74829a", G3 = "#5d6a7f", G4 = "#4c5769", INK = "#2f3542";
  var YEL = "#f5c451", YEL2 = "#d9a94e";
  var RED = "#ff6b6b", DRED = "#b93b3b";
  var SKIN = "#e8d3bd", HAIR = "#2f3542";

  /* ── 직급별 정장색 (기존 팩의 랭크 색을 계승) ── */
  var S_INTERN = "#a3adbd", S_INTERN2 = "#8791a3";   // 헐렁한 연회색
  var S_STAFF  = "#4a5670", S_STAFF2  = "#3b455c";   // 짙은 남색
  var S_SENIOR = "#5b7bab", S_SENIOR2 = "#49669177".slice(0, 7); // 청회색
  var S_MGR    = "#8e8577", S_MGR2    = "#736b5e";   // 따뜻한 회색
  var TIE_MGR  = "#e08a3c";                          // 과장 주황 타이
  var S_GM     = "#a04a4a", S_GM2     = "#7e3535";   // 부장 적갈색 (기존 유지)
  var S_AUDIT  = "#394050", S_AUDIT2  = "#2b3140";   // 점검단 근흑색
  var S_DRUNK  = "#6d7d96", S_DRUNK2  = "#59687f";   // 회식조 (사원급 정장)
  var AMBER    = "#c99a3f";                          // 회식조 앰버 포인트

  /* 둥근 사각형 패스 (다른 팩과 동일) */
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

  /* 76×96 디자인 좌표계 진입 (기존 직장인 적과 동일) */
  function inFoe(ctx, cx, cy, s) {
    ctx.save();
    ctx.translate(cx, cy);
    var k = s / 96;
    ctx.scale(k, k);
    ctx.translate(-38, -48);
  }

  /* 발밑 그림자 */
  function shadow(ctx, cx, rx, y) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /* 선 스타일 지정 (둥근 끝) */
  function pen(ctx, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
  }

  /* 구두 — 왼쪽(진행 방향)으로 코가 나온 신발 */
  function shoe(ctx, x, y, w) {
    frr(ctx, x, y, w, 4.6, 2.2, INK);
  }

  /* ══════════ 인턴 — 작고 좁고 웅크림, 소매가 손을 덮는다 ══════════ */
  function intern(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 35, 15, 77);
    /* 다리 — 짧고 좁은 종종걸음 */
    frr(ctx, 28.5, 58, 5.6, 14, 2.4, S_INTERN2);
    frr(ctx, 36.5, 58, 5.6, 14, 2.4, S_INTERN2);
    shoe(ctx, 25.5, 70.5, 9.5);
    shoe(ctx, 35.5, 70.5, 9.5);
    /* 몸통 — 좁은 어깨, 아래로 살짝 벌어진 큰 재킷 */
    ctx.fillStyle = S_INTERN;
    ctx.beginPath();
    ctx.moveTo(29, 37);
    ctx.quadraticCurveTo(24.5, 38.5, 24, 47);
    ctx.lineTo(23, 62); ctx.lineTo(47, 62); ctx.lineTo(46, 47);
    ctx.quadraticCurveTo(45.5, 38.5, 41, 37);
    ctx.closePath(); ctx.fill();
    /* 너무 긴 소매 — 손이 보이지 않는다 */
    frr(ctx, 23.5, 39, 6.4, 20, 3.2, S_INTERN2);
    frr(ctx, 40.5, 39, 6.4, 20, 3.2, S_INTERN2);
    /* 셔츠 깃 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(31, 37); ctx.lineTo(34, 41.5); ctx.lineTo(37, 37);
    ctx.closePath(); ctx.fill();
    /* 머리 — 숙이고 어깨 사이에 파묻힘 */
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(33, 29, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 앞머리 무거운 바가지
    ctx.beginPath();
    ctx.arc(33, 28, 9.5, Math.PI * 0.92, Math.PI * 2.02);
    ctx.closePath(); ctx.fill();
    frr(ctx, 24.5, 26, 5.5, 4.5, 2, HAIR);
    /* 얼굴 — 크게 뜬 눈이 옆(진행 방향)을 흘깃 */
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.ellipse(28.4, 30.6, 2.5, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(34.6, 30.6, 2.5, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(27.4, 31, 1.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(33.6, 31, 1.15, 0, Math.PI * 2); ctx.fill();
    pen(ctx, INK, 1.4);                            // 치켜올라간 눈썹
    ctx.beginPath();
    ctx.moveTo(26.4, 26.4); ctx.lineTo(30, 27.2);
    ctx.moveTo(32.6, 27.2); ctx.lineTo(36.2, 26.4);
    ctx.stroke();
    pen(ctx, INK, 1.5);                            // 오므린 입
    ctx.beginPath(); ctx.moveTo(29.6, 35.4); ctx.lineTo(32.4, 35.4); ctx.stroke();
    ctx.restore();
  }

  /* ══════════ 사원 — 기준 체형: 반듯하고 피곤한 보통 몸 ══════════ */
  function staff(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 37, 18, 78.5);
    /* 다리 — 평범한 걸음 */
    frr(ctx, 28.5, 58, 6.5, 15.5, 2.6, S_STAFF2);
    frr(ctx, 39, 58, 6.5, 15.5, 2.6, S_STAFF2);
    shoe(ctx, 25, 73, 11);
    shoe(ctx, 38, 73, 11);
    /* 몸통 — 단정한 남색 재킷 */
    frr(ctx, 25, 33, 24, 28, 7, S_STAFF);
    /* 팔 */
    frr(ctx, 24, 35.5, 6.6, 20, 3.3, S_STAFF2);
    frr(ctx, 43.5, 35.5, 6.6, 20, 3.3, S_STAFF2);
    ctx.fillStyle = SKIN;                          // 손
    ctx.beginPath(); ctx.arc(27.3, 57, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(46.8, 57, 2.4, 0, Math.PI * 2); ctx.fill();
    /* 셔츠 + 수수한 넥타이 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(31.5, 33); ctx.lineTo(35.5, 39); ctx.lineTo(39.5, 33);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = DRED;
    ctx.beginPath();
    ctx.moveTo(34, 36.5); ctx.lineTo(37, 36.5); ctx.lineTo(36.6, 46.5);
    ctx.lineTo(35.5, 48.5); ctx.lineTo(34.4, 46.5);
    ctx.closePath(); ctx.fill();
    /* 목 + 머리 */
    frr(ctx, 32.5, 30, 6, 5, 1.5, SKIN);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(35, 24.5, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 단정한 머리
    ctx.beginPath();
    ctx.arc(35, 23.6, 10.5, Math.PI * 0.97, Math.PI * 1.97);
    ctx.closePath(); ctx.fill();
    frr(ctx, 42, 22, 3.5, 7, 1.6, HAIR);           // 뒷머리
    /* 얼굴 — 무표정 + 다크서클 */
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(29.8, 25.8, 1.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(36.2, 25.8, 1.55, 0, Math.PI * 2); ctx.fill();
    pen(ctx, G2, 1.3);                             // 다크서클
    ctx.beginPath();
    ctx.moveTo(28.4, 28.6); ctx.lineTo(31.2, 28.6);
    ctx.moveTo(34.8, 28.6); ctx.lineTo(37.6, 28.6);
    ctx.stroke();
    pen(ctx, INK, 1.6);                            // 일자 입
    ctx.beginPath(); ctx.moveTo(30.6, 31.8); ctx.lineTo(35.4, 31.8); ctx.stroke();
    ctx.restore();
  }

  /* ══════════ 대리 — 앞으로 기울고, 서류 더미를 안고 있다 ══════════ */
  function senior(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 36, 19, 78.5);
    /* 다리 — 보폭이 큰 급한 걸음 (기울임 밖에서 그린다) */
    pen(ctx, S_SENIOR2, 6.4);
    ctx.beginPath(); ctx.moveTo(32, 59); ctx.lineTo(26.5, 71.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(41, 59); ctx.lineTo(46.5, 70.5); ctx.stroke();
    shoe(ctx, 21, 71.5, 11);
    shoe(ctx, 42.5, 70.5, 11);
    /* 상체 전체를 진행 방향으로 기울인다 */
    ctx.save();
    ctx.translate(36, 62); ctx.rotate(-0.11); ctx.translate(-36, -62);
    /* 몸통 — 사원보다 한 치수 큼 */
    frr(ctx, 24, 31.5, 26, 30, 7.5, S_SENIOR);
    /* 삐져나온 셔츠 자락 (한쪽만 빠짐) */
    frr(ctx, 41.5, 58.5, 8.5, 5, 2, PAPER);
    /* 뒤쪽 팔 */
    frr(ctx, 44, 34, 6.6, 18, 3.3, S_SENIOR2);
    /* 셔츠 + 느슨하게 풀린 비뚠 넥타이 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(30.5, 31.5); ctx.lineTo(35, 38); ctx.lineTo(39.5, 31.5);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(35.6, 36.5); ctx.rotate(0.34);   // 중심에서 빗나간 타이
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(-1.6, 0); ctx.lineTo(1.9, 0); ctx.lineTo(1.2, 9);
    ctx.lineTo(-0.2, 11); ctx.lineTo(-1.6, 8.6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* 가슴에 안은 서류철 더미 — 몸통을 반쯤 가린다 */
    frr(ctx, 15, 49.5, 24, 5.5, 1.5, YEL2);
    frr(ctx, 14, 44.5, 25, 5.5, 1.5, PAPER2);
    frr(ctx, 15.5, 39.5, 24, 5.5, 1.5, YEL);
    ctx.fillStyle = PAPER;                         // 삐져나온 낱장
    ctx.beginPath();
    ctx.moveTo(13, 47); ctx.lineTo(9.5, 50.5); ctx.lineTo(14, 51.5);
    ctx.closePath(); ctx.fill();
    /* 걷어붙인 앞쪽 팔뚝이 더미를 감싼다 */
    frr(ctx, 24.5, 33.5, 6.6, 10, 3.3, S_SENIOR2); // 윗팔(소매)
    pen(ctx, SKIN, 5);                             // 맨 팔뚝
    ctx.beginPath(); ctx.moveTo(27.5, 43.5); ctx.lineTo(20, 52); ctx.stroke();
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(19, 53, 2.6, 0, Math.PI * 2); ctx.fill();
    /* 목 + 머리 */
    frr(ctx, 31.5, 28.5, 6, 5, 1.5, SKIN);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(34, 23, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 흐트러진 머리 + 뻗친 올
    ctx.beginPath();
    ctx.arc(34, 22.2, 10.5, Math.PI * 0.95, Math.PI * 1.98);
    ctx.closePath(); ctx.fill();
    frr(ctx, 41, 20, 3.5, 7.5, 1.6, HAIR);
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(41.5, 16.5); ctx.lineTo(46.5, 14.5); ctx.lineTo(43.2, 19);
    ctx.closePath(); ctx.fill();
    /* 얼굴 — 몰린 눈썹, 말하다 만 입 */
    pen(ctx, INK, 1.6);                            // 눈썹 (가운데로 몰림)
    ctx.beginPath();
    ctx.moveTo(26.6, 22.6); ctx.lineTo(30, 24);
    ctx.moveTo(35.4, 24); ctx.lineTo(38.8, 22.6);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(28.8, 26.4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(35.2, 26.4, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();                               // 벌어진 입 (말하는 중)
    ctx.ellipse(31.6, 31.2, 2.1, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();                                 // 기울임 해제
    ctx.restore();
  }

  /* ══════════ 과장 — 어깨 펴고 턱 들고, 손가락으로 앞을 가리킨다 ══════════ */
  function manager(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 38, 20, 78.5);
    /* 다리 — 당당한 보폭 */
    frr(ctx, 28, 59, 7, 14.5, 2.8, S_MGR2);
    frr(ctx, 40.5, 59, 7, 14.5, 2.8, S_MGR2);
    shoe(ctx, 24, 73, 12);
    shoe(ctx, 39.5, 73, 12);
    /* 몸통 — 위가 넓고 가슴을 내민 사다리꼴 */
    ctx.fillStyle = S_MGR;
    ctx.beginPath();
    ctx.moveTo(24, 34);
    ctx.quadraticCurveTo(21.5, 42, 24.5, 52);
    ctx.quadraticCurveTo(26, 60, 29, 61);
    ctx.lineTo(47, 61);
    ctx.quadraticCurveTo(50.5, 54, 50.5, 44);
    ctx.quadraticCurveTo(50.5, 36, 48, 33.5);
    ctx.closePath(); ctx.fill();
    /* 뒤쪽 팔 — 뒷짐 느낌으로 몸에 붙임 */
    frr(ctx, 45, 35.5, 6.8, 19, 3.4, S_MGR2);
    /* 잠근 재킷 여밈 + 단추 */
    pen(ctx, S_MGR2, 1.6);
    ctx.beginPath(); ctx.moveTo(35.5, 41); ctx.lineTo(34.5, 60); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(34.9, 50, 1.2, 0, Math.PI * 2); ctx.fill();
    /* 셔츠 + 곧은 주황 타이 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(30.5, 33.5); ctx.lineTo(35, 40); ctx.lineTo(39.5, 33.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = TIE_MGR;
    ctx.beginPath();
    ctx.moveTo(33.4, 37); ctx.lineTo(36.6, 37); ctx.lineTo(36.2, 46.5);
    ctx.lineTo(35, 48.5); ctx.lineTo(33.8, 46.5);
    ctx.closePath(); ctx.fill();
    /* 치켜든 앞팔 — 손가락이 플레이어(왼쪽 위)를 가리킨다 */
    pen(ctx, S_MGR2, 6.6);
    ctx.beginPath();
    ctx.moveTo(26.5, 37.5); ctx.quadraticCurveTo(20, 36, 15.5, 30);
    ctx.stroke();
    ctx.fillStyle = SKIN;                          // 주먹
    ctx.beginPath(); ctx.arc(13.8, 28, 3, 0, Math.PI * 2); ctx.fill();
    pen(ctx, SKIN, 2.4);                           // 집게손가락
    ctx.beginPath(); ctx.moveTo(13, 27.4); ctx.lineTo(8, 24.6); ctx.stroke();
    /* 목 + 머리 — 턱을 든다 (머리를 살짝 뒤·위로) */
    frr(ctx, 33.5, 29.5, 6, 5, 1.5, SKIN);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(37, 23.5, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 넘긴 머리 (이마 넓게)
    ctx.beginPath();
    ctx.arc(37, 22.2, 10.5, Math.PI * 1.06, Math.PI * 2.02);
    ctx.closePath(); ctx.fill();
    frr(ctx, 44, 20, 3.6, 8, 1.7, HAIR);
    /* 얼굴 — 내리깐 눈 + 옅은 웃음. 시선은 아래(플레이어) */
    pen(ctx, INK, 1.9);                            // 반쯤 감긴 눈꺼풀
    ctx.beginPath();
    ctx.moveTo(29.6, 24.6); ctx.lineTo(33, 24.6);
    ctx.moveTo(36.4, 24.6); ctx.lineTo(39.8, 24.6);
    ctx.stroke();
    ctx.fillStyle = INK;                           // 눈꺼풀 아래 동공
    ctx.beginPath(); ctx.arc(30.8, 25.6, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(37.6, 25.6, 1.05, 0, Math.PI * 2); ctx.fill();
    pen(ctx, INK, 1.6);                            // 히죽 올라간 입꼬리
    ctx.beginPath();
    ctx.moveTo(31, 30.6); ctx.quadraticCurveTo(34, 32, 36.6, 29.6);
    ctx.stroke();
    ctx.restore();
  }

  /* ══════════ 부장 — 압도적으로 크고 무겁다. 벗어진 머리, 굳은 얼굴 ══════════ */
  function gm(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 38, 24, 78.5);
    /* 다리 — 짧고 굵게, 벌리고 딛는다 */
    frr(ctx, 24, 62, 8.5, 11, 3, S_GM2);
    frr(ctx, 43, 62, 8.5, 11, 3, S_GM2);
    shoe(ctx, 20, 72.5, 13.5);
    shoe(ctx, 42, 72.5, 13.5);
    /* 몸통 — 어깨부터 배까지 한 덩어리, 배가 앞(왼쪽)으로 나온다 */
    ctx.fillStyle = S_GM;
    ctx.beginPath();
    ctx.moveTo(22, 35);
    ctx.quadraticCurveTo(15, 44, 16, 55);
    ctx.quadraticCurveTo(17, 66, 28, 67);
    ctx.lineTo(50, 67);
    ctx.quadraticCurveTo(59, 65, 59.5, 53);
    ctx.quadraticCurveTo(60, 40, 54, 35);
    ctx.closePath(); ctx.fill();
    /* 팔 — 굵고 짧다 */
    frr(ctx, 16.5, 38, 8, 20, 4, S_GM2);
    frr(ctx, 51.5, 38, 8, 20, 4, S_GM2);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(20.8, 59.5, 2.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(55.6, 59.5, 2.7, 0, Math.PI * 2); ctx.fill();
    /* 당겨진 재킷 여밈 — 배에서 벌어져 셔츠가 보인다 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(33, 38); ctx.lineTo(38.5, 38); ctx.lineTo(33.5, 52);
    ctx.lineTo(31, 64); ctx.lineTo(27.5, 64); ctx.lineTo(30, 50);
    ctx.closePath(); ctx.fill();
    pen(ctx, S_GM2, 1.6);                          // 팽팽한 스트레스 주름
    ctx.beginPath();
    ctx.moveTo(30.5, 53); ctx.lineTo(24, 50);
    ctx.moveTo(29.5, 58); ctx.lineTo(23.5, 56.5);
    ctx.stroke();
    ctx.fillStyle = INK;                           // 버티는 단추
    ctx.beginPath(); ctx.arc(30.2, 55.5, 1.4, 0, Math.PI * 2); ctx.fill();
    /* 넥타이 — 배 위에 얹힘 */
    ctx.fillStyle = S_GM2;
    ctx.beginPath();
    ctx.moveTo(34, 38.5); ctx.lineTo(37.2, 38.5); ctx.lineTo(34.8, 48);
    ctx.lineTo(33.2, 49.8); ctx.lineTo(32.4, 47);
    ctx.closePath(); ctx.fill();
    /* 머리 — 목 없이 어깨에 얹힘, 크고 각진 턱 */
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(35, 26, 11.5, 0, Math.PI * 2); ctx.fill();
    frr(ctx, 26, 29, 18, 8, 3.5, SKIN);            // 무거운 턱·볼
    /* 벗어진 머리 + 빗어넘긴 몇 가닥 */
    ctx.fillStyle = HAIR;                          // 뒤통수에 남은 머리
    ctx.beginPath();
    ctx.arc(35, 25.5, 11.5, Math.PI * 1.72, Math.PI * 2.28);
    ctx.closePath(); ctx.fill();
    pen(ctx, HAIR, 1.5);                           // 컴오버 가닥
    ctx.beginPath();
    ctx.moveTo(43.5, 17.5); ctx.quadraticCurveTo(35, 13.8, 26.5, 17.5);
    ctx.moveTo(44, 20); ctx.quadraticCurveTo(35.5, 16.6, 27.5, 20.4);
    ctx.stroke();
    /* 얼굴 — 두꺼운 눈썹, 거의 감긴 눈, 처진 입 */
    pen(ctx, INK, 2.3);                            // 무거운 눈썹
    ctx.beginPath();
    ctx.moveTo(27.2, 23.4); ctx.lineTo(31.8, 24.4);
    ctx.moveTo(36.2, 24.4); ctx.lineTo(40.8, 23.4);
    ctx.stroke();
    pen(ctx, INK, 1.5);                            // 감긴 눈
    ctx.beginPath();
    ctx.moveTo(27.8, 27.2); ctx.lineTo(31.4, 27.2);
    ctx.moveTo(36.6, 27.2); ctx.lineTo(40.2, 27.2);
    ctx.stroke();
    pen(ctx, INK, 1.7);                            // 처진 입
    ctx.beginPath();
    ctx.moveTo(30.4, 33.6); ctx.quadraticCurveTo(33.6, 31.8, 36.6, 33.4);
    ctx.stroke();
    ctx.restore();
  }

  /* ══════════ 점검단(보스 68px) — 곧고 뻣뻣한 기둥. 표정이 없다 ══════════ */
  function audit(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 38, 17, 71.8);
    /* 다리 — 모으고 곧게 */
    frr(ctx, 31, 60, 6, 10.5, 1.2, S_AUDIT2);
    frr(ctx, 39, 60, 6, 10.5, 1.2, S_AUDIT2);
    frr(ctx, 28.5, 69.5, 9, 3.6, 1.4, INK);
    frr(ctx, 38.5, 69.5, 9, 3.6, 1.4, INK);
    /* 몸통 — 각진 어깨의 검은 기둥 (모서리 반경 최소) */
    frr(ctx, 27, 36, 22, 26, 2.5, S_AUDIT);
    /* 뒤쪽 팔 — 차렷 */
    frr(ctx, 45.5, 37.5, 5.8, 17, 2.2, S_AUDIT2);
    /* 셔츠 깃 + 목줄(랜야드) + ID 카드 */
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(34, 36); ctx.lineTo(37.5, 40); ctx.lineTo(41, 36);
    ctx.closePath(); ctx.fill();
    pen(ctx, PAPER3, 1.3);
    ctx.beginPath();
    ctx.moveTo(35, 37.5); ctx.lineTo(38.6, 45.5);
    ctx.moveTo(40, 37.5); ctx.lineTo(39.6, 45.5);
    ctx.stroke();
    frr(ctx, 36.4, 45.5, 6, 8, 1, PAPER);          // ID 카드
    frr(ctx, 37.4, 46.6, 4, 3.2, 0.8, G1);
    ctx.fillStyle = G2;
    ctx.fillRect(37.4, 51, 4, 1.2);
    /* 치켜든 클립보드 — 화면에서 가장 밝은 것 */
    frr(ctx, 27, 40, 5.5, 12, 2.6, S_AUDIT2);      // 앞팔 (board를 향해)
    pen(ctx, S_AUDIT2, 5);
    ctx.beginPath(); ctx.moveTo(29.5, 49); ctx.lineTo(22.5, 46); ctx.stroke();
    frr(ctx, 10.5, 33, 14.5, 19.5, 1.6, G3);       // 보드 등판
    frr(ctx, 12, 35, 11.5, 16, 1, PAPER);          // 종이
    frr(ctx, 15.2, 31.6, 6, 3.4, 1.4, G2);         // 클립
    ctx.fillStyle = G1;                            // 점검 항목 줄
    ctx.fillRect(14, 38.5, 7.5, 1.7);
    ctx.fillRect(14, 42, 7.5, 1.7);
    ctx.fillRect(14, 45.5, 5, 1.7);
    ctx.fillStyle = SKIN;                          // 보드를 쥔 손
    ctx.beginPath(); ctx.arc(21.5, 45.5, 2.4, 0, Math.PI * 2); ctx.fill();
    /* 목 + 머리 — 작고 곧다 */
    frr(ctx, 35, 33, 5.5, 4, 1.2, SKIN);
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(37.5, 29.5, 8.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 이마까지 내려온 단정한 머리
    ctx.beginPath();
    ctx.arc(37.5, 28.8, 8.2, Math.PI * 0.86, Math.PI * 2.06);
    ctx.closePath(); ctx.fill();
    frr(ctx, 43, 27, 3, 6.5, 1.4, HAIR);
    /* 얼굴 — 점 두 개. 입은 없다. 그 무표정이 위협이다 */
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(33.6, 31, 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(38.8, 31, 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ══════════ 회식조 — 통째로 기운 몸, 머리띠 넥타이, 치켜든 소주잔 ══════════ */
  function drunk(ctx, cx, cy, s) {
    inFoe(ctx, cx, cy, s);
    shadow(ctx, 36, 18, 78.5);
    /* 비틀거리는 다리 — 기울임 밖: 발은 땅에 있다 */
    pen(ctx, S_DRUNK2, 6.2);
    ctx.beginPath(); ctx.moveTo(33, 58); ctx.lineTo(24, 70.5); ctx.stroke();  // 앞으로 뻗은 다리
    ctx.beginPath(); ctx.moveTo(40, 58); ctx.lineTo(43.5, 71); ctx.stroke();
    shoe(ctx, 18.5, 70.5, 11);
    shoe(ctx, 40, 71, 11);
    /* 상체 전체가 뒤로 기운다 */
    ctx.save();
    ctx.translate(37, 62); ctx.rotate(0.15); ctx.translate(-37, -62);
    /* 몸통 */
    frr(ctx, 26, 33, 23, 28, 7, S_DRUNK);
    /* 흘러내린 재킷 — 앞쪽 어깨는 셔츠 바람 */
    frr(ctx, 24.5, 34.5, 8, 15, 3.5, PAPER);       // 드러난 셔츠 어깨·팔
    ctx.fillStyle = S_DRUNK2;                      // 팔꿈치에 걸린 재킷
    ctx.beginPath();
    ctx.moveTo(25, 47); ctx.quadraticCurveTo(22.5, 52, 24, 58);
    ctx.lineTo(30, 58); ctx.lineTo(30, 48);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = SKIN;                          // 앞손 (늘어짐)
    ctx.beginPath(); ctx.arc(27.8, 60, 2.4, 0, Math.PI * 2); ctx.fill();
    /* 잔을 치켜든 뒤쪽 팔 */
    pen(ctx, S_DRUNK2, 6.2);
    ctx.beginPath();
    ctx.moveTo(46, 38); ctx.quadraticCurveTo(52, 34, 54.5, 27);
    ctx.stroke();
    ctx.fillStyle = SKIN;                          // 손
    ctx.beginPath(); ctx.arc(55.5, 24.5, 2.9, 0, Math.PI * 2); ctx.fill();
    frr(ctx, 52.6, 15.5, 6.2, 8, 1.4, PAPER2);     // 소주잔
    frr(ctx, 53.6, 17, 4.2, 5, 1, PAPER);          // 찰랑이는 술
    /* 풀린 넥타이 자락 — 셔츠 위에 대롱 */
    ctx.save();
    ctx.translate(33.5, 35); ctx.rotate(0.5);
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(-1.5, 0); ctx.lineTo(1.8, 0); ctx.lineTo(1, 8.5);
    ctx.lineTo(-0.4, 10.5); ctx.lineTo(-1.7, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* 머리 — 넥타이 머리띠 */
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.arc(33, 24, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HAIR;                          // 부스스한 머리
    ctx.beginPath();
    ctx.arc(33, 22.6, 10.5, Math.PI * 1.02, Math.PI * 1.95);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = HAIR;                          // 뻗친 올
    ctx.beginPath();
    ctx.moveTo(27, 14.8); ctx.lineTo(24.5, 11.5); ctx.lineTo(29.5, 13.6);
    ctx.closePath(); ctx.fill();
    frr(ctx, 23.2, 19.6, 20, 4.4, 2.2, RED);       // 이마의 넥타이 밴드
    ctx.fillStyle = RED;                           // 휘날리는 밴드 자락
    ctx.beginPath();
    ctx.moveTo(42.5, 20); ctx.quadraticCurveTo(49, 17.5, 51.5, 13.8);
    ctx.lineTo(53.5, 17.5); ctx.quadraticCurveTo(48.5, 21.5, 43.5, 23.6);
    ctx.closePath(); ctx.fill();
    /* 얼굴 — 감긴 웃음눈, 발그레한 볼, 노래하는 입 */
    ctx.save();
    ctx.globalAlpha = 0.65; ctx.fillStyle = RED;
    ctx.beginPath(); ctx.arc(26.6, 28.8, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(37.4, 28.8, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    pen(ctx, INK, 1.7);                            // ∩∩ 감긴 눈
    ctx.beginPath();
    ctx.arc(28.2, 26.6, 2.3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(35.8, 26.6, 2.3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = INK;                           // 크게 벌린 입
    ctx.beginPath(); ctx.ellipse(31.6, 32.2, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = RED;                           // 목젖 대신 혀 끝
    ctx.beginPath(); ctx.ellipse(31.6, 34.4, 1.6, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();                                 // 기울임 해제
    ctx.restore();
  }

  window.SPRITES_RANK = {
    intern: intern, staff: staff, senior: senior, manager: manager,
    gm: gm, audit: audit, drunk: drunk
  };
})();
