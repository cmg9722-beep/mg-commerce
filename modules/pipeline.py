"""전체 파이프라인 관리 모듈"""
from modules.database import get_db
from datetime import datetime, timedelta
from config import COUPANG_PROMO_DEADLINE

# 공급사 상태 → 파이프라인 단계 매핑
# status 값이 아래 그룹에 포함되면 해당 step 이상을 자동 처리
SAMPLE_ORDER_STATUSES  = {"샘플주문", "샘플발송", "샘플배송중", "샘플도착", "샘플검수중",
                           "검수완료", "본발주", "본발주완료", "배송중", "입고완료", "런칭완료",
                           "샘플 발송", "샘플 주문", "샘플 도착"}
SAMPLE_ARRIVED_STATUSES = {"샘플도착", "샘플검수중", "검수완료", "본발주", "본발주완료",
                            "배송중", "입고완료", "런칭완료", "샘플 도착"}
INSPECTION_STATUSES    = {"검수완료", "본발주", "본발주완료", "배송중", "입고완료", "런칭완료"}
BULK_ORDER_STATUSES    = {"본발주완료", "배송중", "입고완료", "런칭완료"}
BULK_SHIPPING_STATUSES = {"배송중", "입고완료", "런칭완료"}
WAREHOUSED_STATUSES    = {"입고완료", "런칭완료"}
LAUNCHED_STATUSES      = {"런칭완료"}

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


def sync_pipeline(product_id):
    """공급사 상태/트래킹 기반 파이프라인 자동 동기화"""
    conn = get_db()
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # 해당 제품의 공급사 정보 수집
    suppliers = conn.execute(
        "SELECT status, tracking_no FROM suppliers WHERE product_id=?", (product_id,)
    ).fetchall()

    statuses  = {(s["status"] or "").strip() for s in suppliers}
    has_tracking = any((s["tracking_no"] or "").strip() for s in suppliers)
    supplier_count = len(suppliers)

    def set_step(order, status):
        current = conn.execute(
            "SELECT status FROM pipeline_steps WHERE product_id=? AND step_order=?",
            (product_id, order)
        ).fetchone()
        if current and current[0] != status:
            completed = now if status == "done" else None
            conn.execute(
                "UPDATE pipeline_steps SET status=?, completed_at=? WHERE product_id=? AND step_order=?",
                (status, completed, product_id, order)
            )

    # Step 1: 제품 발굴/선정 → 공급사가 1명이라도 있으면 완료
    if supplier_count > 0:
        set_step(1, "done")
        set_step(2, "done")

    # Step 3: 샘플 문의/주문 → 샘플 주문 이상 상태
    if statuses & SAMPLE_ORDER_STATUSES:
        set_step(3, "done")

    # Step 4: 샘플 배송 → 트래킹번호 등록됐으면 진행중, 도착 상태면 완료
    if statuses & SAMPLE_ARRIVED_STATUSES:
        set_step(4, "done")
    elif has_tracking or statuses & SAMPLE_ORDER_STATUSES:
        set_step(4, "progress")

    # Step 5: 샘플 한국 도착
    if statuses & SAMPLE_ARRIVED_STATUSES:
        set_step(5, "done")
    elif statuses & SAMPLE_ARRIVED_STATUSES:
        set_step(5, "progress")

    # Step 6: 품질 검수
    if statuses & INSPECTION_STATUSES:
        set_step(6, "done")
    elif statuses & SAMPLE_ARRIVED_STATUSES:
        set_step(6, "progress")

    # Step 7: 본발주
    if statuses & BULK_ORDER_STATUSES:
        set_step(7, "done")
    elif statuses & INSPECTION_STATUSES:
        set_step(7, "progress")

    # Step 8: 본발주 배송
    if statuses & BULK_SHIPPING_STATUSES:
        set_step(8, "progress")
    if statuses & WAREHOUSED_STATUSES:
        set_step(8, "done")

    # Step 9: 쿠팡 입고
    if statuses & WAREHOUSED_STATUSES:
        set_step(9, "done")
    elif statuses & BULK_SHIPPING_STATUSES:
        set_step(9, "progress")

    # Step 10: 상품 등록/런칭
    if statuses & LAUNCHED_STATUSES:
        set_step(10, "done")

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
