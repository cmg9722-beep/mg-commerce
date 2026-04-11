"""MG Commerce 설정"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("MG_DATA_DIR", os.path.join(BASE_DIR, "data"))
DB_PATH = os.path.join(DATA_DIR, "db.sqlite3")

# 쿠팡 로켓그로스 수수료
COUPANG_FEE_RATE = 10.8  # %
COUPANG_PROMO_DEADLINE = "2026-04-30"
COUPANG_PROMO_LOGISTICS_FREE_DAYS = 90
COUPANG_PROMO_SAVER_FREE_DAYS = 270

# 배대지 (타배 위해시 창고)
WAREHOUSE = {
    "address_cn": "山东省 威海市 环翠区 凤林街道 梧桐路南500米贵和光电院内2号仓库",
    "receiver": "TB96329",
    "phone": "18563144074",
    "zip": "264205",
}

# 배송비/통관비 기본값 (원)
DEFAULT_SHIPPING_DOMESTIC_KRW = 0      # 프로모션 기간 0원
DEFAULT_SHIPPING_INTL_KRW = 3000       # 배대지→한국 (개당 추정)
DEFAULT_CUSTOMS_KRW = 0                # 소액 면세 (150달러 이하)
DEFAULT_WAREHOUSING_KRW = 0            # 프로모션 기간 0원

# 제품 평가 기준 (가중치)
PRODUCT_CRITERIA = {
    "margin_rate": {"weight": 30, "min": 40, "desc": "마진율 (%)"},
    "competition": {"weight": 20, "min": 0, "desc": "쿠팡 경쟁강도 (낮을수록 좋음, 0~100)"},
    "return_rate": {"weight": 15, "min": 0, "desc": "예상 반품률 (낮을수록 좋음, %)"},
    "supplier_grade": {"weight": 15, "min": 70, "desc": "공급사 등급 (0~100)"},
    "kc_exempt": {"weight": 10, "min": 0, "desc": "KC인증 면제 여부 (100=면제, 0=필요)"},
    "moq_friendly": {"weight": 10, "min": 0, "desc": "MOQ 적합성 (100=1개부터, 0=대량만)"},
}

# 환율 API
EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/CNY"
DEFAULT_EXCHANGE_RATE = 200  # CNY→KRW 기본값

# 1688 검색 카테고리 (관심 카테고리)
SEARCH_CATEGORIES = [
    {"name": "전자부품/공구", "keywords_cn": ["防静电", "电子工具", "焊接工具"]},
    {"name": "테이프/접착제", "keywords_cn": ["高温胶带", "聚酰亚胺胶带", "工业胶带"]},
    {"name": "스포츠 용품", "keywords_cn": ["运动护腕", "健身配件", "运动护具"]},
    {"name": "IT 액세서리", "keywords_cn": ["USB风扇", "迷你风扇", "桌面风扇"]},
    {"name": "골프 용품", "keywords_cn": ["高尔夫球标", "高尔夫配件"]},
    {"name": "생활 소품", "keywords_cn": ["创意礼品", "实用小物"]},
]
