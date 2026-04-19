"""
SQLite (로컬) / PostgreSQL (Render 프로덕션) 이중 지원 DB 모듈

- 환경변수 DATABASE_URL 없음  → 로컬 SQLite 사용
- 환경변수 DATABASE_URL 있음  → Neon/PostgreSQL 사용 (배포해도 데이터 유지!)

app.py / 모든 모듈의 SQL 코드는 변경 불필요.
wrapper가 자동으로 SQLite 문법 → PostgreSQL 문법 변환.
"""
import sqlite3
import os
import re
from datetime import datetime
from config import DB_PATH

# Render 환경변수에서 PostgreSQL 연결 URL 읽기
DATABASE_URL = os.environ.get('DATABASE_URL')


# ─── 연결 팩토리 ──────────────────────────────────────────────────────────────

def get_db():
    """DB 연결 반환.
    로컬: SQLite  /  Render 배포: PostgreSQL (DATABASE_URL 환경변수 필요)
    """
    if DATABASE_URL:
        return _PgConn(_pg_connect())
    return _sqlite_connect()


def _sqlite_connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _pg_connect():
    import psycopg2
    url = DATABASE_URL
    # Render가 postgres:// 형식으로 줄 때 postgresql://로 교정
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return psycopg2.connect(url)


# ─── SQL 자동 변환 ────────────────────────────────────────────────────────────

_DT_PG = "to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')"

def _to_pg_sql(sql: str) -> str:
    """SQLite SQL → PostgreSQL SQL 자동 변환"""
    # ? → %s (파라미터 플레이스홀더)
    sql = sql.replace('?', '%s')
    # datetime 함수
    sql = re.sub(
        r"datetime\('now'(?:,\s*'localtime')?\)",
        _DT_PG, sql, flags=re.IGNORECASE
    )
    # last_insert_rowid() → lastval()
    sql = re.sub(r'\blast_insert_rowid\(\)', 'lastval()', sql, flags=re.IGNORECASE)
    return sql


def _to_pg_ddl(script: str) -> str:
    """SQLite DDL → PostgreSQL DDL 변환 (CREATE TABLE 전용)"""
    # AUTOINCREMENT → SERIAL
    script = re.sub(
        r'INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT',
        'SERIAL PRIMARY KEY',
        script, flags=re.IGNORECASE
    )
    # TEXT DEFAULT (datetime('now','localtime'))
    script = re.sub(
        r"TEXT\s+DEFAULT\s+\(datetime\('now'(?:,\s*'localtime')?\)\)",
        f"TEXT DEFAULT ({_DT_PG})",
        script, flags=re.IGNORECASE
    )
    return script


# ─── PostgreSQL Row 래퍼 ──────────────────────────────────────────────────────

class _Row(dict):
    """sqlite3.Row 호환: row['col'] 과 row[0] 모두 지원"""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


class _FakeCursor:
    """미리 가져온 rows를 sqlite3 커서처럼 반환"""
    def __init__(self, rows):
        self._rows = list(rows)
        self.rowcount = len(self._rows)

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows

    def __iter__(self):
        return iter(self._rows)


class _PgCursor:
    """psycopg2 RealDictCursor를 sqlite3 커서처럼 래핑"""
    def __init__(self, cur):
        self._c = cur

    def fetchone(self):
        row = self._c.fetchone()
        return _Row(row) if row else None

    def fetchall(self):
        rows = self._c.fetchall()
        return [_Row(r) for r in rows]

    @property
    def lastrowid(self):
        """INSERT RETURNING id 후 삽입된 id 반환"""
        try:
            row = self._c.fetchone()
            if row:
                r = _Row(row)
                return r.get('id') or r[0]
        except Exception:
            pass
        return None

    @property
    def rowcount(self):
        return self._c.rowcount

    def __iter__(self):
        for row in self._c:
            yield _Row(row)


# ─── PostgreSQL 연결 래퍼 ─────────────────────────────────────────────────────

class _PgConn:
    """psycopg2 연결을 sqlite3 연결처럼 래핑 — 기존 코드 무변경"""

    def __init__(self, conn):
        import psycopg2.extras
        self._conn = conn
        self._dict_factory = psycopg2.extras.RealDictCursor

    def _cursor(self):
        return self._conn.cursor(cursor_factory=self._dict_factory)

    # --- execute ---

    def execute(self, sql: str, params=None):
        sql_stripped = sql.strip()

        # PRAGMA 처리 (PG에서는 information_schema로 대체)
        if sql_stripped.upper().startswith('PRAGMA'):
            return self._handle_pragma(sql_stripped)

        pg_sql = _to_pg_sql(sql_stripped)
        is_insert = pg_sql.strip().upper().startswith('INSERT')

        # INSERT에 RETURNING id 자동 추가 (lastrowid 지원)
        if is_insert and 'RETURNING' not in pg_sql.upper():
            pg_sql = pg_sql.rstrip().rstrip(';') + ' RETURNING id'

        cur = self._cursor()
        try:
            cur.execute(pg_sql, list(params) if params else [])
        except Exception:
            self._conn.rollback()
            raise
        return _PgCursor(cur)

    def _handle_pragma(self, sql: str):
        """PRAGMA table_info(tbl) → information_schema 쿼리"""
        m = re.search(r'PRAGMA\s+table_info\((\w+)\)', sql, re.IGNORECASE)
        if m:
            tbl = m.group(1)
            cur = self._cursor()
            cur.execute(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name=%s ORDER BY ordinal_position",
                (tbl,)
            )
            # sqlite3의 r[1] = column_name 에 맞춰 _Row 구성
            rows = [_Row({'cid': i, 'name': r['column_name'],
                          'type': r['data_type'], 'column_name': r['column_name']})
                    for i, r in enumerate(cur.fetchall())]
            return _PgCursor(_FakeCursor(rows))
        # 기타 PRAGMA (journal_mode 등)는 no-op
        return _PgCursor(_FakeCursor([]))

    # --- executescript (DDL 전용) ---

    def executescript(self, script: str):
        """CREATE TABLE 등 DDL 스크립트 실행"""
        pg_script = _to_pg_ddl(script)
        cur = self._conn.cursor()
        stmts = [s.strip() for s in pg_script.split(';') if s.strip()]
        for stmt in stmts:
            try:
                cur.execute(stmt)
            except Exception as e:
                # 이미 존재하는 테이블 등 무시하고 계속
                self._conn.rollback()
        self._conn.commit()

    # --- 표준 인터페이스 ---

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


# ─── DB 초기화 / 마이그레이션 / 시드 ─────────────────────────────────────────

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
    conn.close()


def migrate_db():
    """기존 DB에 누락된 컬럼 추가 (하위 호환)"""
    conn = get_db()

    # 컬럼 목록 조회 (SQLite / PostgreSQL 공용)
    cols_result = conn.execute("PRAGMA table_info(products)").fetchall()
    cols = [r[1] for r in cols_result]   # _Row에서 [1] = 'name'/'column_name'

    new_cols = {
        "show_on_homepage": "INTEGER DEFAULT 0",
        "display_order":    "INTEGER DEFAULT 99",
        "description":      "TEXT",
        "tag_label":        "TEXT",
        "tag_type":         "TEXT DEFAULT 'new'",
        "emoji":            "TEXT DEFAULT '📦'",
        "img_gradient":     "TEXT",
        "coupang_link":     "TEXT",
    }
    for col, typedef in new_cols.items():
        if col not in cols:
            conn.execute(f"ALTER TABLE products ADD COLUMN {col} {typedef}")
    conn.commit()
    conn.close()


def seed_initial_data():
    """초기 데이터 시드 (비어 있을 때만 실행)"""
    conn = get_db()

    if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] > 0:
        conn.close()
        return

    # 제품 6종
    products = [
        ("①", "ESD 무선 정전기방지 팔찌", "防静电手环", "전자부품/공구", 9900, "active", "높음",
         1, 1, "전자기기 작업 시 정전기 보호. 무선 설계로 자유로운 작업.", "TECH", "new", "⚡",
         "linear-gradient(135deg,#e0e7ff,#c7d2fe)", ""),
        ("②", "카프톤(폴리이미드) 테이프", "聚酰亚胺胶带", "테이프/접착제", 9900, "active", "최고",
         1, 2, "내열 260°C 고온 테이프. 납땜, 절연, 3D프린터에 최적.", "BEST", "best", "🔥",
         "linear-gradient(135deg,#fef3c7,#fde68a)", ""),
        ("③", "프리미엄 운동 손목밴드", "运动护腕", "스포츠 용품", 12900, "active", "보통",
         1, 3, "건초염 예방 압박밴드. 벨크로 방식, 4가지 컬러.", "SPORTS", "hot", "💪",
         "linear-gradient(135deg,#d1fae5,#a7f3d0)", ""),
        ("⑤", "USB 미니 선풍기", "USB迷你风扇", "IT 액세서리", 9900, "active", "보통",
         1, 4, "3단 풍속, USB 전원, 사무실/차량 겸용. 저소음 설계.", "TREND", "trend", "🌀",
         "linear-gradient(135deg,#e0e7ff,#c7d2fe)", ""),
        ("⑥", "컬러 스포츠 흡한 손목밴드", "彩色运动吸汗护腕", "스포츠 용품", 6900, "active", "보통",
         1, 5, "고탄력 흡한속건 소재. 15가지 컬러, 러닝·헬스·사이클링 만능.", "COLOR", "best", "🌈",
         "linear-gradient(135deg,#fce7f3,#fbcfe8)", ""),
        ("⑦", "초경량 USB 핸디 선풍기", "超轻量USB手持风扇", "IT 액세서리", 7900, "active", "보통",
         1, 6, "충전식 휴대용, 폰거치대 겸용. 82g 초경량 설계.", "SUMMER", "new", "🍃",
         "linear-gradient(135deg,#ecfccb,#d9f99d)", ""),
    ]
    for p in products:
        conn.execute(
            """INSERT INTO products (code,name_ko,name_cn,category,coupang_price,status,margin_category,
               show_on_homepage,display_order,description,tag_label,tag_type,emoji,img_gradient,coupang_link)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", p)

    # 공급사 4곳 (타배 입고 현황 반영)
    suppliers = [
        (1, "우지 테크놀로지",     "五祉科技有限公司",             "五祉科技有限公司",            "광저우",   "A+A",   "-",
         "¥1.50", "추후 협의", "-", "1", "闪电棱镜 시리즈, 드롭쉬핑 지원",
         "입고완료", "타배 입고완료 (3개×¥1.50)", "509835923285"),
        (2, "xmyydz1688",         "xmyydz1688",                  "xmyydz1688",                 "샤먼(厦门)", "공장입사", "-",
         "🆓 무료!", "¥4.00/롤", "-", "1", "무료 샘플 + 무료 배송! MG COMMERCE 라벨 인쇄",
         "입고완료", "타배 입고완료", "509837025424"),
        (3, "오미스 스포츠 용품", "奥美斯体育用品股份有限公司", "오미스 스포츠 용품 주식회사", "양저우",   "공장입사", "-",
         "¥5.20", "¥4.80", "¥4.50", "2", "OEM/ODM 가능, 한국 직배송 가능",
         "입고완료", "타배 입고완료 (¥5.20)", "509837025472"),
        (4, "원 세일 토이 팩토리", "暖帆玩具厂",                  "원 세일 토이 팩토리",         "이우(义乌)", "A+A",  "80%",
         "¥4.20", "¥4.20", "¥4.20", "1", "100개/500개 동일 단가 ¥4.2, 보라색/민트",
         "입고예정", "타배 입고예정 (5개 ¥15.00)", "509837025413"),
    ]
    for s in suppliers:
        conn.execute(
            """INSERT INTO suppliers (product_id,name_ko,name_cn,chat_name,location,grade,reorder_rate,
               sample_price,bulk_100,bulk_500,moq,notes,status,sample_status,tracking_no)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", s)

    # 타임라인 이벤트 (3곳 입고완료 반영)
    timeline = [
        # 공급사1 (ESD) — 입고완료
        (1,"4/9","1차 문의 발송",1),(1,"4/9","견적 회수 (¥1.50)",1),
        (1,"4/11","창고주소 전달",1),(1,"4/11","샘플 주문 메시지 발송",1),
        (1,"4/12","샘플 발송 확인",1),(1,"4/17","트래킹번호 입력 (509835923285)",1),
        (1,"4/17","타배 창고 도착",1),(1,"4/19","한국 배송",0),(1,"-","검수 완료",0),
        # 공급사2 (카프톤) — 입고완료
        (2,"4/9","1차 문의 발송",1),(2,"4/9","견적 회수 (¥4.00)",1),
        (2,"4/11","창고주소 전달",1),(2,"4/11","무료 샘플 확정!",1),
        (2,"4/11","배송비 무료 확정!",1),(2,"4/11","MG COMMERCE 라벨 요청",1),
        (2,"4/12","샘플 발송",1),(2,"4/17","트래킹번호 입력 (509837025424)",1),
        (2,"4/17","타배 창고 도착",1),(2,"4/19","한국 배송",0),(2,"-","검수 완료",0),
        # 공급사3 (운동밴드) — 입고완료
        (3,"4/9","1차 문의 발송",1),(3,"4/9","견적 회수 (100개 ¥4.80)",1),
        (3,"4/11","창고주소 전달",1),(3,"4/11","샘플 주문 메시지 발송",1),
        (3,"4/13","샘플 발송 확인",1),(3,"4/17","트래킹번호 입력 (509837025472)",1),
        (3,"4/17","타배 창고 도착",1),(3,"4/19","한국 배송",0),(3,"-","검수 완료",0),
        # 공급사4 (선풍기) — 입고예정
        (4,"4/11","공급사 교체 (골프→선풍기)",1),(4,"4/11","문의 발송",1),
        (4,"4/11","창고주소 전달",1),(4,"4/11","단가 확인 ¥4.2",1),
        (4,"4/17","샘플 주문 (5개 ¥15.00)",1),(4,"4/17","트래킹번호 입력 (509837025413)",1),
        (4,"-","타배 창고 도착",0),(4,"-","한국 배송",0),(4,"-","검수 완료",0),
    ]
    for t in timeline:
        conn.execute("INSERT INTO timeline_events (supplier_id,event_date,event_name,done) VALUES (?,?,?,?)", t)

    # 마일스톤 (타배 입고 현황 반영)
    milestones = [
        ("쿠팡 로켓그로스 가입",              "done",     "4/7"),
        ("KYC 인증",                          "done",     "4/7"),
        ("통신판매업 신고",                    "done",     "4/7"),
        ("사업자 등록",                        "done",     "4/7"),
        ("1688 공급사 발굴 (4종)",             "done",     "4/8"),
        ("1688 샘플 문의 발송",               "done",     "4/9"),
        ("1688 1차 견적 회수",                "done",     "4/9"),
        ("④ 골프 → ⑤ USB선풍기 교체",       "done",     "4/11"),
        ("타배 배대지 가입 (위해시 창고)",     "done",     "4/11"),
        ("4곳 창고주소 전달 + 샘플 주문",     "done",     "4/11"),
        ("② 카프톤 무료 샘플 확정",           "done",     "4/11"),
        ("쿠팡 경쟁사 분석 완료",             "done",     "4/11"),
        ("상세페이지 카피 4종 초안",           "done",     "4/11"),
        ("공급사 응답 대기 + 주문 확정",      "done",     "4/12"),
        ("② 카프톤 인증서류 요청",            "done",     "4/12"),
        ("타배 배송대행 신청 (트래킹번호)",    "done",     "4/17"),
        ("3곳 타배 입고완료 확인",            "done",     "4/17"),
        ("샘플 한국 도착 + 품질 검수",        "progress", "4/19~22"),
        ("본주문 발주 (100개x4종)",           "todo",     "4/25"),
        ("쿠팡 Wing 상품 등록",               "todo",     "4/27"),
        ("쿠팡 런칭 D-Day!",                  "todo",     "4/30"),
    ]
    for m in milestones:
        conn.execute("INSERT INTO milestones (task,status,target_date) VALUES (?,?,?)", m)

    # 검수 체크리스트
    inspection = {
        1: ["외관 스크래치/파손 확인","착용감 테스트","정전기 방전 테스트","잠금장치 작동 확인","디자인/색상 일치 확인","포장 상태 확인"],
        2: ["롤 표면 주름/기포 확인","가장자리 절단면 깔끔한지","롤 감김 균일한지","접착력 테스트 (금속 표면)",
            "잔접착 확인 (떼었을 때)","내열 테스트 (라이터 3초)","두께 0.05mm 확인 (캘리퍼스)",
            "폭/길이 스펙 일치 확인","MG COMMERCE 라벨 확인"],
        3: ["원단 질감/두께 확인","봉제 상태 확인","땀 흡수력 테스트","신축성 테스트",
            "4색 색상 일치 확인","세탁 후 변형 확인","포장 상태 확인"],
        4: ["외관 스크래치/파손 확인","USB 연결 테스트","팬 회전 정상 확인","풍량 테스트 (3단계)",
            "소음 레벨 확인","색상 일치 확인 (보라/민트)","케이블 포함 확인","포장 상태 확인"],
    }
    for pid, items in inspection.items():
        for item in items:
            conn.execute("INSERT INTO inspection_items (product_id,item_name) VALUES (?,?)", (pid, item))

    conn.commit()
    conn.close()
