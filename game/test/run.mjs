#!/usr/bin/env node
/* 「정시 퇴근」 검증 스위트
     node game/test/run.mjs            전부
     node game/test/run.mjs i18n play  이름에 맞는 것만

   배포 전 체크리스트(CLAUDE.md)의 2·3번 — 변경 기능 테스트와 회귀
   테스트 — 를 사람 손 대신 여기서 돌린다. 전부 ✅ 여야 push 한다. */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { shutdown } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const filters = process.argv.slice(2).filter(a => !a.startsWith('-'));

const files = readdirSync(resolve(HERE, 'cases'))
  .filter(f => f.endsWith('.mjs'))
  .filter(f => !filters.length || filters.some(x => f.includes(x)))
  .sort();

if(!files.length){ console.error('해당하는 검사가 없습니다:', filters.join(' ')); process.exit(2); }

const t0 = Date.now();
let failed = 0;
for(const f of files){
  const name = basename(f, '.mjs');
  process.stdout.write(`\n── ${name} ${'─'.repeat(Math.max(0, 46 - name.length))}\n`);
  const started = Date.now();
  try{
    const mod = await import(resolve(HERE, 'cases', f));
    const s = await mod.default();
    const ok = s.report();
    const secs = ((Date.now()-started)/1000).toFixed(1);
    console.log(`   ${ok ? '통과' : '실패'} · ${s.rows.length}개 확인 · ${secs}초`);
    if(!ok) failed++;
  }catch(e){
    console.log(`  ❌ 검사 자체가 터졌습니다\n     ${e.stack||e}`);
    failed++;
  }
}
await shutdown();
const secs = ((Date.now()-t0)/1000).toFixed(1);
console.log(`\n${failed ? `❌ ${failed}개 실패` : '✅ 전부 통과'} · ${files.length}개 검사 · ${secs}초`);
process.exit(failed ? 1 : 0);
