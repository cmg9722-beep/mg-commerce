/* 「정시 퇴근」 서비스워커 — 오프라인 전용.

   게임은 네트워크로 아무것도 안 가져온다(글꼴까지 파일로 들고 있다).
   그래서 전략도 단순하다: 설치할 때 전부 받아 두고, 그 다음부터는
   캐시에서만 준다. 지하철에서도 비행기에서도 같은 화면이 나온다.

   판올림할 때 CACHE 를 올린다. 그러면 새 캐시를 새로 채우고
   옛 캐시는 activate 에서 지운다 — 반쯤 섞인 상태가 생기지 않는다.

   뒤에 붙은 것은 rush.html 의 내용 해시다. 브라우저는 이 파일이
   한 바이트도 안 바뀌면 서비스워커를 다시 설치하지 않는다. 그래서
   게임만 고치고 여기를 잊으면, 고친 것이 이미 설치한 사람에게
   영영 가지 않는다 — 실제로 여섯 커밋 동안 그 상태였다.
   손으로 올리는 걸 잊지 않도록 offline 검사가 해시를 대조한다. */
const CACHE = 'jeongsi-v2-ae13cc96b6d9';

const SHELL = [
  './',
  './rush.html',
  './manifest.webmanifest',
  './store/icon-192.png',
  './store/icon-512.png',
  './assets/fonts/BlackHanSans-subset.woff2',
  './assets/fonts/GothicA1-400-subset.woff2',
  './assets/fonts/GothicA1-700-subset.woff2',
  './assets/fonts/GothicA1-800-subset.woff2',
  './assets/sfx/bgmPad.ogg',
  './assets/sfx/bgmDrum.ogg',
  './assets/sfx/hit.ogg',
  './assets/sfx/kill.ogg',
  './assets/sfx/killBoss.ogg',
  './assets/sfx/coin.ogg',
  './assets/sfx/place.ogg',
  './assets/sfx/levelup.ogg',
  './assets/sfx/win.ogg',
  './assets/sfx/lose.ogg',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* 하나가 실패해도 나머지는 깔린다 — 소리 파일 하나 때문에
       게임 전체가 오프라인에서 못 열리면 안 된다 */
    await Promise.allSettled(SHELL.map(u => c.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;   // 바깥은 손대지 않는다
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      /* 문서를 못 가져오면 게임 화면이라도 준다 */
      if (req.mode === 'navigate') {
        const shell = await caches.match('./rush.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
