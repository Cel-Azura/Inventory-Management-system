/**
 * app.js — IMS Frontend (Microservice Edition)
 * =============================================================
 * Single-file frontend that communicates exclusively with the
 * API Gateway at /api/*  (served via nginx proxy at port 80).
 *
 * All business logic has been moved to backend microservices.
 * This file handles:
 *   - JWT token management (localStorage)
 *   - REST API calls via fetch()
 *   - DOM rendering of all pages
 *   - Role-based UI show/hide
 * =============================================================
 */

const API = '/api';  // nginx proxies /api → api-gateway:3000

// ─────────────────────────────────────────────────────────────
//  TOKEN / SESSION
// ─────────────────────────────────────────────────────────────
let _token = localStorage.getItem('ims_token');
let _user  = JSON.parse(localStorage.getItem('ims_user') || 'null');

function setSession(token, user) {
  _token = token;
  _user  = user;
  localStorage.setItem('ims_token', token);
  localStorage.setItem('ims_user', JSON.stringify(user));
}

function clearSession() {
  _token = null;
  _user  = null;
  localStorage.removeItem('ims_token');
  localStorage.removeItem('ims_user');
}

function getUser()    { return _user; }
function isAdmin()    { return _user && _user.role === 'admin'; }
function authHeader() { return { 'Authorization': `Bearer ${_token}`, 'Content-Type': 'application/json' }; }

// ─────────────────────────────────────────────────────────────
//  HTTP CLIENT
// ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: authHeader() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  // FIX: Chỉ auto-logout khi đã đăng nhập (có token) mà nhận 401,
  //      không reload khi đang ở trang login (tránh vòng lặp vô hạn)
  if (res.status === 401 && _token && path !== '/auth/login') {
    clearSession();
    location.reload();
  }
  if (!data.success) throw new Error(data.message || 'Lỗi không xác định');
  return data;
}

const GET    = path        => api('GET',    path);
const POST   = (path, b)   => api('POST',   path, b);
const PUT    = (path, b)   => api('PUT',    path, b);
const PATCH  = (path, b)   => api('PATCH',  path, b);
const DELETE = path        => api('DELETE', path);

// ─────────────────────────────────────────────────────────────
//  FORMAT HELPERS
// ─────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function padId(id) { return '#' + String(id).padStart(4, '0'); }
function getStockStatus(stock, threshold) {
  if (stock === 0)        return { label: 'Hết hàng', badge: 'badge-danger'  };
  if (stock <= threshold) return { label: 'Sắp hết',  badge: 'badge-warning' };
  return                         { label: 'Còn hàng', badge: 'badge-success' };
}
function stockBarHTML(stock, threshold) {
  const pct       = Math.min(100, Math.round((stock / Math.max(threshold * 3, 1)) * 100));
  const fillClass = stock === 0 ? 'crit' : stock <= threshold ? 'warn' : 'ok';
  const st        = getStockStatus(stock, threshold);
  return `<div class="stock-bar-wrap">
    <div class="stock-mini-bar"><div class="stock-mini-fill ${fillClass}" style="width:${pct}%"></div></div>
    <span class="badge ${st.badge}">${st.label}</span>
  </div>`;
}
function renderTableEmpty(colspan, msg = 'Không có dữ liệu') {
  return `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text-muted)">${msg}</td></tr>`;
}

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ─────────────────────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

window.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// ─────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  if (window.innerWidth <= 900) {
    s.classList.toggle('open');
  } else {
    s.classList.toggle('collapsed');
    document.querySelector('.main-wrap').style.marginLeft =
      s.classList.contains('collapsed') ? '0' : 'var(--sidebar-w)';
  }
}

// ─────────────────────────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────────────────────────
function startClock(elId) {
  function tick() {
    const el = document.getElementById(elId);
    if (el) el.textContent = new Date().toLocaleString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  tick();
  return setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────────
//  LOGIN / LOGOUT
// ─────────────────────────────────────────────────────────────
function fillDemo(u, p) {
  document.getElementById('username').value = u;
  document.getElementById('password').value = p;
  document.getElementById('login-error').classList.add('hidden');
}

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('login-error');

  // FIX: Validate trống trước khi gọi API
  if (!username || !password) {
    const msgElV = document.getElementById('login-error-msg');
    if (msgElV) msgElV.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
    else errorEl.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
    errorEl.classList.remove('hidden');
    return;
  }

  const btn = document.querySelector('.btn-login');
  btn.disabled = true;
  btn.textContent = 'Đang đăng nhập...';

  try {
    const data = await POST('/auth/login', { username, password });
    setSession(data.token, data.user);
    bootApp();
  } catch (e) {
    // FIX: Hiển thị thông báo lỗi cụ thể từ server
    const msgEl = document.getElementById('login-error-msg');
    if (msgEl) msgEl.textContent = e.message || 'Tài khoản hoặc mật khẩu không đúng';
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Đăng nhập';
  }
}

function handleLogout() {
  clearSession();
  // FIX: reset toan bo state UI ve trang thai chua dang nhap
  _productsCache = [];
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-error').classList.add('hidden');
  const msgEl = document.getElementById('login-error-msg');
  if (msgEl) msgEl.textContent = 'Tai khoan hoac mat khau khong dung';
}

// ─────────────────────────────────────────────────────────────
//  BOOT — apply role-based UI
// ─────────────────────────────────────────────────────────────
function bootApp() {
  const user = getUser();
  const initials = user.fullname.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('user-avatar').textContent      = initials;
  document.getElementById('topbar-avatar').textContent    = initials;
  document.getElementById('user-name-display').textContent = user.fullname;
  document.getElementById('user-role-badge').textContent  =
    user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';

  const adminGroup   = document.getElementById('admin-nav-group');
  const btnAddProduct = document.getElementById('btn-add-product');

  if (!isAdmin()) {
    adminGroup.style.display    = 'none';
    btnAddProduct.style.display = 'none';
  } else {
    adminGroup.style.display    = '';
    btnAddProduct.style.display = '';
  }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('app').style.display = 'flex';

  startClock('topbar-time');
  refreshNotifBadge();
  setInterval(refreshNotifBadge, 60000); // refresh every 60s
  showPage('dashboard');
}

// ─────────────────────────────────────────────────────────────
//  PAGE ROUTER
// ─────────────────────────────────────────────────────────────
function showPage(page) {
  // Guard: non-admin cannot access admin pages
  if (!isAdmin() && ['reports', 'users', 'history'].includes(page)) {
    showToast('Bạn không có quyền truy cập trang này', 'error');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pg  = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  const titles = {
    dashboard:    'Dashboard',
    products:     'Sản phẩm',
    inventory:    'Tồn kho',
    transactions: 'Giao dịch',
    reports:      'Báo cáo',
    users:        'Người dùng',
    history:      'Lịch sử kiểm toán',
    alerts:       'Cảnh báo tồn kho',
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  const renderMap = {
    dashboard:    renderDashboard,
    products:     renderProducts,
    inventory:    renderInventory,
    transactions: renderTransactions,
    reports:      renderReports,
    users:        renderUsers,
    history:      renderHistory,
    alerts:       renderAlerts,
  };
  if (renderMap[page]) renderMap[page]();

  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
async function renderDashboard() {
  try {
    const [productsData, txCountData, recentData] = await Promise.all([
      GET('/products'),
      GET('/transactions/count'),
      GET('/transactions/recent?n=8'),
    ]);

    const products = productsData.products || [];
    // Chỉ tính SKU con (có parentSku) hoặc sản phẩm độc lập thực sự (price > 0)
    const realProducts = products.filter(p => p.parentSku !== null || (p.price > 0 && p.threshold > 0));
    const lowStock = realProducts.filter(p => p.stock <= p.threshold && p.threshold > 0);

    document.getElementById('stat-products').textContent     = realProducts.length;
    document.getElementById('stat-transactions').textContent = txCountData.total || 0;
    document.getElementById('stat-low-stock').textContent    = lowStock.length;

    // Active users count (admin only)
    if (isAdmin()) {
      try {
        const ud = await GET('/auth/users');
        const active = (ud.users || []).filter(u => u.status === 'active').length;
        document.getElementById('stat-users').textContent = active;
      } catch (_) { document.getElementById('stat-users').textContent = '-'; }
    }

    // Recent transactions table
    const recent = recentData.transactions || [];
    const tbody  = document.getElementById('recent-tx-body');
    tbody.innerHTML = recent.map(tx => {
      const pName = tx.productName || `#${tx.productId}`;
      return `<tr>
        <td><strong>${pName}</strong></td>
        <td><span class="badge badge-${tx.type === 'import' ? 'import' : 'export'}">${tx.type === 'import' ? '▲ Nhập' : '▼ Xuất'}</span></td>
        <td class="td-mono">${tx.qty}</td>
        <td style="color:var(--text-muted);font-size:12px">${fmtDate(tx.time)}</td>
        <td><span class="badge badge-success">✓ Hoàn thành</span></td>
      </tr>`;
    }).join('') || renderTableEmpty(5, 'Chưa có giao dịch');

    // Low stock panel
    const lsl = document.getElementById('low-stock-list');
    if (lowStock.length === 0) {
      lsl.innerHTML = '<p style="color:var(--success);font-size:13px;font-weight:600;text-align:center;padding:20px">✓ Tất cả sản phẩm đủ tồn kho</p>';
    } else {
      lsl.innerHTML = lowStock.slice(0, 8).map(p => `
        <div class="low-stock-item">
          <div class="low-stock-dot"></div>
          <span class="item-name">${p.name}</span>
          <span class="item-stock">${p.stock}/${p.threshold}</span>
        </div>`).join('');
    }
  } catch (e) {
    showToast('Không thể tải dashboard: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
//  PRODUCTS PAGE  (V2 — SKU Variants / Grouped View)
// ─────────────────────────────────────────────────────────────
let _productsCache  = [];   // flat list of ALL products
let _productView    = 'grouped'; // 'grouped' | 'flat'
let _expandedGroups = {};   // { sku: true/false }

function setProductView(mode, btn) {
  _productView = mode;
  document.querySelectorAll('#page-products .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts();
}

// ── Render a single real-product row ─────────────────────────
function productRow(p, isVariant = false) {
  const canEdit = isAdmin();
  const st      = getStockStatus(p.stock, p.threshold);
  const indent  = isVariant
    ? `<span style="color:var(--text-muted);margin-right:4px">└</span>`
    : '';
  const skuStyle = isVariant
    ? 'color:var(--primary);padding-left:16px'
    : '';
  return `<tr class="${isVariant ? 'variant-row' : ''}">
    <td class="td-mono" style="${skuStyle}">${indent}${p.sku}</td>
    <td>
      ${isVariant ? '' : '<strong>'}${p.name}${isVariant ? '' : '</strong>'}
      <br><small style="color:var(--text-muted)">${(p.desc || '').substring(0, 55)}${p.desc && p.desc.length > 55 ? '…' : ''}</small>
    </td>
    <td><span class="badge badge-blue">${p.category}</span></td>
    <td class="td-mono">${fmtCurrency(p.price)}</td>
    <td class="td-mono"><strong>${p.stock}</strong></td>
    <td><span class="badge ${st.badge}">${st.label}</span></td>
    <td class="td-actions">
      ${canEdit
        ? `<button class="btn-sm btn-edit"   onclick="editProduct(${p.id})">Sửa</button>
           <button class="btn-sm btn-delete" onclick="deleteProduct(${p.id})">Xóa</button>`
        : '<span style="color:var(--text-muted);font-size:12px">—</span>'}
    </td>
  </tr>`;
}

// ── Render a group header row ─────────────────────────────────
function groupHeaderRow(group) {
  const expanded   = _expandedGroups[group.sku] !== false; // default open
  const totalStock = (group.variants || []).reduce((s, v) => s + v.stock, 0);
  const varCount   = (group.variants || []).length;
  const canEdit    = isAdmin();
  return `<tr class="group-header-row" onclick="toggleGroup('${group.sku}')">
    <td class="td-mono" style="font-weight:700;color:var(--primary)">
      <span style="margin-right:6px;transition:transform .2s;display:inline-block;transform:rotate(${expanded ? 90 : 0}deg)" id="arrow-${group.sku}">▶</span>
      ${group.sku}
    </td>
    <td>
      <strong>${group.name}</strong>
      <span class="badge" style="background:var(--primary-light,#e8f4ff);color:var(--primary);margin-left:6px">${varCount} phiên bản</span>
    </td>
    <td><span class="badge badge-blue">${group.category}</span></td>
    <td class="td-mono" style="color:var(--text-muted)">—</td>
    <td class="td-mono"><strong>${totalStock}</strong> <small style="color:var(--text-muted)">(tổng)</small></td>
    <td>—</td>
    <td class="td-actions">
      ${canEdit
        ? `<button class="btn-sm btn-edit" onclick="event.stopPropagation();editProduct(${group.id})">Sửa</button>
           <button class="btn-sm btn-delete" onclick="event.stopPropagation();deleteProduct(${group.id})">Xóa</button>`
        : ''}
    </td>
  </tr>`;
}

function toggleGroup(sku) {
  _expandedGroups[sku] = !(_expandedGroups[sku] !== false);
  renderProducts();
}

async function renderProducts(list) {
  try {
    const tbody   = document.getElementById('products-body');
    const canEdit = isAdmin();

    // ── Flat view (search results or explicit flat mode) ──────
    if (list || _productView === 'flat') {
      if (!list) {
        const data = await GET('/products');
        _productsCache = data.products || [];
        list = _productsCache;
      }
      // Keep only real products (price > 0) in flat view
      const real = list.filter(p => p.price > 0 || p.threshold > 0);
      tbody.innerHTML = real.map(p => productRow(p, !!p.parentSku))
        .join('') || renderTableEmpty(7, 'Không tìm thấy sản phẩm');
      return;
    }

    // ── Grouped view ──────────────────────────────────────────
    const data = await GET('/products/grouped');
    // Also load flat list for cache (for modals)
    const flatData = await GET('/products');
    _productsCache = flatData.products || [];

    const groups     = data.groups     || [];
    const standalone = data.standalone || [];
    let rows = '';

    for (const g of groups) {
      rows += groupHeaderRow(g);
      const expanded = _expandedGroups[g.sku] !== false;
      if (expanded) {
        for (const v of (g.variants || [])) {
          rows += productRow(v, true);
        }
      }
    }

    // Standalone products (no parent, real price)
    for (const p of standalone) {
      rows += productRow(p, false);
    }

    tbody.innerHTML = rows || renderTableEmpty(7, 'Không có sản phẩm');
  } catch (e) {
    showToast('Lỗi tải sản phẩm: ' + e.message, 'error');
  }
}

async function filterProducts() {
  const q = document.getElementById('product-search').value.trim();
  if (!q) return renderProducts();
  const data = await GET(`/products?q=${encodeURIComponent(q)}`);
  renderProducts(data.products || []);
}

// ── Populate parent SKU dropdown in modal ─────────────────────
async function populateParentSkuDropdown(currentParentSku) {
  const sel = document.getElementById('product-parent-sku');
  sel.innerHTML = '<option value="">— Sản phẩm độc lập (không thuộc nhóm) —</option>';
  try {
    const data = await GET('/products/parents');
    (data.products || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.sku;
      opt.textContent = `${p.sku} — ${p.name}`;
      if (p.sku === currentParentSku) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (_) {}
}

async function openProductModal(id) {
  document.getElementById('product-modal-title').textContent = id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới';
  document.getElementById('product-id').value = id || '';
  await populateParentSkuDropdown(null);

  if (id) {
    const p = _productsCache.find(x => x.id === id);
    if (p) {
      document.getElementById('product-sku').value        = p.sku;
      document.getElementById('product-name').value       = p.name;
      document.getElementById('product-category').value   = p.category;
      document.getElementById('product-desc').value       = p.desc || '';
      document.getElementById('product-price').value      = p.price;
      document.getElementById('product-stock').value      = p.stock;
      document.getElementById('product-threshold').value  = p.threshold;
      await populateParentSkuDropdown(p.parentSku);
    }
  } else {
    ['product-sku','product-name','product-desc','product-price','product-stock','product-threshold']
      .forEach(fid => { document.getElementById(fid).value = ''; });
    document.getElementById('product-category').value = 'Điện tử';
  }
  document.getElementById('product-modal').classList.remove('hidden');
}

function editProduct(id) { openProductModal(id); }

async function saveProduct() {
  const id   = document.getElementById('product-id').value;
  const body = {
    sku:       document.getElementById('product-sku').value.trim(),
    name:      document.getElementById('product-name').value.trim(),
    price:     parseFloat(document.getElementById('product-price').value) || 0,
    category:  document.getElementById('product-category').value,
    desc:      document.getElementById('product-desc').value.trim(),
    stock:     parseInt(document.getElementById('product-stock').value)     || 0,
    threshold: parseInt(document.getElementById('product-threshold').value) || 10,
    parentSku: document.getElementById('product-parent-sku').value || null,
  };

  try {
    if (id) {
      await PUT(`/products/${id}`, body);
      showToast('Cập nhật sản phẩm thành công');
    } else {
      await POST('/products', body);
      showToast('Thêm sản phẩm thành công');
    }
    closeModal('product-modal');
    renderProducts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteProduct(id) {
  const p = _productsCache.find(x => x.id === id);
  if (!p || !confirm(`Bạn có chắc muốn xóa sản phẩm "${p.name}"?\n${p.parentSku ? '' : 'Lưu ý: Xóa nhóm cha sẽ xóa toàn bộ biến thể con!'}`)) return;
  try {
    await DELETE(`/products/${id}`);
    showToast('Đã xóa sản phẩm', 'info');
    renderProducts();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  NOTIFICATION BELL  (topbar)
// ─────────────────────────────────────────────────────────────
let _alertsCache  = [];  // all products with stock info
let _notifTab     = 'low'; // current tab in dropdown

async function loadAlertData() {
  try {
    const data     = await GET('/products');
    // Chỉ theo dõi SKU con (có parentSku) — bỏ qua các nhóm SKU cha
    const products = (data.products || []).filter(p => p.parentSku !== null && p.threshold > 0);
    _alertsCache   = products;
    return products;
  } catch (_) { return []; }
}

function classifyProduct(p) {
  if (p.stock === 0)                          return 'out';
  if (p.stock < p.threshold * 0.5)           return 'critical';
  if (p.stock <= p.threshold)                return 'low';
  return 'ok';
}

async function refreshNotifBadge() {
  const products = await loadAlertData();
  const outCount  = products.filter(p => p.stock === 0).length;
  const lowCount  = products.filter(p => p.stock > 0 && p.stock <= p.threshold).length;
  const total     = outCount + lowCount;

  const badge = document.getElementById('notif-badge');
  const navBadge = document.getElementById('nav-alert-badge');

  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.remove('hidden');
    badge.className = 'notif-badge' + (outCount > 0 ? ' danger' : '');
    if (navBadge) { navBadge.style.display = 'inline-flex'; navBadge.textContent = total; }
  } else {
    badge.classList.add('hidden');
    if (navBadge) navBadge.style.display = 'none';
  }

  document.getElementById('nc-low').textContent = lowCount;
  document.getElementById('nc-out').textContent = outCount;
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    renderNotifList(_notifTab);
  } else {
    panel.classList.add('hidden');
  }
}

function closeNotifPanel() {
  document.getElementById('notif-panel').classList.add('hidden');
}

function switchNotifTab(tab, btn) {
  _notifTab = tab;
  document.querySelectorAll('.notif-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotifList(tab);
}

function renderNotifList(tab) {
  const list = document.getElementById('notif-list');
  const products = _alertsCache.filter(p => {
    if (tab === 'out') return p.stock === 0;
    if (tab === 'low') return p.stock > 0 && p.stock <= p.threshold;
    return false;
  });

  if (products.length === 0) {
    list.innerHTML = `<div class="notif-empty">${tab === 'out' ? '✅ Không có sản phẩm hết hàng' : '✅ Không có sản phẩm sắp hết'}</div>`;
    return;
  }

  list.innerHTML = products.slice(0, 10).map(p => {
    const cls    = p.stock === 0 ? 'out' : p.stock < p.threshold * 0.5 ? 'critical' : 'low';
    const icon   = p.stock === 0 ? '🚫' : p.stock < p.threshold * 0.5 ? '⚠️' : '🔶';
    const pct    = p.threshold > 0 ? Math.round((p.stock / p.threshold) * 100) : 0;
    return `<div class="notif-item ${cls}" onclick="showPage('alerts'); closeNotifPanel()">
      <div class="notif-item-icon">${icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-name">${p.name}</div>
        <div class="notif-item-meta">
          <span class="notif-item-sku">${p.sku}</span>
          <span class="notif-item-stock ${cls}">Còn ${p.stock} / ngưỡng ${p.threshold} (${pct}%)</span>
        </div>
        <div class="notif-progress-bar">
          <div class="notif-progress-fill ${cls}" style="width:${Math.min(pct,100)}%"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  if (products.length > 10) {
    list.innerHTML += `<div class="notif-more" onclick="showPage('alerts'); closeNotifPanel()">+${products.length - 10} sản phẩm khác — Xem tất cả</div>`;
  }
}

// Close notif panel when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

// ─────────────────────────────────────────────────────────────
//  ALERTS PAGE  (chi tiết cảnh báo tồn kho)
// ─────────────────────────────────────────────────────────────
let _alertFilter = 'all';

async function renderAlerts() {
  try {
    const products = await loadAlertData();

    const out      = products.filter(p => p.stock === 0);
    const critical = products.filter(p => p.stock > 0 && p.stock < p.threshold * 0.5);
    const low      = products.filter(p => p.stock >= p.threshold * 0.5 && p.stock <= p.threshold);
    const ok       = products.filter(p => p.stock > p.threshold);

    document.getElementById('ac-out').textContent      = out.length;
    document.getElementById('ac-critical').textContent = critical.length;
    document.getElementById('ac-low').textContent      = low.length;
    document.getElementById('ac-ok').textContent       = ok.length;

    renderAlertsTable(_alertFilter, products);
  } catch (e) {
    showToast('Lỗi tải cảnh báo: ' + e.message, 'error');
  }
}

function filterAlerts(filter, btn) {
  _alertFilter = filter;
  document.querySelectorAll('#alert-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAlertsTable(filter, _alertsCache);
}

function renderAlertsTable(filter, products) {
  const tbody = document.getElementById('alerts-body');
  if (!tbody) return;

  let list = products;
  if (filter === 'out')      list = products.filter(p => p.stock === 0);
  else if (filter === 'critical') list = products.filter(p => p.stock > 0 && p.stock < p.threshold * 0.5);
  else if (filter === 'low') list = products.filter(p => p.stock >= p.threshold * 0.5 && p.stock <= p.threshold);
  else if (filter === 'ok')  list = products.filter(p => p.stock > p.threshold);

  // Sort: out → critical → low → ok
  list = [...list].sort((a, b) => {
    const rank = p => p.stock === 0 ? 0 : p.stock < p.threshold * 0.5 ? 1 : p.stock <= p.threshold ? 2 : 3;
    return rank(a) - rank(b);
  });

  if (list.length === 0) {
    tbody.innerHTML = renderTableEmpty(9, '✅ Không có sản phẩm nào trong mức này');
    return;
  }

  tbody.innerHTML = list.map(p => {
    const cls  = p.stock === 0 ? 'out' : p.stock < p.threshold * 0.5 ? 'critical' : p.stock <= p.threshold ? 'low' : 'ok';
    const icon = p.stock === 0 ? '🚫' : p.stock < p.threshold * 0.5 ? '⚠️' : p.stock <= p.threshold ? '🔶' : '✅';
    const lbl  = p.stock === 0 ? 'Hết hàng' : p.stock < p.threshold * 0.5 ? 'Nguy hiểm' : p.stock <= p.threshold ? 'Sắp hết' : 'Bình thường';
    const pct  = p.threshold > 0 ? Math.round((p.stock / p.threshold) * 100) : 100;
    const barW = Math.min(pct, 100);
    return `<tr class="alert-row-${cls}">
      <td>
        <span class="alert-level-badge ${cls}">${icon} ${lbl}</span>
      </td>
      <td class="td-mono" style="color:var(--primary);font-size:12px">${p.sku}</td>
      <td>
        <strong>${p.name}</strong>
        ${p.parentSku ? `<br><small style="color:var(--text-muted)">Thuộc: ${p.parentSku}</small>` : ''}
      </td>
      <td><span class="badge badge-blue">${p.category}</span></td>
      <td class="td-mono"><strong style="color:${p.stock===0?'var(--danger)':p.stock<=p.threshold?'var(--warning)':'inherit'}">${p.stock}</strong></td>
      <td class="td-mono">${p.threshold}</td>
      <td>
        <div class="alert-bar-wrap">
          <div class="alert-bar-track">
            <div class="alert-bar-fill ${cls}" style="width:${barW}%"></div>
          </div>
          <span class="alert-bar-pct ${cls}">${pct}%</span>
        </div>
      </td>
      <td>
        <span class="badge ${p.stock===0?'badge-danger':p.stock<=p.threshold?'badge-warning':'badge-success'}">
          ${p.stock===0?'Hết hàng':p.stock<=p.threshold?'Sắp hết':'Còn hàng'}
        </span>
      </td>
      <td class="td-actions">
        ${isAdmin() ? `<button class="btn-sm btn-edit" onclick="editProduct(${p.id})">Nhập hàng</button>` : '—'}
      </td>
    </tr>`;
  }).join('');
}

//  INVENTORY PAGE
// ─────────────────────────────────────────────────────────────
async function renderInventory(list) {
  try {
    if (!list) {
      const data = await GET('/products');
      list = data.products || [];
    }
    // Fetch latest transaction time per product
    const txData = await GET('/transactions?type=all');
    const txAll  = txData.transactions || [];

    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = list.map(p => {
      const lastTx = txAll.filter(t => t.productId === p.id)
                         .sort((a, b) => new Date(b.time) - new Date(a.time))[0];
      return `<tr>
        <td class="td-mono">${p.sku}</td>
        <td><strong>${p.name}</strong></td>
        <td class="td-mono"><strong style="font-size:16px">${p.stock}</strong></td>
        <td class="td-mono">${p.threshold}</td>
        <td>${stockBarHTML(p.stock, p.threshold)}</td>
        <td style="color:var(--text-muted);font-size:12px">${lastTx ? fmtDate(lastTx.time) : 'Chưa có'}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    showToast('Lỗi tải tồn kho: ' + e.message, 'error');
  }
}

async function filterInventory() {
  const q = document.getElementById('inventory-search').value.trim();
  if (!q) return renderInventory();
  const data = await GET(`/products?q=${encodeURIComponent(q)}`);
  renderInventory(data.products || []);
}

// ─────────────────────────────────────────────────────────────
//  TRANSACTIONS PAGE
// ─────────────────────────────────────────────────────────────
let txFilter = 'all';

async function renderTransactions() {
  try {
    const data = await GET(`/transactions?type=${txFilter}`);
    const list = (data.transactions || []).slice().sort((a, b) => new Date(b.time) - new Date(a.time));
    const tbody = document.getElementById('transactions-body');

    tbody.innerHTML = list.map(tx => `<tr>
      <td class="td-mono">${padId(tx.id)}</td>
      <td><strong>${tx.productName || `Sản phẩm #${tx.productId}`}</strong></td>
      <td><span class="badge badge-${tx.type === 'import' ? 'import' : 'export'}">${tx.type === 'import' ? '▲ Nhập kho' : '▼ Xuất kho'}</span></td>
      <td class="td-mono"><strong>${tx.qty}</strong></td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tx.note || '—'}</td>
      <td><span class="badge badge-gray">${tx.user}</span></td>
      <td style="color:var(--text-muted);font-size:12px">${fmtDate(tx.time)}</td>
      <td><span class="badge badge-success">✓ Hoàn thành</span></td>
    </tr>`).join('') || renderTableEmpty(8, 'Không có giao dịch');
  } catch (e) {
    showToast('Lỗi tải giao dịch: ' + e.message, 'error');
  }
}

function filterTx(type, btn) {
  txFilter = type;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransactions();
}

async function openTxModal(type) {
  document.getElementById('tx-type').value            = type;
  document.getElementById('tx-modal-title').textContent = type === 'import' ? '▲ Nhập kho' : '▼ Xuất kho';
  document.getElementById('tx-qty').value             = '';
  document.getElementById('tx-note').value            = '';
  document.getElementById('tx-stock-info').textContent = '';

  try {
    const data = await GET('/products');
    const sel  = document.getElementById('tx-product');
    sel.innerHTML = (data.products || []).map(p =>
      `<option value="${p.id}" data-stock="${p.stock}">${p.sku} — ${p.name} (Tồn: ${p.stock})</option>`
    ).join('');
    updateTxInfo();
  } catch (e) {
    showToast('Không thể tải danh sách sản phẩm', 'error');
    return;
  }
  document.getElementById('tx-modal').classList.remove('hidden');
}

function updateTxInfo() {
  const sel   = document.getElementById('tx-product');
  const qty   = parseInt(document.getElementById('tx-qty').value) || 0;
  const type  = document.getElementById('tx-type').value;
  const opt   = sel.options[sel.selectedIndex];
  const stock = opt ? parseInt(opt.dataset.stock) : 0;
  const info  = document.getElementById('tx-stock-info');

  if (!opt) { info.textContent = ''; return; }

  if (type === 'export' && qty > stock) {
    info.className   = 'info-box danger';
    info.textContent = `⚠ Số lượng xuất (${qty}) vượt quá tồn kho (${stock})`;
  } else {
    info.className   = 'info-box';
    const after      = type === 'import' ? stock + qty : stock - qty;
    info.textContent = qty
      ? `Tồn kho hiện tại: ${stock} → Sau giao dịch: ${after}`
      : `Tồn kho hiện tại: ${stock}`;
  }
}

async function saveTransaction() {
  const productId = parseInt(document.getElementById('tx-product').value);
  const qty       = parseInt(document.getElementById('tx-qty').value);
  const type      = document.getElementById('tx-type').value;
  const note      = document.getElementById('tx-note').value.trim();

  try {
    const result = await POST('/transactions', { productId, type, qty, note });
    closeModal('tx-modal');
    renderTransactions();
    const pName = result.product ? result.product.name : `#${productId}`;
    showToast(`${type === 'import' ? 'Nhập kho' : 'Xuất kho'} thành công: ${qty} × ${pName}`);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
//  REPORTS PAGE (admin only)
// ─────────────────────────────────────────────────────────────
async function renderReports() {
  try {
    const data = await GET('/reports/full');

    const s = data.summary || {};
    document.getElementById('report-total-value').textContent  = fmtCurrency(s.totalValue  || 0);
    document.getElementById('report-total-tx').textContent     = s.totalTx     || 0;
    document.getElementById('report-import-count').textContent = s.importCount || 0;
    document.getElementById('report-export-count').textContent = s.exportCount || 0;

    // Bar chart
    const top5     = data.topStock || [];
    const maxStock = top5[0]?.stock || 1;
    document.getElementById('top-stock-chart').innerHTML = top5.map(p => `
      <div class="bar-item">
        <div class="bar-label" title="${p.name}">${p.name}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round(p.stock / maxStock * 100)}%">
            <span>${p.stock}</span>
          </div>
        </div>
        <div class="bar-count">${p.stock}</div>
      </div>`).join('');

    // Category breakdown
    document.getElementById('category-report').innerHTML =
      (data.categoryBreakdown || []).map(([cat, cnt]) => `
        <div class="category-item">
          <div class="cat-name">${cat}</div>
          <div class="cat-count">${cnt}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">đơn vị giao dịch</div>
        </div>`).join('');
  } catch (e) {
    showToast('Lỗi tải báo cáo: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
//  USERS PAGE (admin only)
// ─────────────────────────────────────────────────────────────
async function renderUsers() {
  try {
    const data  = await GET('/auth/users');
    const tbody = document.getElementById('users-body');
    const me    = getUser().username;

    tbody.innerHTML = (data.users || []).map(u => `
      <tr>
        <td class="td-mono">#${u.id}</td>
        <td><strong>${u.username}</strong></td>
        <td>${u.fullname}</td>
        <td><span class="badge badge-${u.role === 'admin' ? 'admin' : 'staff'}">${u.role === 'admin' ? '👑 Admin' : '👤 Staff'}</span></td>
        <td><span class="badge badge-${u.status === 'active' ? 'success' : 'gray'}">${u.status === 'active' ? 'Hoạt động' : 'Vô hiệu'}</span></td>
        <td style="color:var(--text-muted)">${u.createdAt || ''}</td>
        <td class="td-actions">
          <button class="btn-sm btn-toggle" onclick="toggleUser(${u.id})">${u.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}</button>
          ${u.username !== me
            ? `<button class="btn-sm btn-delete" onclick="deleteUser(${u.id})">Xóa</button>`
            : ''}
        </td>
      </tr>`).join('');
  } catch (e) {
    showToast('Lỗi tải người dùng: ' + e.message, 'error');
  }
}

function openUserModal() {
  ['user-id','user-username','user-password','user-fullname'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('user-role').value = 'staff';
  document.getElementById('user-modal').classList.remove('hidden');
}

async function saveUser() {
  const body = {
    username: document.getElementById('user-username').value.trim(),
    password: document.getElementById('user-password').value,
    fullname: document.getElementById('user-fullname').value.trim(),
    role:     document.getElementById('user-role').value,
  };
  try {
    await POST('/auth/users', body);
    closeModal('user-modal');
    renderUsers();
    showToast(`Tạo tài khoản "${body.username}" thành công`);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function toggleUser(id) {
  try {
    const data = await PATCH(`/auth/users/${id}/toggle`);
    renderUsers();
    const u = data.user;
    showToast(`Đã ${u.status === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} tài khoản ${u.username}`);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
  try {
    await DELETE(`/auth/users/${id}`);
    renderUsers();
    showToast('Đã xóa tài khoản', 'info');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
//  HISTORY PAGE (admin only)
// ─────────────────────────────────────────────────────────────
async function renderHistory() {
  try {
    const data  = await GET('/transactions/audit?limit=50');
    const log   = data.log || [];
    const actionColors = {
      LOGIN: 'badge-blue', LOGOUT: 'badge-gray',
      IMPORT: 'badge-import', EXPORT: 'badge-export',
      CREATE: 'badge-cyan', UPDATE: 'badge-warning', DELETE: 'badge-danger',
      CREATE_USER: 'badge-blue', UPDATE_USER: 'badge-warning', DELETE_USER: 'badge-danger',
    };
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = log.map(a => `
      <tr>
        <td style="font-size:12px;color:var(--text-muted)">${fmtDate(a.time)}</td>
        <td><span class="badge badge-gray">${a.user}</span></td>
        <td><span class="badge ${actionColors[a.action] || 'badge-gray'}">${a.action}</span></td>
        <td><strong>${a.target}</strong></td>
        <td style="color:var(--text-secondary)">${a.detail}</td>
        <td class="td-mono">${a.ip}</td>
      </tr>`).join('') || renderTableEmpty(6, 'Chưa có lịch sử');
  } catch (e) {
    showToast('Lỗi tải lịch sử: ' + e.message, 'error');
  }
}

// -------------------------------------------------------------
//  INIT -- auto-restore session on page load / reload
//  FIX: kiem tra token con hieu luc voi server truoc khi bootApp()
//       Neu token het han -> xoa session, hien thi man hinh dang nhap
// -------------------------------------------------------------
(async function init() {
  if (_token && _user) {
    try {
      const res = await fetch(API + '/products?_check=1', {
        headers: { 'Authorization': 'Bearer ' + _token }
      });
      if (res.status === 401) {
        clearSession();
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('app').classList.add('hidden');
      } else {
        bootApp();
      }
    } catch (_) {
      bootApp();
    }
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app').classList.add('hidden');
  }
})();