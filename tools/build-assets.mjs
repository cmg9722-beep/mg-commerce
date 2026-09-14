#!/usr/bin/env node
/* 에셋 최적화 → 게임에 박아 넣기
   ──────────────────────────────────────────────────────────────
   game/assets/img/*  그림 → WebP로 줄여서 base64
   game/assets/sfx/*  소리 → 그대로 base64 (브라우저가 디코딩한다)
   결과는 game/_assets.js 한 장. rush.html이 그걸 읽어 쓰고,
   없는 항목은 지금처럼 코드로 그리고 합성한다.

   왜 base64인가: 이 게임의 강점이 「파일 하나, 로딩 없음」이다.
   스토어에 올릴 때도 통째로 하나면 패키징이 단순하다.
   대신 용량을 계속 재서 예산을 넘으면 경고한다.

   쓰기:  node tools/build-assets.mjs           빌드
          node tools/build-assets.mjs --check   현황만 보기
*/
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const IMG = path.join(ROOT, "game/assets/img");
const SFX = path.join(ROOT, "game/assets/sfx");
const OUT = path.join(ROOT, "game/_assets.js");

/* 예산 — 넘으면 경고한다. 모바일에서 첫 로딩이 길어지는 순간 이탈이 난다 */
const BUDGET = { total: 8 * 1024 * 1024, img: 6 * 1024 * 1024, sfx: 2 * 1024 * 1024 };

/* 그림 종류별 최적화 방침. 배경은 크고 부드러워도 되지만
   스프라이트는 가장자리가 뭉개지면 안 되니 손실을 적게 준다. */
const PLAN = [
  { re: /^zone-\d+$/,  q: 78, max: 1024, label: "구역 배경" },
  { re: /^(foe-|hero)/, q: 92, max: 1024, label: "캐릭터 시트", sharp: true },
  { re: /^icon-/,      q: 90, max: 128,  label: "아이콘", sharp: true },
  { re: /.*/,          q: 85, max: 1024, label: "기타" },
];
const planFor = (n) => PLAN.find((p) => p.re.test(n));

const kb = (n) => (n / 1024).toFixed(0) + "KB";
const mb = (n) => (n / 1024 / 1024).toFixed(2) + "MB";

async function listDir(dir, exts) {
  try {
    const f = await fs.readdir(dir);
    return f
      .filter((n) => exts.includes(path.extname(n).toLowerCase()))
      .sort();
  } catch {
    return [];
  }
}

async function loadSharp() {
  try {
    const here = path.join(ROOT, "tools");
    const m = await import(url.pathToFileURL(path.join(here, "node_modules/sharp/lib/index.js")).href);
    return m.default || m;
  } catch {
    try { return (await import("sharp")).default; } catch { return null; }
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const imgFiles = await listDir(IMG, [".png", ".jpg", ".jpeg", ".webp", ".gif"]);
  const sfxFiles = await listDir(SFX, [".wav", ".mp3", ".ogg", ".m4a", ".webm"]);

  if (!imgFiles.length && !sfxFiles.length) {
    console.log("에셋이 아직 없습니다.");
    console.log("  그림 → game/assets/img/   소리 → game/assets/sfx/");
    console.log("  넣는 방법은 game/assets/README.md 참고");
    if (!checkOnly) {
      await fs.writeFile(OUT, "/* 에셋 없음 — 코드 그림·합성음을 쓴다 */\nwindow.ASSETS={img:{},sfx:{}};\n");
      console.log("\n빈 game/_assets.js 를 만들었습니다(게임은 그대로 돕니다).");
    }
    return;
  }

  const sharp = await loadSharp();
  if (imgFiles.length && !sharp) {
    console.error("sharp가 없습니다. tools 폴더에서 한 번만:  npm install");
    process.exit(1);
  }

  const img = {}, sfx = {};
  let rawI = 0, outI = 0, rawS = 0;

  for (const f of imgFiles) {
    const name = path.basename(f, path.extname(f));
    const p = planFor(name);
    const src = await fs.readFile(path.join(IMG, f));
    rawI += src.length;
    let pipe = sharp(src, { limitInputPixels: 268402689 });
    const meta = await pipe.metadata();
    if (meta.width > p.max || meta.height > p.max) {
      pipe = pipe.resize(p.max, p.max, { fit: "inside", kernel: p.sharp ? "nearest" : "lanczos3" });
    }
    const buf = await pipe.webp({ quality: p.q, effort: 6, alphaQuality: 100 }).toBuffer();
    outI += buf.length;
    img[name] = "data:image/webp;base64," + buf.toString("base64");
    const shrink = src.length ? Math.round((1 - buf.length / src.length) * 100) : 0;
    console.log(
      `  ${name.padEnd(18)} ${p.label.padEnd(10)} ${meta.width}×${meta.height}` +
      `  ${kb(src.length).padStart(7)} → ${kb(buf.length).padStart(7)}  (−${shrink}%)`
    );
  }

  const MIME = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg",
                 ".m4a": "audio/mp4", ".webm": "audio/webm" };
  for (const f of sfxFiles) {
    const name = path.basename(f, path.extname(f));
    const src = await fs.readFile(path.join(SFX, f));
    rawS += src.length;
    const ext = path.extname(f).toLowerCase();
    sfx[name] = `data:${MIME[ext] || "audio/wav"};base64,` + src.toString("base64");
    console.log(`  ${name.padEnd(18)} 소리       ${ext.slice(1).padEnd(5)} ${kb(src.length).padStart(7)}`);
    if (ext === ".wav" && src.length > 200 * 1024) {
      console.warn(`     ↑ WAV가 큽니다. OGG나 MP3로 바꾸면 1/5로 줄어듭니다`);
    }
  }

  /* base64는 원본보다 약 1.37배가 된다 — 예산은 그 값으로 잰다 */
  const encI = Math.round(outI * 1.37), encS = Math.round(rawS * 1.37);
  console.log("\n── 용량 ──────────────────────────────");
  console.log(`  그림  ${mb(rawI)} → ${mb(outI)} (박으면 ${mb(encI)})   예산 ${mb(BUDGET.img)}`);
  console.log(`  소리  ${mb(rawS)}            (박으면 ${mb(encS)})   예산 ${mb(BUDGET.sfx)}`);
  console.log(`  합계                          ${mb(encI + encS)}   예산 ${mb(BUDGET.total)}`);

  let over = false;
  if (encI > BUDGET.img) { console.warn("  ⚠ 그림이 예산을 넘습니다"); over = true; }
  if (encS > BUDGET.sfx) { console.warn("  ⚠ 소리가 예산을 넘습니다 — OGG/MP3로 바꾸세요"); over = true; }
  if (encI + encS > BUDGET.total) { console.warn("  ⚠ 합계가 예산을 넘습니다 — 모바일 첫 로딩이 길어집니다"); over = true; }
  if (!over) console.log("  ✅ 예산 안");

  if (checkOnly) { console.log("\n--check 였으므로 파일은 쓰지 않았습니다."); return; }

  const body =
    "/* 자동 생성 — tools/build-assets.mjs. 직접 고치지 마세요.\n" +
    `   그림 ${Object.keys(img).length}장 · 소리 ${Object.keys(sfx).length}개 · ${mb(encI + encS)} */\n` +
    "window.ASSETS=" + JSON.stringify({ img, sfx }) + ";\n";
  await fs.writeFile(OUT, body);
  console.log(`\n game/_assets.js 썼습니다 (${mb(body.length)})`);
  console.log(" rush.html이 이 파일을 읽어 씁니다. 없는 항목은 코드 그림·합성음 그대로입니다.");
}

main().catch((e) => { console.error(e); process.exit(1); });
