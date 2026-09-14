/* 플레이 스토어 피처 그래픽 1024×500.
   실제 게임 화면을 배경으로 깔고 그 위에 제목만 얹는다 —
   합성 일러스트를 쓰면 「스토어에서 본 것과 다르다」가 된다.

   node game/store/make-feature.mjs */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const HERE = dirname(fileURLToPath(import.meta.url));

const shot = 'data:image/png;base64,' +
  readFileSync(resolve(HERE, 'shot-4-wide.png')).toString('base64');
const font = 'data:font/woff2;base64,' +
  readFileSync(resolve(HERE, '..', 'assets/fonts/BlackHanSans-subset.woff2')).toString('base64');
const body = 'data:font/woff2;base64,' +
  readFileSync(resolve(HERE, '..', 'assets/fonts/GothicA1-700-subset.woff2')).toString('base64');

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{ width:1024, height:500 }, deviceScaleFactor:1 });
await p.setContent(`<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BHS;src:url(${font}) format('woff2')}
@font-face{font-family:G1;src:url(${body}) format('woff2');font-weight:700}
*{margin:0;box-sizing:border-box}
body{width:1024px;height:500px;overflow:hidden;position:relative;background:#0b0e14}
/* 조금 당겨서 자른다 — 그대로 쓰면 일시정지 단추와 보스바가 걸쳐 보인다 */
img{position:absolute;inset:0;width:1024px;height:500px;object-fit:cover;
    object-position:50% 50%;filter:saturate(1.05);
    transform:scale(1.26);transform-origin:62% 58%}
/* 왼쪽에서 오른쪽으로 걷히는 어둠 — 글자가 앉을 자리를 만든다 */
.veil{position:absolute;inset:0;background:
  linear-gradient(100deg,#0b0e14 4%,rgba(11,14,20,.94) 30%,rgba(11,14,20,.58) 52%,rgba(11,14,20,.14) 78%)}
.wrap{position:absolute;left:56px;top:50%;transform:translateY(-50%);width:520px}
.clock{font:400 15px G1,sans-serif;font-weight:700;letter-spacing:.22em;color:#f5c451;
  margin-bottom:14px;opacity:.92}
h1{font-family:BHS,sans-serif;font-weight:400;font-size:82px;line-height:.98;color:#fff;
   letter-spacing:-.01em;text-shadow:0 6px 30px rgba(0,0,0,.7)}
.line{font:700 20px G1,sans-serif;color:#e8ecf4;margin-top:18px;line-height:1.5;opacity:.95}
.tags{display:flex;gap:8px;margin-top:26px;flex-wrap:wrap}
.tag{font:700 13px G1,sans-serif;color:#c9cfdb;border:1px solid #39414f;
  border-radius:999px;padding:7px 13px;background:rgba(11,14,20,.55)}
.tag.on{color:#0b0e14;background:#f5c451;border-color:#f5c451}
</style>
<img src="${shot}">
<div class="veil"></div>
<div class="wrap">
  <div class="clock">09:00 &nbsp;—&nbsp; 18:00</div>
  <h1>정시 퇴근</h1>
  <div class="line">18시까지 회사를 뚫고 정문으로.<br>아홉 개 구역, 스물일곱 가지 무기, 다섯 직군.</div>
  <div class="tags">
    <span class="tag on">완전 오프라인</span>
    <span class="tag">광고 없음</span>
    <span class="tag">결제 없음</span>
  </div>
</div>`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.screenshot({ path: resolve(HERE,'feature-1024x500.png') });
await b.close();
console.log('feature-1024x500.png');
