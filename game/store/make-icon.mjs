/* 아이콘 — 「정시 퇴근」을 한 글자도 없이 알아보게.
   6시 정각은 시침이 아래, 분침이 위 = 세로 한 줄. 그게 이 게임의 뜻이고,
   48px로 줄여도 남는 유일한 형태다. 거기에 반려 도장의 붉은 링을 씌운다.
   기울인 링은 서류에 눌러 찍힌 도장의 각도다.

   node game/store/make-icon.mjs   → store/icon-*.png */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const OUT = dirname(fileURLToPath(import.meta.url));

const draw = `(S, pad) => {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S/512, R = (S/2) - pad*k;
  const cx = S/2, cy = S/2;

  // 바탕 — 게임의 어두운 사무실 색
  const bg = x.createLinearGradient(0,0,0,S);
  bg.addColorStop(0,'#161c27'); bg.addColorStop(1,'#0b0e14');
  x.fillStyle = bg; x.fillRect(0,0,S,S);

  /* 도장 링 — 살짝 기울여 찍는다. 틈은 작고 불규칙해야 「덜 묻은 인주」로
     읽힌다. 처음엔 크고 고른 틈 일곱 개를 뒀더니 구명튜브가 됐다. */
  x.save(); x.translate(cx,cy); x.rotate(-0.11);
  x.strokeStyle = '#c0392b'; x.lineWidth = 24*k; x.lineCap='butt';
  x.beginPath(); x.arc(0,0,R*0.82,0,Math.PI*2); x.stroke();
  x.globalCompositeOperation='destination-out';
  const nicks=[[0.35,0.035],[1.15,0.022],[2.05,0.045],[3.4,0.018],
               [4.15,0.038],[5.3,0.026],[5.95,0.02]];
  for(const [a,w] of nicks){
    x.strokeStyle='#000'; x.lineWidth=26*k;
    x.beginPath(); x.arc(0,0,R*0.82,a,a+w); x.stroke();
  }
  x.globalCompositeOperation='source-over';
  x.restore();

  /* 6시 정각 — 분침은 위로 길게, 시침은 아래로 짧게.
     길이가 비슷하면 한 개의 막대로 보여서 6시가 안 읽힌다. */
  x.strokeStyle = '#f5c451'; x.lineCap = 'round';
  x.lineWidth = 26*k;                          // 분침 — 길다
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy - R*0.66); x.stroke();
  x.lineWidth = 34*k;                          // 시침 — 짧고 굵다
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + R*0.33); x.stroke();
  x.fillStyle = '#f5c451';
  x.beginPath(); x.arc(cx, cy, 19*k, 0, 6.2832); x.fill();

  return c.toDataURL('image/png');
}`;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('about:blank');
/* maskable 아이콘은 바깥 20%가 잘릴 수 있어 안전영역 안에 그린다 */
const sizes = [[1024,120],[512,60],[192,23],[180,21],[32,4]];
for(const [S,pad] of sizes){
  const url = await p.evaluate(([fn,S,pad]) => eval('('+fn+')')(S,pad), [draw,S,pad]);
  const buf = Buffer.from(url.split(',')[1],'base64');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(resolve(OUT, `icon-${S}.png`), buf);
  console.log(`icon-${S}.png  ${buf.length.toLocaleString()} bytes`);
}
await b.close();
