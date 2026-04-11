"""쿠팡 상품등록 보조 모듈"""
from modules.database import get_db


def generate_product_page(product_id):
    """상세페이지 HTML 템플릿 생성"""
    conn = get_db()
    p = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    s = conn.execute("SELECT * FROM suppliers WHERE product_id=? LIMIT 1", (product_id,)).fetchone()
    conn.close()
    if not p:
        return None

    name = p["name_ko"]
    price = f'{p["coupang_price"]:,}'

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>{name} - MG COMMERCE</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Malgun Gothic',sans-serif;color:#333;max-width:860px;margin:0 auto}}
.hero{{background:linear-gradient(135deg,#1e3a5f,#2d5a87);color:#fff;padding:40px 30px;text-align:center}}
.hero h1{{font-size:28px;margin-bottom:10px}}
.hero .price{{font-size:36px;font-weight:900;color:#ffd700}}
.hero .badge{{display:inline-block;background:#e74c3c;padding:4px 12px;border-radius:20px;font-size:13px;margin-top:8px}}
.section{{padding:30px;border-bottom:1px solid #eee}}
.section h2{{font-size:20px;color:#1e3a5f;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #1e3a5f}}
.feature-grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.feature{{background:#f8f9fa;padding:16px;border-radius:10px;border-left:4px solid #2d5a87}}
.feature h3{{font-size:15px;color:#1e3a5f;margin-bottom:6px}}
.feature p{{font-size:13px;color:#666}}
.spec-table{{width:100%;border-collapse:collapse}}
.spec-table td{{padding:10px 14px;border-bottom:1px solid #eee;font-size:14px}}
.spec-table td:first-child{{font-weight:700;color:#1e3a5f;width:35%;background:#f8f9fa}}
.trust{{background:#f0f7ff;padding:20px;border-radius:10px;margin-top:16px}}
.trust li{{padding:6px 0;font-size:14px}}
.footer-badge{{text-align:center;padding:20px;background:#1e3a5f;color:#fff;font-size:13px}}
</style></head>
<body>
<div class="hero">
  <div class="badge">로켓그로스 빠른배송</div>
  <h1>{name}</h1>
  <div class="price">{price}원</div>
  <p style="margin-top:12px;font-size:14px;opacity:0.9">MG COMMERCE | 20년 제조업 전문가가 직접 검수</p>
</div>

<div class="section">
  <h2>제품 특징</h2>
  <div class="feature-grid">
    <div class="feature"><h3>전문가 직접 검수</h3><p>20년 제조업 경력의 품질관리 전문가가 전수검사합니다</p></div>
    <div class="feature"><h3>빠른 CS 대응</h3><p>24시간 이내 고객 문의 응대</p></div>
    <div class="feature"><h3>안심 포장</h3><p>파손 방지 특수 포장으로 안전하게 배송</p></div>
    <div class="feature"><h3>교환/반품 보장</h3><p>제품 하자 시 무조건 교환/환불</p></div>
  </div>
</div>

<div class="section">
  <h2>제품 사양</h2>
  <table class="spec-table">
    <tr><td>브랜드</td><td>MG COMMERCE</td></tr>
    <tr><td>제품명</td><td>{name}</td></tr>
    <tr><td>원산지</td><td>중국</td></tr>
    <tr><td>판매가</td><td>{price}원</td></tr>
  </table>
</div>

<div class="section">
  <h2>MG COMMERCE를 선택하는 이유</h2>
  <div class="trust">
    <ul>
      <li>20년 제조업 전문가의 검수 기준 공개</li>
      <li>실측치 기반 정확한 스펙 표기</li>
      <li>전문 세트 구성으로 최고의 가성비</li>
      <li>신속한 AS 및 고객 응대</li>
      <li>쿠팡 로켓그로스 빠른 배송</li>
    </ul>
  </div>
</div>

<div class="footer-badge">
  MG COMMERCE &middot; 품질에 자신 있습니다
</div>
</body></html>"""
    return {"product_name": name, "html": html}


def generate_product_title(product_name, keywords=None):
    """쿠팡 상품명 생성 (SEO 최적화)"""
    base_keywords = {
        "ESD": ["정전기방지", "ESD", "무선", "팔찌", "정전기제거", "산업용", "전자작업"],
        "카프톤": ["카프톤테이프", "폴리이미드", "내열", "고온", "PI테이프", "절연", "산업용"],
        "손목밴드": ["스포츠", "손목보호대", "운동", "헬스", "압박밴드", "손목아대", "건초염"],
        "선풍기": ["USB선풍기", "미니선풍기", "휴대용", "탁상용", "저소음", "사무실"],
    }

    matched = []
    for key, kws in base_keywords.items():
        if key in product_name:
            matched = kws
            break

    if keywords:
        matched = keywords + matched

    title = f"[MG COMMERCE] {product_name}"
    if matched:
        title += " " + " ".join(matched[:5])

    return {
        "title": title[:100],
        "keywords": matched,
        "tips": [
            "상품명 80자 이내 권장",
            "핵심 키워드 앞쪽 배치",
            "[브랜드명] 제품명 키워드1 키워드2 형식",
            "숫자+단위 포함 (예: 0.05mm, 100개입)",
        ]
    }


def generate_price_strategy(cost_cny, exchange_rate, competitors=None):
    """가격 전략 추천"""
    cost_krw = cost_cny * exchange_rate
    fee_rate = 10.8

    strategies = []
    for label, multiplier in [("공격적", 2.5), ("균형", 3.0), ("프리미엄", 4.0), ("고급", 5.0)]:
        price = round(cost_krw * multiplier / 100) * 100  # 100원 단위
        price = max(price, 5900)  # 최소 5,900원
        fee = price * fee_rate / 100
        margin = price - cost_krw - fee
        margin_pct = margin / price * 100 if price > 0 else 0
        strategies.append({
            "label": label,
            "price": price,
            "margin_krw": round(margin),
            "margin_pct": round(margin_pct, 1),
        })

    return {
        "cost_krw": round(cost_krw),
        "strategies": strategies,
        "recommendation": "프로모션 기간에는 '균형' 전략으로 시작, 리뷰 확보 후 가격 조정 권장",
    }


def get_listing_checklist():
    """쿠팡 Wing 상품등록 체크리스트"""
    return [
        {"step": "상품 카테고리 선택", "desc": "가장 정확한 카테고리 선택 (검색 노출 영향)"},
        {"step": "상품명 입력", "desc": "SEO 키워드 포함, 80자 이내"},
        {"step": "상품 이미지 등록", "desc": "대표이미지 1장 + 상세이미지 4장 이상, 정사각형 1000x1000px"},
        {"step": "판매가 설정", "desc": "경쟁사 대비 적정 가격"},
        {"step": "상세페이지 등록", "desc": "HTML 또는 이미지 업로드"},
        {"step": "배송 설정", "desc": "로켓그로스 배송 선택"},
        {"step": "옵션 설정", "desc": "색상/사이즈 등 옵션이 있는 경우"},
        {"step": "반품/교환 정책", "desc": "쿠팡 기본 정책 + 자체 보증"},
        {"step": "재고 수량 입력", "desc": "실제 입고 예정 수량"},
        {"step": "검수 완료 확인", "desc": "품질 검수 체크리스트 완료 후 등록"},
    ]
