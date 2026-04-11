"""환율 자동 조회 모듈"""
import requests
import time

_cache = {"rate": None, "ts": 0}
CACHE_TTL = 3600  # 1시간


def get_cny_to_krw():
    """CNY→KRW 실시간 환율 조회 (1시간 캐싱)"""
    now = time.time()
    if _cache["rate"] and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["rate"]

    try:
        resp = requests.get(
            "https://api.exchangerate-api.com/v4/latest/CNY",
            timeout=5
        )
        data = resp.json()
        rate = data["rates"].get("KRW", 200)
        _cache["rate"] = round(rate, 2)
        _cache["ts"] = now
        return _cache["rate"]
    except Exception:
        pass

    # 폴백: 네이버 환율 (간이)
    try:
        resp = requests.get(
            "https://api.manana.kr/exchange/rate.json",
            timeout=5
        )
        data = resp.json()
        cny_rate = None
        for item in data:
            if item.get("name") == "CNYKRW=X":
                cny_rate = item.get("rate")
                break
        if cny_rate:
            _cache["rate"] = round(cny_rate, 2)
            _cache["ts"] = now
            return _cache["rate"]
    except Exception:
        pass

    return 200.0  # 기본값


def convert_cny_to_krw(amount_cny, rate=None):
    """위안화 → 원화 변환"""
    if rate is None:
        rate = get_cny_to_krw()
    return round(amount_cny * rate)


def get_rate_info():
    """환율 정보 딕셔너리 반환"""
    rate = get_cny_to_krw()
    return {
        "cny_to_krw": rate,
        "cached": _cache["ts"] > 0,
        "last_update": time.strftime("%Y-%m-%d %H:%M", time.localtime(_cache["ts"])) if _cache["ts"] else "없음",
    }
