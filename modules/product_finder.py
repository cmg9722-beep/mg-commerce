"""신규 제품 발굴 엔진"""
from modules.database import get_db
from modules.exchange_rate import get_cny_to_krw
from config import PRODUCT_CRITERIA, COUPANG_FEE_RATE


def score_product(candidate):
    """제품 후보 평가 (0~100점)"""
    total = 0
    details = {}

    for key, crit in PRODUCT_CRITERIA.items():
        val = candidate.get(key, 0)
        weight = crit["weight"]

        if key == "margin_rate":
            # 마진율 40% 이상이면 만점, 비례 스코어
            score = min(val / 60 * 100, 100) if val > 0 else 0
        elif key == "competition":
            # 경쟁강도: 낮을수록 좋음 (역전 스코어)
            score = max(100 - val, 0)
        elif key == "return_rate":
            # 반품률: 낮을수록 좋음
            score = max(100 - val * 5, 0)
        elif key == "supplier_grade":
            score = min(val, 100)
        elif key == "kc_exempt":
            score = 100 if val else 0
        elif key == "moq_friendly":
            score = val
        else:
            score = val

        weighted = round(score * weight / 100, 1)
        total += weighted
        details[key] = {"raw": val, "score": round(score, 1), "weighted": weighted}

    return {"total_score": round(total, 1), "details": details}


def estimate_margin_rate(cost_cny, coupang_price_krw, rate=None):
    """예상 마진율 계산 (제품 발굴용 간이 계산)"""
    if rate is None:
        rate = get_cny_to_krw()
    cost_krw = cost_cny * rate
    fee_krw = coupang_price_krw * COUPANG_FEE_RATE / 100
    margin = coupang_price_krw - cost_krw - fee_krw
    return round(margin / coupang_price_krw * 100, 1) if coupang_price_krw > 0 else 0


def add_candidate(data):
    """신규 제품 후보 추가 + 자동 스코어링"""
    rate = get_cny_to_krw()
    margin_rate = estimate_margin_rate(
        data.get("price_cny", 0),
        data.get("coupang_est_price", 9900),
        rate
    )

    scoring_input = {
        "margin_rate": margin_rate,
        "competition": data.get("competition_score", 50),
        "return_rate": data.get("return_rate_est", 10),
        "supplier_grade": data.get("supplier_grade_score", 70),
        "kc_exempt": data.get("kc_exempt", 1),
        "moq_friendly": _moq_score(data.get("moq", 1)),
    }
    result = score_product(scoring_input)

    conn = get_db()
    conn.execute("""
        INSERT INTO product_candidates
        (name_cn, name_ko, category, price_cny, supplier_name, supplier_grade,
         supplier_location, coupang_est_price, est_margin_pct, competition_score,
         return_rate_est, kc_exempt, moq, total_score, source_url, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        data.get("name_cn"), data.get("name_ko"), data.get("category"),
        data.get("price_cny", 0), data.get("supplier_name"), data.get("supplier_grade"),
        data.get("supplier_location"), data.get("coupang_est_price", 9900),
        margin_rate, data.get("competition_score", 50),
        data.get("return_rate_est", 10), data.get("kc_exempt", 1),
        data.get("moq", 1), result["total_score"],
        data.get("source_url"), data.get("notes"),
    ))
    conn.commit()
    cid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": cid, **result, "est_margin_pct": margin_rate}


def get_candidates(status=None, min_score=0):
    """제품 후보 목록 조회"""
    conn = get_db()
    if status:
        rows = conn.execute(
            "SELECT * FROM product_candidates WHERE status=? AND total_score>=? ORDER BY total_score DESC",
            (status, min_score)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM product_candidates WHERE total_score>=? ORDER BY total_score DESC",
            (min_score,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_candidate_status(candidate_id, status):
    conn = get_db()
    conn.execute("UPDATE product_candidates SET status=? WHERE id=?", (status, candidate_id))
    conn.commit()
    conn.close()


def promote_to_product(candidate_id):
    """후보 → 정식 제품으로 승격"""
    conn = get_db()
    c = conn.execute("SELECT * FROM product_candidates WHERE id=?", (candidate_id,)).fetchone()
    if not c:
        conn.close()
        return None

    conn.execute("""
        INSERT INTO products (name_ko, name_cn, category, coupang_price, status, score)
        VALUES (?,?,?,?,?,?)
    """, (c["name_ko"] or c["name_cn"], c["name_cn"], c["category"],
          c["coupang_est_price"], "active", c["total_score"]))
    pid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    conn.execute("UPDATE product_candidates SET status='promoted' WHERE id=?", (candidate_id,))
    conn.commit()
    conn.close()
    return pid


def get_search_suggestions():
    """1688 검색 키워드 제안 (높은 마진 기대 카테고리 기반)"""
    suggestions = [
        {"category": "산업용 소모품", "keywords": ["防静电", "高温胶带", "绝缘胶带", "导热硅脂"],
         "reason": "KC면제 + 높은 마진 + 낮은 경쟁"},
        {"category": "전자 액세서리", "keywords": ["USB风扇", "手机支架", "数据线", "充电宝"],
         "reason": "대중적 수요 + 소형경량"},
        {"category": "스포츠 보호대", "keywords": ["护腕", "护膝", "运动绷带", "护踝"],
         "reason": "재구매율 높음 + 사이즈 다양"},
        {"category": "사무 용품", "keywords": ["桌面收纳", "文件架", "笔筒", "便签盒"],
         "reason": "B2B 가능성 + 안정 수요"},
        {"category": "차량 용품", "keywords": ["车载手机支架", "遮阳板", "汽车香薰"],
         "reason": "높은 판매가 가능 + 트렌드"},
        {"category": "반려동물", "keywords": ["宠物玩具", "宠物碗", "猫抓板"],
         "reason": "성장 시장 + 감성 프리미엄"},
    ]
    return suggestions


def _moq_score(moq):
    """MOQ 기반 점수 (1개=100, 10개=80, 100개=50, 500+=20)"""
    if moq <= 1:
        return 100
    elif moq <= 5:
        return 90
    elif moq <= 10:
        return 80
    elif moq <= 50:
        return 60
    elif moq <= 100:
        return 50
    elif moq <= 500:
        return 30
    return 20
