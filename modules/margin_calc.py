"""마진 자동 계산 모듈"""
from modules.exchange_rate import get_cny_to_krw, convert_cny_to_krw
from modules.database import get_db
from config import (
    COUPANG_FEE_RATE,
    DEFAULT_SHIPPING_INTL_KRW,
    DEFAULT_CUSTOMS_KRW,
    DEFAULT_WAREHOUSING_KRW,
)


def calc_margin(cost_cny, coupang_price_krw, rate=None, promo=True,
                shipping_intl=None, customs=None, qty=1):
    """단일 제품 마진 계산"""
    if rate is None:
        rate = get_cny_to_krw()
    if shipping_intl is None:
        shipping_intl = DEFAULT_SHIPPING_INTL_KRW if not promo else 0
    if customs is None:
        customs = DEFAULT_CUSTOMS_KRW

    cost_krw = convert_cny_to_krw(cost_cny, rate)
    total_cost = cost_krw + shipping_intl + customs
    fee_krw = round(coupang_price_krw * COUPANG_FEE_RATE / 100)
    margin_krw = coupang_price_krw - total_cost - fee_krw
    margin_pct = round((margin_krw / coupang_price_krw * 100), 1) if coupang_price_krw > 0 else 0

    return {
        "cost_cny": cost_cny,
        "exchange_rate": rate,
        "cost_krw": cost_krw,
        "shipping_krw": shipping_intl,
        "customs_krw": customs,
        "total_cost_krw": total_cost,
        "coupang_price": coupang_price_krw,
        "fee_rate": COUPANG_FEE_RATE,
        "fee_krw": fee_krw,
        "margin_krw": margin_krw,
        "margin_pct": margin_pct,
        "margin_total_krw": margin_krw * qty,
        "qty": qty,
        "promo_applied": promo,
    }


def calc_all_products(rate=None, promo=True):
    """모든 활성 제품의 마진 일괄 계산"""
    if rate is None:
        rate = get_cny_to_krw()
    conn = get_db()
    products = conn.execute("""
        SELECT p.id, p.code, p.name_ko, p.coupang_price, s.sample_price, s.bulk_100
        FROM products p
        LEFT JOIN suppliers s ON s.product_id = p.id
        WHERE p.status = 'active'
    """).fetchall()
    conn.close()

    results = []
    for p in products:
        price_str = p["bulk_100"] or p["sample_price"] or "0"
        # 가격 문자열에서 숫자 추출
        cost = _parse_price(price_str)
        if cost <= 0:
            cost = _parse_price(p["sample_price"] or "0")

        m = calc_margin(cost, p["coupang_price"], rate=rate, promo=promo, qty=100)
        m["product_id"] = p["id"]
        m["product_code"] = p["code"]
        m["product_name"] = p["name_ko"]
        results.append(m)
    return results


def simulate_price(cost_cny, rate=None, promo=True, price_range=None):
    """판매가별 마진 시뮬레이션"""
    if rate is None:
        rate = get_cny_to_krw()
    if price_range is None:
        price_range = range(5900, 20000, 1000)

    return [
        calc_margin(cost_cny, price, rate=rate, promo=promo)
        for price in price_range
    ]


def save_margin_log(product_id, margin_data):
    """마진 계산 결과 저장"""
    conn = get_db()
    conn.execute("""
        INSERT INTO margin_logs
        (product_id, exchange_rate, cost_cny, cost_krw, shipping_krw, customs_krw,
         coupang_price, fee_rate, fee_krw, margin_krw, margin_pct, promo_applied)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        product_id, margin_data["exchange_rate"], margin_data["cost_cny"],
        margin_data["cost_krw"], margin_data["shipping_krw"], margin_data["customs_krw"],
        margin_data["coupang_price"], margin_data["fee_rate"], margin_data["fee_krw"],
        margin_data["margin_krw"], margin_data["margin_pct"], 1 if margin_data["promo_applied"] else 0,
    ))
    conn.commit()
    conn.close()


def _parse_price(s):
    """가격 문자열에서 숫자 추출 (¥4.20 → 4.2)"""
    if not s:
        return 0.0
    import re
    nums = re.findall(r"[\d.]+", str(s))
    return float(nums[0]) if nums else 0.0
