# MG Commerce - Claude 작업 규칙

---

## 🔴 역할 구분 (매우 중요)

### Claude Code만 할 수 있는 것
- 코드 파일 수정 (app.py, app.js, html, css, modules/*.py 등)
- git push / 배포
- requirements.txt, config.py 수정
- DB 스키마 변경

### Cowork Opus가 해야 하는 것 (데이터만)
- 공급사 상태/트래킹번호 업데이트 → **반드시 https://mg-commerce.onrender.com/admin 에서**
- 마일스톤 추가/완료 처리 → **반드시 Render 대시보드에서**
- 절대 금지: 로컬 data/db.sqlite3 직접 수정, 코드 파일 수정, git 명령

### Cowork Opus가 코드 변경이 필요할 때
- `PENDING_CHANGES.md` 파일에 요청사항 작성만 할 것
- 실제 코드 수정은 Claude Code가 처리

---

## 배포 전 필수 검증 체크리스트

1. ✅ 로컬 서버 실행 + 에러 없음 확인
2. ✅ 변경 기능 직접 테스트 (클릭, 입력, 결과 확인)
3. ✅ 기존 기능 회귀 테스트
4. ✅ 위 3개 모두 통과 후에만 git push

**같은 버그로 2번 이상 push 금지. 로컬에서 해결하고 1번만 push.**

## CSS 변경 시 주의
- `position: absolute/fixed` + `inset:0` → 반드시 `pointer-events:none` 확인
- `z-index` 변경 → 클릭 영역 가려지는지 확인
- 서비스워커 캐시 버전 (sw.js CACHE_NAME) 업데이트 필요 여부 확인
