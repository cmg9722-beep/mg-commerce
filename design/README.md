# 출근 저지 — 아트 디렉션

게임(`../game/index.html`)의 비주얼 방향을 잡는 디자인 캔버스 소스.

**채택 방향: 「형광등 꺼진 사무실」(Fluorescent Night)**
어두운 청회색 바닥 + 형광등의 차가운 청백 + 종이·토너의 크림. 악센트는 두 개뿐.
화면에서 유일하게 빛나는 곳이 **내 자리**가 되도록 설계했습니다.

## 아트보드

| 파일 | 내용 |
|---|---|
| `Main.dc.html` | 타이틀 화면 |
| `Palette.dc.html` | 컬러 + 타이포 시스템 |
| `Units.dc.html` | 설치 사물 5종 아이콘 시트 |
| `Foes.dc.html` | 적 7종 + 점검단 보스 캐릭터 시트 |
| `HUD.dc.html` | 인게임 HUD + 필드 레이아웃 |
| `Result.dc.html` | 결과 화면 (승리 / 패배) |
| `Themes.dc.html` | 테마 팩 — 직장인 팩 / 학생 팩 |
| `DirectionB.dc.html` | 대안 방향: 복사기 토너 (미채택) |
| `DirectionC.dc.html` | 대안 방향: 8비트 사원증 (미채택) |

`canvas.json` 이 배치·주석·시작 뷰를 정의합니다.

## 컬러

| 역할 | 값 |
|---|---|
| 바닥 | `#0b0e14` |
| 패널 | `#141922` |
| 경계선 | `#232a36` |
| 본문 | `#e8ecf4` · 보조 `#7d8699` |
| 형광등 (악센트 1) | `#9ec8ff` — 내 자리 · 선택 · 진행바 |
| 토너 (악센트 2) | `#f5c451` — 커피 자원 · 강조 |
| 비상구 | `#57d98a` — 승리 · 처치 |
| 경고 | `#ff6b6b` — 피격 · 보스 · 패배 |

폰트: **Black Han Sans** (타이틀) + **Gothic A1** 400/600/800 (UI).
숫자는 `tabular-nums` 고정 — 커피·HP가 줄 때 자릿수가 흔들리면 안 됩니다.

## 원칙

- **아이콘에 이모지를 쓰지 않습니다.** 전부 인라인 SVG — 스킨마다 색을 바꿔야 하기 때문입니다.
- 적은 **몸통 색으로 계급**, **소품 하나로 정체**만 구분합니다.
- HUD는 필드를 절대 덮지 않습니다.
- 등장 인물은 전부 가상. 실존 인물·거래처를 알아볼 수 있는 특징은 넣지 않습니다.

## 다시 만들기

시드된 `.html`(2.5MB)은 빌드 산출물이라 커밋하지 않습니다. 소스에서 재생성:

```
node "<design 스킬 디렉터리>/seed-canvas.mjs" \
  --template "<design 스킬 디렉터리>/payload.template.html" \
  --out chulgeun-jeoji-art-direction.html \
  --title "출근 저지 아트 디렉션" \
  --artboard Main.dc.html --artboard Palette.dc.html --artboard Units.dc.html \
  --artboard Foes.dc.html --artboard HUD.dc.html --artboard Result.dc.html \
  --artboard Themes.dc.html --artboard DirectionB.dc.html --artboard DirectionC.dc.html \
  --canvas canvas.json
```

## 다음

1. 이 아트를 게임에 실제 적용 (이모지 → 벡터 교체)
2. 학생 팩 데이터 추가
3. 사운드
