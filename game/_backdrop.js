/* _backdrop.js — 「출근 저지」 서바이버즈 필드 배경 레이어
   아트 디렉션: design/README.md 「형광등 꺼진 사무실」(Fluorescent Night)

   위에서 내려다본 심야 오픈플랜 사무실 바닥. 플레이어가 자유롭게 뛰어다니고
   적이 사방에서 몰려온다. 형광등은 대부분 꺼져 있고, 몇 개만 켜져
   바닥에 부드러운 빛 웅덩이를 남긴다. 화면은 카메라를 따라 무한 스크롤.

   계약:
     window.BACKDROP = { office: fn, school: fn }
     fn(ctx, W, H, camX, camY, t)
       ctx        항등 변환 상태로 들어오고, 그대로 돌려준다
       W, H       뷰포트 픽셀 크기
       camX, camY 카메라 월드 좌표 (일관되게만 쓰면 원점/중심 어느 관례든 무방 —
                  무한 타일이라 평행이동 차이일 뿐이다)
       t          경과 초 — 깜빡이 등 하나에만 쓴다

   규칙:
     · 배경 상한 #2a3444 (휘도 ~51). 예외는 켜진 형광등 관과 직근 글로우뿐.
     · 스프라이트가 어디든 설 수 있으므로 강한 에지를 어디에도 두지 않는다.
       가구는 전부 저대비 실루엣, 무드는 빛 웅덩이가 담당한다.
     · 월드 타일(1056px 주기, 내부 528px 블록 4개가 서로 다름)을 최초 1회
       오프스크린에 굽고, 매 프레임은 격자 blit + 깜빡이 등 1개 + 비네트만.
     · 이음새 없음: 바닥 격자는 타일을 정확히 나누고, 소품·빛·꺼진 등은
       각각 3×3 랩 패스로 오름차순 합성해 경계 양쪽이 동일하게 겹친다.
     · 텍스트·이모지·이미지·외부 자원 없음. save/restore 짝 맞춤, 상태 누수 없음. */

(function () {
  "use strict";

  var TS = 1056;                       // 월드 타일 주기 (264px 조명 그리드 × 4)
  var FIX = 264;                       // 등기구 간격
  var LIT = [158, 200, 255];           // #9ec8ff — 형광등 빛

  var tileCache = {};                  // pack -> {cv, flick, poolMul}
  var vigCache = {};                   // "WxH" -> canvas
  var vigKeys = [];

  function la(a) { return "rgba(" + LIT[0] + "," + LIT[1] + "," + LIT[2] + "," + a + ")"; }
  function m(a, n) { return ((a % n) + n) % n; }

  /* 결정적 난수 — 랩 패스 9회가 완전히 같은 배치를 그려야 한다 */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var z = Math.imul(seed ^ seed >>> 15, 1 | seed);
      z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    };
  }

  /* 깜빡임 — 125ms 슬롯 해시. 대부분 1(정지 화면과 동일), 3~4초에 한 번 짧게 주저앉는다. */
  function flickLevel(t) {
    var q = Math.floor(t * 8);
    var r = Math.sin(q * 127.1) * 43758.5453;
    r -= Math.floor(r);
    if (r > 0.972) return 0.25 + 0.4 * ((r * 57.31) % 1);
    if (r > 0.955) return 0.78;
    return 1;
  }

  /* ── 조명 ─────────────────────────────────────────────────
     켜진 등: 바닥 빛 웅덩이(길쭉한 타원) + 관 자체. 관만 상한 초과, 면적 최소. */
  function drawLitTop(c, cx, cy, w, h, level, poolMul) {
    if (level <= 0.02) return;
    c.save();

    c.save();                                       // 빛 웅덩이 — 관 방향으로 길쭉
    c.translate(cx, cy); c.scale(1.6, 1.05);
    var R = w * 1.15;
    var g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, la(0.075 * level * poolMul));
    g.addColorStop(1, la(0));
    c.fillStyle = g; c.fillRect(-R, -R, R * 2, R * 2);
    g = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
    g.addColorStop(0, la(0.055 * level * poolMul));
    g.addColorStop(1, la(0));
    c.fillStyle = g; c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();

    c.fillStyle = la(0.28 * level);                 // 관 주위 할로
    c.fillRect(cx - w / 2 - 3, cy - h / 2 - 3, w + 6, h + 6);
    c.globalAlpha = 0.95 * level;                   // 형광관 두 줄 — 유일한 밝은 곳
    c.fillStyle = "#cfe4ff";
    c.fillRect(cx - w / 2, cy - h / 2, w, h * 0.32);
    c.fillRect(cx - w / 2, cy + h / 2 - h * 0.32, w, h * 0.32);
    c.restore();
  }

  /* 꺼진 등 — 천장에 매달린 어두운 직사각형. 바닥 위 실루엣으로만 읽힌다. */
  function drawDarkTop(c, cx, cy, w, h) {
    c.save();
    c.fillStyle = "rgba(7,10,15,0.55)";
    c.fillRect(cx - w / 2, cy - h / 2, w, h);
    c.strokeStyle = "rgba(26,33,46,0.5)"; c.lineWidth = 1;
    c.strokeRect(cx - w / 2, cy - h / 2, w, h);
    c.fillStyle = "rgba(20,26,34,0.8)";
    c.fillRect(cx - w / 2 + 2, cy - h * 0.34, w - 4, h * 0.2);
    c.fillRect(cx - w / 2 + 2, cy + h * 0.14, w - 4, h * 0.2);
    c.restore();
  }

  /* ── 소품 (전부 위에서 본 모습, 전부 저대비) ─────────────── */

  function chair(c, x, y) {
    c.save();
    c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2);
    c.fillStyle = "#0e1218"; c.fill();
    c.strokeStyle = "rgba(24,30,42,0.6)"; c.lineWidth = 1; c.stroke();
    c.restore();
  }

  /* 책상 하나 — dir=1이면 왼쪽 열(오른쪽의 스파인을 본다), -1이면 미러 */
  function desk(c, x, y, dir, r) {
    c.save();
    c.translate(x, y); c.scale(dir, 1);
    c.fillStyle = "#131820"; c.fillRect(-37, -21, 74, 42);
    c.strokeStyle = "rgba(26,33,46,0.6)"; c.lineWidth = 1;
    c.strokeRect(-37, -21, 74, 42);
    c.fillStyle = "#0a0d12";                        // 모니터 — 스파인 쪽
    c.fillRect(28, -10, 6, 20);
    c.fillStyle = "#10141c";                        // 키보드
    c.fillRect(8, -8, 10, 16);
    c.beginPath(); c.arc(20, 12, 1.6, 0, Math.PI * 2); c.fill();   // 마우스
    if (r() < 0.35) {                               // 어질러진 서류
      c.save();
      c.translate(-14, -6 + r() * 10); c.rotate((r() - 0.5) * 0.5);
      c.fillStyle = "#1a222e"; c.fillRect(-7, -5, 14, 10);
      c.fillStyle = "#1e2733"; c.fillRect(-5, -7, 14, 10);
      c.restore();
    }
    c.restore();
    chair(c, x - dir * 51, y + (r() - 0.5) * 10);
  }

  /* 책상 섬 — 2×2, 낮은 파티션 테두리 */
  function deskCluster(c, x, y, rot, r) {
    c.save();
    c.translate(x, y); c.rotate(rot);
    c.strokeStyle = "#1a2130"; c.lineWidth = 2;
    if (c.roundRect) { c.beginPath(); c.roundRect(-86, -52, 172, 104, 6); c.stroke(); }
    else c.strokeRect(-86, -52, 172, 104);
    c.beginPath(); c.moveTo(0, -50); c.lineTo(0, 50); c.stroke();   // 스파인
    desk(c, -40, -24, 1, r); desk(c, -40, 24, 1, r);
    desk(c, 40, -24, -1, r); desk(c, 40, 24, -1, r);
    c.restore();
  }

  function plant(c, x, y, r) {
    c.save();
    c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2);
    c.fillStyle = "#141922"; c.fill();
    c.strokeStyle = "rgba(30,38,52,0.6)"; c.lineWidth = 1; c.stroke();
    for (var i = 0; i < 6; i++) {
      var a = i * 1.05 + r() * 0.6, d = 3 + r() * 5;
      c.beginPath();
      c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 4 + r() * 4, 0, Math.PI * 2);
      c.fillStyle = i % 2 ? "#142016" : "#182a1e"; c.fill();
    }
    c.restore();
  }

  function printer(c, x, y) {
    c.save();
    c.fillStyle = "#12171f"; c.fillRect(x - 18, y - 14, 36, 28);
    c.strokeStyle = "rgba(28,36,50,0.6)"; c.lineWidth = 1;
    c.strokeRect(x - 18, y - 14, 36, 28);
    c.fillStyle = "#0d1118"; c.fillRect(x - 14, y - 10, 28, 14);
    c.fillStyle = "#1a212c"; c.fillRect(x - 12, y + 7, 24, 4);
    c.fillStyle = "rgba(87,217,138,0.5)";           // 대기 LED — 밤의 작은 점
    c.fillRect(x + 13, y - 12, 2, 2);
    c.restore();
  }

  function waterCooler(c, x, y) {
    c.save();
    c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2);
    c.fillStyle = "#10151d"; c.fill();
    c.strokeStyle = "rgba(28,36,50,0.6)"; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(x, y, 5.5, 0, Math.PI * 2);
    c.fillStyle = "#16202e"; c.fill();
    c.strokeStyle = la(0.07); c.beginPath();
    c.arc(x, y, 5.5, -2.4, -1.1); c.stroke();       // 물통에 스민 희미한 빛
    c.restore();
  }

  function pillarBoard(c, x, y, r) {
    c.save();
    c.fillStyle = "#0f131b"; c.fillRect(x - 13, y - 13, 26, 26);
    c.strokeStyle = "#1a2130"; c.lineWidth = 1.5;
    c.strokeRect(x - 13, y - 13, 26, 26);
    c.fillStyle = "#1c2430";                        // 화이트보드 — 불 꺼져 어둡다
    c.fillRect(x - 17, y - 18, 34, 6);
    c.strokeStyle = "rgba(125,150,185,0.07)"; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - 13, y - 15);
    c.quadraticCurveTo(x - 4, y - 17 + r() * 3, x + 5, y - 15);
    c.lineTo(x + 12, y - 15.5);
    c.stroke();
    c.restore();
  }

  function cableTray(c, x, y, vert) {
    c.save();
    c.translate(x, y); if (vert) c.rotate(Math.PI / 2);
    c.fillStyle = "#0a0d12"; c.fillRect(-70, -3, 140, 6);
    c.strokeStyle = "rgba(24,31,44,0.5)"; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-70, -3); c.lineTo(70, -3);
    c.moveTo(-70, 3); c.lineTo(70, 3);
    c.stroke();
    c.restore();
  }

  /* ── 학교 소품 ──────────────────────────────────────────── */

  function schoolDeskBlock(c, x, y, r) {
    c.save();
    c.translate(x, y);
    for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
      var dx = i * 44 + (r() - 0.5) * 5, dy = j * 42 + (r() - 0.5) * 5;
      c.fillStyle = "#12161e"; c.fillRect(dx - 13, dy - 10, 26, 20);
      c.strokeStyle = "rgba(26,33,46,0.55)"; c.lineWidth = 1;
      c.strokeRect(dx - 13, dy - 10, 26, 20);
      c.beginPath(); c.arc(dx, dy + 16, 6, 0, Math.PI * 2);
      c.fillStyle = "#0e1218"; c.fill();
    }
    c.restore();
  }

  function teacherPlatform(c, x, y) {
    c.save();
    c.fillStyle = "#11151d"; c.fillRect(x - 65, y - 27, 130, 54);
    c.strokeStyle = "rgba(28,36,50,0.5)"; c.lineWidth = 1.5;
    c.strokeRect(x - 65, y - 27, 130, 54);
    c.fillStyle = "#141922"; c.fillRect(x - 23, y - 11, 46, 22);
    c.strokeStyle = "rgba(30,38,52,0.6)"; c.lineWidth = 1;
    c.strokeRect(x - 23, y - 11, 46, 22);
    c.restore();
  }

  function piano(c, x, y) {
    c.save();
    c.translate(x, y);
    c.beginPath();                                  // 그랜드 피아노 상판
    c.moveTo(-40, -30); c.lineTo(24, -30);
    c.bezierCurveTo(46, -28, 46, 6, 26, 12);
    c.bezierCurveTo(12, 17, -2, 30, -40, 26);
    c.closePath();
    c.fillStyle = "#0a0d13"; c.fill();
    c.strokeStyle = "#161d28"; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = "#232b38";                        // 건반 띠
    c.fillRect(-40, -26, 7, 48);
    c.fillStyle = "#11161e";                        // 벤치
    c.fillRect(-58, -13, 12, 30);
    c.restore();
  }

  function lockerStrip(c, y0) {
    c.save();
    c.fillStyle = "#0f141c"; c.fillRect(0, y0, TS, 28);
    c.fillStyle = "#1a202b";
    c.fillRect(0, y0, TS, 1.5); c.fillRect(0, y0 + 26.5, TS, 1.5);
    c.strokeStyle = "rgba(22,28,38,0.55)"; c.lineWidth = 1;
    c.beginPath();
    for (var x = 24; x < TS; x += 24) { c.moveTo(x, y0 + 2); c.lineTo(x, y0 + 26); }
    c.stroke();
    c.fillStyle = "#0a0d12";
    for (x = 18; x < TS; x += 24) c.fillRect(x, y0 + 12, 3, 4);
    c.restore();
  }

  /* ── 타일 조립 ──────────────────────────────────────────── */

  /* 바닥 원단 — 격자가 타일을 정확히 나눠 이음새가 없다 */
  function baseFloor(c, pack, seed) {
    var r = rng(seed), cell = pack === "school" ? 88 : 44, n = TS / cell;
    c.save();
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      var v = r();
      c.fillStyle = v < 0.06 ? "#0b0e13" : v < 0.13 ? "#0e1219"
                  : (i + j) % 2 ? "#0d1016" : "#0c0f15";
      c.fillRect(i * cell, j * cell, cell, cell);
    }
    c.strokeStyle = "rgba(30,40,58,0.32)"; c.lineWidth = 1;
    c.beginPath();
    for (i = 0; i <= n; i++) {
      c.moveTo(i * cell, 0); c.lineTo(i * cell, TS);
      c.moveTo(0, i * cell); c.lineTo(TS, i * cell);
    }
    c.stroke();
    c.restore();
  }

  /* 소품 배치 — 264px 셀 격자에 지터. 랩 패스마다 같은 seed로 동일 재현. */
  function props(c, pack, seed) {
    var r = rng(seed);
    for (var gy = 0; gy < 4; gy++) for (var gx = 0; gx < 4; gx++) {
      var x = gx * FIX + FIX / 2 + (r() - 0.5) * 72;
      var y = gy * FIX + FIX / 2 + (r() - 0.5) * 72;
      var v = r();
      if (pack === "school") {
        if (gy === 0) { r(); continue; }            // 사물함 옆 통로는 비운다
        if (gx === 3 && gy === 3) { piano(c, TS * 0.86, TS * 0.88); continue; }
        if (v < 0.42) schoolDeskBlock(c, x, y, r);
        else if (v < 0.54) teacherPlatform(c, x, y);
        else if (v < 0.62) plant(c, x, y, r);
        else if (v < 0.70) pillarBoard(c, x, y, r);
        /* else 통로 */
      } else {
        if (v < 0.50) deskCluster(c, x, y, r() < 0.5 ? 0 : Math.PI / 2, r);
        else if (v < 0.58) plant(c, x, y, r);
        else if (v < 0.66) printer(c, x, y);
        else if (v < 0.72) waterCooler(c, x, y);
        else if (v < 0.78) pillarBoard(c, x, y, r);
        else if (v < 0.83) cableTray(c, x, y, r() < 0.5);
        /* else 통로 */
      }
    }
    if (pack === "school") lockerStrip(c, 6);       // 한쪽 가장자리의 사물함 열
  }

  /* 등기구 명단 — 16개 중 3개 점등, 1개 깜빡임. 두 팩 같은 기하(같은 건물). */
  function fixtureList(seed) {
    var r = rng(seed), idx = [], i;
    for (i = 0; i < 16; i++) idx.push(i);
    for (i = 15; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
    }
    var out = [];
    for (i = 0; i < 16; i++) {
      out.push({
        cx: (i % 4) * FIX + FIX / 2,
        cy: Math.floor(i / 4) * FIX + FIX / 2,
        w: 112, h: 18,
        lit: idx.indexOf(i) < 3,
        flick: idx.indexOf(i) === 3
      });
    }
    return out;
  }

  /* 3×3 랩 패스 — 오름차순 오프셋 고정 순서라 경계 양쪽 합성이 동일 */
  function wrapped(c, fn) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      c.save(); c.translate(dx * TS, dy * TS); fn(c); c.restore();
    }
  }

  function buildTile(pack) {
    var cv = document.createElement("canvas");
    cv.width = TS; cv.height = TS;
    var c = cv.getContext("2d");
    var seed = pack === "school" ? 8190826 : 20260826;
    var poolMul = pack === "school" ? 1.25 : 1;     // 학교 복도 바닥이 더 반들거린다
    var fx = fixtureList(seed + 7), flick = null;
    fx.forEach(function (f) { if (f.flick) flick = f; });
    c.save();

    baseFloor(c, pack, seed);
    wrapped(c, function (cc) { props(cc, pack, seed + 1); });
    wrapped(c, function (cc) {                       // 빛 — 소품 위로 떨어진다
      fx.forEach(function (f) {
        if (f.lit) drawLitTop(cc, f.cx, f.cy, f.w, f.h, 1, poolMul);
      });
    });
    wrapped(c, function (cc) {                       // 꺼진 등 — 맨 위 실루엣
      fx.forEach(function (f) {
        if (!f.lit) drawDarkTop(cc, f.cx, f.cy, f.w, f.h);
      });
    });

    c.restore();
    return { cv: cv, flick: flick, poolMul: poolMul };
  }

  /* 비네트 — 화면 공간, 크기별 1회 생성 */
  function vignette(W, H) {
    var key = W + "x" + H, cv = vigCache[key];
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d");
    var g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38,
                                   W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.24)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    vigCache[key] = cv; vigKeys.push(key);
    if (vigKeys.length > 4) delete vigCache[vigKeys.shift()];
    return cv;
  }

  /* ── 매 프레임 진입점 ───────────────────────────────────── */
  function paint(pack, ctx, W, H, camX, camY, t) {
    if (!ctx || !W || !H) return;
    camX = camX || 0; camY = camY || 0;
    var st = tileCache[pack] || (tileCache[pack] = buildTile(pack));
    var ox = -m(camX, TS), oy = -m(camY, TS), x, y;
    ctx.save();

    for (y = oy; y < H; y += TS)                     // 타일 blit (최대 2×2)
      for (x = ox; x < W; x += TS)
        ctx.drawImage(st.cv, x, y);

    var lv = flickLevel(t || 0), f = st.flick;       // 깜빡이 등 — 유일한 라이브 드로잉
    for (y = oy - TS; y < H + TS; y += TS)
      for (x = ox - TS; x < W + TS; x += TS) {
        var fx2 = x + f.cx, fy2 = y + f.cy;
        if (fx2 > -260 && fx2 < W + 260 && fy2 > -260 && fy2 < H + 260)
          drawLitTop(ctx, fx2, fy2, f.w, f.h, lv, st.poolMul);
      }

    ctx.drawImage(vignette(W, H), 0, 0);
    ctx.restore();
  }

  window.BACKDROP = {
    office: function (ctx, W, H, camX, camY, t) { paint("office", ctx, W, H, camX, camY, t); },
    school: function (ctx, W, H, camX, camY, t) { paint("school", ctx, W, H, camX, camY, t); }
  };
})();
