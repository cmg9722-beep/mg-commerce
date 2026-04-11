// MG Commerce - Frontend Logic
const API = '';
let currentTab = 'dashboard';
let selectedMsgTemplate = 'sample_order';
let selectedInspectionProduct = 1;

// === Navigation ===
document.querySelectorAll('[data-tab]').forEach(el => {
  el.addEventListener('click', () => {
    const tab = el.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item, .mobile-nav .tab').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelectorAll(`[data-tab="${tab}"]`).forEach(n => n.classList.add('active'));
  loadTabData(tab);
}

function loadTabData(tab) {
  switch(tab) {
    case 'dashboard': loadDashboard(); break;
    case 'finder': loadFinder(); break;
    case 'suppliers': loadSuppliers(); break;
    case 'margin': loadMargin(); break;
    case 'pipeline': loadPipeline(); break;
    case 'messages': loadMessages(); break;
    case 'coupang': loadCoupang(); break;
    case 'inspection': loadInspection(); break;
    case 'inquiries': loadInquiries(); break;
  }
}

// === API Helper ===
async function api(path, opts) {
  const resp = await fetch(API + path, opts);
  return resp.json();
}
async function post(path, body) {
  return api(path, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
}

// === Dashboard ===
async function loadDashboard() {
  const data = await api('/api/dashboard');
  const s = data.summary;

  document.getElementById('dday-text').textContent = `D-${s.d_day}`;

  document.getElementById('kpi-row').innerHTML = `
    <div class="kpi-card danger"><div class="value">D-${s.d_day}</div><div class="label">런칭 데드라인</div></div>
    <div class="kpi-card"><div class="value">${s.product_count}</div><div class="label">활성 제품</div></div>
    <div class="kpi-card success"><div class="value">${s.milestone_done}/${s.milestone_total}</div><div class="label">마일스톤</div></div>
    <div class="kpi-card warning"><div class="value">${s.candidate_count}</div><div class="label">신규 후보</div></div>
    <div class="kpi-card"><div class="value">${data.rate.cny_to_krw}</div><div class="label">CNY/KRW 환율</div></div>
  `;

  // Milestones
  let msHtml = '';
  data.milestones.forEach(m => {
    const badge = m.status === 'done' ? 'badge-done' : m.status === 'progress' ? 'badge-progress' : 'badge-todo';
    const label = m.status === 'done' ? '완료' : m.status === 'progress' ? '진행중' : '예정';
    msHtml += `<div class="timeline-item">
      <div class="timeline-dot ${m.status === 'done' ? 'done' : 'pending'}"></div>
      <span class="timeline-date">${m.target_date || ''}</span>
      <span style="flex:1;${m.status === 'done' ? 'text-decoration:line-through;color:#64748b' : ''}">${m.task}</span>
      <span class="badge ${badge}">${label}</span>
    </div>`;
  });
  document.getElementById('milestones-list').innerHTML = msHtml;

  // Margin summary
  if (data.margins.length > 0) {
    let mHtml = '<table><thead><tr><th>제품</th><th>원가</th><th>마진</th><th>마진율</th></tr></thead><tbody>';
    data.margins.forEach(m => {
      const cls = m.margin_pct > 0 ? 'margin-positive' : 'margin-negative';
      mHtml += `<tr><td>${m.product_code} ${m.product_name}</td><td>¥${m.cost_cny}</td>
        <td class="${cls}">₩${m.margin_krw.toLocaleString()}</td>
        <td class="${cls}">${m.margin_pct}%</td></tr>`;
    });
    mHtml += '</tbody></table>';
    document.getElementById('margin-summary').innerHTML = mHtml;
  }
}

// === Finder ===
async function loadFinder() {
  const [suggestions, candidates] = await Promise.all([
    api('/api/finder/suggestions'),
    api('/api/finder/candidates'),
  ]);

  let sHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">';
  suggestions.forEach(s => {
    sHtml += `<div class="supplier-card" style="border-left-color:#fbbf24">
      <div class="name">${s.category}</div>
      <div class="meta">${s.reason}</div>
      <div class="price mt-8">키워드: ${s.keywords.join(', ')}</div>
    </div>`;
  });
  sHtml += '</div>';
  document.getElementById('search-suggestions').innerHTML = sHtml;

  let cHtml = '';
  if (candidates.length === 0) {
    cHtml = '<div style="text-align:center;color:#64748b;padding:20px">아직 등록된 후보가 없습니다. 위에서 후보를 등록해보세요!</div>';
  } else {
    cHtml = '<table><thead><tr><th>제품</th><th>카테고리</th><th>가격</th><th>예상마진</th><th>점수</th><th>상태</th><th>액션</th></tr></thead><tbody>';
    candidates.forEach(c => {
      const scoreCls = c.total_score >= 70 ? 'high' : c.total_score >= 50 ? 'mid' : 'low';
      cHtml += `<tr>
        <td>${c.name_ko || c.name_cn}</td><td>${c.category || '-'}</td>
        <td>¥${c.price_cny}</td><td>${c.est_margin_pct}%</td>
        <td><div class="score-bar"><span>${c.total_score}</span><div class="bar"><div class="fill ${scoreCls}" style="width:${c.total_score}%"></div></div></div></td>
        <td><span class="badge ${c.status === 'new' ? 'badge-todo' : c.status === 'promoted' ? 'badge-done' : 'badge-warn'}">${c.status}</span></td>
        <td>${c.status === 'new' ? `<button class="btn btn-sm btn-success" onclick="promoteCandidate(${c.id})">승격</button>` : ''}</td>
      </tr>`;
    });
    cHtml += '</tbody></table>';
  }
  document.getElementById('candidates-list').innerHTML = cHtml;
}

document.getElementById('candidate-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd);
  data.price_cny = parseFloat(data.price_cny) || 0;
  data.coupang_est_price = parseInt(data.coupang_est_price) || 9900;
  data.moq = parseInt(data.moq) || 1;
  data.competition_score = parseInt(data.competition_score) || 50;
  data.return_rate_est = parseFloat(data.return_rate_est) || 5;
  data.kc_exempt = parseInt(data.kc_exempt);

  const result = await post('/api/finder/add', data);
  alert(`등록 완료! 점수: ${result.total_score}점, 예상마진율: ${result.est_margin_pct}%`);
  e.target.reset();
  loadFinder();
});

async function promoteCandidate(id) {
  if (!confirm('이 후보를 정식 제품으로 승격하시겠습니까?')) return;
  const result = await post(`/api/finder/${id}/promote`, {});
  if (result.product_id) {
    alert(`제품 ID ${result.product_id}로 승격 완료! 파이프라인이 자동 생성되었습니다.`);
    loadFinder();
  }
}

// === Suppliers ===
async function loadSuppliers() {
  const suppliers = await api('/api/suppliers');
  let html = '';
  suppliers.forEach(s => {
    const doneCount = s.timeline.filter(t => t.done).length;
    const totalCount = s.timeline.length;
    const pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;

    let timelineHtml = '';
    s.timeline.forEach(t => {
      timelineHtml += `<div class="timeline-item">
        <div class="timeline-dot ${t.done ? 'done' : 'pending'}"></div>
        <span class="timeline-date">${t.event_date}</span>
        <span style="flex:1;${t.done ? 'text-decoration:line-through;color:#64748b' : ''}">${t.event_name}</span>
        <button class="btn btn-sm ${t.done ? 'btn-secondary' : 'btn-success'}" onclick="toggleTimeline(${t.id}, ${!t.done})">${t.done ? '↩' : '✓'}</button>
      </div>`;
    });

    html += `<div class="card">
      <div class="flex-between mb-8">
        <h3 style="border:0;padding:0;margin:0">${s.product_code} ${s.product_name}</h3>
        <span class="badge ${s.status === '샘플확정' ? 'badge-done' : s.status === '답변대기' ? 'badge-todo' : 'badge-warn'}">${s.status}</span>
      </div>
      <div class="supplier-card">
        <div class="name">${s.name_ko} (${s.name_cn})</div>
        <div class="meta">채팅방: ${s.chat_name} | 소재지: ${s.location} | 등급: ${s.grade}</div>
        <div class="price">샘플: ${s.sample_price} | 100개: ${s.bulk_100 || '-'} | 500개: ${s.bulk_500 || '-'}</div>
        <div class="meta mt-8">${s.notes || ''}</div>
      </div>
      <div class="progress-bar"><div class="progress-fill blue" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:#64748b;text-align:right">${doneCount}/${totalCount} (${pct}%)</div>
      <div class="mt-8">${timelineHtml}</div>
      <div class="flex gap-8 mt-8">
        <select onchange="updateSupplierStatus(${s.id}, this.value)" style="width:auto">
          ${['답변대기','단가확인','샘플확정','발송완료','도착완료','검수완료','제외'].map(st =>
            `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`
          ).join('')}
        </select>
        <input placeholder="트래킹번호" value="${s.tracking_no || ''}" style="width:200px"
          onchange="updateTracking(${s.id}, this.value)">
      </div>
    </div>`;
  });
  document.getElementById('suppliers-list').innerHTML = html;
}

async function toggleTimeline(id, done) {
  await post(`/api/timeline/${id}/toggle`, { done });
  loadSuppliers();
}

async function updateSupplierStatus(id, status) {
  await post(`/api/suppliers/${id}/status`, { status });
  loadSuppliers();
}

async function updateTracking(id, tracking) {
  await post(`/api/suppliers/${id}/tracking`, { tracking_no: tracking });
}

// === Margin ===
async function loadMargin() {
  const [rateInfo, margins] = await Promise.all([
    api('/api/exchange-rate'),
    api('/api/margin/all'),
  ]);

  document.getElementById('current-rate').textContent = `₩${rateInfo.cny_to_krw} (${rateInfo.last_update})`;

  let html = '';
  margins.forEach(m => {
    const cls = m.margin_pct > 0 ? 'margin-positive' : 'margin-negative';
    html += `<tr>
      <td>${m.product_code} ${m.product_name}</td>
      <td>¥${m.cost_cny}</td>
      <td>₩${m.cost_krw.toLocaleString()}</td>
      <td>₩${m.coupang_price.toLocaleString()}</td>
      <td>₩${m.fee_krw.toLocaleString()}</td>
      <td class="${cls}">₩${m.margin_krw.toLocaleString()}</td>
      <td class="${cls}">${m.margin_pct}%</td>
      <td class="${cls}">₩${m.margin_total_krw.toLocaleString()}</td>
    </tr>`;
  });
  document.getElementById('margin-table').innerHTML = html;
}

async function refreshRate() {
  const info = await api('/api/exchange-rate');
  document.getElementById('current-rate').textContent = `₩${info.cny_to_krw} (${info.last_update})`;
  loadMargin();
}

async function runSimulation() {
  const cost = parseFloat(document.getElementById('sim-cost').value) || 0;
  const price = parseInt(document.getElementById('sim-price').value) || 0;
  const qty = parseInt(document.getElementById('sim-qty').value) || 1;
  const promo = document.getElementById('sim-promo').value === '1';

  const result = await post('/api/margin/calc', { cost_cny: cost, coupang_price: price, qty, promo });
  const cls = result.margin_pct > 0 ? 'margin-positive' : 'margin-negative';

  document.getElementById('sim-result').innerHTML = `
    <div class="card" style="margin:0">
      <table>
        <tr><td>환율</td><td>₩${result.exchange_rate}</td></tr>
        <tr><td>원가 (CNY→KRW)</td><td>¥${result.cost_cny} → ₩${result.cost_krw.toLocaleString()}</td></tr>
        <tr><td>배송비</td><td>₩${result.shipping_krw.toLocaleString()} ${result.promo_applied ? '(프로모션 0원)' : ''}</td></tr>
        <tr><td>쿠팡 수수료 (${result.fee_rate}%)</td><td>₩${result.fee_krw.toLocaleString()}</td></tr>
        <tr style="font-size:18px;font-weight:800"><td>개당 마진</td><td class="${cls}">₩${result.margin_krw.toLocaleString()} (${result.margin_pct}%)</td></tr>
        <tr style="font-size:20px;font-weight:900"><td>${qty}개 총 마진</td><td class="${cls}">₩${result.margin_total_krw.toLocaleString()}</td></tr>
      </table>
    </div>`;
}

// === Pipeline ===
async function loadPipeline() {
  const steps = await api('/api/pipeline');
  const byProduct = {};
  steps.forEach(s => {
    if (!byProduct[s.product_id]) byProduct[s.product_id] = { name: `${s.product_code} ${s.product_name}`, steps: [] };
    byProduct[s.product_id].steps.push(s);
  });

  let html = '';
  Object.entries(byProduct).forEach(([pid, group]) => {
    const done = group.steps.filter(s => s.status === 'done').length;
    const pct = Math.round(done / group.steps.length * 100);

    let stepsHtml = '';
    group.steps.forEach(s => {
      const badge = s.status === 'done' ? 'badge-done' : s.status === 'progress' ? 'badge-progress' : 'badge-todo';
      const label = s.status === 'done' ? '완료' : s.status === 'progress' ? '진행' : '대기';
      stepsHtml += `<div class="timeline-item">
        <div class="timeline-dot ${s.status === 'done' ? 'done' : 'pending'}"></div>
        <span style="flex:1">${s.step_name}</span>
        <span class="timeline-date">${s.due_date || ''}</span>
        <span class="badge ${badge}">${label}</span>
        <select style="width:auto;padding:2px 6px;font-size:11px" onchange="updatePipelineStep(${s.id}, this.value)">
          <option value="pending" ${s.status==='pending'?'selected':''}>대기</option>
          <option value="progress" ${s.status==='progress'?'selected':''}>진행</option>
          <option value="done" ${s.status==='done'?'selected':''}>완료</option>
        </select>
      </div>`;
    });

    html += `<div class="card">
      <h3 style="border:0;padding:0">${group.name}</h3>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:#64748b;text-align:right;margin-bottom:8px">${done}/${group.steps.length} (${pct}%)</div>
      ${stepsHtml}
    </div>`;
  });

  if (!html) html = '<div class="card"><p style="text-align:center;color:#64748b">파이프라인 데이터가 없습니다.</p></div>';
  document.getElementById('pipeline-view').innerHTML = html;
}

async function updatePipelineStep(id, status) {
  await post(`/api/pipeline/${id}/status`, { status });
  loadPipeline();
}

// === Messages ===
async function loadMessages() {
  const templates = await api('/api/messages/templates');
  let html = '';
  templates.forEach(t => {
    html += `<div class="tab ${t.key === selectedMsgTemplate ? 'active' : ''}"
      onclick="selectMsgTemplate('${t.key}')">${t.label}</div>`;
  });
  document.getElementById('msg-tabs').innerHTML = html;
}

function selectMsgTemplate(key) {
  selectedMsgTemplate = key;
  document.querySelectorAll('#msg-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#msg-tabs .tab[onclick*="${key}"]`)?.classList.add('active');
}

async function generateMsg() {
  const params = {
    product: document.getElementById('msg-product').value,
    qty: document.getElementById('msg-qty').value,
    extra: document.getElementById('msg-extra').value,
  };
  const result = await post('/api/messages/generate', { template: selectedMsgTemplate, params });
  document.getElementById('msg-output').textContent = result.message;
}

function copyMsg() {
  const text = document.getElementById('msg-output').textContent;
  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.querySelector('#tab-messages .btn-copy');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = '📋 복사', 2000);
  });
}

// === Coupang ===
async function loadCoupang() {
  // Checklist
  const checklist = await api('/api/coupang/checklist');
  let clHtml = '';
  checklist.forEach((c, i) => {
    clHtml += `<div class="timeline-item"><div class="timeline-dot pending"></div>
      <span style="font-weight:700">${i+1}. ${c.step}</span>
      <span style="font-size:11px;color:#64748b">${c.desc}</span></div>`;
  });
  document.getElementById('cp-checklist').innerHTML = clHtml;

  // Product select
  const products = await api('/api/products');
  let optHtml = '';
  products.forEach(p => {
    optHtml += `<option value="${p.id}">${p.code} ${p.name_ko}</option>`;
  });
  document.getElementById('cp-product-select').innerHTML = optHtml;
}

async function genTitle() {
  const name = document.getElementById('cp-name').value;
  const kwStr = document.getElementById('cp-keywords').value;
  const keywords = kwStr ? kwStr.split(',').map(k => k.trim()) : null;
  const result = await post('/api/coupang/title', { name, keywords });
  document.getElementById('cp-title-result').innerHTML = `
    <div class="card" style="margin:0">
      <div style="font-size:16px;font-weight:700;color:#fbbf24;margin-bottom:8px">${result.title}</div>
      <div style="font-size:12px;color:#94a3b8">키워드: ${result.keywords.join(', ')}</div>
      <div class="mt-8">${result.tips.map(t => `<div style="font-size:12px;color:#64748b">• ${t}</div>`).join('')}</div>
    </div>`;
}

async function genPriceStrategy() {
  const cost = parseFloat(document.getElementById('cp-cost').value) || 0;
  const result = await post('/api/coupang/price-strategy', { cost_cny: cost });
  let html = `<div class="card" style="margin:0"><p style="font-size:12px;color:#94a3b8;margin-bottom:12px">원가: ₩${result.cost_krw.toLocaleString()}</p>
    <table><thead><tr><th>전략</th><th>판매가</th><th>마진</th><th>마진율</th></tr></thead><tbody>`;
  result.strategies.forEach(s => {
    const cls = s.margin_pct > 0 ? 'margin-positive' : 'margin-negative';
    html += `<tr><td>${s.label}</td><td>₩${s.price.toLocaleString()}</td>
      <td class="${cls}">₩${s.margin_krw.toLocaleString()}</td><td class="${cls}">${s.margin_pct}%</td></tr>`;
  });
  html += `</tbody></table><p style="font-size:12px;color:#fbbf24;margin-top:8px">${result.recommendation}</p></div>`;
  document.getElementById('cp-price-result').innerHTML = html;
}

async function genProductPage() {
  const pid = document.getElementById('cp-product-select').value;
  const result = await api(`/api/coupang/product-page/${pid}`);
  if (result.html) {
    document.getElementById('cp-page-result').innerHTML = `
      <div class="card" style="margin:0">
        <p style="font-size:12px;color:#94a3b8;margin-bottom:8px">${result.product_name} 상세페이지 HTML 생성 완료</p>
        <textarea style="height:200px;font-family:monospace;font-size:11px">${result.html.replace(/</g,'&lt;')}</textarea>
        <button class="btn btn-copy btn-sm mt-8" onclick="navigator.clipboard.writeText(document.querySelector('#cp-page-result textarea').value)">📋 HTML 복사</button>
      </div>`;
  }
}

// === Inspection ===
async function loadInspection() {
  const products = await api('/api/products');
  let tabsHtml = '';
  products.forEach(p => {
    tabsHtml += `<div class="tab ${p.id === selectedInspectionProduct ? 'active' : ''}"
      onclick="selectInspectionProduct(${p.id})">${p.code} ${p.name_ko}</div>`;
  });
  document.getElementById('inspection-tabs').innerHTML = tabsHtml;
  loadInspectionItems(selectedInspectionProduct);
}

async function selectInspectionProduct(pid) {
  selectedInspectionProduct = pid;
  document.querySelectorAll('#inspection-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`#inspection-tabs .tab[onclick*="${pid}"]`)?.classList.add('active');
  loadInspectionItems(pid);
}

async function loadInspectionItems(pid) {
  const items = await api(`/api/inspection/${pid}`);
  const done = items.filter(i => i.checked).length;
  const pct = items.length > 0 ? Math.round(done / items.length * 100) : 0;

  let html = `<div class="card">
    <div class="flex-between mb-8">
      <span>${done}/${items.length} 완료</span>
      <span class="badge ${pct === 100 ? 'badge-done' : 'badge-warn'}">${pct}%</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div>`;

  items.forEach(item => {
    html += `<label style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;margin-top:4px;
      ${item.checked ? 'background:#0f2b1a;border:1px solid #166534' : 'background:#0f172a;border:1px solid #334155'}">
      <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleInspection(${item.id})"
        style="width:18px;height:18px;accent-color:#10b981">
      <span style="${item.checked ? 'text-decoration:line-through;color:#64748b' : ''}">${item.item_name}</span>
    </label>`;
  });
  html += '</div>';
  document.getElementById('inspection-list').innerHTML = html;
}

async function toggleInspection(id) {
  await post(`/api/inspection/${id}/toggle`, {});
  loadInspectionItems(selectedInspectionProduct);
}

// === Inquiries ===
async function loadInquiries() {
  const inquiries = await api('/api/inquiries');
  const newCount = inquiries.filter(i => i.status === 'new').length;
  const repliedCount = inquiries.filter(i => i.status === 'replied').length;
  const closedCount = inquiries.filter(i => i.status === 'closed').length;

  document.getElementById('inquiry-kpi').innerHTML = `
    <div class="kpi-card danger"><div class="value">${newCount}</div><div class="label">신규 문의</div></div>
    <div class="kpi-card warning"><div class="value">${repliedCount}</div><div class="label">답변 완료</div></div>
    <div class="kpi-card success"><div class="value">${closedCount}</div><div class="label">처리 완료</div></div>
    <div class="kpi-card"><div class="value">${inquiries.length}</div><div class="label">전체 문의</div></div>
  `;

  if (inquiries.length === 0) {
    document.getElementById('inquiries-list').innerHTML =
      '<div style="text-align:center;color:#64748b;padding:30px">아직 접수된 문의가 없습니다.<br>홈페이지에서 문의가 들어오면 여기에 표시됩니다.</div>';
    return;
  }

  let html = '';
  inquiries.forEach(q => {
    const badge = q.status === 'new' ? 'badge-alert' : q.status === 'replied' ? 'badge-warn' : 'badge-done';
    const label = q.status === 'new' ? '신규' : q.status === 'replied' ? '답변완료' : '처리완료';
    html += `<div class="card" style="margin-bottom:12px;border-left:3px solid ${q.status === 'new' ? '#ef4444' : q.status === 'replied' ? '#f59e0b' : '#10b981'}">
      <div class="flex-between mb-8">
        <div>
          <strong style="font-size:15px">${q.name}</strong>
          <span style="font-size:12px;color:#64748b;margin-left:8px">${q.email || ''} ${q.phone || ''}</span>
        </div>
        <div>
          <span class="badge ${badge}">${label}</span>
          <span style="font-size:11px;color:#64748b;margin-left:8px">${q.created_at}</span>
        </div>
      </div>
      <div style="background:#0f172a;padding:12px;border-radius:8px;font-size:13px;margin-bottom:10px;white-space:pre-wrap">${q.message}</div>
      ${q.reply ? `<div style="background:#0f2b1a;border:1px solid #166534;padding:12px;border-radius:8px;font-size:13px;margin-bottom:10px">
        <span style="color:#10b981;font-weight:700">답변:</span> ${q.reply}</div>` : ''}
      ${q.status === 'new' ? `
        <div class="flex gap-8">
          <input id="reply-${q.id}" placeholder="답변을 입력하세요..." style="flex:1">
          <button class="btn btn-sm btn-primary" onclick="replyInquiry(${q.id})">답변</button>
        </div>` : ''}
      ${q.status === 'replied' ? `<button class="btn btn-sm btn-success" onclick="closeInquiry(${q.id})">처리 완료</button>` : ''}
    </div>`;
  });
  document.getElementById('inquiries-list').innerHTML = html;

  // 신규 문의 알림
  if (newCount > 0) {
    updateNotificationBadge(newCount);
  }
}

async function replyInquiry(id) {
  const reply = document.getElementById(`reply-${id}`).value;
  if (!reply) { alert('답변을 입력해주세요.'); return; }
  await post(`/api/inquiries/${id}/reply`, { reply });
  loadInquiries();
}

async function closeInquiry(id) {
  await post(`/api/inquiries/${id}/close`, {});
  loadInquiries();
}

// === Notification System ===
let lastInquiryCount = 0;

function updateNotificationBadge(count) {
  const navItem = document.querySelector('[data-tab="inquiries"] .icon');
  if (navItem && count > 0) {
    navItem.parentElement.innerHTML = `<span class="icon">📩</span>고객 문의 <span class="badge badge-alert" style="margin-left:4px">${count}</span>`;
  }
}

async function checkNewInquiries() {
  try {
    const inquiries = await api('/api/inquiries');
    const newCount = inquiries.filter(i => i.status === 'new').length;

    if (newCount > lastInquiryCount && lastInquiryCount >= 0) {
      // 브라우저 알림
      if (Notification.permission === 'granted') {
        const latest = inquiries.find(i => i.status === 'new');
        new Notification('MG Commerce - 새 문의!', {
          body: `${latest?.name || '고객'}님의 문의가 접수되었습니다.`,
          icon: '/static/icon.png',
          tag: 'mg-inquiry',
        });
      }
      // 소리 알림
      try { new Audio('data:audio/wav;base64,UklGRl9vT19teleXM=').play(); } catch(e) {}
    }

    lastInquiryCount = newCount;
    updateNotificationBadge(newCount);

    // 현재 문의 탭이면 자동 갱신
    if (currentTab === 'inquiries') loadInquiries();
  } catch(e) {}
}

// 브라우저 알림 권한 요청
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// 30초마다 새 문의 체크
setInterval(checkNewInquiries, 30000);

// === PWA Service Worker ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js').catch(() => {});
}

// === Init ===
loadDashboard();
checkNewInquiries();
