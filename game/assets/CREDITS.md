# 에셋 출처

상업 이용 가능한 것만 씁니다. CC0가 아니면 출처 표기 의무가 있으니
게임 안(타이틀 또는 결과 화면)에도 넣어야 합니다.

## 소리 — Kenney · CC0 1.0 Universal

CC0는 저작권을 완전히 포기한 것이라 **상업 이용 가능하고 출처 표기 의무도
없습니다.** 그래도 예의상, 그리고 나중에 어디서 왔는지 알기 위해 적어 둡니다.

| 게임 안 이름 | 원본 파일 | 팩 |
|---|---|---|
| `hit` 명중 | bookPlace1.ogg | RPG Audio |
| `kill` 처치 | dropLeather.ogg | RPG Audio |
| `killBoss` 보스 처치 | metalPot3.ogg | RPG Audio |
| `coin` 획득 | handleCoins2.ogg | RPG Audio |
| `place` 설치·선택 | click1.ogg | UI Audio |
| `levelup` 레벨업 | jingles_PIZZA00.ogg | Music Jingles |
| `win` 정시 퇴근 | jingles_STEEL00.ogg | Music Jingles |
| `lose` 쓰러짐 | jingles_PIZZA14.ogg | Music Jingles |

- 출처: https://kenney.nl/assets
- 라이선스 전문: CC0 1.0 Universal
- 받은 경로: GitHub 미러 `iwenzhou/kenney` (같은 CC0)

### 고른 근거

들어보고 고른 게 아니라 **재서** 골랐습니다. 길이·피크·평균 음량을
브라우저에서 디코딩해 숫자로 뽑고, 용도에 맞는 것을 뽑았습니다.

- 명중음은 초당 여러 번 나므로 **실제 소리 길이 0.12초**짜리로
- 획득음도 자주 나므로 0.21초짜리로
- 보스 처치는 커야 하니 0.62초에 피크가 제일 큰 것으로
- 결말 징글은 0.5~0.7초 — 더 길면 결과 화면이 늘어진다

원본들의 평균 음량이 0.014~0.268로 **19배 차이**가 나서, 그대로 쓰면
동전은 안 들리고 보스는 귀를 때립니다. `SFX_GAIN` 표에서 맞췄습니다.

## 그림

| 파일 | 출처 | 라이선스 | 표기 의무 |
|---|---|---|---|
| (아직 없음 — 전부 코드로 그립니다) | | | |

## 바꾸고 싶을 때

`game/assets/sfx/` 에 같은 이름으로 덮어쓰고 `node tools/build-assets.mjs`.
파일을 지우면 그 소리만 다시 코드 합성음으로 돌아갑니다.
