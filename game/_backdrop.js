/* _backdrop.js — 「정시 퇴근」 필드 배경: 형광등 꺼진 심야 사무실 바닥
   아트 디렉션: design/README.md 「형광등 꺼진 사무실」(Fluorescent Night)

   위에서 수직으로 내려다본 오픈플랜 사무실. 카펫타일 바닥 위에 파티션으로
   둘러싼 책상 섬(4~6석)이 놓이고, 그 사이가 통로다. 천장 형광등은 대부분
   꺼져 있고 몇 개만 켜져 바닥에 푸른 빛 웅덩이를 남긴다. 무드는 전부
   빛 웅덩이가 담당하고, 가구는 스프라이트와 싸우지 않도록 저대비 실루엣.

   계약:
     window.BACKDROP = { office: fn }
     fn(ctx, W, H, camX, camY, t)
       ctx        게임 컨텍스트. 균등 스케일 변환 하에서도 동작(논리 px로만 그림)
       W, H       뷰포트 논리 픽셀 크기 (리사이즈 가능)
       camX, camY 뷰포트 좌상단의 월드 좌표 (screen = world - cam)
       t          경과 초 — 형광등 하나의 간헐적 깜빡임에만 사용

   규칙:
     · 대비 상한 #2a3444 (r42 g52 b68). 예외는 켜진 형광등 관과 직근 글로우뿐,
       화면의 몇 % 이하.
     · 구조 주기 528px(책상·카펫), 조명 변주 주기 1056px(2×2 블록 매크로 타일).
       매크로 타일을 최초 1회 오프스크린에 굽고 createPattern으로 채운다 —
       패턴 반복은 브라우저가 랩 샘플링하므로 이음새가 원리적으로 없다.
     · 매 프레임 라이브는 패턴 fill 1회 + 깜빡이 등 blit + 비네트 blit뿐.
     · 텍스트·이모지·이미지·외부 자원 없음. save/restore 짝 맞춤, 상태 누수 없음. */

(function () {
  "use strict";

  var BLOCK = 528;                 // 구조(가구) 주기
  var TS = BLOCK * 2;              // 매크로 타일 주기 = 1056 (조명 변주)
  var Q = 264;                     // 쿼드런트(등기구 그리드) 간격
  var CARPET = 66;                 // 카펫타일 한 변 (1056/66 = 16, 정확히 나눠떨어짐)

  /* 팔레트 — 전부 상한 #2a3444 이하 */
  var FLOOR = "#0b0e14";
  var FLOOR2 = "#0d1119";          // 카펫 체커 밝은 쪽
  var PART = "#1b2331";            // 파티션
  var DESK = "#151b26";
  var DESKEDGE = "#1d2534";
  var DARKOBJ = "#10141c";         // 모니터·의자 등 짙은 사물
  var LIT = [158, 200, 255];       // #9ec8ff 형광등 (악센트 1)

  function la(a) { return "rgba(" + LIT[0] + "," + LIT[1] + "," + LIT[2] + "," + a + ")"; }
  function m(a, n) { return ((a % n) + n) % n; }

  /* 결정적 난수 (mulberry32) — 타일은 언제 구워도 같아야 한다 */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var z = Math.imul(seed ^ seed >>> 15, 1 | seed);
      z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
  }

  function rr(c, x, y, w, h, r) {
    if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function frr(c, x, y, w, h, r, col) { c.fillStyle = col; rr(c, x, y, w, h, r); c.fill(); }

  /* ── 가구 ──────────────────────────────────────────────────── */

  /* 책상 섬 — 중앙 스파인을 사이에 두고 2열이 마주 봄. rows=2(4석) 또는 3(6석) */
  function cluster(c, cx, cy, rot, rows, rnd) {
    var DW = 80, DH = 62;                       // 책상 하나
    var ih = rows * DH;                         // 섬 높이
    c.save();
    c.translate(cx, cy);
    if (rot) c.rotate(Math.PI / 2);

    /* 파티션 — 어두운 외곽 헤일로 + 본체. 밝은 에지는 만들지 않는다 */
    c.lineWidth = 10; c.strokeStyle = "rgba(0,0,0,.30)";
    rr(c, -88, -ih / 2 - 8, 176, ih + 16, 10); c.stroke();
    c.lineWidth = 5; c.strokeStyle = PART;
    rr(c, -88, -ih / 2 - 8, 176, ih + 16, 10); c.stroke();

    /* 섬 내부 바닥을 아주 살짝 눌러 깊이 */
    c.fillStyle = "rgba(0,0,0,.14)";
    rr(c, -85, -ih / 2 - 5, 170, ih + 10, 8); c.fill();

    /* 중앙 케이블 스파인 */
    c.fillStyle = "#0f131c";
    c.fillRect(-3, -ih / 2, 6, ih);

    for (var col = 0; col < 2; col++) {
      var sgn = col === 0 ? -1 : 1;
      for (var row = 0; row < rows; row++) {
        var x0 = sgn < 0 ? -DW : 0;
        var y0 = -ih / 2 + row * DH;
        var yc = y0 + DH / 2;
        /* 상판 */
        frr(c, x0 + 3, y0 + 3, DW - 6, DH - 6, 4, DESK);
        c.lineWidth = 1; c.strokeStyle = DESKEDGE;
        rr(c, x0 + 3, y0 + 3, DW - 6, DH - 6, 4); c.stroke();
        /* 모니터 — 위에서 보면 스파인과 평행한 얇은 슬래브 + 스탠드 */
        var mx = sgn < 0 ? -20 : 14;
        frr(c, mx, yc - 15, 6, 30, 2, DARKOBJ);
        c.fillStyle = "#0c0f16";
        c.fillRect(sgn < 0 ? mx + 6 : mx - 5, yc - 3, 5, 6);
        /* 키보드 */
        frr(c, sgn < 0 ? -48 : 34, yc - 12, 14, 24, 2, "#10161f");
        /* 잡동사니 — 자리마다 조금씩 다르게 */
        var d = rnd();
        if (d < 0.38) {                          // 서류 더미
          c.save();
          c.translate(sgn < 0 ? -66 : 62, yc + (rnd() - 0.5) * 20);
          c.rotate((rnd() - 0.5) * 0.5);
          frr(c, -6, -8, 12, 16, 1, "#212938");
          c.fillStyle = "#1a2130"; c.fillRect(-6, -8, 12, 3);
          c.restore();
        } else if (d < 0.62) {                   // 머그컵
          c.fillStyle = "#1d2431";
          c.beginPath();
          c.arc(sgn < 0 ? -62 : 62, yc + (rnd() - 0.5) * 26, 3.5, 0, Math.PI * 2);
          c.fill();
        }
        /* 의자 — 책상 바깥쪽에 반쯤 밀어 넣음 */
        var chx = sgn * (72 + rnd() * 8), chy = yc + (rnd() - 0.5) * 12;
        c.fillStyle = DARKOBJ;
        c.beginPath(); c.arc(chx, chy, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#151a24";                 // 등받이 호
        c.beginPath();
        c.arc(chx, chy, 10, sgn < 0 ? -2.2 : 0.94, sgn < 0 ? 2.2 : 5.34);
        c.arc(chx, chy, 6.2, sgn < 0 ? 2.2 : 5.34, sgn < 0 ? -2.2 : 0.94, true);
        c.fill();
      }
    }
    c.restore();
  }

  /* ── 소품 (전부 위에서 본 모습, 저대비) ─────────────────────── */

  function printer(c, x, y, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    frr(c, -24, -17, 48, 34, 5, "#1a212e");
    frr(c, -18, -11, 36, 10, 2, "#10151e");     // 급지 트레이
    frr(c, -14, 3, 28, 9, 2, "#232b3a");        // 배지 용지
    c.restore();
  }
  function cooler(c, x, y) {
    c.save(); c.translate(x, y);
    frr(c, -12, -12, 24, 24, 6, "#141a24");     // 본체
    c.fillStyle = "#1d2836";                    // 물통
    c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#141c28";
    c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function plant(c, x, y, rnd) {
    c.save(); c.translate(x, y);
    c.fillStyle = "#1f1a15";                    // 화분
    c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#14211b";                    // 잎 — 위에서 본 로제트
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2 + rnd() * 0.5;
      c.save(); c.rotate(a);
      c.beginPath(); c.ellipse(8, 0, 8, 3.4, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.fillStyle = "#182a20";
    c.beginPath(); c.arc(0, 0, 4.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function pillar(c, x, y) {                    // 기둥 + 화이트보드
    c.save(); c.translate(x, y);
    c.fillStyle = "rgba(0,0,0,.28)";
    c.fillRect(-17, -17, 34, 34);
    c.fillStyle = "#161b25";
    c.fillRect(-14, -14, 28, 28);
    frr(c, -11, 12, 22, 6, 2, "#262e3c");       // 보드 (위에서 본 두께)
    c.restore();
  }
  function boxes(c, x, y, rnd) {                // 박스 더미
    c.save(); c.translate(x, y);
    for (var i = 0; i < 3; i++) {
      c.save();
      c.translate((rnd() - 0.5) * 22, (rnd() - 0.5) * 22);
      c.rotate((rnd() - 0.5) * 0.9);
      var s = 15 + rnd() * 8;
      frr(c, -s / 2, -s / 2, s, s, 2, "#1f1a13");
      c.fillStyle = "#2a2419";                  // 테이프
      c.fillRect(-s / 2, -1.5, s, 3);
      c.restore();
    }
    c.restore();
  }
  var PROPS = [printer, cooler, plant, pillar, boxes];

  /* ── 형광등 ────────────────────────────────────────────────── */

  /* 꺼진 등기구 — 거의 안 보이는 하우징 */
  function darkFixture(c, x, y, horiz) {
    c.save(); c.translate(x, y);
    if (!horiz) c.rotate(Math.PI / 2);
    frr(c, -62, -10, 124, 20, 3, "#10141b");
    c.fillStyle = "#151b26";                    // 꺼진 관 2개
    c.fillRect(-56, -6, 112, 4);
    c.fillRect(-56, 2, 112, 4);
    c.restore();
  }

  /* 켜진 등 스프라이트 — 264×264 캔버스 1장에 구워 재사용 (베이크·깜빡이 공용) */
  var litSprite = null;
  function getLitSprite(horiz) {
    if (litSprite) return litSprite;
    var cv = document.createElement("canvas");
    cv.width = 264; cv.height = 264;
    var c = cv.getContext("2d");
    c.save(); c.translate(132, 132);
    /* 바닥 빛 웅덩이 — 상한 아래에 머무는 저알파, 관 방향으로 긴 타원 */
    var g = c.createRadialGradient(0, 0, 6, 0, 0, 126);
    g.addColorStop(0, la(0.10));
    g.addColorStop(0.55, la(0.05));
    g.addColorStop(1, la(0));
    c.fillStyle = g;
    c.save(); c.scale(1, 0.76);
    c.beginPath(); c.arc(0, 0, 126, 0, Math.PI * 2); c.fill();
    c.restore();
    /* 직근 글로우 (허용 예외, 소면적) */
    var g2 = c.createRadialGradient(0, 0, 2, 0, 0, 46);
    g2.addColorStop(0, la(0.34));
    g2.addColorStop(1, la(0));
    c.fillStyle = g2;
    c.save(); c.scale(1.6, 0.62);
    c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.fill();
    c.restore();
    /* 하우징 + 켜진 관 */
    frr(c, -62, -10, 124, 20, 3, "#151b28");
    c.fillStyle = "#8fb4e0";
    c.fillRect(-56, -6, 112, 4);
    c.fillRect(-56, 2, 112, 4);
    c.fillStyle = "#cfe4ff";                    // 코어
    c.fillRect(-52, -5, 104, 2);
    c.fillRect(-52, 3, 104, 2);
    c.restore();
    litSprite = cv;
    return litSprite;
  }

  /* 켜진 등 위치 — 매크로(4×4 쿼드런트) 안에서 3개, 그중 1개가 깜빡이 담당.
     쿼드런트 중심에서 반사거리 132 ≥ 스프라이트 반폭 132 → 매크로 밖으로
     삐져나가지 않아 랩 패스 없이도 이음새가 없다. */
  var LIT_Q = [[1, 1], [3, 2]];                 // 상시 점등 (베이크)
  var FLICK_Q = [0, 3];                         // 깜빡이 (라이브)
  var FLICK_X = FLICK_Q[0] * Q + 132;
  var FLICK_Y = FLICK_Q[1] * Q + 132;

  /* 깜빡임 — 125ms 슬롯 해시. 거의 항상 1(정지 화면과 동일),
     3~4초에 한 번 짧게 주저앉았다가 돌아온다. */
  function flickLevel(t) {
    var q = Math.floor(t * 8);
    var r = Math.sin(q * 127.1) * 43758.5453;
    r -= Math.floor(r);
    if (r > 0.972) return 0.22 + 0.4 * ((r * 57.31) % 1);
    if (r > 0.952) return 0.75;
    return 1;
  }

  /* ── 매크로 타일 베이크 (1056×1056, 최초 1회) ───────────────── */

  var baked = null;                             // { cv, pattern }
  function getTile() {
    if (baked) return baked;
    var cv = document.createElement("canvas");
    cv.width = TS; cv.height = TS;
    var c = cv.getContext("2d");
    var i, j, x, y;

    /* 1. 바닥 + 카펫타일 체커 */
    c.fillStyle = FLOOR; c.fillRect(0, 0, TS, TS);
    c.fillStyle = FLOOR2;
    for (j = 0; j < TS / CARPET; j++)
      for (i = 0; i < TS / CARPET; i++)
        if ((i + j) & 1) c.fillRect(i * CARPET, j * CARPET, CARPET, CARPET);
    c.strokeStyle = "rgba(120,150,200,.045)"; c.lineWidth = 1;
    c.beginPath();
    for (i = 0; i <= TS / CARPET; i++) {
      c.moveTo(i * CARPET + 0.5, 0); c.lineTo(i * CARPET + 0.5, TS);
      c.moveTo(0, i * CARPET + 0.5); c.lineTo(TS, i * CARPET + 0.5);
    }
    c.stroke();

    /* 2. 카펫 얼룩 — 결정적 배치, 반경 ≤ 안쪽 여백이라 랩 불필요 */
    var rd = rng(0x5eed);
    for (i = 0; i < 26; i++) {
      x = 130 + rd() * (TS - 260); y = 130 + rd() * (TS - 260);
      var rad = 40 + rd() * 80;
      var dark = rd() < 0.68;
      var gg = c.createRadialGradient(x, y, 0, x, y, rad);
      gg.addColorStop(0, dark ? "rgba(0,0,0,.05)" : la(0.018));
      gg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gg;
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }

    /* 3. 통로 — 쿼드런트 경계선을 따라 살짝 닳은 카펫 (그리드에 정렬 → 이음새 없음) */
    c.fillStyle = "rgba(0,0,0,.055)";
    for (i = 0; i < 4; i++) {
      c.fillRect(m(i * Q - 20, TS), 0, 40, TS);
      c.fillRect(0, m(i * Q - 20, TS), TS, 40);
    }

    /* 4. 블록 4개 — 같은 문법, 다른 배치의 가구 */
    for (var bj = 0; bj < 2; bj++)
      for (var bi = 0; bi < 2; bi++) {
        var rb = rng(0xA11CE + bi * 7 + bj * 131);
        c.save();
        c.translate(bi * BLOCK, bj * BLOCK);
        /* 쿼드런트 4곳 중 2~3곳에 책상 섬, 나머지에 소품/공터 */
        var order = [0, 1, 2, 3];
        for (i = 3; i > 0; i--) { j = (rb() * (i + 1)) | 0; var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
        var nClu = 2 + (rb() < 0.5 ? 1 : 0);
        for (var qi = 0; qi < 4; qi++) {
          var qq = order[qi];
          var qx = (qq & 1) * Q + 132, qy = (qq >> 1) * Q + 132;
          if (qi < nClu) {
            cluster(c, qx, qy, rb() < 0.5, rb() < 0.45 ? 2 : 3, rb);
          } else if (rb() < 0.8) {
            var p = PROPS[(rb() * PROPS.length) | 0];
            p(c, qx + (rb() - 0.5) * 90, qy + (rb() - 0.5) * 90, rb);
            if (rb() < 0.35) {
              p = PROPS[(rb() * PROPS.length) | 0];
              p(c, qx + (rb() - 0.5) * 130, qy + (rb() - 0.5) * 130, rb);
            }
          }
        }
        c.restore();
      }

    /* 5. 천장 등기구 — 16개 전부 하우징, 그중 LIT_Q 2개만 점등 베이크.
       깜빡이 자리는 하우징만 굽고 점등은 매 프레임 라이브로 얹는다. */
    var lit = getLitSprite();
    for (j = 0; j < 4; j++)
      for (i = 0; i < 4; i++) {
        x = i * Q + 132; y = j * Q + 132;
        darkFixture(c, x, y, ((i + j) & 1) === 0);
        for (var k = 0; k < LIT_Q.length; k++)
          if (LIT_Q[k][0] === i && LIT_Q[k][1] === j)
            c.drawImage(lit, x - 132, y - 132);
      }

    var pat = c.createPattern(cv, "repeat");
    baked = { cv: cv, pattern: pat };
    return baked;
  }

  /* ── 비네트 (뷰포트 크기별 캐시, 최대 4개) ───────────────────── */
  var vigCache = {}, vigKeys = [];
  function getVig(W, H) {
    var key = W + "x" + H;
    if (vigCache[key]) return vigCache[key];
    var cv = document.createElement("canvas");
    cv.width = Math.max(1, W); cv.height = Math.max(1, H);
    var c = cv.getContext("2d");
    var R = Math.hypot(W, H) / 2;
    var g = c.createRadialGradient(W / 2, H / 2, R * 0.42, W / 2, H / 2, R * 1.02);
    g.addColorStop(0, "rgba(4,7,12,0)");
    g.addColorStop(1, "rgba(4,7,12,.42)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    vigCache[key] = cv; vigKeys.push(key);
    if (vigKeys.length > 4) delete vigCache[vigKeys.shift()];
    return cv;
  }

  /* ── 매 프레임 ─────────────────────────────────────────────── */
  function office(ctx, W, H, camX, camY, t) {
    var tile = getTile();

    /* rush.html은 ZOOM(≥1.15) 스케일 변환 아래에서 줌 미적용 VW/VH를 넘긴다.
       채우기는 W×H로 해도 안전하게 넘치지만(잘림), 화면 고정인 비네트는
       실제 보이는 논리 영역에 맞춰야 중심이 플레이어에 온다. */
    var effW = W, effH = H;
    try {
      var tr = ctx.getTransform();
      if (tr && tr.a > 0 && tr.d > 0 && ctx.canvas) {
        effW = Math.min(W, ctx.canvas.width / tr.a);
        effH = Math.min(H, ctx.canvas.height / tr.d);
      }
    } catch (e) { /* getTransform 미지원 환경 — W/H 그대로 */ }

    ctx.save();
    /* 베이스 레이어의 책임 — 이전 프레임이 남긴 합성 상태에 흔들리지 않는다.
       restore가 호출자 상태를 그대로 되돌린다. */
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    /* 바닥 — 패턴 원점을 월드 그리드에 맞춰 뷰포트 전체를 1회 채움 */
    var ox = -m(camX, TS), oy = -m(camY, TS);
    ctx.translate(ox, oy);
    ctx.fillStyle = tile.pattern;
    ctx.fillRect(-ox, -oy, W, H);
    ctx.translate(-ox, -oy);

    /* 깜빡이 형광등 — 보이는 매크로 인스턴스마다 라이브로 */
    var lv = flickLevel(t);
    if (lv > 0.004) {
      var spr = getLitSprite();
      var i0 = Math.floor((camX + FLICK_X - 132) / TS) - 1;
      var i1 = Math.floor((camX + W - FLICK_X + 132) / TS) + 1;
      var j0 = Math.floor((camY + FLICK_Y - 132) / TS) - 1;
      var j1 = Math.floor((camY + H - FLICK_Y + 132) / TS) + 1;
      ctx.globalAlpha = lv;
      for (var j = j0; j <= j1; j++)
        for (var i = i0; i <= i1; i++) {
          var sx = i * TS + FLICK_X - 132 - camX;
          var sy = j * TS + FLICK_Y - 132 - camY;
          if (sx > W || sy > H || sx + 264 < 0 || sy + 264 < 0) continue;
          ctx.drawImage(spr, sx, sy);
        }
      ctx.globalAlpha = 1;
    }

    /* 비네트 — 시선을 중앙(플레이어)으로. 실제 가시 영역 크기로 */
    ctx.drawImage(getVig(Math.round(effW), Math.round(effH)), 0, 0);

    ctx.restore();
  }

  window.BACKDROP = { office: office };
})();
