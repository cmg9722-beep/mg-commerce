"""SQLite DB 초기화 및 마이그레이션"""
import sqlite3
import os
from datetime import datetime
from config import DB_PATH


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT,
        name_ko TEXT NOT NULL,
        name_cn TEXT,
        category TEXT,
        coupang_price INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        score REAL DEFAULT 0,
        margin_category TEXT,
        notes TEXT,
        -- 홈페이지 표시용 필드
        show_on_homepage INTEGER DEFAULT 0,
        display_order INTEGER DEFAULT 99,
        description TEXT,
        tag_label TEXT,
        tag_type TEXT DEFAULT 'new',
        emoji TEXT DEFAULT '📦',
        img_gradient TEXT,
        coupang_link TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER REFERENCES products(id),
        name_ko TEXT,
        name_cn TEXT,
        chat_name TEXT,
        location TEXT,
        grade TEXT,
        reorder_rate TEXT,
        sample_price TEXT,
        bulk_100 TEXT,
        bulk_500 TEXT,
        moq TEXT,
        notes TEXT,
        status TEXT DEFAULT '답변대기',
        sample_status TEXT,
        tracking_no TEXT,
        cert_sgs INTEGER DEFAULT 0,
        cert_msds INTEGER DEFAULT 0,
        cert_rohs INTEGER DEFAULT 0,
        cert_tds INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER REFERENCES suppliers(id),
        order_type TEXT CHECK(order_type IN ('sample','bulk')),
        qty INTEGER DEFAULT 1,
        unit_price_cny REAL,
        total_cny REAL,
        status TEXT DEFAULT 'pending',
        tracking_no TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER REFERENCES products(id),
        step_name TEXT NOT NULL,
        step_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','progress','done')),
        due_date TEXT,
        completed_at TEXT,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER REFERENCES suppliers(id),
        event_date TEXT,
        event_name TEXT,
        done INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS inspection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER REFERENCES products(id),
        item_name TEXT,
        checked INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS margin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER REFERENCES products(id),
        exchange_rate REAL,
        cost_cny REAL,
        cost_krw REAL,
        shipping_krw REAL DEFAULT 0,
        customs_krw REAL DEFAULT 0,
        coupang_price INTEGER,
        fee_rate REAL,
        fee_krw REAL,
        margin_krw REAL,
        margin_pct REAL,
        promo_applied INTEGER DEFAULT 1,
        calculated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS product_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_cn TEXT,
        name_ko TEXT,
        category TEXT,
        price_cny REAL,
        supplier_name TEXT,
        supplier_grade TEXT,
        supplier_location TEXT,
        coupang_est_price INTEGER,
        est_margin_pct REAL,
        competition_score INTEGER,
        return_rate_est REAL,
        kc_exempt INTEGER DEFAULT 1,
        moq INTEGER,
        total_score REAL DEFAULT 0,
        status TEXT DEFAULT 'new',
        source_url TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        status TEXT DEFAULT 'todo' CHECK(status IN ('todo','progress','done')),
        target_date TEXT,
        completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        message TEXT NOT NULL,
        product TEXT,
        status TEXT DEFAULT 'new' CHECK(status IN ('new','replied','closed')),
        reply TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        replied_at TEXT
    );
    """)
    conn.commit()
    conn.close()


def migrate_db():
    """기존 DB에 홈페이지 표시용 컬럼 추가 (마이그레이션)"""
    conn = get_db()
    cols = [r[1] for r in conn.execute("PRAGMA table_info(products)").fetchall()]
    new_cols = {
        "show_on_homepage": "INTEGER DEFAULT 0",
        "display_order": "INTEGER DEFAULT 99",
        "description": "TEXT",
        "tag_label": "TEXT",
        "tag_type": "TEXT DEFAULT 'new'",
        "emoji": "TEXT DEFAULT '📦'",
        "img_gradient": "TEXT",
        "coupang_link": "TEXT",
    }
    for col, typedef in new_cols.items():
        if col not in cols:
            conn.execute(f"ALTER TABLE products ADD COLUMN {col} {typedef}")
    conn.commit()
    conn.close()


def seed_initial_data():
    """기존 JSX 데이터를 DB에 마이그레이션"""
    conn = get_db()

    # 이미 데이터가 있으면 스킵
    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] > 0:
        conn.close()
        return

    # 제품 6종 (홈페이지 표시 포함)
    products = [
        ("①", "ESD 무선 정전기방지 팔찌", "防静电手环", "전자부품/공구", 9900, "active", "높음",
         1, 1, "전자기기 작업 시 정전기 보호. 무선 설계로 자유로운 작업.", "TECH", "new", "⚡", "linear-gradient(135deg,#e0e7ff,#c7d2fe)", ""),
        ("②", "카프톤(폴리이미드) 테이프", "聚酰亚胺胶带", "테이프/접착제", 9900, "active", "최고",
         1, 2, "내열 260°C 고온 테이프. 납땜, 절연, 3D프린터에 최적.", "BEST", "best", "🔥", "linear-gradient(135deg,#fef3c7,#fde68a)", ""),
        ("③", "프리미엄 운동 손목밴드", "运动护腕", "스포츠 용품", 12900, "active", "보통",
         1, 3, "건초염 예방 압박밴드. 벨크로 방식, 4가지 컬러.", "SPORTS", "hot", "💪", "linear-gradient(135deg,#d1fae5,#a7f3d0)", ""),
        ("⑤", "USB 미니 선풍기", "USB迷你风扇", "IT 액세서리", 9900, "active", "보통",
         1, 4, "3단 풍속, USB 전원, 사무실/차량 겸용. 저소음 설계.", "TREND", "trend", "🌀", "linear-gradient(135deg,#e0e7ff,#c7d2fe)", ""),
        ("⑥", "컬러 스포츠 흡한 손목밴드", "彩色运动吸汗护腕", "스포츠 용품", 6900, "active", "보통",
         1, 5, "고탄력 흡한속건 소재. 15가지 컬러, 러닝·헬스·사이클링 만능.", "COLOR", "best", "🌈", "linear-gradient(135deg,#fce7f3,#fbcfe8)", ""),
        ("⑦", "초경량 USB 핸디 선풍기", "超轻量USB手持风扇", "IT 액세서리", 7900, "active", "보통",
         1, 6, "충전식 휴대용, 폰거치대 겸용. 82g 초경량 설계.", "SUMMER", "new", "🍃", "linear-gradient(135deg,#ecfccb,#d9f99d)", ""),
    ]
    for p in products:
        conn.execute(
            """INSERT INTO products (code, name_ko, name_cn, category, coupang_price, status, margin_category,
               show_on_homepage, display_order, description, tag_label, tag_type, emoji, img_gradient, coupang_link)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            p
        )

    # 공급사 4곳
    suppliers = [
        (1, "우지 테크놀로지", "五祉科技有限公司", "五祉科技有限公司", "광저우", "A+A", "-",
         "¥1.50", "추후 협의", "-", "1", "闪电棱镜 시리즈, 드롭쉬핑 지원", "답변대기", "주문메시지발송"),
        (2, "xmyydz1688", "xmyydz1688", "xmyydz1688", "샤먼(厦门)", "공장입사", "-",
         "🆓 무료!", "¥4.00/롤", "-", "1", "무료 샘플 + 무료 배송! MG COMMERCE 라벨 인쇄", "샘플확정", "내일(4/12) 무료발송 예정"),
        (3, "오미스 스포츠 용품", "奥美斯体育用品股份有限公司", "오미스 스포츠 용품 주식회사", "양저우", "공장입사", "-",
         "¥5.20", "¥4.80", "¥4.50", "2", "OEM/ODM 가능, 한국 직배송 가능", "답변대기", "주문메시지발송"),
        (4, "원 세일 토이 팩토리", "暖帆玩具厂", "원 세일 토이 팩토리", "이우(义乌)", "A+A", "80%",
         "¥4.20", "¥4.20", "¥4.20", "1", "100개/500개 동일 단가 ¥4.2, 보라색/민트", "단가확인", "단가 ¥4.2 확인, 샘플 대기"),
    ]
    for s in suppliers:
        conn.execute(
            "INSERT INTO suppliers (product_id, name_ko, name_cn, chat_name, location, grade, reorder_rate, sample_price, bulk_100, bulk_500, moq, notes, status, sample_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            s
        )

    # 타임라인 이벤트
    timeline = [
        # 공급사1 (ESD)
        (1, "4/9", "1차 문의 발송", 1), (1, "4/9", "견적 회수 (¥1.50)", 1),
        (1, "4/11", "창고주소 전달", 1), (1, "4/11", "샘플 주문 메시지 발송", 1),
        (1, "-", "담당자 연결 대기", 0), (1, "-", "샘플 발송 확인", 0),
        (1, "-", "트래킹번호 입력", 0), (1, "-", "타배 창고 도착", 0),
        (1, "-", "한국 배송", 0), (1, "-", "검수 완료", 0),
        # 공급사2 (카프톤)
        (2, "4/9", "1차 문의 발송", 1), (2, "4/9", "견적 회수 (¥4.00)", 1),
        (2, "4/11", "창고주소 전달", 1), (2, "4/11", "무료 샘플 확정!", 1),
        (2, "4/11", "배송비 무료 확정!", 1), (2, "4/11", "MG COMMERCE 라벨 요청", 1),
        (2, "4/12", "샘플 발송 예정", 0), (2, "-", "트래킹번호 입력", 0),
        (2, "-", "타배 창고 도착", 0), (2, "-", "한국 배송", 0), (2, "-", "검수 완료", 0),
        # 공급사3 (운동밴드)
        (3, "4/9", "1차 문의 발송", 1), (3, "4/9", "견적 회수 (100개 ¥4.80)", 1),
        (3, "4/11", "창고주소 전달", 1), (3, "4/11", "샘플 주문 메시지 발송", 1),
        (3, "-", "주말 답변 대기", 0), (3, "-", "샘플 발송 확인", 0),
        (3, "-", "트래킹번호 입력", 0), (3, "-", "타배 창고 도착", 0),
        (3, "-", "한국 배송", 0), (3, "-", "검수 완료", 0),
        # 공급사4 (선풍기)
        (4, "4/11", "공급사 교체 (골프→선풍기)", 1), (4, "4/11", "문의 발송", 1),
        (4, "4/11", "창고주소 전달", 1), (4, "4/11", "단가 확인 ¥4.2", 1),
        (4, "4/11", "샘플 주문 메시지 발송", 1), (4, "-", "샘플 발송 확인", 0),
        (4, "-", "트래킹번호 입력", 0), (4, "-", "타배 창고 도착", 0),
        (4, "-", "한국 배송", 0), (4, "-", "검수 완료", 0),
    ]
    for t in timeline:
        conn.execute("INSERT INTO timeline_events (supplier_id, event_date, event_name, done) VALUES (?,?,?,?)", t)

    # 마일스톤
    milestones = [
        ("쿠팡 로켓그로스 가입", "done", "4/7"),
        ("KYC 인증", "done", "4/7"),
        ("통신판매업 신고", "done", "4/7"),
        ("사업자 등록", "done", "4/7"),
        ("1688 공급사 발굴 (4종)", "done", "4/8"),
        ("1688 샘플 문의 발송", "done", "4/9"),
        ("1688 1차 견적 회수", "done", "4/9"),
        ("④ 골프 → ⑤ USB선풍기 교체", "done", "4/11"),
        ("타배 배대지 가입 (위해시 창고)", "done", "4/11"),
        ("4곳 창고주소 전달 + 샘플 주문", "done", "4/11"),
        ("② 카프톤 무료 샘플 확정", "done", "4/11"),
        ("쿠팡 경쟁사 분석 완료", "done", "4/11"),
        ("상세페이지 카피 4종 초안", "done", "4/11"),
        ("공급사 응답 대기 + 주문 확정", "progress", "4/11~12"),
        ("② 카프톤 인증서류 요청", "todo", "4/12"),
        ("타배 배송대행 신청 (트래킹번호)", "todo", "4/12~13"),
        ("샘플 도착 + 품질 검수", "todo", "4/18"),
        ("본주문 발주 (100개x4종)", "todo", "4/19"),
        ("쿠팡 Wing 상품 등록", "todo", "4/25"),
        ("쿠팡 런칭 D-Day!", "todo", "4/30"),
    ]
    for m in milestones:
        conn.execute("INSERT INTO milestones (task, status, target_date) VALUES (?,?,?)", m)

    # 검수 체크리스트
    inspection = {
        1: ["외관 스크래치/파손 확인", "착용감 테스트", "정전기 방전 테스트", "잠금장치 작동 확인", "디자인/색상 일치 확인", "포장 상태 확인"],
        2: ["롤 표면 주름/기포 확인", "가장자리 절단면 깔끔한지", "롤 감김 균일한지", "접착력 테스트 (금속 표면)",
            "잔접착 확인 (떼었을 때)", "내열 테스트 (라이터 3초)", "두께 0.05mm 확인 (캘리퍼스)",
            "폭/길이 스펙 일치 확인", "MG COMMERCE 라벨 확인"],
        3: ["원단 질감/두께 확인", "봉제 상태 확인", "땀 흡수력 테스트", "신축성 테스트",
            "4색 색상 일치 확인", "세탁 후 변형 확인", "포장 상태 확인"],
        4: ["외관 스크래치/파손 확인", "USB 연결 테스트", "팬 회전 정상 확인", "풍량 테스트 (3단계)",
            "소음 레벨 확인", "색상 일치 확인 (보라/민트)", "케이블 포함 확인", "포장 상태 확인"],
    }
    for pid, items in inspection.items():
        for item in items:
            conn.execute("INSERT INTO inspection_items (product_id, item_name) VALUES (?,?)", (pid, item))

    conn.commit()
    conn.close()
