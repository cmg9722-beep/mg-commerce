"""공급사/주문 관리 모듈"""
from modules.database import get_db
from datetime import datetime


def _sync(supplier_id):
    """공급사 변경 후 파이프라인 자동 동기화"""
    from modules.pipeline import sync_pipeline
    conn = get_db()
    row = conn.execute("SELECT product_id FROM suppliers WHERE id=?", (supplier_id,)).fetchone()
    conn.close()
    if row:
        sync_pipeline(row["product_id"])


def get_all_suppliers():
    conn = get_db()
    rows = conn.execute("""
        SELECT s.*, p.code as product_code, p.name_ko as product_name, p.coupang_price
        FROM suppliers s
        JOIN products p ON p.id = s.product_id
        ORDER BY s.product_id
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_supplier(supplier_id):
    conn = get_db()
    row = conn.execute("""
        SELECT s.*, p.code as product_code, p.name_ko as product_name, p.coupang_price
        FROM suppliers s
        JOIN products p ON p.id = s.product_id
        WHERE s.id = ?
    """, (supplier_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_supplier_status(supplier_id, status, sample_status=None):
    conn = get_db()
    if status is None and sample_status is not None:
        conn.execute("UPDATE suppliers SET sample_status=?, updated_at=datetime('now','localtime') WHERE id=?",
                      (sample_status, supplier_id))
    elif sample_status:
        conn.execute("UPDATE suppliers SET status=?, sample_status=?, updated_at=datetime('now','localtime') WHERE id=?",
                      (status, sample_status, supplier_id))
    else:
        conn.execute("UPDATE suppliers SET status=?, updated_at=datetime('now','localtime') WHERE id=?",
                      (status, supplier_id))
    conn.commit()
    conn.close()
    _sync(supplier_id)  # 파이프라인 자동 동기화


def update_tracking(supplier_id, tracking_no):
    conn = get_db()
    conn.execute("UPDATE suppliers SET tracking_no=?, updated_at=datetime('now','localtime') WHERE id=?",
                  (tracking_no, supplier_id))
    conn.commit()
    conn.close()
    _sync(supplier_id)  # 파이프라인 자동 동기화


def add_supplier(data):
    conn = get_db()
    conn.execute("""
        INSERT INTO suppliers (product_id, name_ko, name_cn, chat_name, location, grade,
                               reorder_rate, sample_price, bulk_100, bulk_500, moq, notes, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        data["product_id"], data.get("name_ko"), data.get("name_cn"),
        data.get("chat_name"), data.get("location"), data.get("grade"),
        data.get("reorder_rate"), data.get("sample_price"),
        data.get("bulk_100"), data.get("bulk_500"), data.get("moq"),
        data.get("notes"), data.get("status", "답변대기"),
    ))
    conn.commit()
    sid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return sid


def get_timeline(supplier_id):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM timeline_events WHERE supplier_id=? ORDER BY id",
        (supplier_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_timeline_event(event_id, done):
    conn = get_db()
    conn.execute("UPDATE timeline_events SET done=? WHERE id=?", (1 if done else 0, event_id))
    conn.commit()
    conn.close()


def add_timeline_event(supplier_id, event_date, event_name, done=False):
    conn = get_db()
    conn.execute(
        "INSERT INTO timeline_events (supplier_id, event_date, event_name, done) VALUES (?,?,?,?)",
        (supplier_id, event_date, event_name, 1 if done else 0)
    )
    conn.commit()
    conn.close()


# === 주문 관리 ===

def create_order(supplier_id, order_type, qty, unit_price_cny, notes=""):
    conn = get_db()
    total = round(qty * unit_price_cny, 2)
    conn.execute("""
        INSERT INTO orders (supplier_id, order_type, qty, unit_price_cny, total_cny, notes)
        VALUES (?,?,?,?,?,?)
    """, (supplier_id, order_type, qty, unit_price_cny, total, notes))
    conn.commit()
    conn.close()


def get_orders(supplier_id=None):
    conn = get_db()
    if supplier_id:
        rows = conn.execute("SELECT * FROM orders WHERE supplier_id=? ORDER BY created_at DESC", (supplier_id,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT o.*, s.name_ko as supplier_name, p.name_ko as product_name
            FROM orders o
            JOIN suppliers s ON s.id = o.supplier_id
            JOIN products p ON p.id = s.product_id
            ORDER BY o.created_at DESC
        """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_order_status(order_id, status, tracking_no=None):
    conn = get_db()
    if tracking_no:
        conn.execute("UPDATE orders SET status=?, tracking_no=?, updated_at=datetime('now','localtime') WHERE id=?",
                      (status, tracking_no, order_id))
    else:
        conn.execute("UPDATE orders SET status=?, updated_at=datetime('now','localtime') WHERE id=?",
                      (status, order_id))
    conn.commit()
    conn.close()


# === 검수 체크리스트 ===

def get_inspection_items(product_id):
    conn = get_db()
    rows = conn.execute("SELECT * FROM inspection_items WHERE product_id=?", (product_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def toggle_inspection(item_id):
    conn = get_db()
    conn.execute("UPDATE inspection_items SET checked = 1 - checked WHERE id=?", (item_id,))
    conn.commit()
    conn.close()


# === 마일스톤 ===

def get_milestones():
    conn = get_db()
    rows = conn.execute("SELECT * FROM milestones ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_milestone(milestone_id, status):
    conn = get_db()
    completed = datetime.now().strftime("%Y-%m-%d %H:%M") if status == "done" else None
    conn.execute("UPDATE milestones SET status=?, completed_at=? WHERE id=?",
                  (status, completed, milestone_id))
    conn.commit()
    conn.close()
