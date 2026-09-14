# 에셋 넣는 곳

여기에 그림과 소리를 넣고 `node tools/build-assets.mjs` 를 돌리면
최적화해서 게임에 박아 넣습니다. 게임은 단일 HTML 그대로 유지됩니다.

## 그림 — `img/`

파일 이름이 그대로 게임 안의 이름이 됩니다.

| 이름 | 쓰이는 곳 | 권장 크기 |
|---|---|---|
| `zone-0.png` ~ `zone-8.png` | 구역 배경 (주차장 → 대표이사실) | 1024×1024, 이어 붙는 타일 |
| `foe-intern.png` 등 | 적 스프라이트 시트 | 가로로 8프레임, 프레임당 64×64 |
| `hero.png` | 주인공 시트 | 가로로 8프레임, 프레임당 64×64 |
| `icon-stamp.png` 등 | 무기·강화 아이콘 | 64×64 |

적 id: intern staff senior manager drunk gm audit chief rookie hrteam
vendor ceo bot

## 소리 — `sfx/`

WAV·MP3·OGG 아무거나. 이름이 곧 효과음 이름입니다.

| 이름 | 언제 |
|---|---|
| `hit` | 명중 |
| `kill` | 처치 |
| `killBoss` | 보스 처치 |
| `coin` | 획득 |
| `levelup` | 레벨업 |
| `place` | 설치·선택 |
| `win` / `lose` | 결말 |

## 규칙

- **없으면 지금 코드 그림·합성음이 그대로 쓰입니다.** 하나씩 갈아끼워도 됩니다
- 상업 이용 가능한 것만 넣으세요. 출처는 `CREDITS.md`에 적습니다
- 빌드가 용량을 알려줍니다. 전체 8MB를 넘으면 경고합니다
