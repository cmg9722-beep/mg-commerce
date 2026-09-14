# 정시 퇴근 — 화면 시안

`game/rush.html` 의 실제 CSS 토큰을 그대로 쓴 UI 시안입니다.
새 색·새 폰트를 만들지 않았습니다.

| 파일 | 화면 |
|---|---|
| `Main.dc.html` | 타이틀 |
| `Career.dc.html` | 자기계발 (메타 성장 상점) |
| `LevelUp.dc.html` | 레벨업 선택 · 진화 |
| `Result.dc.html` | 결과 |
| `Hud.dc.html` | 인게임 HUD |
| `canvas.json` | 캔버스 배치 |
| `_head.txt` | 공통 머리 (폰트·토큰) — 각 artboard 앞에 붙인다 |

## 게임과 달라진 곳

- **타이틀** — 기록 4개를 한 덩어리 격자로. 적용 중인 영구 능력을 칩으로 표시
  (현재는 한 줄 텍스트라 뭐가 켜져 있는지 안 읽힌다)
- **자기계발** — 잔액을 머리에 고정(살 수 있는지가 늘 보여야 한다).
  완료(초록) / 부족(흐림) / 특별(금색)을 상태별로 구분
- **레벨업** — 보유 무기를 위에 함께 표시(뭘 키울지 판단하려면 필요하다).
  진화는 별개 사건으로 크게
- **결과** — 승패를 색 막대로. 마지막 무기 구성과 입력한 한마디를 인용으로
- **HUD** — 거의 그대로. 시간 막대에 보스 시각 눈금, 진화 무기 슬롯만 테두리·★로 구분

## 다시 만들기

```
node "<design 스킬 base>/seed-canvas.mjs" \
  --template "<design 스킬 base>/payload.template.html" \
  --out jeongsi-toegeun-ui.html --title "정시 퇴근 UI" \
  --artboard Main.dc.html --artboard Career.dc.html --artboard LevelUp.dc.html \
  --artboard Result.dc.html --artboard Hud.dc.html --canvas canvas.json
```

시드된 `jeongsi-toegeun-ui.html` 은 2.5MB 빌드 산출물이라 gitignore 되어 있습니다.
