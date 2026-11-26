// js/webapp-shell.js
// Enjin UI Auth, Kawalan Akses, Navigasi & Dashboard Live (Non-Destructive)
import {
  ACCOUNT_STATUS,
  registerUser,
  loginUser,
  logoutUser,
  resetUserPassword,
  updateBuyerProfile,
  getFreshIdToken,
  watchAuthAndProfile,
  formatAuthError
} from './auth-service.js';
import {
  watchUserDashboard,
  formatDateMY,
  saveUserProject,
  deleteUserProject,
  saveUserProduct,
  deleteUserProduct,
  submitPaymentProof
} from './data-service.js';

const state = {
  configured: true,
  loading: true,
  authUser: null,
  profile: null,
  authTab: 'login', // 'login' | 'register' | 'reset'
  activeView: 'studio', // 'studio' | 'dashboard' | 'profile'
  alert: null, // { type: 'error' | 'success', message: string }
  busy: false,
  dashboard: {
    projects: [],
    products: [],
    payments: [],
    activities: []
  }
};

let unsubDashboard = null;
let rootEl = null;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStatusBadge(status) {
  switch (status) {
    case ACCOUNT_STATUS.ACTIVE:
      return '<span class="ga-badge ga-badge-active">● AKTIF</span>';
    case ACCOUNT_STATUS.PENDING_APPROVAL:
      return '<span class="ga-badge ga-badge-pending">● MENUNGGU PENGESAHAN</span>';
    case ACCOUNT_STATUS.PENDING_PAYMENT:
      return '<span class="ga-badge ga-badge-pending">● BELUM BAYAR</span>';
    case ACCOUNT_STATUS.SUSPENDED:
      return '<span class="ga-badge ga-badge-danger">● DIGANTUNG</span>';
    case ACCOUNT_STATUS.REJECTED:
      return '<span class="ga-badge ga-badge-danger">● DITOLAK</span>';
    default:
      return `<span class="ga-badge ga-badge-pending">${esc(status || 'MENUNGGU')}</span>`;
  }
}

function ensureRoot() {
  if (rootEl) return rootEl;
  rootEl = document.getElementById('ga-shell-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'ga-shell-root';
    document.body.appendChild(rootEl);
  }
  return rootEl;
}

function setAlert(type, message) {
  state.alert = message ? { type, message } : null;
  render();
}

function renderAlert() {
  if (!state.alert) return '';
  const cls = state.alert.type === 'success' ? 'ga-alert-success' : 'ga-alert-error';
  return `<div class="ga-alert ${cls}">${esc(state.alert.message)}</div>`;
}

function renderLoading() {
  return `
    <div class="ga-overlay">
      <div class="ga-card" style="text-align:center; padding: 34px 20px;">
        <div class="ga-spinner"></div>
        <div style="font-weight:700; font-size:15px; color:#fff;">Genesis AI V2.0</div>
        <div style="font-size:12.5px; color:var(--ga-muted); margin-top:4px;">Menyemak sesi akaun anda...</div>
      </div>
    </div>
  `;
}

function renderUnconfigured() {
  return `
    <div class="ga-overlay">
      <div class="ga-card">
        <div class="ga-brand">
          <div class="ga-logo-badge">G</div>
          <div>
            <h1>Genesis AI V2.0</h1>
            <p>Konfigurasi Diperlukan</p>
          </div>
        </div>
        <div class="ga-alert ga-alert-error">
          Konfigurasi Firebase belum lengkap di dalam <code>js/firebase-config.js</code>. Sila semak semula fail konfigurasi anda.
        </div>
      </div>
    </div>
  `;
}

function renderAuthOverlay() {
  const isLogin = state.authTab === 'login';
  const isRegister = state.authTab === 'register';
  const isReset = state.authTab === 'reset';

  return `
    <div class="ga-overlay">
      <div class="ga-card">
        <div class="ga-brand">
          <div class="ga-logo-badge">G</div>
          <div>
            <h1>Genesis AI V2.0</h1>
            <p>Akses Portal Rasmi WebApp</p>
          </div>
        </div>

        ${!isReset ? `
          <div class="ga-tabs">
            <button type="button" class="ga-tab-btn ${isLogin ? 'active' : ''}" data-ga-action="auth-tab" data-tab="login">Log Masuk</button>
            <button type="button" class="ga-tab-btn ${isRegister ? 'active' : ''}" data-ga-action="auth-tab" data-tab="register">Daftar Akaun</button>
          </div>
        ` : ''}

        ${renderAlert()}

        ${isLogin ? `
          <form id="ga-login-form">
            <div class="ga-field">
              <label for="ga-login-email">Alamat Emel</label>
              <input id="ga-login-email" class="ga-input" type="email" name="email" placeholder="nama@emel.com" required autocomplete="email" />
            </div>
            <div class="ga-field">
              <label for="ga-login-pass">Kata Laluan</label>
              <input id="ga-login-pass" class="ga-input" type="password" name="password" placeholder="Masukkan kata laluan" required autocomplete="current-password" />
            </div>
            <div style="text-align:right; margin-bottom:14px;">
              <button type="button" class="ga-link-btn" data-ga-action="auth-tab" data-tab="reset">Lupa kata laluan?</button>
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Memproses...' : 'Log Masuk Sekarang'}
            </button>
          </form>
        ` : ''}

        ${isRegister ? `
          <form id="ga-register-form">
            <div class="ga-field">
              <label for="ga-reg-name">Nama Penuh</label>
              <input id="ga-reg-name" class="ga-input" type="text" name="fullName" placeholder="Contoh: Aiman Hakim" required autocomplete="name" />
            </div>
            <div class="ga-field">
              <label for="ga-reg-email">Alamat Emel</label>
              <input id="ga-reg-email" class="ga-input" type="email" name="email" placeholder="nama@emel.com" required autocomplete="email" />
            </div>
            <div class="ga-field">
              <label for="ga-reg-phone">No. WhatsApp / Telefon</label>
              <input id="ga-reg-phone" class="ga-input" type="tel" name="phone" placeholder="01X-XXXXXXX" autocomplete="tel" />
            </div>
            <div class="ga-field">
              <label for="ga-reg-pass">Kata Laluan (min. 6 aksara)</label>
              <input id="ga-reg-pass" class="ga-input" type="password" name="password" placeholder="Cipta kata laluan" minlength="6" required autocomplete="new-password" />
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Mendaftar...' : 'Daftar Akaun Baharu'}
            </button>
          </form>
        ` : ''}

        ${isReset ? `
          <form id="ga-reset-form">
            <div style="font-size:13px; color:var(--ga-muted); margin-bottom:14px; line-height:1.5;">
              Masukkan emel berdaftar anda. Pautan tetapan semula kata laluan akan dihantar ke peti masuk emel anda.
            </div>
            <div class="ga-field">
              <label for="ga-reset-email">Alamat Emel</label>
              <input id="ga-reset-email" class="ga-input" type="email" name="email" placeholder="nama@emel.com" required autocomplete="email" />
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Menghantar...' : 'Hantar Pautan Reset'}
            </button>
            <div style="text-align:center; margin-top:12px;">
              <button type="button" class="ga-link-btn" data-ga-action="auth-tab" data-tab="login">← Kembali ke Log Masuk</button>
            </div>
          </form>
        ` : ''}
      </div>
    </div>
  `;
}

function renderGatekeeperOverlay() {
  const p = state.profile || {};
  const status = p.accountStatus || ACCOUNT_STATUS.PENDING_PAYMENT;
  const canSubmitProof =
    status === ACCOUNT_STATUS.PENDING_PAYMENT || status === ACCOUNT_STATUS.PENDING_APPROVAL;
  const latestPayment = state.dashboard.payments[0];

  let statusMsg = 'Akaun anda perlu diaktifkan sebelum menggunakan Genesis V2.';
  if (status === ACCOUNT_STATUS.PENDING_PAYMENT) {
    statusMsg = 'Akaun berjaya didaftarkan. Lengkapkan pembayaran dan hantar nombor rujukan transaksi di bawah untuk pengaktifan.';
  } else if (status === ACCOUNT_STATUS.PENDING_APPROVAL) {
    statusMsg = 'Rekod anda sedang menunggu semakan Admin. Sebaik sahaja disahkan, akses Genesis V2 akan terbuka secara automatik.';
  } else if (status === ACCOUNT_STATUS.SUSPENDED) {
    statusMsg = 'Akaun anda telah digantung buat sementara waktu. Sila hubungi pihak pentadbir untuk bantuan.';
  } else if (status === ACCOUNT_STATUS.REJECTED) {
    statusMsg = 'Permohonan pengaktifan akaun tidak diluluskan. Sila hubungi pihak pentadbir untuk semakan semula.';
  }

  return `
    <div class="ga-overlay">
      <div class="ga-card">
        <div class="ga-brand">
          <div class="ga-logo-badge">G</div>
          <div>
            <h1>Pengaktifan Akaun</h1>
            <p>${esc(p.email || state.authUser?.email || '')}</p>
          </div>
        </div>

        <div style="margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span style="font-size:12.5px; color:var(--ga-muted);">Status Akaun:</span>
          ${getStatusBadge(status)}
        </div>

        <div style="font-size:13px; color:#cbd5e1; line-height:1.5; background:rgba(6,10,20,0.55); border:1px solid var(--ga-border-soft); border-radius:12px; padding:12px; margin-bottom:14px;">
          ${esc(statusMsg)}
        </div>

        ${renderAlert()}

        ${latestPayment ? `
          <div style="font-size:12px; color:#a7f3d0; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:10px; padding:10px; margin-bottom:14px;">
            <strong>Rekod Bayaran Terkini:</strong> ${esc(latestPayment.plan)} — RM${esc(latestPayment.amount)}<br/>
            Rujukan: <code>${esc(latestPayment.reference)}</code> (${esc(latestPayment.status)})
          </div>
        ` : ''}

        ${canSubmitProof ? `
          <form id="ga-payment-form" style="margin-bottom:14px;">
            <div class="ga-field">
              <label for="ga-pay-plan">Pilih Pelan Akses</label>
              <select id="ga-pay-plan" class="ga-input" name="plan">
                <option value="PRO_MONTHLY">Pro Bulanan (RM49)</option>
                <option value="PRO_LIFETIME" selected>Pro Lifetime (RM149)</option>
              </select>
            </div>
            <div class="ga-field">
              <label for="ga-pay-ref">Nombor Rujukan Resit / FPX / DuitNow</label>
              <input id="ga-pay-ref" class="ga-input" type="text" name="reference" placeholder="Contoh: DN20261125XXXX" required />
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Menghantar...' : 'Hantar Bukti Pembayaran'}
            </button>
          </form>
        ` : ''}

        <button type="button" class="ga-btn ga-btn-danger" data-ga-action="logout" ${state.busy ? 'disabled' : ''}>
          Log Keluar
        </button>
      </div>
    </div>
  `;
}

function renderDashboardDrawer() {
  const p = state.profile || {};
  const { projects, products, payments, activities } = state.dashboard;

  return `
    <div class="ga-drawer">
      <div class="ga-container">
        <div class="ga-section-head">
          <div>
            <h2>Dashboard Akaun</h2>
            <div style="font-size:12.5px; color:var(--ga-muted); margin-top:2px;">
              Selamat datang, ${esc(p.fullName || p.email || 'Pengguna')}
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${p.role === 'admin' ? '<span class="ga-badge ga-badge-admin">ADMIN</span>' : ''}
            ${getStatusBadge(p.accountStatus)}
          </div>
        </div>

        ${renderAlert()}

        <div class="ga-stats-grid">
          <div class="ga-stat-card">
            <div class="ga-stat-label">Projek Disimpan</div>
            <div class="ga-stat-value">${projects.length}</div>
          </div>
          <div class="ga-stat-card">
            <div class="ga-stat-label">Produk Disimpan</div>
            <div class="ga-stat-value">${products.length}</div>
          </div>
          <div class="ga-stat-card">
            <div class="ga-stat-label">Pelan Semasa</div>
            <div class="ga-stat-value" style="font-size:15px; color:var(--ga-cyan);">${esc(p.plan || 'STANDARD')}</div>
          </div>
          <div class="ga-stat-card">
            <div class="ga-stat-label">Log Aktiviti</div>
            <div class="ga-stat-value">${activities.length}</div>
          </div>
        </div>

        <div class="ga-panel">
          <h3>+ Simpan Produk Pantas (Product Lock)</h3>
          <form id="ga-quick-product-form">
            <div class="ga-field">
              <label for="ga-prod-name">Nama Produk</label>
              <input id="ga-prod-name" class="ga-input" type="text" name="name" placeholder="Contoh: Serum Glowing Vitamin C" required />
            </div>
            <div class="ga-field">
              <label for="ga-prod-usp">Kelebihan Utama (USP) / Nota Ringkas</label>
              <input id="ga-prod-usp" class="ga-input" type="text" name="usp" placeholder="Contoh: Cepat meresap, lulus KKM, sesuai kulit sensitif" />
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Menyimpan...' : 'Simpan Produk ke Cloud'}
            </button>
          </form>
        </div>

        <div class="ga-panel">
          <h3>Senarai Produk Disimpan (${products.length})</h3>
          ${products.length === 0
            ? '<div class="ga-empty">Belum ada produk disimpan. Tambah produk di atas untuk rujukan pantas.</div>'
            : products.map((item) => `
              <div class="ga-list-item">
                <div>
                  <div class="ga-list-title">${esc(item.name)}</div>
                  <div class="ga-list-sub">${esc(item.usp || 'Tiada nota USP')} • ${esc(formatDateMY(item.createdAt))}</div>
                </div>
                <button type="button" class="ga-btn ga-btn-danger" style="width:auto; padding:6px 10px; font-size:12px;" data-ga-action="delete-product" data-id="${esc(item.id)}">Padam</button>
              </div>
            `).join('')
          }
        </div>

        <div class="ga-panel">
          <h3>+ Simpan Nota Projek / Kempen</h3>
          <form id="ga-quick-project-form">
            <div class="ga-field">
              <label for="ga-proj-title">Tajuk Projek</label>
              <input id="ga-proj-title" class="ga-input" type="text" name="title" placeholder="Contoh: Kempen TikTok Raya 2026" required />
            </div>
            <div class="ga-field">
              <label for="ga-proj-summary">Ringkasan / Hook / Nota</label>
              <input id="ga-proj-summary" class="ga-input" type="text" name="summary" placeholder="Contoh: Fokus UGC 3 saat pertama + CTA beg kuning" />
            </div>
            <button type="submit" class="ga-btn ga-btn-secondary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Menyimpan...' : 'Simpan Projek'}
            </button>
          </form>
        </div>

        <div class="ga-panel">
          <h3>Projek Terkini (${projects.length})</h3>
          ${projects.length === 0
            ? '<div class="ga-empty">Belum ada projek disimpan lagi.</div>'
            : projects.map((item) => `
              <div class="ga-list-item">
                <div>
                  <div class="ga-list-title">${esc(item.title)}</div>
                  <div class="ga-list-sub">${esc(item.summary || item.category || 'Genesis V2')} • ${esc(formatDateMY(item.createdAt))}</div>
                </div>
                <button type="button" class="ga-btn ga-btn-danger" style="width:auto; padding:6px 10px; font-size:12px;" data-ga-action="delete-project" data-id="${esc(item.id)}">Padam</button>
              </div>
            `).join('')
          }
        </div>

        <div class="ga-panel">
          <h3>Rekod Bayaran & Aktiviti Terkini</h3>
          ${payments.length > 0 ? payments.map((pay) => `
            <div class="ga-list-item">
              <div>
                <div class="ga-list-title">Bayaran ${esc(pay.plan)} — RM${esc(pay.amount)}</div>
                <div class="ga-list-sub">Rujukan: ${esc(pay.reference)} • ${esc(formatDateMY(pay.createdAt))}</div>
              </div>
              <span class="ga-badge ${pay.status === 'PAID' ? 'ga-badge-active' : 'ga-badge-pending'}">${esc(pay.status)}</span>
            </div>
          `).join('') : ''}
          ${activities.slice(0, 6).map((act) => `
            <div class="ga-list-item">
              <div>
                <div class="ga-list-title">${esc(act.action)}</div>
                <div class="ga-list-sub">${esc(formatDateMY(act.timestamp))}</div>
              </div>
            </div>
          `).join('') || '<div class="ga-empty">Tiada aktiviti direkodkan lagi.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderProfileDrawer() {
  const p = state.profile || {};
  return `
    <div class="ga-drawer">
      <div class="ga-container" style="max-width:560px;">
        <div class="ga-section-head">
          <h2>Profil & Tetapan Akaun</h2>
          ${getStatusBadge(p.accountStatus)}
        </div>

        ${renderAlert()}

        <div class="ga-panel">
          <h3>Maklumat Pengguna</h3>
          <form id="ga-profile-form">
            <div class="ga-field">
              <label>Emel Berdaftar</label>
              <input class="ga-input" type="email" value="${esc(p.email || state.authUser?.email || '')}" disabled style="opacity:0.7;" />
            </div>
            <div class="ga-field">
              <label for="ga-prof-name">Nama Penuh</label>
              <input id="ga-prof-name" class="ga-input" type="text" name="fullName" value="${esc(p.fullName || '')}" required />
            </div>
            <div class="ga-field">
              <label for="ga-prof-phone">No. WhatsApp / Telefon</label>
              <input id="ga-prof-phone" class="ga-input" type="tel" name="phone" value="${esc(p.phone || '')}" placeholder="01X-XXXXXXX" />
            </div>
            <button type="submit" class="ga-btn ga-btn-primary" ${state.busy ? 'disabled' : ''}>
              ${state.busy ? 'Menyimpan...' : 'Kemas Kini Profil'}
            </button>
          </form>
        </div>

        <div class="ga-panel">
          <h3>Status Langganan</h3>
          <div class="ga-list-item">
            <div class="ga-list-title">Peranan Akaun</div>
            <div class="ga-list-sub" style="text-transform:uppercase; color:var(--ga-cyan); font-weight:700;">${esc(p.role || 'buyer')}</div>
          </div>
          <div class="ga-list-item">
            <div class="ga-list-title">Pelan Aktif</div>
            <div class="ga-list-sub">${esc(p.plan || 'STANDARD')}</div>
          </div>
          <div class="ga-list-item">
            <div class="ga-list-title">Log Masuk Terakhir</div>
            <div class="ga-list-sub">${esc(formatDateMY(p.lastLogin))}</div>
          </div>
        </div>

        <button type="button" class="ga-btn ga-btn-danger" data-ga-action="logout" ${state.busy ? 'disabled' : ''}>
          Log Keluar daripada Peranti Ini
        </button>
      </div>
    </div>
  `;
}

function renderActiveShell() {
  const p = state.profile || {};
  const displayName = p.fullName || p.email || 'Akaun';
  const view = state.activeView;

  return `
    <header class="ga-topbar">
      <div class="ga-topbar-left">
        <div class="ga-topbar-logo">G</div>
        <div class="ga-topbar-title">Genesis V2</div>
      </div>

      <nav class="ga-topbar-nav">
        <button type="button" class="ga-nav-pill ${view === 'studio' ? 'active' : ''}" data-ga-action="switch-view" data-view="studio">✨ Genesis V2</button>
        <button type="button" class="ga-nav-pill ${view === 'dashboard' ? 'active' : ''}" data-ga-action="switch-view" data-view="dashboard">📊 Dashboard</button>
        <button type="button" class="ga-nav-pill ${view === 'profile' ? 'active' : ''}" data-ga-action="switch-view" data-view="profile">👤 Profil</button>
      </nav>

      <div class="ga-topbar-right">
        <span class="ga-user-chip" title="${esc(displayName)}">${esc(displayName)}</span>
        <button type="button" class="ga-nav-pill" style="padding:6px 10px; color:#fda4af;" data-ga-action="logout">Keluar</button>
      </div>
    </header>

    ${view === 'dashboard' ? renderDashboardDrawer() : ''}
    ${view === 'profile' ? renderProfileDrawer() : ''}

    <nav class="ga-bottomnav">
      <button type="button" class="ga-bnav-btn ${view === 'studio' ? 'active' : ''}" data-ga-action="switch-view" data-view="studio">
        <span class="ga-bnav-icon">✨</span>
        <span>Genesis V2</span>
      </button>
      <button type="button" class="ga-bnav-btn ${view === 'dashboard' ? 'active' : ''}" data-ga-action="switch-view" data-view="dashboard">
        <span class="ga-bnav-icon">📊</span>
        <span>Dashboard</span>
      </button>
      <button type="button" class="ga-bnav-btn ${view === 'profile' ? 'active' : ''}" data-ga-action="switch-view" data-view="profile">
        <span class="ga-bnav-icon">👤</span>
        <span>Profil</span>
      </button>
    </nav>
  `;
}

function render() {
  const root = ensureRoot();

  if (!state.configured) {
    document.body.classList.add('ga-locked');
    document.body.classList.remove('ga-shell-active');
    root.innerHTML = renderUnconfigured();
    return;
  }

  if (state.loading) {
    document.body.classList.add('ga-locked');
    document.body.classList.remove('ga-shell-active');
    root.innerHTML = renderLoading();
    return;
  }

  if (!state.authUser) {
    document.body.classList.add('ga-locked');
    document.body.classList.remove('ga-shell-active');
    root.innerHTML = renderAuthOverlay();
    return;
  }

  const isActive = state.profile?.accountStatus === ACCOUNT_STATUS.ACTIVE;
  if (!isActive) {
    document.body.classList.add('ga-locked');
    document.body.classList.remove('ga-shell-active');
    root.innerHTML = renderGatekeeperOverlay();
    return;
  }

  // Akaun AKTIF: Buka akses penuh ke Genesis V2 + Bar Navigasi
  document.body.classList.add('ga-shell-active');
  if (state.activeView === 'studio') {
    document.body.classList.remove('ga-locked');
  } else {
    document.body.classList.add('ga-locked');
  }
  root.innerHTML = renderActiveShell();
}

function bindEvents() {
  const root = ensureRoot();

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ga-action]');
    if (!btn) return;
    const action = btn.dataset.gaAction;

    if (action === 'auth-tab') {
      state.authTab = btn.dataset.tab || 'login';
      state.alert = null;
      render();
      return;
    }

    if (action === 'switch-view') {
      state.activeView = btn.dataset.view || 'studio';
      state.alert = null;
      render();
      return;
    }

    if (action === 'logout') {
      state.busy = true;
      render();
      try {
        await logoutUser();
        state.activeView = 'studio';
        state.alert = null;
      } catch (err) {
        setAlert('error', formatAuthError(err));
      } finally {
        state.busy = false;
        render();
      }
      return;
    }

    if (action === 'delete-product' && state.authUser) {
      const id = btn.dataset.id;
      if (!id) return;
      try {
        await deleteUserProduct(state.authUser.uid, id);
      } catch (err) {
        setAlert('error', err.message || 'Gagal memadam produk.');
      }
      return;
    }

    if (action === 'delete-project' && state.authUser) {
      const id = btn.dataset.id;
      if (!id) return;
      try {
        await deleteUserProject(state.authUser.uid, id);
      } catch (err) {
        setAlert('error', err.message || 'Gagal memadam projek.');
      }
    }
  });

  root.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form || !form.id?.startsWith('ga-')) return;
    e.preventDefault();
    const fd = new FormData(form);

    state.busy = true;
    state.alert = null;
    render();

    try {
      if (form.id === 'ga-login-form') {
        await loginUser(fd.get('email'), fd.get('password'));
      } else if (form.id === 'ga-register-form') {
        await registerUser({
          fullName: fd.get('fullName'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          password: fd.get('password')
        });
      } else if (form.id === 'ga-reset-form') {
        await resetUserPassword(fd.get('email'));
        state.alert = {
          type: 'success',
          message: 'Pautan tetapan semula kata laluan telah dihantar ke emel anda.'
        };
      } else if (form.id === 'ga-payment-form' && state.authUser) {
        const plan = String(fd.get('plan') || 'PRO_LIFETIME');
        const amount = plan === 'PRO_MONTHLY' ? 49 : 149;
        await submitPaymentProof(state.authUser.uid, {
          plan,
          amount,
          reference: fd.get('reference'),
          email: state.profile?.email || state.authUser.email
        });
        state.alert = {
          type: 'success',
          message: 'Bukti pembayaran berjaya dihantar! Pihak Admin akan mengaktifkan akaun anda tidak lama lagi.'
        };
      } else if (form.id === 'ga-quick-product-form' && state.authUser) {
        await saveUserProduct(state.authUser.uid, {
          name: fd.get('name'),
          usp: fd.get('usp')
        });
        state.alert = { type: 'success', message: 'Produk berjaya disimpan ke Cloud.' };
      } else if (form.id === 'ga-quick-project-form' && state.authUser) {
        await saveUserProject(state.authUser.uid, {
          title: fd.get('title'),
          summary: fd.get('summary')
        });
        state.alert = { type: 'success', message: 'Projek berjaya disimpan.' };
      } else if (form.id === 'ga-profile-form' && state.authUser) {
        await updateBuyerProfile(state.authUser.uid, {
          fullName: fd.get('fullName'),
          phone: fd.get('phone')
        });
        state.alert = { type: 'success', message: 'Maklumat profil berjaya dikemas kini.' };
      }
    } catch (err) {
      state.alert = { type: 'error', message: formatAuthError(err) };
    } finally {
      state.busy = false;
      render();
    }
  });
}

function initWebAppShell() {
  ensureRoot();
  bindEvents();
  render();

  watchAuthAndProfile(({ configured, authUser, profile, loading, error }) => {
    state.configured = configured;
    state.loading = loading;
    state.authUser = authUser;
    state.profile = profile;

    if (error) {
      state.alert = { type: 'error', message: error };
    }

    if (unsubDashboard) {
      unsubDashboard();
      unsubDashboard = null;
    }

    if (authUser) {
      unsubDashboard = watchUserDashboard(authUser.uid, (data) => {
        state.dashboard = data;
        if (state.activeView === 'dashboard' || state.profile?.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
          render();
        }
      });
    } else {
      state.dashboard = { projects: [], products: [], payments: [], activities: [] };
    }

    render();
  });

  // Jambatan selamat untuk integrasi lanjut dengan Genesis V2
  window.GenesisWebApp = {
    getProfile: () => state.profile,
    getUser: () => state.authUser,
    getIdToken: getFreshIdToken,
    saveProject: (data) => state.authUser ? saveUserProject(state.authUser.uid, data) : Promise.reject(new Error('Belum log masuk')),
    saveProduct: (data) => state.authUser ? saveUserProduct(state.authUser.uid, data) : Promise.reject(new Error('Belum log masuk')),
    openDashboard: () => {
      state.activeView = 'dashboard';
      render();
    },
    openStudio: () => {
      state.activeView = 'studio';
      render();
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebAppShell);
} else {
  initWebAppShell();
}
