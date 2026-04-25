"""MG Commerce 자동화 플랫폼 - Flask 서버 v1.1 (2026-04-25 시드데이터 4/25 현황 반영)"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from functools import wraps
import hashlib
from werkzeug.utils import secure_filename
import uuid
from modules.database import init_db, seed_initial_data, migrate_db, get_db
from modules.exchange_rate import get_cny_to_krw, get_rate_info
from modules.margin_calc import calc_margin, calc_all_products, simulate_price
from modules.supplier_mgr import (
    get_all_suppliers, get_supplier, update_supplier_status,
    update_tracking, add_supplier, get_timeline, update_timeline_event,
    add_timeline_event, create_order, get_orders, update_order_status,
    get_inspection_items, toggle_inspection, get_milestones, update_milestone,
)
from modules.message_gen import generate_message, get_all_templates
from modules.product_finder import (
    add_candidate, get_candidates, update_candidate_status,
    promote_to_product, get_search_suggestions, score_product,
)
from modules.coupang_helper import (
    generate_product_page, generate_product_title,
    generate_price_strategy, get_listing_checklist,
)
from modules.pipeline import (
    init_pipeline_for_product, get_pipeline, update_step,
    get_dashboard_summary,
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "mg-commerce-secret-2026")

# 관리자 비밀번호 (해시 저장)
ADMIN_PW_HASH = hashlib.sha256("Ab96460904~!".encode()).hexdigest()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_logged_in"):
            if request.is_json:
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

# === 페이지 ===

@app.route("/")
def homepage():
    conn = get_db()
    products = conn.execute(
        "SELECT * FROM products WHERE show_on_homepage=1 ORDER BY display_order"
    ).fetchall()
    conn.close()
    return render_template("homepage.html", products=[dict(p) for p in products])

@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("admin_logged_in"):
        return redirect(url_for("admin"))
    error = None
    if request.method == "POST":
        pw = request.form.get("password", "")
        if hashlib.sha256(pw.encode()).hexdigest() == ADMIN_PW_HASH:
            session["admin_logged_in"] = True
            return redirect(url_for("admin"))
        error = "비밀번호가 틀렸습니다"
    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("homepage"))

@app.route("/admin")
@login_required
def admin():
    return render_template("index.html")


# === API: 문의 (홈페이지 연동) ===

@app.route("/api/contact", methods=["POST"])
def api_contact():
    d = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO inquiries (name, email, phone, message, product) VALUES (?,?,?,?,?)",
        (d.get("name"), d.get("email"), d.get("phone"), d.get("message"), d.get("product"))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "문의가 접수되었습니다"})

@app.route("/api/inquiries")
@login_required
def api_inquiries():
    conn = get_db()
    rows = conn.execute("SELECT * FROM inquiries ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/inquiries/<int:iid>/reply", methods=["POST"])
def api_inquiry_reply(iid):
    d = request.json
    conn = get_db()
    conn.execute(
        "UPDATE inquiries SET status='replied', reply=?, replied_at=datetime('now','localtime') WHERE id=?",
        (d.get("reply"), iid)
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@app.route("/api/inquiries/<int:iid>/close", methods=["POST"])
def api_inquiry_close(iid):
    conn = get_db()
    conn.execute("UPDATE inquiries SET status='closed' WHERE id=?", (iid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# === API: 대시보드 ===

@app.route("/api/dashboard")
@login_required
def api_dashboard():
    summary = get_dashboard_summary()
    rate_info = get_rate_info()
    margins = calc_all_products()
    milestones = get_milestones()
    return jsonify({
        "summary": summary,
        "rate": rate_info,
        "margins": margins,
        "milestones": milestones,
    })


# === API: 환율 ===

@app.route("/api/exchange-rate")
def api_exchange_rate():
    return jsonify(get_rate_info())


# === API: 마진 계산 ===

@app.route("/api/margin/all")
def api_margin_all():
    promo = request.args.get("promo", "1") == "1"
    rate = request.args.get("rate", type=float)
    return jsonify(calc_all_products(rate=rate, promo=promo))


@app.route("/api/margin/calc", methods=["POST"])
def api_margin_calc():
    d = request.json
    return jsonify(calc_margin(
        d.get("cost_cny", 0),
        d.get("coupang_price", 9900),
        rate=d.get("rate"),
        promo=d.get("promo", True),
        shipping_intl=d.get("shipping_intl"),
        customs=d.get("customs"),
        qty=d.get("qty", 1),
    ))


@app.route("/api/margin/simulate", methods=["POST"])
def api_margin_simulate():
    d = request.json
    prices = d.get("prices", list(range(5900, 20000, 1000)))
    return jsonify(simulate_price(
        d.get("cost_cny", 0),
        rate=d.get("rate"),
        promo=d.get("promo", True),
        price_range=prices,
    ))


# === API: 공급사 ===

@app.route("/api/suppliers")
def api_suppliers():
    suppliers = get_all_suppliers()
    for s in suppliers:
        s["timeline"] = get_timeline(s["id"])
    return jsonify(suppliers)


@app.route("/api/suppliers/<int:sid>")
def api_supplier_detail(sid):
    s = get_supplier(sid)
    if not s:
        return jsonify({"error": "not found"}), 404
    s["timeline"] = get_timeline(sid)
    s["orders"] = get_orders(sid)
    return jsonify(s)


@app.route("/api/suppliers/<int:sid>/status", methods=["POST"])
def api_supplier_update_status(sid):
    d = request.json
    update_supplier_status(sid, d["status"], d.get("sample_status"))
    return jsonify({"ok": True})


@app.route("/api/suppliers/<int:sid>/tracking", methods=["POST"])
def api_supplier_update_tracking(sid):
    d = request.json
    update_tracking(sid, d["tracking_no"])
    return jsonify({"ok": True})


@app.route("/api/suppliers/add", methods=["POST"])
def api_supplier_add():
    sid = add_supplier(request.json)
    return jsonify({"id": sid})


# === API: 타임라인 ===

@app.route("/api/timeline/<int:eid>/toggle", methods=["POST"])
def api_timeline_toggle(eid):
    d = request.json
    update_timeline_event(eid, d.get("done", True))
    return jsonify({"ok": True})


@app.route("/api/timeline/add", methods=["POST"])
def api_timeline_add():
    d = request.json
    add_timeline_event(d["supplier_id"], d["date"], d["event"], d.get("done", False))
    return jsonify({"ok": True})


# === API: 주문 ===

@app.route("/api/orders")
def api_orders():
    return jsonify(get_orders())


@app.route("/api/orders/create", methods=["POST"])
def api_order_create():
    d = request.json
    create_order(d["supplier_id"], d["type"], d["qty"], d["unit_price_cny"], d.get("notes", ""))
    return jsonify({"ok": True})


@app.route("/api/orders/<int:oid>/status", methods=["POST"])
def api_order_update(oid):
    d = request.json
    update_order_status(oid, d["status"], d.get("tracking_no"))
    return jsonify({"ok": True})


# === API: 검수 ===

@app.route("/api/inspection/<int:pid>")
def api_inspection(pid):
    return jsonify(get_inspection_items(pid))


@app.route("/api/inspection/<int:iid>/toggle", methods=["POST"])
def api_inspection_toggle(iid):
    toggle_inspection(iid)
    return jsonify({"ok": True})


# === API: 마일스톤 ===

@app.route("/api/milestones")
def api_milestones():
    return jsonify(get_milestones())


@app.route("/api/milestones/<int:mid>/status", methods=["POST"])
def api_milestone_update(mid):
    d = request.json
    update_milestone(mid, d["status"])
    return jsonify({"ok": True})


@app.route("/api/milestones/add", methods=["POST"])
@login_required
def api_milestone_add():
    d = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO milestones (task, status, target_date) VALUES (?,?,?)",
        (d["task"], d.get("status", "todo"), d.get("target_date", ""))
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/milestones/<int:mid>/delete", methods=["POST"])
@login_required
def api_milestone_delete(mid):
    conn = get_db()
    conn.execute("DELETE FROM milestones WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# === API: 메시지 생성 ===

@app.route("/api/messages/templates")
def api_msg_templates():
    return jsonify(get_all_templates())


@app.route("/api/messages/generate", methods=["POST"])
def api_msg_generate():
    d = request.json
    result = generate_message(d["template"], d.get("params", {}))
    if not result:
        return jsonify({"error": "unknown template"}), 400
    return jsonify(result)


# === API: 제품 발굴 ===

@app.route("/api/finder/suggestions")
def api_finder_suggestions():
    return jsonify(get_search_suggestions())


@app.route("/api/finder/candidates")
def api_finder_candidates():
    status = request.args.get("status")
    min_score = request.args.get("min_score", 0, type=float)
    return jsonify(get_candidates(status=status, min_score=min_score))


@app.route("/api/finder/add", methods=["POST"])
def api_finder_add():
    result = add_candidate(request.json)
    return jsonify(result)


@app.route("/api/finder/<int:cid>/status", methods=["POST"])
def api_finder_status(cid):
    d = request.json
    update_candidate_status(cid, d["status"])
    return jsonify({"ok": True})


@app.route("/api/finder/<int:cid>/promote", methods=["POST"])
def api_finder_promote(cid):
    pid = promote_to_product(cid)
    if pid:
        init_pipeline_for_product(pid)
        return jsonify({"product_id": pid})
    return jsonify({"error": "not found"}), 404


# === API: 쿠팡 보조 ===

@app.route("/api/coupang/product-page/<int:pid>")
def api_coupang_page(pid):
    return jsonify(generate_product_page(pid))


@app.route("/api/coupang/title", methods=["POST"])
def api_coupang_title():
    d = request.json
    return jsonify(generate_product_title(d["name"], d.get("keywords")))


@app.route("/api/coupang/price-strategy", methods=["POST"])
def api_coupang_price():
    d = request.json
    rate = d.get("rate") or get_cny_to_krw()
    return jsonify(generate_price_strategy(d["cost_cny"], rate))


@app.route("/api/coupang/checklist")
def api_coupang_checklist():
    return jsonify(get_listing_checklist())


# === API: 파이프라인 ===

@app.route("/api/pipeline")
def api_pipeline():
    pid = request.args.get("product_id", type=int)
    return jsonify(get_pipeline(pid))


@app.route("/api/pipeline/<int:sid>/status", methods=["POST"])
def api_pipeline_update(sid):
    d = request.json
    update_step(sid, d["status"], d.get("notes"))
    return jsonify({"ok": True})


@app.route("/api/pipeline/init/<int:pid>", methods=["POST"])
def api_pipeline_init(pid):
    init_pipeline_for_product(pid)
    return jsonify({"ok": True})


# === API: 제품 관리 ===

@app.route("/api/products")
def api_products():
    conn = get_db()
    rows = conn.execute("SELECT * FROM products ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/products/add", methods=["POST"])
def api_product_add():
    d = request.json
    conn = get_db()
    conn.execute("""
        INSERT INTO products (code, name_ko, name_cn, category, coupang_price, status, margin_category,
        show_on_homepage, display_order, description, tag_label, tag_type, emoji, img_gradient, coupang_link)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (d.get("code"), d["name_ko"], d.get("name_cn"), d.get("category"),
          d.get("coupang_price", 0), "active", d.get("margin_category", "미정"),
          d.get("show_on_homepage", 0), d.get("display_order", 99),
          d.get("description", ""), d.get("tag_label", "NEW"), d.get("tag_type", "new"),
          d.get("emoji", "📦"), d.get("img_gradient", ""), d.get("coupang_link", "")))
    conn.commit()
    pid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    init_pipeline_for_product(pid)
    return jsonify({"id": pid})


@app.route("/api/products/<int:pid>/update", methods=["POST"])
@login_required
def api_product_update(pid):
    d = request.json
    conn = get_db()
    fields = []
    values = []
    allowed = ["name_ko", "name_cn", "category", "coupang_price", "status",
               "show_on_homepage", "display_order", "description", "tag_label",
               "tag_type", "emoji", "img_gradient", "coupang_link", "code", "margin_category",
               "image_url"]
    for key in allowed:
        if key in d:
            fields.append(f"{key}=?")
            values.append(d[key])
    if fields:
        values.append(pid)
        conn.execute(f"UPDATE products SET {','.join(fields)}, updated_at=datetime('now','localtime') WHERE id=?", values)
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/products/<int:pid>/delete", methods=["POST"])
@login_required
def api_product_delete(pid):
    conn = get_db()
    conn.execute("DELETE FROM products WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/products/<int:pid>/upload-image", methods=["POST"])
@login_required
def api_product_upload_image(pid):
    """제품 이미지 업로드 (파일 또는 URL)"""
    # URL 방식
    if request.is_json:
        image_url = request.json.get("image_url", "").strip()
        if not image_url:
            return jsonify({"ok": False, "error": "URL이 없습니다"}), 400
        conn = get_db()
        conn.execute("UPDATE products SET image_url=?, updated_at=datetime('now','localtime') WHERE id=?",
                     (image_url, pid))
        conn.commit()
        conn.close()
        return jsonify({"ok": True, "image_url": image_url})

    # 파일 업로드 방식
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "파일이 없습니다"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"ok": False, "error": "파일명이 없습니다"}), 400

    allowed_ext = {"jpg", "jpeg", "png", "webp", "gif"}
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in allowed_ext:
        return jsonify({"ok": False, "error": "지원하지 않는 형식"}), 400

    upload_dir = os.path.join(os.path.dirname(__file__), "static", "images", "products")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"p{pid}_{uuid.uuid4().hex[:8]}.{ext}"
    file.save(os.path.join(upload_dir, filename))

    image_url = f"/static/images/products/{filename}"
    conn = get_db()
    conn.execute("UPDATE products SET image_url=?, updated_at=datetime('now','localtime') WHERE id=?",
                 (image_url, pid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "image_url": image_url})


@app.route("/api/products/<int:pid>/toggle-homepage", methods=["POST"])
@login_required
def api_product_toggle_homepage(pid):
    conn = get_db()
    current = conn.execute("SELECT show_on_homepage FROM products WHERE id=?", (pid,)).fetchone()
    if current:
        new_val = 0 if current[0] else 1
        conn.execute("UPDATE products SET show_on_homepage=? WHERE id=?", (new_val, pid))
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


# === 시작 ===

if __name__ == "__main__":
    init_db()
    migrate_db()
    seed_initial_data()
    # 기존 제품 파이프라인 초기화
    conn = get_db()
    products = conn.execute("SELECT id FROM products").fetchall()
    conn.close()
    for p in products:
        init_pipeline_for_product(p["id"])

    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("RENDER") is None  # 로컬에서만 debug 모드
    print("\n" + "="*50)
    print("  MG Commerce 자동화 플랫폼 시작!")
    print(f"  http://localhost:{port}")
    print("="*50 + "\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
