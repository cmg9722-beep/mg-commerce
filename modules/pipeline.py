"""전체 파이프라인 관리 모듈"""
from modules.database import get_db
from datetime import datetime, timedelta
from config import COUPANG_PROMO_DEADLINE

PIPELINE_STEPS = [
    {"name": "제품 발굴/선정", "order": 1},
    {"name": "1688 공급사 탐색", "order": 2},
    {"name": "샘플 문의/주문", "order": 3},
    {"name": "샘플 배송 (배대지)", "order": 4},
    {"name": "샘플 한국 도착", "order": 5},
    {"name": "품질 검수", "order": 6},
    {"name": "본발주 (대량)", "order": 7},
    {"name": "본발주 배송", "order": 8},
    {"name": "쿠팡 입고", "order": 9},
    {"name": "상품 등록/런칭", "order": 10},
]


def init_pipeline_for_product(product_id, start_date=None):
    """제품에 대한 파이프라인 단계 초기화"""
    conn = get_db()
    existing = conn.execute("SELECT COUNT(*) FROM pipeline_steps WHERE product_id=?", (product_id,)).fetchone()[0]
    if existing > 0:
        conn.close()
        return

    if start_date is None:
        start_date = datetime.now()

    for step in PIPELINE_STEPS:
        due = start_date + timedelta(days=step["order"] * 3)
        conn.execute("""
            INSERT INTO pipeline_steps (product_id, step_name, step_order, status, due_date)
            VALUES (?,?,?,?,?)
        """, (product_id, step["name"], step["order"], "pending",
              due.strftime("%Y-%m-%d")))

    conn.commit()
    conn.close()


def get_pipeline(product_id=None):
    """파이프라인 상태 조회"""
    conn = get_db()
    if product_id:
        rows = conn.execute("""
            SELECT ps.*, p.name_ko as product_name, p.code as product_code
            FROM pipeline_steps ps
            JOIN products p ON p.id = ps.product_id
            WHERE ps.product_id=?
            ORDER BY ps.step_order
        """, (product_id,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT ps.*, p.name_ko as product_name, p.code as product_code
            FROM pipeline_steps ps
            JOIN products p ON p.id = ps.product_id
            ORDER BY ps.product_id, ps.step_order
        """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_step(step_id, status, notes=None):
    """파이프라인 단계 상태 업데이트"""
    conn = get_db()
    completed = datetime.now().strftime("%Y-%m-%d %H:%M") if status == "done" else None
    if notes:
        conn.execute("UPDATE pipeline_steps SET status=?, completed_at=?, notes=? WHERE id=?",
                      (status, completed, notes, step_id))
    else:
        conn.execute("UPDATE pipeline_steps SET status=?, completed_at=? WHERE id=?",
                      (status, completed, step_id))
    conn.commit()
    conn.close()


def get_dashboard_summary():
    """대시보드용 전체 요약"""
    conn = get_db()

    # 제품 수
    product_count = conn.execute("SELECT COUNT(*) FROM products WHERE status='active'").fetchone()[0]

    # 공급사 상태별 수
    supplier_stats = {}
    for row in conn.execute("SELECT status, COUNT(*) as cnt FROM suppliers GROUP BY status").fetchall():
        supplier_stats[row["status"]] = row["cnt"]

    # 파이프라인 진행률
    total_steps = conn.execute("SELECT COUNT(*) FROM pipeline_steps").fetchone()[0]
    done_steps = conn.execute("SELECT COUNT(*) FROM pipeline_steps WHERE status='done'").fetchone()[0]
    progress_pct = round(done_steps / total_steps * 100) if total_steps > 0 else 0

    # 마일스톤 진행
    ms_total = conn.execute("SELECT COUNT(*) FROM milestones").fetchone()[0]
    ms_done = conn.execute("SELECT COUNT(*) FROM milestones WHERE status='done'").fetchone()[0]

    # D-Day 계산
    deadline = datetime.strptime(COUPANG_PROMO_DEADLINE, "%Y-%m-%d")
    today = datetime.now()
    d_day = (deadline - today).days

    # 후보 제품 수
    candidates = conn.execute("SELECT COUNT(*) FROM product_candidates WHERE status='new'").fetchone()[0]

    conn.close()

    return {
        "product_count": product_count,
        "supplier_stats": supplier_stats,
        "pipeline_progress": progress_pct,
        "pipeline_done": done_steps,
        "pipeline_total": total_steps,
        "milestone_done": ms_done,
        "milestone_total": ms_total,
        "d_day": d_day,
        "deadline": COUPANG_PROMO_DEADLINE,
        "candidate_count": candidates,
    }
