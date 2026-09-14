# 안드로이드 패키징 (TWA)

게임은 웹으로 완결돼 있습니다 — 외부 요청 0, 서비스워커로 오프라인 동작.
그래서 **TWA(Trusted Web Activity)로 감싸기만 하면** 구글 플레이에 올라갑니다.
따로 다시 만들 것이 없습니다.

여기 있는 `twa-manifest.json` 은 Bubblewrap 설정입니다. 도메인·패키지명·
아이콘 주소가 이미 채워져 있습니다.

## 왜 여기서 APK를 만들지 않았나

**서명 키가 필요한데, 그건 만들면 안 되는 것이기 때문입니다.**
안드로이드 앱 서명 키는 한 번 정하면 앱의 평생 신원이 됩니다. 잃어버리면
같은 앱으로 갱신할 수 없고, 남이 만들어 준 키를 쓰면 그 사람이 언제든
내 앱 행세를 할 수 있습니다. 그래서 키는 **반드시 소유자 본인이 만들어
본인만 보관**해야 합니다.

## 순서

```bash
# 1) 준비 (JDK 17 + 안드로이드 SDK 는 bubblewrap 이 알아서 받습니다)
npm i -g @bubblewrap/cli

# 2) 서명 키 만들기 — 이 파일과 비밀번호를 절대 잃어버리지 마세요
keytool -genkeypair -v -keystore android.keystore \
  -alias jeongsi -keyalg RSA -keysize 2048 -validity 10000

# 3) 이 폴더에서 초기화 (twa-manifest.json 을 읽습니다)
cd game/store/twa
bubblewrap init --manifest https://mg-commerce.onrender.com/game/manifest.webmanifest

# 4) 빌드 → app-release-bundle.aab 가 나옵니다. 이걸 플레이 콘솔에 올립니다
bubblewrap build
```

## 주소창을 없애려면 — Digital Asset Links

이 한 가지를 꼭 해야 합니다. 안 하면 앱 안에 브라우저 주소창이 보입니다.

1. 서명 키의 지문을 뽑습니다.
   ```bash
   keytool -list -v -keystore android.keystore -alias jeongsi | grep SHA256
   ```
2. `assetlinks.json` 의 `PUT_YOUR_SHA256_FINGERPRINT_HERE` 를 그 값으로 바꿉니다.
3. 서버의 `https://mg-commerce.onrender.com/.well-known/assetlinks.json` 로
   서비스되게 합니다. **이 경로는 이미 열려 있습니다** — `app.py` 의
   `well_known_assetlinks` 라우트가 `game/store/twa/assetlinks.json` 을 내보냅니다.
   지문만 채우면 됩니다.
4. 확인: `curl https://mg-commerce.onrender.com/.well-known/assetlinks.json`

## 확인해 둔 것

- 게임은 `https://mg-commerce.onrender.com/game/rush.html` 로 열립니다
- 매니페스트는 `/game/manifest.webmanifest`
- 서비스워커가 등록되고, 네트워크를 끊어도 게임이 열립니다
  (`node game/test/run.mjs offline` 이 매번 확인합니다)
