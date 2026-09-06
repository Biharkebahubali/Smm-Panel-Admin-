
    // ============================================================
    //  CORE CONFIGURATION
    // ============================================================
    const APP_VERSION = String(window.BIHARI_CONFIG?.panelVersion || '20.0');
    const API_BASE_URL = String(window.BIHARI_CONFIG?.apiUrl || '/api').trim().replace(/\/+$/,'');
    let API_KEY = '';
    let ADMIN_PASSWORD = '';
    const API_TIMEOUT_MS = 12000;
    const API_RETRY_COUNT = 1;
    const REQUEST_CACHE_MS = 2500;

    const STORAGE_KEY = 'bihari_smm_data';
    const ACTIVITY_KEY = 'bihari_smm_activity';
    const BROADCAST_KEY = 'bihari_smm_broadcast';
    const BACKUP_KEY = 'bihari_smm_backup_history';
    const SETTINGS_KEY = 'bihari_smm_settings';
    const BLACKLIST_KEY = 'bihari_blacklist';
    const WHITELIST_KEY = 'bihari_whitelist';
    const FAQ_KEY = 'bihari_faq';
    const CAMPAIGN_KEY = 'bihari_campaigns';

    const CURRENCY_RATES = { INR: 1, AED: 0.044, USD: 0.012 };
    const CURRENCY_SYMBOLS = { INR: '₹', AED: 'د.إ', USD: '$' };
    const CURRENCY_NAMES = { INR: 'INR', AED: 'AED', USD: 'USD' };

    let currentCurrency = 'INR';
    let qrImageData = null;
    let appData = { users: [], orders: [], payments: [], services: [], tickets: [], trash: [], apiLogs: [],
      referrals: [], messages: [], profits: [] };
    let activityLog = [],
      broadcastHistory = [],
      backupHistory = [];
    let blacklist = [],
      whitelist = [],
      faqs = [],
      campaigns = [];
    let theme = 'dark';
    let soundEnabled = localStorage.getItem('bihari_sound') !== '0';
    let audioCtx = null;
    let currentOrderFilter = 'all';
    let currentPaymentFilter = 'all';
    let botStatusBusy = false;
    let revenueChartInstance = null,
      userChartInstance = null;
    let monthlyRevenueChartInstance = null,
      orderStatusChartInstance = null;

    // ============================================================
    //  PERSISTENCE
    // ============================================================
    let __saveStateTimer = null;
    let __saveStateBusy = false;
    let __saveStateAgain = false;
    async function persistStateToServer() {
      if (localStorage.getItem('bihari_admin_session') !== '1') return;
      const payload = { appData, activityLog, broadcastHistory, backupHistory, blacklist, whitelist, faqs, campaigns };
      if (__saveStateBusy) { __saveStateAgain = true; return; }
      __saveStateBusy = true;
      try {
        await callApi('saveState', { state: JSON.stringify(payload) }, 'POST', { noCache: true, timeout: 8000 });
      } catch (_) { /* local cache remains available */ }
      finally {
        __saveStateBusy = false;
        if (__saveStateAgain) { __saveStateAgain = false; persistStateToServer(); }
      }
    }
    function saveData() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityLog));
        localStorage.setItem(BROADCAST_KEY, JSON.stringify(broadcastHistory));
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backupHistory));
        localStorage.setItem(BLACKLIST_KEY, JSON.stringify(blacklist));
        localStorage.setItem(WHITELIST_KEY, JSON.stringify(whitelist));
        localStorage.setItem(FAQ_KEY, JSON.stringify(faqs));
        localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaigns));
        clearTimeout(__saveStateTimer);
        __saveStateTimer = setTimeout(persistStateToServer, 350);
      } catch (e) { /* ignore */ }
    }

    function loadData() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const parsed = JSON.parse(raw);
          appData = parsed; }
        const act = localStorage.getItem(ACTIVITY_KEY);
        if (act) activityLog = JSON.parse(act);
        const bc = localStorage.getItem(BROADCAST_KEY);
        if (bc) broadcastHistory = JSON.parse(bc);
        const bk = localStorage.getItem(BACKUP_KEY);
        if (bk) backupHistory = JSON.parse(bk);
        const bl = localStorage.getItem(BLACKLIST_KEY);
        if (bl) blacklist = JSON.parse(bl);
        const wl = localStorage.getItem(WHITELIST_KEY);
        if (wl) whitelist = JSON.parse(wl);
        const fq = localStorage.getItem(FAQ_KEY);
        if (fq) faqs = JSON.parse(fq);
        const cp = localStorage.getItem(CAMPAIGN_KEY);
        if (cp) campaigns = JSON.parse(cp);
      } catch (e) { /* ignore */ }
    }

    async function refreshServerData(showToastOnSuccess=true){
      try{
        apiRequestCache.clear();
        const res=await safeApi('getData',{},'GET');
        if(!res?.success || !res.data) throw new Error(res?.error||res?.message||'Server data unavailable');
        const d=res.data;
        appData={users:Array.isArray(d.users)?d.users:[],orders:Array.isArray(d.orders)?d.orders:[],payments:Array.isArray(d.payments)?d.payments:[],services:Array.isArray(d.services)?d.services:[],tickets:Array.isArray(d.tickets)?d.tickets:[],trash:Array.isArray(d.trash)?d.trash:[],apiLogs:Array.isArray(d.apiLogs)?d.apiLogs:[],referrals:Array.isArray(d.referrals)?d.referrals:[],messages:Array.isArray(d.messages)?d.messages:[],profits:Array.isArray(d.profits)?d.profits:[]};
        activityLog=Array.isArray(d.activity)?d.activity:[];broadcastHistory=Array.isArray(d.broadcastHistory)?d.broadcastHistory:[];backupHistory=Array.isArray(d.backups)?d.backups:[];blacklist=Array.isArray(d.blacklist)?d.blacklist:[];whitelist=Array.isArray(d.whitelist)?d.whitelist:[];faqs=Array.isArray(d.faqs)?d.faqs:[];campaigns=Array.isArray(d.campaigns)?d.campaigns:[];
        if(d.settings && typeof d.settings==='object'){const safeSettings={...d.settings};delete safeSettings.admin_password;localStorage.setItem(SETTINGS_KEY,JSON.stringify(safeSettings));if(safeSettings.default_currency && CURRENCY_SYMBOLS[safeSettings.default_currency])currentCurrency=safeSettings.default_currency;}
        saveData();renderAll();loadSettingsUI();updateBadges();
        if(showToastOnSuccess)showToast('success','Server Synced','Admin panel is now using live server data.');
        return true;
      }catch(e){console.warn('refreshServerData:',e);if(showToastOnSuccess)showToast('warning','Server Sync','Could not load live server data: '+(e.message||'Network error'));return false;}
    }

    // ============================================================
    //  CURRENCY HELPERS
    // ============================================================
    function getCurrencySymbol() { return CURRENCY_SYMBOLS[currentCurrency] || '₹'; }

    function getCurrencyCode() { return CURRENCY_NAMES[currentCurrency] || 'INR'; }

    function convertCurrency(amountInINR) {
      const rate = CURRENCY_RATES[currentCurrency] || 1;
      return amountInINR * rate;
    }

    function formatCurrency(amountInINR) {
      const converted = convertCurrency(amountInINR || 0);
      const symbol = getCurrencySymbol();
      const formatted = converted.toFixed(2);
      if (currentCurrency === 'AED') return symbol + ' ' + formatted;
      return symbol + formatted;
    }

    function changeCurrency(code) {
      currentCurrency = code;
      document.getElementById('currencySelector').value = code;
      renderAll();
      showToast('info', 'Currency Changed', 'Now using ' + CURRENCY_NAMES[code] + ' (' + CURRENCY_SYMBOLS[code] + ')');
    }

    // ============================================================
    //  API – with robust error handling
    // ============================================================
    const apiRequestCache = new Map();
    const apiInFlight = new Map();

    function buildApiUrl(action, data = {}, method = 'POST') {
      const params = new URLSearchParams();
      params.set('action', action);
      if (method === 'GET') Object.entries(data || {}).forEach(([k,v]) => {
        if (v !== undefined && v !== null) params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      return API_BASE_URL + (API_BASE_URL.includes('?') ? '&' : '?') + params.toString();
    }

    async function callApi(action, data = {}, method = 'POST', options = {}) {
      const cacheKey = method + ':' + action + ':' + JSON.stringify(data || {});
      const now = Date.now();
      if (method === 'GET' && !options.noCache) {
        const cached = apiRequestCache.get(cacheKey);
        if (cached && now - cached.time < REQUEST_CACHE_MS) return cached.value;
      }
      if (apiInFlight.has(cacheKey)) return apiInFlight.get(cacheKey);

      const run = async () => {
        let lastError;
        for (let attempt = 0; attempt <= API_RETRY_COUNT; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT_MS);
          try {
            const url = buildApiUrl(action, data, method);
            const fetchOptions = {
              method,
              headers: { 'Accept': 'application/json' },
              credentials: 'same-origin',
              signal: controller.signal,
              mode: 'cors',
              cache: 'no-store'
            };
            if (method !== 'GET' && method !== 'HEAD') {
              const body = new URLSearchParams();
              Object.entries(data || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null) body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
              });
              fetchOptions.body = body;
              fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
            }
            const response = await fetch(url, fetchOptions);
            const text = await response.text();
            let result = {};
            try { result = text ? JSON.parse(text) : {}; } catch (_) { throw new Error('API returned non-JSON response'); }
            if (!response.ok) throw new Error(result?.message || result?.error || ('HTTP ' + response.status));
            if (result && result.success === undefined && (result.status === 'success' || result.status === true || result.ok === true)) result.success = true;
            if (result && result.message === undefined && result.msg !== undefined) result.message = result.msg;
            if (method === 'GET' && !options.noCache) apiRequestCache.set(cacheKey, { time: Date.now(), value: result });
            return result;
          } catch (error) {
            lastError = error;
            if (attempt < API_RETRY_COUNT && error?.name !== 'AbortError') await new Promise(r => setTimeout(r, 450));
          } finally { clearTimeout(timeout); }
        }
        throw lastError || new Error('Network/API error');
      };
      const promise = run().finally(() => apiInFlight.delete(cacheKey));
      apiInFlight.set(cacheKey, promise);
      return promise;
    }

    async function safeApi(action, data = {}, method = 'POST') {
      if (localStorage.getItem('bihari_internet_mode') === '0') {
        return { success: false, offline: true, error: 'Internet/API mode is disabled', message: 'Internet/API mode is disabled' };
      }
      try { return await callApi(action, data, method); } catch (error) {
        const message = error && error.name === 'AbortError' ? 'API timeout' : (error?.message || 'Network/API error');
        if (!appData.apiLogs) appData.apiLogs = [];
        appData.apiLogs.unshift({ id: Date.now(), action, error: message, created_at: new Date().toLocaleString() });
        appData.apiLogs = appData.apiLogs.slice(0, 100);
        saveData();
        return { success: false, error: message, message };
      }
    }

    // ============================================================
    //  TOAST
    // ============================================================
    function showToast(type, title, message) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = `
        <div class="toast-icon">${icons[type]||'📢'}</div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
      `;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    }

    // ============================================================
    //  LOGIN / LOGOUT
    // ============================================================
    function togglePasswordVisibility() {
      const input = document.getElementById('adminPassword');
      const btn = document.querySelector('.password-toggle i');
      if (!input) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      if (btn) btn.className = visible ? 'fas fa-eye' : 'fas fa-eye-slash';
    }

    let loginLockedUntil = 0;
    let loginFailures = 0;
    function login() {
      const now = Date.now();
      if (now < loginLockedUntil) { showToast('warning','Please wait','Too many failed attempts. Try again shortly.'); return; }
      const pwd = document.getElementById('adminPassword').value;
      const errorDiv = document.getElementById('loginError');
      const button = document.getElementById('loginButton');
      if (pwd === ADMIN_PASSWORD) {
        loginFailures = 0;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadAdminContent();
        showToast('success', 'Welcome back', 'Admin control center is ready.');
      } else {
        loginFailures++;
        if (loginFailures >= 5) { loginLockedUntil = Date.now() + 30000; loginFailures = 0; }
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = '<i class="fas fa-circle-exclamation"></i> Incorrect password';
        setTimeout(() => errorDiv.style.display = 'none', 2500);
        document.getElementById('adminPassword').value = '';
        if (button) button.classList.add('shake');
        setTimeout(() => button?.classList.remove('shake'), 400);
      }
    }

    function logout() {
      if (confirm('Are you sure you want to logout?')) {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('adminPassword').value = '';
        showToast('info', 'Logged Out', 'See you soon!');
      }
    }

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
      const overlay = document.getElementById('proSidebarOverlay');
      if (overlay) overlay.classList.toggle('active', document.getElementById('sidebar').classList.contains('open'));
      document.body.classList.toggle('sidebar-open', document.getElementById('sidebar').classList.contains('open'));
    }

    function toggleTheme() {
      theme = (theme === 'dark') ? 'light' : 'dark';
      localStorage.setItem('bihari_theme', theme);
      const root = document.documentElement;
      if (theme === 'light') {
        root.style.setProperty('--glass-bg', 'rgba(240,240,250,0.55)');
        root.style.setProperty('--glass-border', 'rgba(0,0,0,0.06)');
        root.style.setProperty('--text-primary', '#111');
        root.style.setProperty('--text-secondary', '#555');
        root.style.setProperty('--text-muted', '#888');
      } else {
        root.style.setProperty('--glass-bg', 'rgba(20,20,30,0.55)');
        root.style.setProperty('--glass-border', 'rgba(255,255,255,0.08)');
        root.style.setProperty('--text-primary', '#fff');
        root.style.setProperty('--text-secondary', '#B0B0D0');
        root.style.setProperty('--text-muted', '#7A7A9A');
      }
      showToast('info', 'Theme', 'Switched to ' + theme + ' mode');
    }

    // ============================================================
    //  NAVIGATION
    // ============================================================
    function showPage(page) {
      const routes = {
        dashboard:'dashboard.html', users:'users.html', orders:'orders.html', payments:'payments.html', services:'services.html',
        inbox:'inbox.html', broadcast:'broadcast.html', support:'support.html', trash:'trash.html', apilogs:'api-logs.html',
        referrals:'referrals.html', blacklist:'blacklist.html', whitelist:'whitelist.html', faq:'faq.html', campaigns:'campaigns.html',
        analytics:'analytics.html', qrpayment:'qr-payment.html', leaderboard:'leaderboard.html', activity:'activity.html',
        diagnostics:'diagnostics.html', backup:'backup.html', profits:'profits.html', profile:'profile.html', settings:'settings.html'
      };
      if(!routes[page]) return;
      try{
        if(window.innerWidth<=992){
          document.getElementById('sidebar')?.classList.remove('open');
          document.getElementById('proSidebarOverlay')?.classList.remove('active');
          document.body.classList.remove('sidebar-open');
        }
      }catch(_){}
      if(location.pathname.endsWith('/'+routes[page]) || location.pathname.endsWith(routes[page])){
        const target=document.getElementById('page-'+page);
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
        target?.classList.add('active');
        try{showPageDataOnly(page)}catch(e){console.warn('Page load:',e)}
      }else location.href=routes[page];
    }

    // ============================================================
    //  UTILITY
    // ============================================================
    function getInitials(n) { if (!n) return '?'; return n.charAt(0).toUpperCase(); }

    function getStatusBadges(u) {
      let h = '';
      if (u.is_vip) h += '<span class="badge badge-gold">⭐ VIP</span> ';
      if (u.is_banned) h += '<span class="badge badge-danger">🚫 Banned</span> ';
      if (!u.is_vip && !u.is_banned) h += '<span class="badge badge-info">Regular</span>';
      return h;
    }

    function downloadFile(content, filename, mime) {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function closeModal(id) { document.getElementById(id).classList.remove('active'); }

    function escapeHtml(text) {
      if (!text) return '—';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ============================================================
    //  RENDER ALL
    // ============================================================
    let renderScheduled = false;
    function renderAll() {
      if (renderScheduled) return;
      renderScheduled = true;
      requestAnimationFrame(() => {
        renderScheduled = false;
        try {
          loadDashboard();
          updateBadges();
          const active = document.querySelector('.page.active')?.id?.replace('page-','');
          if (active) showPageDataOnly(active);
        } catch (e) { console.warn('renderAll error:', e); }
      });
    }

    function showPageDataOnly(page) {
      const loadMap = {
        dashboard: loadDashboard, users: loadUsers, orders: loadOrders, payments: loadPayments,
        services: loadServices, inbox: loadInbox, support: loadTickets, trash: loadTrash,
        apilogs: loadApiLogs, referrals: loadReferrals, analytics: loadAnalytics,
        qrpayment: () => { loadQRDisplay(); loadQRPayment(); }, leaderboard: loadLeaderboard,
        activity: loadActivity, diagnostics: loadDiagnostics, backup: loadBackupHistory,
        profits: loadProfits, profile: loadAdminProfile, settings: loadSettingsUI,
        blacklist: loadBlacklist, whitelist: loadWhitelist, faq: loadFaq, campaigns: loadCampaigns,
        broadcast: loadBroadcastHistory
      };
      if (loadMap[page]) loadMap[page]();
    }

    function updateBadges() {
      try {
        document.getElementById('userCountBadge').textContent = appData.users ? appData.users.length : 0;
        document.getElementById('orderCountBadge').textContent = appData.orders ? appData.orders.length : 0;
        document.getElementById('paymentCountBadge').textContent = appData.payments ? appData.payments.length : 0;
        document.getElementById('ticketBadge').textContent = appData.tickets ? appData.tickets.filter(x => x.status ===
          'open').length : 0;
        document.getElementById('trashBadge').textContent = appData.trash ? appData.trash.length : 0;
        document.getElementById('inboxBadge').textContent = appData.messages ? appData.messages.length : 0;
      } catch (e) { /* ignore */ }
    }

    // ============================================================
    //  DASHBOARD
    // ============================================================
    function loadDashboard() {
      try {
        const users = appData.users || [],
          orders = appData.orders || [],
          payments = appData.payments || [];
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('totalOrders').textContent = orders.length;
        document.getElementById('pendingOrders').textContent = orders.filter(o => o.status === 'pending' || o.status ===
          'processing').length;
        document.getElementById('pendingPayments').textContent = payments.filter(p => p.status === 'pending').length;
        const rev = orders.reduce((s, o) => s + (o.user_price || 0), 0);
        document.getElementById('totalRevenue').textContent = formatCurrency(rev);
        const recent = orders.slice(-6).reverse();
        const recentOrders = document.getElementById('recentOrders');
        if (recentOrders) {
          let html = '';
          recent.forEach(o => {
            const user = users.find(u => u.user_id === o.user_id);
            const name = user ? user.first_name : 'Unknown';
            const cls = o.status || 'pending';
            const labels = { completed: 'success', processing: 'info', pending: 'warning', cancelled: 'danger' };
            html +=
              `<tr><td><span class="badge badge-primary">#${o.id}</span></td><td><strong>${name}</strong></td><td>${o.service_name||'N/A'}</td><td>${formatCurrency(o.user_price||0)}</td><td><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></td><td style="font-size:12px;color:var(--text-secondary);">${o.created_at||'-'}</td></tr>`;
          });
          recentOrders.innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:30px;">No orders</td></tr>';
        }
      } catch (e) { console.warn('loadDashboard error:', e); }
    }

    // ============================================================
    //  USERS
    // ============================================================
    function loadUsers() {
      try {
        const users = appData.users || [];
        const list = document.getElementById('usersList');
        if (!list) return;
        document.getElementById('userCountDisplay').textContent = '(' + users.length + ')';
        let html = '';
        users.forEach(u => {
          const initials = getInitials(u.first_name);
          const balColor = u.balance > 500 ? 'var(--success)' : u.balance > 100 ? 'var(--warning)' : 'var(--danger)';
          const phone = u.phone || '—';
          const lastSeen = u.last_active ? new Date(u.last_active).toLocaleString() : 'Never';
          const statusBadges = getStatusBadges(u);
          html += `<tr>
          <td><div class="user-cell"><div class="mini-avatar" style="background:linear-gradient(135deg,${u.is_vip?'#FF6B35':'#6C3CE1'},${u.is_vip?'#FF1744':'#8B6FF5'});">${initials}</div><div><div>${u.first_name||'Unknown'} ${u.last_name||''}</div><div style="font-size:10px;color:var(--text-muted);">${u.user_id}</div><div style="font-size:10px;color:var(--text-muted);">@${u.username||'N/A'}</div></div></div></td>
          <td>${phone}</td>
          <td style="color:${balColor};font-weight:600;">${formatCurrency(u.balance||0)}</td>
          <td>${formatCurrency(u.total_spent||0)}</td>
          <td><span class="badge badge-info">${u.total_orders||0}</span></td>
          <td>${statusBadges}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${lastSeen}</td>
          <td>
            <button class="btn btn-xs btn-info" onclick="viewUserDetail(${u.id})"><i class="fas fa-eye"></i></button>
            <button class="btn btn-xs ${u.is_vip?'btn-warning':'btn-primary'}" onclick="toggleVIP(${u.id})">⭐</button>
            <button class="btn btn-xs ${u.is_banned?'btn-success':'btn-danger'}" onclick="toggleBan(${u.id})">${u.is_banned?'✅':'🚫'}</button>
            <button class="btn btn-xs btn-danger" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:30px;">No users</td></tr>';
      } catch (e) { console.warn('loadUsers error:', e); }
    }

    function filterUsers() {
      try {
        const search = document.getElementById('userSearch').value.toLowerCase();
        const filter = document.getElementById('userFilter').value;
        const rows = document.querySelectorAll('#usersList tr');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          let show = true;
          if (search && !text.includes(search)) show = false;
          if (filter === 'vip' && !text.includes('vip')) show = false;
          if (filter === 'regular' && text.includes('vip')) show = false;
          if (filter === 'banned' && !text.includes('banned')) show = false;
          if (filter === 'inactive' && !text.includes('never')) show = false;
          row.style.display = show ? '' : 'none';
        });
      } catch (e) { /* ignore */ }
    }

    function viewUserDetail(id) {
      try {
        const u = appData.users.find(x => x.id === id);
        if (!u) return;
        const initials = getInitials(u.first_name);
        const phone = u.phone || 'Not set';
        const email = u.email || 'Not set';
        const city = u.city || 'Not set';
        const howFound = u.how_found || 'Not set';
        const profileCompleted = u.profile_completed ? '✅ Yes' : '❌ No';
        const notes = u.notes || '';
        const lastSeen = u.last_active ? new Date(u.last_active).toLocaleString() : 'Never';
        let statusBadges = getStatusBadges(u);
        document.getElementById('userDetailTitle').textContent = '👤 ' + u.first_name + ' ' + (u.last_name || '');
        document.getElementById('userDetailBody').innerHTML = `
        <div class="profile-section">
          <div class="big-avatar" style="background:linear-gradient(135deg,${u.is_vip?'#FF6B35':'#6C3CE1'},${u.is_vip?'#FF1744':'#8B6FF5'});">${initials}</div>
          <div>
            <h3>${u.first_name} ${u.last_name||''}</h3>
            <p>📱 @${u.username||'N/A'}</p>
            <p>🆔 ${u.user_id||'N/A'}</p>
            <p>📞 ${phone}</p>
            <p>📧 ${email}</p>
            <p>📍 ${city}</p>
            <p>🔍 Found via: ${howFound}</p>
            <p>📋 Profile: ${profileCompleted}</p>
            <div style="margin-top:8px;">${statusBadges}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:15px 0;">
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">💰 Balance</div><div style="font-size:20px;font-weight:700;color:${u.balance>500?'var(--success)':'var(--warning)'};">${formatCurrency(u.balance||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">📦 Total Orders</div><div style="font-size:20px;font-weight:700;">${u.total_orders||0}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">💸 Total Spent</div><div style="font-size:20px;font-weight:700;">${formatCurrency(u.total_spent||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">🎁 Referrals</div><div style="font-size:20px;font-weight:700;">${u.referrals||0}</div></div>
        </div>
        <div style="margin:10px 0;"><label style="color:var(--text-secondary);font-size:13px;">Notes</label><textarea id="userNotes" rows="3" style="width:100%;padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;">${notes}</textarea></div>
        <div style="margin:10px 0;"><label style="color:var(--text-secondary);font-size:13px;">Phone</label><input type="text" id="userPhone" value="${phone}" style="width:100%;padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;"></div>
        <div style="margin:10px 0;"><label style="color:var(--text-secondary);font-size:13px;">Email</label><input type="text" id="userEmail" value="${email}" style="width:100%;padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;"></div>
        <div style="margin:10px 0;"><label style="color:var(--text-secondary);font-size:13px;">City</label><input type="text" id="userCity" value="${city}" style="width:100%;padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;"></div>
        <div style="margin:10px 0;"><h4>Manual Balance</h4><div style="display:flex;gap:10px;"><input type="number" id="manualBalanceAmount" placeholder="Amount" style="flex:1;padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;"><select id="manualBalanceType" style="padding:8px;background:rgba(255,255,255,0.04);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:#fff;"><option value="add">Add</option><option value="deduct">Deduct</option></select><button class="btn btn-sm btn-secondary" onclick="manualBalance(${u.id})">Apply</button></div></div>
        <div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-primary" onclick="saveUserDetails(${u.id})"><i class="fas fa-save"></i> Save</button>
          <button class="btn btn-sm ${u.is_vip?'btn-warning':'btn-primary'}" onclick="toggleVIP(${u.id});closeModal('userDetailModal');">${u.is_vip?'Remove VIP':'Make VIP'}</button>
          <button class="btn btn-sm ${u.is_banned?'btn-success':'btn-danger'}" onclick="toggleBan(${u.id});closeModal('userDetailModal');">${u.is_banned?'Unban':'Ban'}</button>
          <button class="btn btn-sm btn-info" onclick="closeModal('userDetailModal');showPage('orders');">Orders</button>
          <button class="btn btn-sm btn-secondary" onclick="closeModal('userDetailModal');">Close</button>
        </div>
      `;
        document.getElementById('userDetailModal').classList.add('active');
      } catch (e) { console.warn('viewUserDetail error:', e);
        showToast('error', 'Error', 'Could not load user details'); }
    }

    function saveUserDetails(id) {
      try {
        const notes = document.getElementById('userNotes').value;
        const phone = document.getElementById('userPhone').value;
        const email = document.getElementById('userEmail').value;
        const city = document.getElementById('userCity').value;
        const u = appData.users.find(x => x.id === id);
        if (u) { u.notes = notes;
          u.phone = phone;
          u.email = email;
          u.city = city;
          saveData();
          loadUsers();
          showToast('success', 'Saved', 'User details updated!');
          addActivity('Admin', 'Updated user details for ' + u.first_name); }
      } catch (e) { showToast('error', 'Error', 'Failed to save'); }
    }

    async function manualBalance(id) {
      try {
        const amount = parseFloat(document.getElementById('manualBalanceAmount').value);
        const type = document.getElementById('manualBalanceType').value;
        if (!amount || amount <= 0) { showToast('warning','Invalid','Enter valid amount'); return; }
        const u = appData.users.find(x => x.id === id);
        if (!u) { showToast('error','Error','User not found'); return; }
        showToast('info','Updating balance','Saving to server and notifying user…');
        const res = await safeApi('adjustBalance',{id:u.user_id,amount,type},'POST');
        if (!res || !res.success) { showToast('error','Failed',res?.error||res?.message||'Balance update failed'); return; }
        await refreshServerData(false);
        showToast('success','Balance Updated',`${type==='add'?'Added':'Deducted'} ${formatCurrency(amount)} for ${u.first_name||u.user_id}`);
        addActivity('Admin','Manual balance '+type+' for '+(u.first_name||u.user_id));
      } catch(e){showToast('error','Error',e.message||'Failed to update balance');}
    }

    function toggleVIP(id) {
      try {
        const u = appData.users.find(x => x.id === id);
        if (!u) return;
        u.is_vip = !u.is_vip;
        saveData();
        loadUsers();
        showToast('success', 'VIP Updated', u.first_name + ' is now ' + (u.is_vip ? 'VIP' : 'Regular'));
        addActivity('Admin', 'Toggled VIP for ' + u.first_name);
      } catch (e) { showToast('error', 'Error', 'Failed to toggle VIP'); }
    }

    function toggleBan(id) {
      try {
        const u = appData.users.find(x => x.id === id);
        if (!u) return;
        u.is_banned = !u.is_banned;
        saveData();
        loadUsers();
        showToast(u.is_banned ? 'error' : 'success', 'Updated', u.first_name + ' ' + (u.is_banned ? 'banned' : 'unbanned'));
        addActivity('Admin', (u.is_banned ? 'Banned' : 'Unbanned') + ' ' + u.first_name);
      } catch (e) { showToast('error', 'Error', 'Failed to toggle ban'); }
    }

    function deleteUser(id) {
      if (!confirm('Delete this user?')) return;
      try {
        const u = appData.users.find(x => x.id === id);
        if (u) {
          appData.trash.push({ id: Date.now(), type: 'user', ref_id: id, name: u.first_name || 'User',
            deleted_at: new Date().toISOString() });
          appData.users = appData.users.filter(x => x.id !== id);
          saveData();
          loadUsers();
          updateBadges();
          showToast('success', 'Deleted', 'User deleted!');
          addActivity('Admin', 'Deleted user ' + (u.first_name || ''));
        }
      } catch (e) { showToast('error', 'Error', 'Failed to delete user'); }
    }

    function showAddUserModal() {
      document.getElementById('userModalTitle').textContent = '➕ Add User';
      document.getElementById('userModalBody').innerHTML = `
        <div class="form-group"><label>User ID</label><input type="text" id="addUserId" placeholder="123456789"></div>
        <div class="form-group"><label>First Name</label><input type="text" id="addFirstName" placeholder="John"></div>
        <div class="form-group"><label>Last Name</label><input type="text" id="addLastName" placeholder="Doe"></div>
        <div class="form-group"><label>Username</label><input type="text" id="addUsername" placeholder="john_doe"></div>
        <div class="form-group"><label>Phone</label><input type="text" id="addPhone" placeholder="+91..."></div>
        <div class="form-group"><label>Email</label><input type="text" id="addEmail" placeholder="user@example.com"></div>
        <div class="form-group"><label>City</label><input type="text" id="addCity" placeholder="Mumbai"></div>
        <div class="form-group"><label>How Found</label><input type="text" id="addHowFound" placeholder="Telegram"></div>
        <div class="form-group"><label>Balance</label><input type="number" id="addBalance" value="0" step="0.01"></div>
        <div class="form-group"><label>VIP</label><select id="addVIP"><option value="0">No</option><option value="1">Yes</option></select></div>
        <button class="btn btn-success" onclick="addUser()"><i class="fas fa-plus"></i> Add</button>
      `;
      document.getElementById('userModal').classList.add('active');
    }

    function addUser() {
      try {
        const data = {
          id: Date.now(),
          user_id: document.getElementById('addUserId').value || 'user_' + Date.now(),
          first_name: document.getElementById('addFirstName').value || 'User',
          last_name: document.getElementById('addLastName').value || '',
          username: document.getElementById('addUsername').value || '',
          phone: document.getElementById('addPhone').value || '',
          email: document.getElementById('addEmail').value || '',
          city: document.getElementById('addCity').value || '',
          how_found: document.getElementById('addHowFound').value || '',
          balance: parseFloat(document.getElementById('addBalance').value) || 0,
          is_vip: parseInt(document.getElementById('addVIP').value) || 0,
          is_banned: 0,
          total_orders: 0,
          total_spent: 0,
          referrals: 0,
          profile_completed: 0,
          join_date: new Date().toISOString(),
          last_active: new Date().toISOString()
        };
        appData.users.push(data);
        saveData();
        closeModal('userModal');
        loadUsers();
        updateBadges();
        showToast('success', 'Added', 'User added!');
        addActivity('Admin', 'Added user ' + data.first_name);
      } catch (e) { showToast('error', 'Error', 'Failed to add user'); }
    }

    function exportUsers() {
      try {
        const data = appData.users || [];
        const csv = [
          ['ID', 'User ID', 'Name', 'Username', 'Phone', 'Email', 'City', 'How Found', 'Balance', 'Total Spent',
            'Total Orders', 'VIP', 'Banned', 'Referrals', 'Join Date', 'Last Seen'
          ]
        ];
        data.forEach(u => csv.push([u.id, u.user_id, `${u.first_name} ${u.last_name||''}`, u.username, u.phone || 'N/A',
          u.email || 'N/A', u.city || 'N/A', u.how_found || 'N/A', u.balance, u.total_spent, u.total_orders, u
            .is_vip ? 'Yes' : 'No', u.is_banned ? 'Yes' : 'No', u.referrals || 0, u.join_date, u.last_active || ''
        ]));
        const content = csv.map(r => r.join(',')).join('\n');
        downloadFile(content, 'users_export.csv', 'text/csv');
        showToast('success', 'Exported', 'Users exported');
      } catch (e) { showToast('error', 'Error', 'Export failed'); }
    }

    // ============================================================
    //  ORDERS
    // ============================================================
    function loadOrders(filter) {
      try {
        filter = filter || currentOrderFilter || 'all';
        currentOrderFilter = filter;
        let orders = appData.orders || [];
        if (filter !== 'all') orders = orders.filter(o => o.status === filter);
        const list = document.getElementById('ordersList');
        if (!list) return;
        const labels = { completed: 'success', processing: 'info', pending: 'warning', cancelled: 'danger' };
        let html = '';
        orders.forEach(o => {
          const user = appData.users.find(u => u.user_id === o.user_id);
          const name = user ? user.first_name : 'Unknown';
          const cls = o.status || 'pending';
          html += `<tr>
          <td><input type="checkbox" class="bulk-check" data-id="${o.id}" data-type="order" onchange="updateBulkBar('order')"></td>
          <td><span class="badge badge-primary">#${o.id}</span></td>
          <td><strong>${name}</strong><br><span style="font-size:10px;color:var(--text-muted);">${o.user_id}</span></td>
          <td>${o.service_name}</td>
          <td style="word-break:break-all;max-width:150px;"><code style="font-size:10px;color:var(--text-secondary);">${o.link||'-'}</code></td>
          <td>${o.quantity}</td>
          <td style="color:var(--success);font-weight:600;">${formatCurrency(o.user_price||0)}</td>
          <td style="color:var(--primary-light);font-weight:600;">${formatCurrency(o.profit||0)}</td>
          <td><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></td>
          <td style="font-size:12px;color:var(--text-secondary);">${o.created_at||'-'}</td>
          <td>
            <button class="btn btn-xs btn-success" onclick="updateOrderStatus(${o.id},'completed')">✅</button>
            <button class="btn btn-xs btn-danger" onclick="updateOrderStatus(${o.id},'cancelled')">❌</button>
            <button class="btn btn-xs btn-info" onclick="viewOrderDetail(${o.id})"><i class="fas fa-eye"></i></button>
          </td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="11" style="text-align:center;padding:30px;">No orders</td></tr>';
        document.getElementById('orderFilterBadge').textContent = filter.charAt(0).toUpperCase() + filter.slice(1);
        updateBulkBar('order');
      } catch (e) { console.warn('loadOrders error:', e); }
    }

    function filterOrders(status) { loadOrders(status); }

    async function updateOrderStatus(id,status){
      try{
        const o=appData.orders.find(x=>x.id===id); if(!o){showToast('error','Error','Order not found');return;}
        const res=await safeApi('updateOrderStatus',{id,status},'POST');
        if(!res?.success){showToast('error','Failed',res?.error||res?.message||'Order update failed');return;}
        await refreshServerData(false);
        showToast('success','Updated','Order #'+id+' marked '+status);
        addActivity('Admin','Order #'+id+' marked '+status);
      }catch(e){showToast('error','Error',e.message||'Failed to update order');}
    }

    function checkAndUpdateOrders() {
      showToast('info', 'Checking', 'Updating processing orders...');
      safeApi('checkOrders', {}).then(res => {
        if (res.success) { saveData();
          renderAll();
          showToast('success', 'Done!', res.message || 'Orders updated');
          addActivity('Admin', 'Checked and updated orders'); } else showToast('error', 'Error', res.message);
      }).catch(() => showToast('error', 'Error', 'Operation failed'));
    }

    function viewOrderDetail(id) {
      try {
        const o = appData.orders.find(x => x.id === id);
        if (!o) return;
        const user = appData.users.find(u => u.user_id === o.user_id);
        const name = user ? user.first_name : 'Unknown';
        document.getElementById('orderDetailTitle').textContent = '📦 Order #' + o.id;
        const labels = { completed: 'success', processing: 'info', pending: 'warning', cancelled: 'danger' };
        const cls = o.status || 'pending';
        document.getElementById('orderDetailBody').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">User</div><div style="font-weight:600;">${name}</div><div style="font-size:11px;color:var(--text-muted);">${o.user_id}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Status</div><div><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Service</div><div style="font-weight:600;">${o.service_name}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Link</div><div style="font-size:11px;word-break:break-all;color:var(--text-secondary);"><code>${o.link||'-'}</code></div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Quantity</div><div style="font-weight:600;">${o.quantity}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Amount</div><div style="font-weight:600;color:var(--success);">${formatCurrency(o.user_price||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Profit</div><div style="font-weight:600;color:var(--primary-light);">${formatCurrency(o.profit||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Date</div><div style="font-size:12px;color:var(--text-secondary);">${o.created_at||'-'}</div></div>
          ${o.api_order_id ? `<div style="grid-column:span 2;background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">API Order ID</div><div style="font-size:12px;color:var(--text-secondary);"><code>${o.api_order_id}</code></div></div>` : ''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-success" onclick="updateOrderStatus(${o.id},'completed');closeModal('orderDetailModal');">✅ Complete</button>
          <button class="btn btn-sm btn-danger" onclick="updateOrderStatus(${o.id},'cancelled');closeModal('orderDetailModal');">❌ Cancel</button>
          <button class="btn btn-sm btn-info" onclick="closeModal('orderDetailModal');viewUserDetail(${user?user.id:0});">👤 User</button>
          <button class="btn btn-sm btn-secondary" onclick="closeModal('orderDetailModal');">Close</button>
        </div>
      `;
        document.getElementById('orderDetailModal').classList.add('active');
      } catch (e) { showToast('error', 'Error', 'Could not load order details'); }
    }

    function exportOrders() {
      try {
        const data = appData.orders || [];
        const csv = [
          ['ID', 'User ID', 'Service', 'Link', 'Quantity', 'Amount', 'Profit', 'Status', 'Date']
        ];
        data.forEach(o => csv.push([o.id, o.user_id, o.service_name, o.link, o.quantity, o.user_price, o.profit, o
          .status, o.created_at
        ]));
        const content = csv.map(r => r.join(',')).join('\n');
        downloadFile(content, 'orders_export.csv', 'text/csv');
        showToast('success', 'Exported', 'Orders exported');
      } catch (e) { showToast('error', 'Error', 'Export failed'); }
    }

    // ============================================================
    //  BULK OPERATIONS
    // ============================================================
    function updateBulkBar(type) {
      try {
        const selected = getSelected(type);
        const bar = document.getElementById('bulkBar-' + type);
        if (bar) {
          if (selected.length > 0) { bar.classList.add('show');
            document.getElementById('bulkCount-' + type).textContent = selected.length; } else { bar.classList.remove(
              'show'); }
        }
      } catch (e) { /* ignore */ }
    }

    function getSelected(type) {
      return Array.from(document.querySelectorAll(`.bulk-check[data-type="${type}"]:checked`)).map(cb => parseInt(cb
      .dataset.id));
    }

    function clearBulkSelection(type) {
      document.querySelectorAll(`.bulk-check[data-type="${type}"]`).forEach(cb => cb.checked = false);
      updateBulkBar(type);
    }

    function toggleAllBulk(type, el) {
      document.querySelectorAll(`.bulk-check[data-type="${type}"]`).forEach(cb => cb.checked = el.checked);
      updateBulkBar(type);
    }

    function bulkAction(type, action) {
      const ids = getSelected(type);
      if (!ids.length) { showToast('warning', 'No items', 'Select at least one'); return; }
      if (!confirm('Are you sure you want to ' + action + ' ' + ids.length + ' item(s)?')) return;
      try {
        ids.forEach(id => {
          if (type === 'order') {
            const o = appData.orders.find(x => x.id === id);
            if (o) {
              if (action === 'complete') o.status = 'completed';
              if (action === 'cancel') o.status = 'cancelled';
              if (action === 'complete' || action === 'cancel') o.completed_at = new Date().toISOString();
            }
          } else if (type === 'payment') {
            const p = appData.payments.find(x => x.id === id);
            if (p && p.status === 'pending') {
              if (action === 'approve') {
                p.status = 'approved';
                p.approved_at = new Date().toISOString();
                const user = appData.users.find(u => u.user_id === p.user_id);
                if (user) user.balance = (user.balance || 0) + (p.total_credit || p.amount || 0);
              }
              if (action === 'reject') { p.status = 'rejected';
                p.rejected_at = new Date().toISOString(); }
            }
          }
        });
        saveData();
        showToast('success', 'Bulk Action', ids.length + ' item(s) ' + action + 'ed.');
        renderAll();
        clearBulkSelection(type);
      } catch (e) { showToast('error', 'Error', 'Bulk action failed'); }
    }

    // ============================================================
    //  PAYMENTS
    // ============================================================
    function loadPayments(filter) {
      try {
        filter = filter || currentPaymentFilter || 'all';
        currentPaymentFilter = filter;
        let payments = appData.payments || [];
        if (filter !== 'all') payments = payments.filter(p => p.status === filter);
        const list = document.getElementById('paymentsList');
        if (!list) return;
        const labels = { approved: 'success', pending: 'warning', rejected: 'danger' };
        let html = '';
        payments.forEach(p => {
          const user = appData.users.find(u => u.user_id === p.user_id);
          const name = user ? user.first_name : 'Unknown';
          const cls = p.status || 'pending';
          const isPending = cls === 'pending';
          html += `<tr>
          <td><input type="checkbox" class="bulk-check" data-id="${p.id}" data-type="payment" onchange="updateBulkBar('payment')"></td>
          <td><span class="badge badge-primary">#${p.id}</span></td>
          <td><strong>${name}</strong><br><span style="font-size:10px;color:var(--text-muted);">${p.user_id}</span></td>
          <td style="color:var(--success);font-weight:600;">${formatCurrency(p.amount||0)}</td>
          <td>${formatCurrency(p.bonus||0)}</td>
          <td style="color:var(--gold);font-weight:700;">${formatCurrency(p.total_credit||p.amount||0)}</td>
          <td><code style="color:var(--text-secondary);font-size:11px;">${p.utr||'-'}</code></td>
          <td><span class="badge badge-info">${p.method||'UPI'}</span></td>
          <td><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></td>
          <td style="font-size:12px;color:var(--text-secondary);">${p.created_at||'-'}</td>
          <td>${isPending ? `<button class="btn btn-xs btn-success" onclick="approvePayment(${p.id})">✅</button><button class="btn btn-xs btn-danger" onclick="rejectPayment(${p.id})">❌</button>` : (cls==='approved'?'✅ Done':'❌ Rejected')}
          <button class="btn btn-xs btn-info" onclick="viewPaymentDetail(${p.id})"><i class="fas fa-eye"></i></button></td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="11" style="text-align:center;padding:30px;">No payments</td></tr>';
        updateBulkBar('payment');
      } catch (e) { console.warn('loadPayments error:', e); }
    }

    function filterPayments(status) { loadPayments(status); }

    async function approvePayment(id) {
      try {
        const p = appData.payments.find(x=>x.id===id);
        if (!p || p.status!=='pending') { showToast('error','Error','Payment not found or already processed'); return; }
        const res = await safeApi('approvePayment',{id},'POST');
        if (!res?.success) { showToast('error','Failed',res?.error||res?.message||'Approval failed'); return; }
        await refreshServerData(false);
        showToast('success','Approved','Payment #'+id+' approved and user balance updated.');
        addActivity('Admin','Payment #'+id+' approved');
      } catch(e){showToast('error','Error',e.message||'Failed to approve payment');}
    }
    async function rejectPayment(id) {
      try {
        const p = appData.payments.find(x=>x.id===id);
        if (!p || p.status!=='pending') { showToast('error','Error','Payment not found or already processed'); return; }
        const reason = prompt('Optional rejection reason:','') || '';
        const res = await safeApi('rejectPayment',{id,reason},'POST');
        if (!res?.success) { showToast('error','Failed',res?.error||res?.message||'Rejection failed'); return; }
        await refreshServerData(false);
        showToast('success','Rejected','Payment #'+id+' rejected.');
        addActivity('Admin','Payment #'+id+' rejected');
      } catch(e){showToast('error','Error',e.message||'Failed to reject payment');}
    }

    function viewPaymentDetail(id) {
      try {
        const p = appData.payments.find(x => x.id === id);
        if (!p) return;
        const user = appData.users.find(u => u.user_id === p.user_id);
        const name = user ? user.first_name : 'Unknown';
        document.getElementById('paymentDetailTitle').textContent = '💳 Payment #' + p.id;
        const labels = { approved: 'success', pending: 'warning', rejected: 'danger' };
        const cls = p.status || 'pending';
        const isPending = cls === 'pending';
        document.getElementById('paymentDetailBody').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">User</div><div style="font-weight:600;">${name}</div><div style="font-size:11px;color:var(--text-muted);">${p.user_id}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Status</div><div><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Amount</div><div style="font-weight:600;color:var(--success);">${formatCurrency(p.amount||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Bonus</div><div style="font-weight:600;color:var(--gold);">${formatCurrency(p.bonus||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Total</div><div style="font-weight:700;color:var(--gold);">${formatCurrency(p.total_credit||p.amount||0)}</div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">UTR</div><div style="font-size:12px;color:var(--text-secondary);"><code>${p.utr||'-'}</code></div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Method</div><div><span class="badge badge-info">${p.method||'UPI'}</span></div></div>
          <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);"><div style="font-size:11px;color:var(--text-muted);">Date</div><div style="font-size:12px;color:var(--text-secondary);">${p.created_at||'-'}</div></div>
          ${p.screenshot_file ? `<div style="grid-column:span 2;background:rgba(255,255,255,0.03);padding:12px;border-radius:8px;border:1px solid var(--glass-border);text-align:center;"><div style="font-size:11px;color:var(--text-muted);">Screenshot</div><div style="margin-top:8px;"><img src="${p.screenshot_file}" style="max-width:200px;max-height:200px;border-radius:8px;border:1px solid var(--glass-border);" alt="Payment Screenshot"></div></div>` : ''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${isPending ? `<button class="btn btn-sm btn-success" onclick="approvePayment(${p.id});closeModal('paymentDetailModal');">✅ Approve</button><button class="btn btn-sm btn-danger" onclick="rejectPayment(${p.id});closeModal('paymentDetailModal');">❌ Reject</button>` : ''}
          <button class="btn btn-sm btn-info" onclick="closeModal('paymentDetailModal');viewUserDetail(${user?user.id:0});">👤 User</button>
          <button class="btn btn-sm btn-secondary" onclick="closeModal('paymentDetailModal');">Close</button>
        </div>
      `;
        document.getElementById('paymentDetailModal').classList.add('active');
      } catch (e) { showToast('error', 'Error', 'Could not load payment details'); }
    }

    // ============================================================
    //  SERVICES
    // ============================================================
    function loadServices() {
      try {
        const services = appData.services || [];
        const container = document.getElementById('servicesContainer');
        if (!container) return;
        const categories = {};
        services.forEach(s => { if (!categories[s.category]) categories[s.category] = [];
          categories[s.category].push(s); });
        let html = '';
        const order = ['Instagram', 'Facebook', 'Twitter', 'YouTube', 'TikTok', 'Telegram', 'Spotify', 'Website', 'Others'];
        order.forEach(cat => {
          if (categories[cat] && categories[cat].length) {
            html += `<div style="margin-bottom:30px;">
            <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:rgba(108,60,225,0.1);border-radius:var(--radius-sm);margin-bottom:15px;border-left:4px solid var(--primary);">
              <h4 style="font-size:16px;font-weight:700;color:var(--primary-light);">${cat}</h4>
              <span style="margin-left:auto;background:var(--glass-border);padding:2px 12px;border-radius:20px;font-size:12px;color:var(--text-secondary);">${categories[cat].length} services</span>
            </div>
            <div class="table-wrapper"><table><thead><tr><th>ID</th><th>Name</th><th>API Rate</th><th>Sell Price</th><th>Profit</th><th>Min</th><th>Max</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
            categories[cat].forEach(s => {
              const status = s.is_active ? '<span class="badge badge-success">✅ Active</span>' :
                '<span class="badge badge-danger">❌ Inactive</span>';
              html += `<tr>
              <td>${(s.api_service_id ?? s.provider_service_id ?? s.provider_id ?? s.service_id ?? s.external_id ?? s.id ?? '-')}</td>
              <td><strong>${s.name}</strong></td>
              <td>${formatCurrency(s.api_rate||0)}</td>
              <td style="color:var(--primary-light);font-weight:600;">${formatCurrency(s.selling_price||0)}</td>
              <td style="color:var(--success);font-weight:600;">${formatCurrency(s.profit_per_1000||0)}</td>
              <td>${s.min_order||0}</td>
              <td>${(s.max_order||0).toLocaleString()}</td>
              <td>${status}</td>
              <td>
                <button class="btn btn-xs btn-info" onclick="editService(${s.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-xs ${s.is_active?'btn-danger':'btn-success'}" onclick="toggleService(${s.id})">${s.is_active?'<i class="fas fa-ban"></i>':'<i class="fas fa-check"></i>'}</button>
                <button class="btn btn-xs btn-danger" onclick="deleteService(${s.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>`;
            });
            html += `</tbody></table></div></div>`;
          }
        });
        container.innerHTML = html || '<div style="text-align:center;padding:30px;">No services</div>';
      } catch (e) { console.warn('loadServices error:', e); }
    }

    async function toggleService(id){
      try{const s=appData.services.find(x=>x.id===id);if(!s){showToast('error','Error','Service not found');return;}
        const next=s.is_active?0:1; const res=await safeApi('updateService',{id,field:'is_active',value:next},'POST');
        if(!res?.success){showToast('error','Failed',res?.error||res?.message||'Service update failed');return;}
        await refreshServerData(false); showToast(next?'success':'warning','Service Updated',s.name+' '+(next?'activated':'deactivated')); addActivity('Admin',s.name+' '+(next?'activated':'deactivated'));
      }catch(e){showToast('error','Error',e.message||'Failed to toggle service');}
    }
    function editService(id){
      try{const s=appData.services.find(x=>x.id===id);if(!s)return;document.getElementById('serviceModalTitle').textContent='✏️ Edit '+s.name;document.getElementById('serviceModalBody').innerHTML=`
        <div class="form-group"><label>Name</label><input type="text" id="editSvcName" value="${escapeHtml(s.name)}"></div>
        <div class="form-group"><label>Category</label><input type="text" id="editSvcCategory" value="${escapeHtml(s.category||'Others')}"></div>
        <div class="form-group"><label>API Rate</label><input type="number" id="editSvcApiRate" value="${s.api_rate||0}" step="0.01"></div>
        <div class="form-group"><label>Sell Price</label><input type="number" id="editSvcPrice" value="${s.selling_price||0}" step="0.01"></div>
        <div class="form-group"><label>Min Order</label><input type="number" id="editSvcMin" value="${s.min_order||0}"></div>
        <div class="form-group"><label>Max Order</label><input type="number" id="editSvcMax" value="${s.max_order||0}"></div>
        <button class="btn btn-success" onclick="saveServiceEdit(${id})"><i class="fas fa-save"></i> Save</button>`;document.getElementById('serviceModal').classList.add('active');}catch(e){showToast('error','Error','Could not edit service');}
    }
    async function saveServiceEdit(id){
      try{const vals={name:document.getElementById('editSvcName').value.trim(),category:document.getElementById('editSvcCategory').value.trim()||'Others',api_rate:parseFloat(document.getElementById('editSvcApiRate').value)||0,selling_price:parseFloat(document.getElementById('editSvcPrice').value)||0,min_order:parseInt(document.getElementById('editSvcMin').value)||0,max_order:parseInt(document.getElementById('editSvcMax').value)||0};
        if(!vals.name){showToast('warning','Invalid','Service name required');return;}
        for(const [field,value] of Object.entries(vals)){const res=await safeApi('updateService',{id,field,value},'POST');if(!res?.success)throw new Error(res?.error||res?.message||('Failed to update '+field));}
        closeModal('serviceModal'); await refreshServerData(false); showToast('success','Updated','Service updated on server.'); addActivity('Admin','Updated service #'+id);
      }catch(e){showToast('error','Error',e.message||'Failed to save service');}
    }
    async function deleteService(id){
      if(!confirm('Delete this service? It will be moved to server trash.'))return;
      try{const res=await safeApi('deleteService',{id},'POST');if(!res?.success){showToast('error','Failed',res?.error||res?.message||'Delete failed');return;}await refreshServerData(false);showToast('success','Deleted','Service deleted on server.');addActivity('Admin','Deleted service #'+id);}catch(e){showToast('error','Error',e.message||'Failed to delete service');}
    }
    function showAddServiceModal(){document.getElementById('serviceModalTitle').textContent='➕ Add Service';document.getElementById('serviceModalBody').innerHTML=`
      <div class="form-group"><label>Name</label><input type="text" id="addSvcName" placeholder="Instagram Followers"></div>
      <div class="form-group"><label>Category</label><input type="text" id="addSvcCategory" value="Instagram"></div>
      <div class="form-group"><label>API Rate</label><input type="number" id="addSvcApiRate" value="10" step="0.01"></div>
      <div class="form-group"><label>Sell Price</label><input type="number" id="addSvcPrice" value="50" step="0.01"></div>
      <div class="form-group"><label>Min Order</label><input type="number" id="addSvcMin" value="100"></div>
      <div class="form-group"><label>Max Order</label><input type="number" id="addSvcMax" value="100000"></div>
      <button class="btn btn-success" onclick="addService()">Add</button>`;document.getElementById('serviceModal').classList.add('active');}
    async function addService(){
      try{const data={name:document.getElementById('addSvcName').value.trim(),category:document.getElementById('addSvcCategory').value.trim()||'Others',api_rate:parseFloat(document.getElementById('addSvcApiRate').value)||0,selling_price:parseFloat(document.getElementById('addSvcPrice').value)||0,min_order:parseInt(document.getElementById('addSvcMin').value)||0,max_order:parseInt(document.getElementById('addSvcMax').value)||0};if(!data.name){showToast('warning','Invalid','Service name required');return;}const res=await safeApi('addService',data,'POST');if(!res?.success){showToast('error','Failed',res?.error||res?.message||'Add service failed');return;}closeModal('serviceModal');await refreshServerData(false);showToast('success','Added','Service added to server.');addActivity('Admin','Added service '+data.name);}catch(e){showToast('error','Error',e.message||'Failed to add service');}
    }
    async function syncServices(){
      if(window.__syncBusy){showToast('warning','Sync busy','A sync request is already running.');return;}window.__syncBusy=true;showToast('info','Sync started','Connecting to provider API…');
      try{const res=await safeApi('sync',{},'POST');if(!res?.success)throw new Error(res?.error||res?.message||'Sync failed');await refreshServerData(false);const count=appData.services.length;showToast('success','Sync complete',count+' services are now loaded from server.');addActivity('Admin','Synced services from provider');}catch(e){showToast('error','Sync failed',e.message||'Check API URL/API key/provider API.');}finally{window.__syncBusy=false;}
    }

    function bulkPriceUpdate() {
      document.getElementById('bulkPriceModal').classList.add('active');
    }

    async function applyBulkPrice() {
      try {
        const percent = parseFloat(document.getElementById('bulkPricePercent').value);
        const target = document.getElementById('bulkPriceTarget').value;
        if (!Number.isFinite(percent)) { showToast('warning', 'Invalid', 'Enter percentage'); return; }
        const services = appData.services || [];
        const filtered = target === 'all' ? services : services.filter(s => String(s.category||'').toLowerCase() === target.toLowerCase());
        if (!filtered.length) { showToast('warning', 'No services', 'No services found'); return; }
        showToast('info','Updating','Saving prices to server…');
        for (const svc of filtered) {
          const price = Math.round((Number(svc.selling_price||0) * (1 + percent / 100)) * 100) / 100;
          const profit = price - Number(svc.api_rate||0);
          const r = await safeApi('updateService',{id:svc.id,field:'selling_price',value:price},'POST');
          if(!r?.success) throw new Error(r?.error||r?.message||('Failed for service '+svc.id));
          const rp = await safeApi('updateService',{id:svc.id,field:'profit_per_1000',value:profit},'POST');
          if(!rp?.success) { /* legacy API may calculate profit automatically */ }
        }
        closeModal('bulkPriceModal');
        await refreshServerData(false);
        showToast('success', 'Applied', 'Price updated for ' + filtered.length + ' services');
        addActivity('Admin', 'Bulk price update ' + percent + '% on ' + target);
      } catch (e) { showToast('error', 'Error', e.message||'Failed to apply bulk price'); }
    }

    // ============================================================
    //  INBOX
    // ============================================================
    function loadInbox() {
      try {
        const messages = appData.messages || [];
        const container = document.getElementById('inboxContainer');
        const countEl = document.getElementById('inboxCount');
        if (countEl) countEl.textContent = '(' + messages.length + ' messages)';
        let html = '';
        messages.forEach(msg => {
          const user = appData.users.find(u => u.user_id === msg.user_id);
          const name = user ? user.first_name : 'Unknown';
          const avatar = name.charAt(0).toUpperCase();
          const isAdmin = msg.is_admin_reply ? 1 : 0;
          const source = msg.source === 'telegram' ? '📱 Telegram' : '📨 SMS';
          html += `<div class="inbox-message">
          <div class="avatar" style="background:${isAdmin?'var(--primary)':'var(--secondary)'};">${avatar}</div>
          <div class="content">
            <div class="header"><span class="name">${name}</span><span>${source} • ${new Date(msg.created_at).toLocaleString()}</span></div>
            <div class="text">${msg.message}</div>
            ${!isAdmin ? `<div class="reply-area"><input type="text" placeholder="Type reply..." id="replyInput_${msg.id}"><button class="btn btn-xs btn-primary" onclick="sendInboxReply(${msg.id})">Reply</button></div>` : ''}
            ${msg.admin_reply ? `<div class="admin-reply">Admin: ${msg.admin_reply}</div>` : ''}
          </div>
        </div>`;
        });
        container.innerHTML = html || '<div style="text-align:center;padding:30px;">No messages</div>';
        updateBadges();
      } catch (e) { console.warn('loadInbox error:', e); }
    }

    function sendInboxReply(id) {
      try {
        const input = document.getElementById('replyInput_' + id);
        if (!input) return;
        const reply = input.value.trim();
        if (!reply) { showToast('warning', 'Empty', 'Enter a reply'); return; }
        const msg = appData.messages.find(x => x.id === id);
        if (msg) {
          msg.admin_reply = reply;
          msg.is_admin_reply = 1;
          saveData();
          loadInbox();
          showToast('success', 'Replied', 'Reply sent');
          addActivity('Admin', 'Replied to inbox message');
        } else { showToast('error', 'Error', 'Message not found'); }
      } catch (e) { showToast('error', 'Error', 'Failed to send reply'); }
    }

    // ============================================================
    //  BROADCAST
    // ============================================================
    function loadBroadcastHistory() {
      try {
        const container = document.getElementById('broadcastHistory');
        let html = '';
        broadcastHistory.forEach(h => {
          html += `<tr>
          <td>${h.date}</td>
          <td>${h.channel||'Telegram'}</td>
          <td>${h.message}</td>
          <td>${h.recipients}</td>
          <td><span class="badge badge-${h.status==='Sent'?'success':'warning'}">${h.status||'Sent'}</span></td>
        </tr>`;
        });
        container.innerHTML = html || '<tr><td colspan="5" style="text-align:center;padding:20px;">No history yet</td></tr>';
      } catch (e) { /* ignore */ }
    }

    function sendBroadcast() {
      const message = document.getElementById('broadcastMessage').value;
      const target = document.getElementById('broadcastTarget').value;
      const channel = document.getElementById('broadcastChannel').value;
      const statusDiv = document.getElementById('broadcastStatus');
      if (!message.trim()) {
        statusDiv.innerHTML = '<div style="color:var(--danger);padding:12px;">❌ Enter message</div>';
        return;
      }
      statusDiv.innerHTML = '<div style="color:var(--info);padding:12px;">📤 Sending...</div>';
      let recipients = appData.users.length;
      if (target === 'vip') recipients = appData.users.filter(u => u.is_vip).length;
      if (target === 'inactive') recipients = appData.users.filter(u => {
        if (!u.last_active) return true;
        const days = (Date.now() - new Date(u.last_active).getTime()) / (1000 * 60 * 60 * 24);
        return days > 30;
      }).length;
      safeApi('broadcast', { message: message, channel: channel, target: target }, 'POST').then(res => {
        if (res.success) {
          broadcastHistory.unshift({
            date: new Date().toLocaleString(),
            channel: channel,
            message: message.substring(0, 30) + '...',
            recipients: recipients,
            status: 'Sent'
          });
          saveData();
          loadBroadcastHistory();
          statusDiv.innerHTML = '<div style="color:var(--success);padding:12px;">✅ Broadcast sent to ' + recipients +
            ' users!</div>';
          document.getElementById('broadcastMessage').value = '';
          showToast('success', 'Broadcast Sent', 'Sent to ' + recipients + ' users');
          addActivity('Admin', 'Broadcast sent via ' + channel + ' to ' + recipients + ' users');
        } else {
          statusDiv.innerHTML = '<div style="color:var(--danger);padding:12px;">❌ Failed: ' + (res.message ||
            'Unknown error') + '</div>';
          showToast('error', 'Failed', res.message || 'Broadcast failed');
        }
      }).catch(() => {
        statusDiv.innerHTML = '<div style="color:var(--danger);padding:12px;">❌ Network error!</div>';
        showToast('error', 'Error', 'Network error');
      });
    }

    // ============================================================
    //  SUPPORT TICKETS
    // ============================================================
    function loadTickets() {
      try {
        const tickets = appData.tickets || [];
        const list = document.getElementById('ticketsList');
        let html = '';
        tickets.forEach(t => {
          const user = appData.users.find(u => u.user_id === t.user_id);
          const name = user ? user.first_name : 'Unknown';
          const isOpen = t.status === 'open';
          html += `<tr>
          <td><span class="badge badge-primary">#${t.id}</span></td>
          <td><strong>${name}</strong><br><span style="font-size:10px;color:var(--text-muted);">${t.user_id}</span></td>
          <td>${t.subject||'No subject'}</td>
          <td style="max-width:150px;word-wrap:break-word;">${(t.message||'').substring(0,50)}...</td>
          <td><span class="badge ${isOpen?'badge-warning':'badge-success'}">${t.status}</span></td>
          <td style="font-size:12px;color:var(--text-secondary);">${t.created_at||'-'}</td>
          <td>${isOpen ? `<button class="btn btn-xs btn-primary" onclick="showReplyTicket(${t.id})"><i class="fas fa-reply"></i> Reply</button>` : '<span class="badge badge-info">Resolved</span>'}</td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="7" style="text-align:center;padding:30px;">No tickets</td></tr>';
        updateBadges();
      } catch (e) { console.warn('loadTickets error:', e); }
    }

    function showReplyTicket(id) {
      try {
        const t = appData.tickets.find(x => x.id === id);
        if (!t) return;
        document.getElementById('ticketModalTitle').textContent = '📩 Reply to Ticket #' + id;
        document.getElementById('ticketModalBody').innerHTML = `
        <div style="background:rgba(255,255,255,0.03);padding:15px;border-radius:8px;margin-bottom:15px;">
          <p><strong>User:</strong> ${t.user_id}</p>
          <p><strong>Subject:</strong> ${t.subject||'No subject'}</p>
          <p><strong>Message:</strong> ${t.message}</p>
        </div>
        <div class="form-group"><label>Reply</label><textarea id="ticketReply" rows="4" placeholder="Type reply..."></textarea></div>
        <button class="btn btn-success" onclick="replyTicket(${id})">Send Reply</button>
      `;
        document.getElementById('ticketModal').classList.add('active');
      } catch (e) { showToast('error', 'Error', 'Could not load ticket'); }
    }

    function replyTicket(id) {
      try {
        const reply = document.getElementById('ticketReply').value;
        if (!reply) { showToast('warning', 'Empty', 'Enter reply'); return; }
        const t = appData.tickets.find(x => x.id === id);
        if (t && t.status === 'open') {
          t.status = 'resolved';
          t.admin_reply = reply;
          t.resolved_at = new Date().toISOString();
          saveData();
          closeModal('ticketModal');
          loadTickets();
          showToast('success', 'Replied', 'Ticket #' + id + ' resolved');
          addActivity('Admin', 'Replied to ticket #' + id);
        } else { showToast('error', 'Error', 'Ticket not found or already resolved'); }
      } catch (e) { showToast('error', 'Error', 'Failed to reply'); }
    }

    // ============================================================
    //  TRASH
    // ============================================================
    function loadTrash() {
      try {
        const trash = appData.trash || [];
        const list = document.getElementById('trashList');
        let html = '';
        trash.forEach(item => {
          html += `<tr>
          <td><span class="badge ${item.type==='user'?'badge-primary':'badge-info'}">${item.type}</span></td>
          <td>${item.name||item.ref_id}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${item.deleted_at||'-'}</td>
          <td><button class="btn btn-xs btn-success" onclick="restoreItem(${item.id})"><i class="fas fa-undo"></i> Restore</button></td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;">Trash empty</td></tr>';
        updateBadges();
      } catch (e) { console.warn('loadTrash error:', e); }
    }

    function restoreItem(id) {
      try {
        const idx = appData.trash.findIndex(x => x.id === id);
        if (idx !== -1) {
          appData.trash.splice(idx, 1);
          saveData();
          loadTrash();
          showToast('success', 'Restored', 'Item removed from trash');
          addActivity('Admin', 'Restored item from trash');
        } else { showToast('error', 'Error', 'Item not found'); }
      } catch (e) { showToast('error', 'Error', 'Failed to restore'); }
    }

    // ============================================================
    //  API LOGS
    // ============================================================
    function loadApiLogs() {
      try {
        const logs = appData.apiLogs || [];
        const list = document.getElementById('apiLogsList');
        let html = '';
        logs.forEach(log => {
          html += `<tr>
          <td><span class="badge badge-primary">#${log.id}</span></td>
          <td><code style="font-size:11px;">${log.action||'N/A'}</code></td>
          <td style="color:var(--danger);">${log.error||'N/A'}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${log.created_at||'-'}</td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;">No logs</td></tr>';
      } catch (e) { console.warn('loadApiLogs error:', e); }
    }

    function clearApiLogs() {
      if (!confirm('Clear all API logs?')) return;
      appData.apiLogs = [];
      saveData();
      loadApiLogs();
      showToast('success', 'Cleared', 'Logs cleared');
      addActivity('Admin', 'Cleared API logs');
    }

    // ============================================================
    //  REFERRALS
    // ============================================================
    function loadReferrals() {
      try {
        const users = appData.users || [];
        const sorted = users.filter(u => u.referrals && u.referrals > 0).sort((a, b) => (b.referrals || 0) - (a
        .referrals || 0));
        const list = document.getElementById('referralsList');
        let html = '';
        sorted.forEach((r, i) => {
          html += `<tr>
          <td>#${i+1}</td>
          <td><strong>${r.first_name||'Unknown'}</strong><br><span style="font-size:10px;color:var(--text-muted);">@${r.username||'N/A'}</span></td>
          <td><span class="badge badge-info">${r.referrals||0}</span></td>
          <td style="color:var(--gold);font-weight:600;">${formatCurrency(r.earned||0)}</td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;">No referrals</td></tr>';
      } catch (e) { console.warn('loadReferrals error:', e); }
    }

    // ============================================================
    //  BLACKLIST
    // ============================================================
    function loadBlacklist() {
      try {
        const list = document.getElementById('blacklistList');
        if (!list) return;
        let html = '';
        blacklist.forEach(item => {
          html += `<tr>
          <td><strong>${item.number}</strong></td>
          <td><span class="badge badge-info">${item.type||'mobile'}</span></td>
          <td style="font-size:12px;color:var(--text-secondary);">${item.added_at||new Date().toLocaleString()}</td>
          <td><button class="btn btn-xs btn-danger" onclick="deleteBlacklist(${item.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;">No numbers in blacklist</td></tr>';
      } catch (e) { console.warn('loadBlacklist error:', e); }
    }

    function showAddBlacklistModal() {
      document.getElementById('blacklistModalTitle').textContent = '🚫 Add to Blacklist';
      document.getElementById('blacklistModalBody').innerHTML = `
        <div class="form-group"><label>Number</label><input type="text" id="blacklistNumber" placeholder="+919876543210"></div>
        <div class="form-group"><label>Type</label><select id="blacklistType"><option value="mobile">Mobile</option><option value="email">Email</option></select></div>
        <button class="btn btn-danger" onclick="addBlacklist()"><i class="fas fa-plus"></i> Add</button>
      `;
      document.getElementById('blacklistModal').classList.add('active');
    }

    function addBlacklist() {
      try {
        const number = document.getElementById('blacklistNumber').value.trim();
        const type = document.getElementById('blacklistType').value;
        if (!number) { showToast('warning', 'Invalid', 'Enter a number'); return; }
        blacklist.push({ id: Date.now(), number: number, type: type, added_at: new Date().toLocaleString() });
        saveData();
        loadBlacklist();
        closeModal('blacklistModal');
        showToast('success', 'Added', 'Number blacklisted');
        addActivity('Admin', 'Blacklisted ' + number);
      } catch (e) { showToast('error', 'Error', 'Failed to add'); }
    }

    function deleteBlacklist(id) {
      if (!confirm('Remove from blacklist?')) return;
      blacklist = blacklist.filter(item => item.id !== id);
      saveData();
      loadBlacklist();
      showToast('success', 'Removed', 'Number removed from blacklist');
      addActivity('Admin', 'Removed from blacklist');
    }

    // ============================================================
    //  WHITELIST
    // ============================================================
    function loadWhitelist() {
      try {
        const list = document.getElementById('whitelistList');
        if (!list) return;
        let html = '';
        whitelist.forEach(item => {
          html += `<tr>
          <td><strong>${item.chat_id}</strong></td>
          <td style="font-size:12px;color:var(--text-secondary);">${item.added_at||new Date().toLocaleString()}</td>
          <td><button class="btn btn-xs btn-danger" onclick="deleteWhitelist(${item.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="3" style="text-align:center;padding:30px;">No chat IDs in whitelist</td></tr>';
      } catch (e) { console.warn('loadWhitelist error:', e); }
    }

    function showAddWhitelistModal() {
      document.getElementById('whitelistModalTitle').textContent = '✅ Add to Whitelist';
      document.getElementById('whitelistModalBody').innerHTML = `
        <div class="form-group"><label>Chat ID</label><input type="text" id="whitelistChatId" placeholder="-100123456789"></div>
        <button class="btn btn-success" onclick="addWhitelist()"><i class="fas fa-plus"></i> Add</button>
      `;
      document.getElementById('whitelistModal').classList.add('active');
    }

    function addWhitelist() {
      try {
        const chatId = document.getElementById('whitelistChatId').value.trim();
        if (!chatId) { showToast('warning', 'Invalid', 'Enter a chat ID'); return; }
        whitelist.push({ id: Date.now(), chat_id: chatId, added_at: new Date().toLocaleString() });
        saveData();
        loadWhitelist();
        closeModal('whitelistModal');
        showToast('success', 'Added', 'Chat ID whitelisted');
        addActivity('Admin', 'Whitelisted ' + chatId);
      } catch (e) { showToast('error', 'Error', 'Failed to add'); }
    }

    function deleteWhitelist(id) {
      if (!confirm('Remove from whitelist?')) return;
      whitelist = whitelist.filter(item => item.id !== id);
      saveData();
      loadWhitelist();
      showToast('success', 'Removed', 'Chat ID removed from whitelist');
      addActivity('Admin', 'Removed from whitelist');
    }

    // ============================================================
    //  FAQ
    // ============================================================
    function loadFaq() {
      try {
        const list = document.getElementById('faqList');
        if (!list) return;
        let html = '';
        faqs.forEach(item => {
          html += `<tr>
          <td><span class="badge badge-info">${item.keywords}</span></td>
          <td>${item.answer}</td>
          <td>
            <button class="btn btn-xs btn-info" onclick="editFaq(${item.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-xs btn-danger" onclick="deleteFaq(${item.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="3" style="text-align:center;padding:30px;">No FAQs</td></tr>';
      } catch (e) { console.warn('loadFaq error:', e); }
    }

    function showAddFaqModal() {
      document.getElementById('faqModalTitle').textContent = '❓ Add FAQ';
      document.getElementById('faqModalBody').innerHTML = `
        <div class="form-group"><label>Keywords (comma separated)</label><input type="text" id="faqKeywords" placeholder="payment, help"></div>
        <div class="form-group"><label>Answer</label><textarea id="faqAnswer" rows="3" placeholder="Type answer..."></textarea></div>
        <button class="btn btn-success" onclick="addFaq()"><i class="fas fa-plus"></i> Add</button>
      `;
      document.getElementById('faqModal').classList.add('active');
    }

    function addFaq() {
      try {
        const keywords = document.getElementById('faqKeywords').value.trim();
        const answer = document.getElementById('faqAnswer').value.trim();
        if (!keywords || !answer) { showToast('warning', 'Invalid', 'Fill all fields'); return; }
        faqs.push({ id: Date.now(), keywords: keywords, answer: answer, created_at: new Date().toLocaleString() });
        saveData();
        loadFaq();
        closeModal('faqModal');
        showToast('success', 'Added', 'FAQ added');
        addActivity('Admin', 'Added FAQ');
      } catch (e) { showToast('error', 'Error', 'Failed to add FAQ'); }
    }

    function editFaq(id) {
      try {
        const item = faqs.find(x => x.id === id);
        if (!item) return;
        document.getElementById('faqModalTitle').textContent = '✏️ Edit FAQ';
        document.getElementById('faqModalBody').innerHTML = `
        <div class="form-group"><label>Keywords</label><input type="text" id="faqKeywords" value="${item.keywords}"></div>
        <div class="form-group"><label>Answer</label><textarea id="faqAnswer" rows="3">${item.answer}</textarea></div>
        <button class="btn btn-success" onclick="saveFaqEdit(${id})"><i class="fas fa-save"></i> Save</button>
      `;
        document.getElementById('faqModal').classList.add('active');
      } catch (e) { showToast('error', 'Error', 'Could not edit FAQ'); }
    }

    function saveFaqEdit(id) {
      try {
        const item = faqs.find(x => x.id === id);
        if (!item) return;
        item.keywords = document.getElementById('faqKeywords').value.trim();
        item.answer = document.getElementById('faqAnswer').value.trim();
        saveData();
        loadFaq();
        closeModal('faqModal');
        showToast('success', 'Updated', 'FAQ updated');
        addActivity('Admin', 'Updated FAQ');
      } catch (e) { showToast('error', 'Error', 'Failed to save FAQ'); }
    }

    function deleteFaq(id) {
      if (!confirm('Delete this FAQ?')) return;
      faqs = faqs.filter(item => item.id !== id);
      saveData();
      loadFaq();
      showToast('success', 'Deleted', 'FAQ deleted');
      addActivity('Admin', 'Deleted FAQ');
    }

    // ============================================================
    //  CAMPAIGNS
    // ============================================================
    function loadCampaigns() {
      try {
        const list = document.getElementById('campaignList');
        if (!list) return;
        let html = '';
        campaigns.forEach(item => {
          const status = item.is_active ? '<span class="badge badge-success">Active</span>' :
            '<span class="badge badge-danger">Inactive</span>';
          html += `<tr>
          <td><strong>${item.title}</strong></td>
          <td>${item.description||''}</td>
          <td>${item.click_count||0}</td>
          <td>${item.max_clicks||'∞'}</td>
          <td>${status}</td>
          <td>
            <button class="btn btn-xs ${item.is_active?'btn-warning':'btn-success'}" onclick="toggleCampaign(${item.id})">${item.is_active?'Deactivate':'Activate'}</button>
            <button class="btn btn-xs btn-danger" onclick="deleteCampaign(${item.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:30px;">No campaigns</td></tr>';
      } catch (e) { console.warn('loadCampaigns error:', e); }
    }

    function showAddCampaignModal() {
      document.getElementById('campaignModalTitle').textContent = '📢 Create Campaign';
      document.getElementById('campaignModalBody').innerHTML = `
        <div class="form-group"><label>Title</label><input type="text" id="campaignTitle" placeholder="Summer Sale"></div>
        <div class="form-group"><label>Description</label><textarea id="campaignDesc" rows="2" placeholder="Description..."></textarea></div>
        <div class="form-group"><label>Button Text</label><input type="text" id="campaignBtnText" value="Claim Now"></div>
        <div class="form-group"><label>URL</label><input type="text" id="campaignUrl" placeholder="https://..."></div>
        <div class="form-group"><label>Photo File ID (optional)</label><input type="text" id="campaignPhoto" placeholder="file_id"></div>
        <div class="form-group"><label>Credits (bonus)</label><input type="number" id="campaignCredits" value="0"></div>
        <div class="form-group"><label>Max Clicks</label><input type="number" id="campaignMaxClicks" value="0"></div>
        <button class="btn btn-success" onclick="addCampaign()"><i class="fas fa-plus"></i> Create</button>
      `;
      document.getElementById('campaignModal').classList.add('active');
    }

    function addCampaign() {
      try {
        const title = document.getElementById('campaignTitle').value.trim();
        const desc = document.getElementById('campaignDesc').value.trim();
        const btnText = document.getElementById('campaignBtnText').value.trim();
        const url = document.getElementById('campaignUrl').value.trim();
        const photo = document.getElementById('campaignPhoto').value.trim();
        const credits = parseInt(document.getElementById('campaignCredits').value) || 0;
        const maxClicks = parseInt(document.getElementById('campaignMaxClicks').value) || 0;
        if (!title) { showToast('warning', 'Invalid', 'Enter title'); return; }
        campaigns.push({
          id: Date.now(),
          title: title,
          description: desc,
          button_text: btnText || 'Claim Now',
          url: url || '',
          photo_file_id: photo || '',
          credits: credits,
          max_clicks: maxClicks,
          click_count: 0,
          is_active: 1,
          created_at: new Date().toLocaleString()
        });
        saveData();
        loadCampaigns();
        closeModal('campaignModal');
        showToast('success', 'Created', 'Campaign created');
        addActivity('Admin', 'Created campaign: ' + title);
      } catch (e) { showToast('error', 'Error', 'Failed to create campaign'); }
    }

    function toggleCampaign(id) {
      try {
        const item = campaigns.find(x => x.id === id);
        if (item) {
          item.is_active = item.is_active ? 0 : 1;
          saveData();
          loadCampaigns();
          showToast('info', 'Toggled', 'Campaign ' + (item.is_active ? 'activated' : 'deactivated'));
          addActivity('Admin', 'Toggled campaign ' + item.title);
        }
      } catch (e) { showToast('error', 'Error', 'Failed to toggle campaign'); }
    }

    function deleteCampaign(id) {
      if (!confirm('Delete this campaign?')) return;
      campaigns = campaigns.filter(item => item.id !== id);
      saveData();
      loadCampaigns();
      showToast('success', 'Deleted', 'Campaign deleted');
      addActivity('Admin', 'Deleted campaign');
    }

    // ============================================================
    //  QR FUNCTIONS
    // ============================================================
    function generateQR() {
      const qrContainer = document.getElementById('qrcode');
      if (!qrContainer) return;
      qrContainer.innerHTML = '';
      try {
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrContainer, {
            text: 'https://t.me/biharismmpannel_bot',
            width: 200,
            height: 200,
            colorDark: '#6C3CE1',
            colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      } catch (e) { /* ignore */ }
    }

    function downloadQR() {
      const canvas = document.querySelector('#qrcode canvas');
      if (canvas) {
        const a = document.createElement('a');
        a.download = 'bihari_smm_qr.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        showToast('success', 'Downloaded', 'QR downloaded');
      }
    }

    function loadQRDisplay() {
      const saved = localStorage.getItem('bihari_qr_image');
      if (saved) { qrImageData = saved;
        showQRImage(saved); } else { generatePaymentQR(); }
    }

    function showQRImage(url) {
      const container = document.getElementById('paymentQRDisplay');
      if (!container) return;
      container.innerHTML =
        `<img src="${url}" style="max-width:250px;max-height:250px;border-radius:var(--radius-sm);border:1px solid var(--glass-border);" alt="Payment QR">`;
    }

    function generatePaymentQR() {
      const container = document.getElementById('paymentQRDisplay');
      if (!container) return;
      container.innerHTML = '';
      try {
        if (typeof QRCode !== 'undefined') {
          new QRCode(container, {
            text: 'upi://pay?pa=code-breakerkumar@fam&pn=Bihari%20SMM&cu=INR',
            width: 250,
            height: 250,
            colorDark: '#6C3CE1',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
        }
      } catch (e) { /* ignore */ }
    }

    function refreshQR() { loadQRDisplay();
      showToast('info', 'Refreshed', 'QR updated'); }

    function downloadPaymentQR() {
      const img = document.querySelector('#paymentQRDisplay img');
      if (img) {
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'payment_qr.png';
        a.click();
        showToast('success', 'Downloaded', 'QR downloaded');
      } else {
        const canvas = document.querySelector('#paymentQRDisplay canvas');
        if (canvas) {
          const a = document.createElement('a');
          a.download = 'payment_qr.png';
          a.href = canvas.toDataURL('image/png');
          a.click();
          showToast('success', 'Downloaded', 'QR downloaded');
        } else {
          showToast('warning', 'No QR', 'Please upload or generate QR first');
        }
      }
    }

    function uploadQR() {
      const fileInput = document.getElementById('qrFileInput');
      const file = fileInput.files[0];
      if (!file) { showToast('warning', 'No file', 'Please select an image'); return; }
      if (!file.type.startsWith('image/')) { showToast('error', 'Invalid', 'Please select an image file'); return; }
      const formData = new FormData();
      formData.append('qr_image', file);
      formData.append('action', 'uploadQR');
      formData.append('api_key', API_KEY);
      fetch(API_BASE_URL, { method: 'POST', body: formData, headers: { 'X-API-Key': API_KEY } })
        .then(response => response.json())
        .then(res => {
          if (res.success) {
            localStorage.setItem('bihari_qr_image', res.url);
            qrImageData = res.url;
            showQRImage(res.url);
            document.getElementById('qrUploadStatus').innerHTML =
            '<span style="color:var(--success);">✅ QR uploaded successfully!</span>';
            showToast('success', 'QR Uploaded', 'QR code updated');
            addActivity('Admin', 'Uploaded new QR code');
          } else { showToast('error', 'Upload Failed', res.error || 'Unknown error'); }
        })
        .catch(err => { showToast('error', 'Error', 'Network error');
          console.error(err); });
    }

    function copyUPI() {
      const upi = document.getElementById('upiDisplay').textContent;
      navigator.clipboard.writeText(upi).then(() => showToast('success', 'Copied!', 'UPI copied'));
    }

    function selectPaymentMethod(method) {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
      document.querySelector(`.payment-method-card[onclick*="${method}"]`).classList.add('active');
      let details = '';
      if (method === 'upi') details = 'code-breakerkumar@fam';
      else if (method === 'paytm') details = '9876543210';
      else if (method === 'bank') details = 'Account: 1234567890\nIFSC: SBIN0001234\nBank: SBI';
      document.getElementById('paymentDetailInput').value = details;
    }

    function savePaymentDetails() {
      const details = document.getElementById('paymentDetailInput').value;
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      settings.payment_details = details;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      showToast('success', 'Saved!', 'Payment details updated');
      addActivity('Admin', 'Updated payment details');
    }

    function loadQRPayment() {
      try {
        const payments = appData.payments || [];
        const recent = payments.slice(-5).reverse();
        const container = document.getElementById('recentPayments');
        if (!container) return;
        const labels = { approved: 'success', pending: 'warning', rejected: 'danger' };
        let html = '';
        recent.forEach(p => {
          const user = appData.users.find(u => u.user_id === p.user_id);
          const name = user ? user.first_name : 'Unknown';
          const cls = p.status || 'pending';
          html += `<tr>
          <td><span class="badge badge-primary">#${p.id}</span></td>
          <td><strong>${name}</strong></td>
          <td style="color:var(--success);font-weight:600;">${formatCurrency(p.amount||0)}</td>
          <td><code style="color:var(--text-secondary);font-size:11px;">${p.utr||'-'}</code></td>
          <td><span class="badge badge-${labels[cls]||'info'}">${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></td>
          <td style="font-size:12px;color:var(--text-secondary);">${p.created_at||'-'}</td>
        </tr>`;
        });
        container.innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:20px;">No recent payments</td></tr>';
      } catch (e) { console.warn('loadQRPayment error:', e); }
    }

    // ============================================================
    //  LEADERBOARD
    // ============================================================
    function loadLeaderboard() {
      try {
        const users = appData.users || [];
        const sorted = [...users].sort((a, b) => (b.balance || 0) - (a.balance || 0));
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        const medals = ['🥇', '🥈', '🥉'];
        let html = '';
        sorted.slice(0, 10).forEach((u, i) => {
          const medal = i < 3 ? medals[i] : '#' + (i + 1);
          html += `<tr>
          <td style="font-size:20px;">${medal}</td>
          <td><strong>${u.first_name} ${u.last_name||''}</strong><br><span style="font-size:11px;color:var(--text-muted);">@${u.username||'N/A'}</span></td>
          <td style="color:var(--success);font-weight:600;">${formatCurrency(u.balance||0)}</td>
          <td><span class="badge badge-info">${u.total_orders||0}</span></td>
          <td>${formatCurrency(u.total_spent||0)}</td>
          <td>${u.referrals||0}</td>
        </tr>`;
        });
        container.innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:30px;">No users</td></tr>';
      } catch (e) { console.warn('loadLeaderboard error:', e); }
    }

    // ============================================================
    //  ACTIVITY LOG
    // ============================================================
    function loadActivity() {
      try {
        const container = document.getElementById('activityLog');
        let html = '';
        activityLog.slice().reverse().forEach(a => {
          html += `<div class="activity-item">
          <div class="icon" style="background:${a.color||'var(--glass-border)'};color:var(--text-primary);"><i class="fas ${a.icon||'fa-circle'}"></i></div>
          <div class="content">
            <div class="text"><strong>${a.user||'System'}</strong> ${a.action||'Did something'}</div>
            <div class="time">${a.time||new Date().toLocaleString()}</div>
          </div>
        </div>`;
        });
        container.innerHTML = html || '<div style="text-align:center;padding:30px;">No activity</div>';
      } catch (e) { console.warn('loadActivity error:', e); }
    }

    function clearActivity() {
      if (confirm('Clear activity log?')) { activityLog = [];
        saveData();
        loadActivity();
        showToast('success', 'Cleared', 'Activity cleared'); }
    }

    // ============================================================
    //  BACKUP
    // ============================================================
    function loadBackupHistory() {
      try {
        const container = document.getElementById('backupHistory');
        let html = '';
        backupHistory.slice(0, 10).forEach((b, i) => {
          html += `<tr>
          <td>#${i+1}</td>
          <td>${b.file||'backup.json'}</td>
          <td>${b.size||'0 KB'}</td>
          <td>${b.date||new Date().toLocaleString()}</td>
        </tr>`;
        });
        container.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:20px;">No backups found</td></tr>';
      } catch (e) { console.warn('loadBackupHistory error:', e); }
    }

    function createBackup() {
      showToast('info', 'Creating backup...', 'Please wait');
      safeApi('createBackup', { format: 'json' }, 'GET').then(res => {
        if (res.success) {
          backupHistory.unshift({ file: res.filename, size: (res.size / 1024).toFixed(1) + ' KB',
            date: new Date().toLocaleString() });
          saveData();
          loadBackupHistory();
          showToast('success', 'Backup Created', 'Downloading...');
          if (res.file) window.open(res.file, '_blank');
          addActivity('Admin', 'Created backup');
        } else { showToast('error', 'Failed', res.error || 'Backup failed'); }
      }).catch(() => showToast('error', 'Error', 'Network error'));
    }

    function restoreBackup() {
      const fileInput = document.getElementById('restoreFileInput');
      const file = fileInput.files[0];
      if (!file) { showToast('warning', 'No file', 'Please select a backup file'); return; }
      if (!confirm('Restore this backup? Current data will be replaced.')) return;
      const formData = new FormData();
      formData.append('backup_file', file);
      formData.append('action', 'restoreBackup');
      formData.append('api_key', API_KEY);
      showToast('info', 'Restoring...', 'Please wait');
      fetch(API_BASE_URL, { method: 'POST', body: formData, headers: { 'X-API-Key': API_KEY } })
        .then(response => response.json())
        .then(res => {
          if (res.success) { renderAll();
            showToast('success', 'Restored', 'Backup restored successfully!');
            addActivity('Admin', 'Restored from backup');
            document.getElementById('restoreStatus').innerHTML =
            '<span style="color:var(--success);">✅ Restore successful!</span>'; } else {
            showToast('error', 'Failed', res.error || 'Restore failed');
            document.getElementById('restoreStatus').innerHTML = '<span style="color:var(--danger);">❌ ' + (res
              .error || 'Restore failed') + '</span>'; }
        })
        .catch(err => { showToast('error', 'Error', 'Network error');
          console.error(err); });
    }

    // ============================================================
    //  PROFITS
    // ============================================================
    function loadProfits() {
      try {
        let profits = JSON.parse(localStorage.getItem('bihari_profits') || '[]');
        if (profits.length === 0) {
          profits = [
            { id: 1, category: 'Instagram', subcategory: 'Followers', profit_per_1000: 30 },
            { id: 2, category: 'Instagram', subcategory: 'Likes', profit_per_1000: 14 },
            { id: 3, category: 'YouTube', subcategory: 'Subscribers', profit_per_1000: 30 },
            { id: 4, category: 'YouTube', subcategory: 'Views', profit_per_1000: 15 },
            { id: 5, category: 'Facebook', subcategory: 'Page Likes', profit_per_1000: 20 }
          ];
          localStorage.setItem('bihari_profits', JSON.stringify(profits));
        }
        appData.profits = profits;
        const list = document.getElementById('profitsList');
        if (!list) return;
        let html = '';
        profits.forEach(p => {
          html += `<tr>
          <td><strong>${p.category}</strong></td>
          <td>${p.subcategory||'—'}</td>
          <td style="color:var(--gold);font-weight:600;">${formatCurrency(p.profit_per_1000)}</td>
          <td>
            <button class="btn btn-xs btn-info" onclick="editProfit(${p.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-xs btn-danger" onclick="deleteProfit(${p.id})"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
        });
        list.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;">No profit settings</td></tr>';
      } catch (e) { console.warn('loadProfits error:', e); }
    }

    function showAddProfitModal() {
      document.getElementById('profitModalTitle').textContent = '➕ Add Profit Setting';
      document.getElementById('profitModalBody').innerHTML = `
        <div class="form-group"><label>Category</label><input type="text" id="profitCategory" placeholder="Instagram"></div>
        <div class="form-group"><label>Subcategory (optional)</label><input type="text" id="profitSubcategory" placeholder="Followers"></div>
        <div class="form-group"><label>Profit per 1000 (₹)</label><input type="number" id="profitAmount" value="0" step="0.01"></div>
        <button class="btn btn-success" onclick="addProfit()"><i class="fas fa-plus"></i> Add</button>
      `;
      document.getElementById('profitModal').classList.add('active');
    }

    function addProfit() {
      try {
        const category = document.getElementById('profitCategory').value.trim();
        const subcategory = document.getElementById('profitSubcategory').value.trim();
        const profit = parseFloat(document.getElementById('profitAmount').value);
        if (!category || profit < 0) { showToast('warning', 'Invalid', 'Enter valid data'); return; }
        const newProfit = { id: Date.now(), category: category, subcategory: subcategory || '',
          profit_per_1000: profit };
        appData.profits.push(newProfit);
        localStorage.setItem('bihari_profits', JSON.stringify(appData.profits));
        saveData();
        loadProfits();
        closeModal('profitModal');
        showToast('success', 'Added', 'Profit setting added');
        addActivity('Admin', 'Added profit setting for ' + category);
      } catch (e) { showToast('error', 'Error', 'Failed to add profit'); }
    }

    function editProfit(id) {
      try {
        const p = appData.profits.find(x => x.id === id);
        if (!p) return;
        document.getElementById('profitModalTitle').textContent = '✏️ Edit Profit';
        document.getElementById('profitModalBody').innerHTML = `
        <div class="form-group"><label>Category</label><input type="text" id="profitCategory" value="${p.category}"></div>
        <div class="form-group"><label>Subcategory</label><input type="text" id="profitSubcategory" value="${p.subcategory||''}"></div>
        <div class="form-group"><label>Profit per 1000 (₹)</label><input type="number" id="profitAmount" value="${p.profit_per_1000}" step="0.01"></div>
        <button class="btn btn-success" onclick="saveProfitEdit(${id})"><i class="fas fa-save"></i> Save</button>
      `;
        document.getElementById('profitModal').classList.add('active');
      } catch (e) { showToast('error', 'Error', 'Could not edit profit'); }
    }

    function saveProfitEdit(id) {
      try {
        const p = appData.profits.find(x => x.id === id);
        if (!p) return;
        p.category = document.getElementById('profitCategory').value.trim();
        p.subcategory = document.getElementById('profitSubcategory').value.trim();
        p.profit_per_1000 = parseFloat(document.getElementById('profitAmount').value) || 0;
        localStorage.setItem('bihari_profits', JSON.stringify(appData.profits));
        saveData();
        loadProfits();
        closeModal('profitModal');
        showToast('success', 'Updated', 'Profit setting updated');
        addActivity('Admin', 'Updated profit setting for ' + p.category);
      } catch (e) { showToast('error', 'Error', 'Failed to save profit'); }
    }

    function deleteProfit(id) {
      if (!confirm('Delete this profit setting?')) return;
      appData.profits = appData.profits.filter(x => x.id !== id);
      localStorage.setItem('bihari_profits', JSON.stringify(appData.profits));
      saveData();
      loadProfits();
      showToast('success', 'Deleted', 'Profit setting deleted');
      addActivity('Admin', 'Deleted profit setting');
    }

    // ============================================================
    //  SETTINGS
    // ============================================================
    function loadSettingsUI() {
      try {
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        document.getElementById('announcementSetting').value = settings.announcement || '';
        document.getElementById('refBonusSetting').value = settings.ref_bonus || 5;
        document.getElementById('signupBonusSetting').value = settings.signup_bonus || 3;
        document.getElementById('maintenanceSetting').value = settings.maintenance_mode || 0;
        document.getElementById('whitelistSetting').value = settings.whitelist_enabled || 0;
        document.getElementById('upiSetting').value = settings.upi_id || 'code-breakerkumar@fam';
        document.getElementById('paytmSetting').value = settings.paytm || '';
        document.getElementById('bankSetting').value = settings.bank_details ||
          'Account: 1234567890\nIFSC: SBIN0001234\nBank: SBI';
        document.getElementById('forceJoin1').value = settings.force_join_offers ? 'https://t.me/+' + settings
          .force_join_offers : 'https://t.me/+9aNes6okCnE5ZmE1';
        document.getElementById('forceJoin2').value = settings.force_join_support ? 'https://t.me/+' + settings
          .force_join_support : 'https://t.me/+7SFmz6Y6IvIzNTA1';
        document.getElementById('forceJoinWhatsapp').value = settings.force_join_whatsapp ||
          'https://whatsapp.com/channel/0029Va6kwbV0lwgx7gwx8G43';
        document.getElementById('ipWhitelist').value = settings.ip_whitelist || '';
        document.getElementById('defaultCurrency').value = settings.default_currency || 'INR';
        document.getElementById('adminPasswordSetting').value = '';
        const ap=document.getElementById('adminPasswordSetting'); if(ap){ap.placeholder='Server-managed password'; ap.disabled=true;}
        document.getElementById('upiDisplay').textContent = settings.upi_id || 'code-breakerkumar@fam';
        const apiUrlEl=document.getElementById('apiUrlSetting'); if(apiUrlEl)apiUrlEl.value=API_BASE_URL;
        const keyEl=document.getElementById('apiKeyStatus'); if(keyEl)keyEl.value='Server managed';
        const ar=document.getElementById('autoRefreshSetting'); if(ar)ar.value=localStorage.getItem('bihari_auto_refresh')||'120000';
        const accent=localStorage.getItem('bihari_accent')||'violet'; const ac=document.getElementById('accentThemeSetting'); if(ac)ac.value=accent; applyAccentTheme(accent); syncEffectControls();
      } catch (e) { console.warn('loadSettingsUI error:', e); }
    }

    async function saveServerSetting(key,value){const res=await safeApi('updateSetting',{key,value},'POST');if(!res?.success)throw new Error(res?.error||res?.message||('Failed to save '+key));}
    async function saveSettings(){
      try{const pwd='';const ip=document.getElementById('ipWhitelist').value;const currency=document.getElementById('defaultCurrency').value;const settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');settings.ip_whitelist=ip;settings.default_currency=currency;localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));const saves=[saveServerSetting('ip_whitelist',ip),saveServerSetting('default_currency',currency)];if(pwd)saves.push(saveServerSetting('admin_password',pwd));await Promise.all(saves);if(currency!==currentCurrency)changeCurrency(currency);await refreshServerData(false);showToast('success','Settings Saved','Security settings saved to server.');addActivity('Admin','Updated security settings');}catch(e){showToast('error','Error',e.message||'Failed to save settings');}
    }
    async function savePaymentSettings(){
      try{const vals={upi_id:document.getElementById('upiSetting').value.trim(),paytm:document.getElementById('paytmSetting').value.trim(),bank_details:document.getElementById('bankSetting').value};await Promise.all(Object.entries(vals).map(([k,v])=>saveServerSetting(k,v)));const settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');Object.assign(settings,vals);localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));await refreshServerData(false);showToast('success','Payment Settings Saved','Payment settings are live in Telegram bot.');addActivity('Admin','Updated payment settings');}catch(e){showToast('error','Error',e.message||'Failed to save payment settings');}
    }
    async function saveSystemSettings(){
      try{const vals={announcement:document.getElementById('announcementSetting').value,ref_bonus:document.getElementById('refBonusSetting').value,signup_bonus:document.getElementById('signupBonusSetting').value,maintenance_mode:document.getElementById('maintenanceSetting').value,whitelist_enabled:document.getElementById('whitelistSetting').value};await Promise.all(Object.entries(vals).map(([k,v])=>saveServerSetting(k,v)));await refreshServerData(false);document.getElementById('systemSettingsStatus').innerHTML='<span style="color:var(--success)">✅ Saved to server and Telegram bot.</span>';showToast('success','System Settings Saved','Changes are live for users.');addActivity('Admin','Updated system settings');}catch(e){showToast('error','Error',e.message||'Failed to save system settings');}
    }

    async function saveForceJoin(){
      try{const extractCode=url=>{if(!url)return '';const m=url.match(/\+([a-zA-Z0-9_-]+)/);return m?m[1]:url};const vals={force_join_offers:extractCode(document.getElementById('forceJoin1')?.value||''),force_join_support:extractCode(document.getElementById('forceJoin2')?.value||''),force_join_whatsapp:document.getElementById('forceJoinWhatsapp')?.value||''};await Promise.all(Object.entries(vals).map(([k,v])=>saveServerSetting(k,v)));await refreshServerData(false);const st=document.getElementById('forceJoinStatus');if(st)st.innerHTML='<span style="color:var(--success)">✅ Saved to server and Telegram bot.</span>';showToast('success','Saved','Force-join links updated live.');addActivity('Admin','Updated force join settings');}catch(e){showToast('error','Error',e.message||'Failed to save force join settings');}
    }

    // ============================================================
    //  SYSTEM COMMANDS
    // ============================================================
    function getUiSettings(){ try{return JSON.parse(localStorage.getItem('bihari_ui_settings')||'{}')}catch(e){return {}} }
    function saveUiSettings(patch){ const x=Object.assign(getUiSettings(),patch); localStorage.setItem('bihari_ui_settings',JSON.stringify(x)); return x; }
    function toggleInternetMode(){ const on=localStorage.getItem('bihari_internet_mode')!=='0'; localStorage.setItem('bihari_internet_mode',on?'0':'1'); syncEffectControls(); updateInternetStatus(); showToast(on?'warning':'success',on?'Offline Mode':'Online Mode',on?'API calls disabled; local features remain available.':'API calls enabled.'); }
    function updateInternetStatus(){ const el=document.getElementById('internetStatus'); if(!el)return; const on=localStorage.getItem('bihari_internet_mode')!=='0'; el.className='status-pill '+(on?'online':'offline'); el.innerHTML='<i class="fas fa-circle"></i> '+(on?'Internet/API Online':'Local / Offline'); const sw=document.getElementById('internetModeSwitch'); if(sw)sw.classList.toggle('on',on); }
    async function testApiConnection(){ const out=document.getElementById('apiTestResult'); if(out)out.textContent='Testing connection…'; const t=performance.now(); const res=await safeApi('botStatus',{},'GET'); const ok=!!res?.success; if(out)out.innerHTML=(ok?'✅ Connected':'❌ '+(res?.message||res?.error||'Connection failed'))+' <span style="opacity:.7">('+Math.round(performance.now()-t)+' ms)</span>'; updateInternetStatus(); }
    function clearApiCache(){ apiRequestCache.clear(); apiInFlight.clear(); showToast('success','Cache Cleared','API request cache cleared.'); }
    function toggleSettingsPassword(){ const x=document.getElementById('adminPasswordSetting'); if(x)x.type=x.type==='password'?'text':'password'; }
    function toggleLocalSetting(key){ const x=getUiSettings(); x[key]=!x[key]; saveUiSettings(x); }
    let idleLogoutTimer=null;
    function resetIdleLogoutTimer(){ clearTimeout(idleLogoutTimer); const x=getUiSettings(); if(!x.auto_logout)return; if(document.getElementById('adminPanel')?.style.display==='none')return; idleLogoutTimer=setTimeout(()=>{ if(document.getElementById('adminPanel')?.style.display!=='none'){ document.getElementById('loginPage').style.display='flex'; document.getElementById('adminPanel').style.display='none'; showToast('warning','Session Locked','You were logged out after inactivity.'); } },30*60*1000); }
    function initIdleLogout(){ ['click','keydown','mousemove','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,resetIdleLogoutTimer,{passive:true})); resetIdleLogoutTimer(); }

    function toggleStarEffect(){ const x=getUiSettings(); x.star_effect=x.star_effect===false?true:false; saveUiSettings(x); }
    function toggleParticles(){ const x=getUiSettings(); x.particles=x.particles===false?true:false; saveUiSettings(x); const wrap=document.getElementById('fxParticles'); if(wrap)wrap.style.display=x.particles===false?'none':''; }
    function syncEffectControls(){ const x=getUiSettings(); const vals=[['settingsSoundSwitch',soundEnabled],['starEffectSwitch',x.star_effect!==false],['particleSwitch',x.particles!==false],['autoLogoutSwitch',!!x.auto_logout]]; vals.forEach(([id,on])=>{const b=document.getElementById(id);if(b)b.classList.toggle('on',!!on)}); updateInternetStatus(); updateStorageStats(); }
    function applyAccentTheme(v){ const themes={violet:['#7c3aed','#06b6d4'],blue:['#2563eb','#8b5cf6'],green:['#10b981','#06b6d4'],pink:['#ec4899','#8b5cf6']}; const t=themes[v]||themes.violet; document.documentElement.style.setProperty('--accent-a',t[0]); document.documentElement.style.setProperty('--accent-b',t[1]); localStorage.setItem('bihari_accent',v); }
    function saveAutomationSettings(){ const v=document.getElementById('autoRefreshSetting')?.value||'120000'; localStorage.setItem('bihari_auto_refresh',v); scheduleAutoRefresh();showToast('success','Automation Saved','Refresh preference applied.'); }
    function updateStorageStats(){ const el=document.getElementById('storageStats'); if(!el)return; let bytes=0; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); bytes+=(k?.length||0)+(localStorage.getItem(k)?.length||0)} const kb=(bytes/1024).toFixed(1); el.innerHTML='<i class="fas fa-database"></i> Local storage: '+kb+' KB'; }
    function exportAdminData(){ const payload={version:APP_VERSION,exported_at:new Date().toISOString(),appData,activityLog,broadcastHistory,backupHistory,settings:JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'),profits:JSON.parse(localStorage.getItem('bihari_profits')||'[]'),blacklist:JSON.parse(localStorage.getItem(BLACKLIST_KEY)||'[]'),whitelist:JSON.parse(localStorage.getItem(WHITELIST_KEY)||'[]'),faq:JSON.parse(localStorage.getItem(FAQ_KEY)||'[]'),campaigns:JSON.parse(localStorage.getItem(CAMPAIGN_KEY)||'[]')}; const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bihari-smm-admin-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('success','Export Complete','Admin data exported as JSON.'); }
    function importAdminData(){ document.getElementById('importDataInput')?.click(); }
    function handleImportFile(input){ const file=input?.files?.[0]; if(!file)return; const r=new FileReader(); r.onload=()=>{try{const p=JSON.parse(r.result);if(!p||typeof p!=='object')throw Error('Invalid file'); if(p.appData)appData=p.appData;if(Array.isArray(p.activityLog))activityLog=p.activityLog;if(Array.isArray(p.broadcastHistory))broadcastHistory=p.broadcastHistory;if(Array.isArray(p.backupHistory))backupHistory=p.backupHistory; const map=[[SETTINGS_KEY,p.settings],[ 'bihari_profits',p.profits],[BLACKLIST_KEY,p.blacklist],[WHITELIST_KEY,p.whitelist],[FAQ_KEY,p.faq],[CAMPAIGN_KEY,p.campaigns]];map.forEach(([k,v])=>{if(v!==undefined)localStorage.setItem(k,JSON.stringify(v))});saveData();renderAll();loadSettingsUI();showToast('success','Import Complete','Backup data imported successfully.');}catch(e){showToast('error','Import Failed',e.message||'Invalid JSON backup.');}finally{input.value='';}};r.readAsText(file); }
    function clearLocalDataSafe(){ if(!confirm('Clear browser-stored admin data? This cannot be undone unless you have a backup.'))return; resetDefaults(); }
    function syncEffectClick(e){ const x=getUiSettings(); if(x.star_effect===false)return; const count=window.innerWidth<600?3:5; for(let i=0;i<count;i++){const s=document.createElement('span');s.className='click-star';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.style.setProperty('--dx',(Math.random()*70-35)+'px');s.style.setProperty('--dy',(Math.random()*70-35)+'px');document.body.appendChild(s);setTimeout(()=>s.remove(),700);} const ring=document.createElement('span');ring.className='click-ring';ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';document.body.appendChild(ring);setTimeout(()=>ring.remove(),600); }

    function syncDatabase() { renderAll();
      showToast('info', 'Syncing', 'Database synced');
      addActivity('Admin', 'Synced database'); }

    function resetDefaults() {
      if (!confirm('Reset all data to defaults? This will erase all custom data!')) return;
      if (!confirm('Are you absolutely sure?')) return;
      try {
        appData = { users: [], orders: [], payments: [], services: [], tickets: [], trash: [], apiLogs: [],
          referrals: [], messages: [], profits: [] };
        activityLog = [];
        broadcastHistory = [];
        backupHistory = [];
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACTIVITY_KEY);
        localStorage.removeItem(BROADCAST_KEY);
        localStorage.removeItem(BACKUP_KEY);
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem('bihari_profits');
        localStorage.removeItem('bihari_qr_image');
        apiRequestCache.clear();
        showPageDataOnly('dashboard');
        renderAll();
        showToast('success', 'Reset complete', 'Local admin data has been cleared.');
        addActivity('Admin', 'Reset to defaults');
      } catch (e) { showToast('error', 'Error', 'Reset failed'); }
    }

    function setWebhook() {
      showToast('info', 'Setting Webhook...', 'Webhook configured');
      safeApi('set_webhook', {}, 'GET').then(res => {
        if (res.success) showToast('success', 'Webhook Set', 'Webhook configured successfully');
        else showToast('error', 'Failed', res.message || 'Webhook setup failed');
      }).catch(() => showToast('error', 'Error', 'Network error'));
      addActivity('Admin', 'Set webhook');
    }

    function syncToGitHub() {
      if (!confirm('Sync all data to GitHub backup?')) return;
      showToast('info', 'Syncing to GitHub...', 'Please wait');
      safeApi('syncToGitHub', {}, 'POST').then(res => {
        if (res.success) { showToast('success', 'Synced', 'Data backed up to GitHub');
          addActivity('Admin', 'Synced data to GitHub'); } else showToast('error', 'Failed', res.message ||
          'GitHub sync failed');
      }).catch(() => showToast('error', 'Error', 'Network error'));
    }

    function restoreFromGitHub() {
      if (!confirm('Restore all data from GitHub? This will OVERWRITE current data!')) return;
      showToast('info', 'Restoring from GitHub...', 'Please wait');
      safeApi('restoreFromGitHub', {}, 'POST').then(res => {
        if (res.success) { renderAll();
          showToast('success', 'Restored', 'Data restored from GitHub');
          addActivity('Admin', 'Restored data from GitHub'); } else showToast('error', 'Failed', res.message ||
          'GitHub restore failed');
      }).catch(() => showToast('error', 'Error', 'Network error'));
    }

    function getApiBalance() {
      showToast('info', 'Checking API Balance...', 'Please wait');
      safeApi('getApiBalance', {}, 'GET').then(res => {
        if (res.success) {
          showToast('success', 'API Balance', 'Balance: ' + formatCurrency(res.balance || 0));
          addActivity('Admin', 'Checked API balance: ' + formatCurrency(res.balance || 0));
        } else showToast('error', 'Failed', res.error || 'Could not fetch balance');
      }).catch(() => showToast('error', 'Error', 'Network error'));
    }

    // ============================================================
    //  CHARTS
    // ============================================================
    function initCharts() {
      try {
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
          if (revenueChartInstance) revenueChartInstance.destroy();
          revenueChartInstance = new Chart(revenueCtx, {
            type: 'line',
            data: {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{
                label: 'Revenue (' + getCurrencySymbol() + ')',
                data: [450, 620, 380, 510, 720, 890, 650],
                borderColor: '#6C3CE1',
                backgroundColor: 'rgba(108,60,225,0.1)',
                fill: true,
                tension: 0.4
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(
                    document.documentElement).getPropertyValue('--text-secondary') } } } }
          });
        }
        const userCtx = document.getElementById('userChart');
        if (userCtx) {
          if (userChartInstance) userChartInstance.destroy();
          userChartInstance = new Chart(userCtx, {
            type: 'bar',
            data: {
              labels: ['Week1', 'Week2', 'Week3', 'Week4'],
              datasets: [{
                label: 'New Users',
                data: [12, 18, 25, 32],
                backgroundColor: 'rgba(255,107,53,0.7)',
                borderColor: '#FF6B35',
                borderWidth: 2,
                borderRadius: 6
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(
                    document.documentElement).getPropertyValue('--text-secondary') } } } }
          });
        }
      } catch (e) { console.warn('initCharts error:', e); }
    }

    function initAnalyticsCharts() {
      try {
        const monthlyCtx = document.getElementById('monthlyRevenueChart');
        if (monthlyCtx) {
          if (monthlyRevenueChartInstance) monthlyRevenueChartInstance.destroy();
          const months = [];
          const data = [];
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = d.toISOString().substring(0, 7);
            months.push(d.toLocaleString('default', { month: 'short' }));
            const monthOrders = appData.orders.filter(o => o.created_at && o.created_at.startsWith(monthKey));
            const sum = monthOrders.reduce((s, o) => s + (o.user_price || 0), 0);
            data.push(sum);
          }
          monthlyRevenueChartInstance = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
              labels: months,
              datasets: [{
                label: 'Revenue (' + getCurrencySymbol() + ')',
                data: data,
                backgroundColor: ['rgba(108,60,225,0.6)', 'rgba(108,60,225,0.7)',
                  'rgba(255,107,53,0.6)', 'rgba(255,107,53,0.7)', 'rgba(0,230,118,0.6)',
                  'rgba(0,230,118,0.7)'
                ],
                borderColor: '#6C3CE1',
                borderWidth: 2,
                borderRadius: 8
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(
                    document.documentElement).getPropertyValue('--text-secondary') } } } }
          });
        }
        const statusCtx = document.getElementById('orderStatusChart');
        if (statusCtx) {
          if (orderStatusChartInstance) orderStatusChartInstance.destroy();
          const orders = appData.orders || [];
          const counts = ['completed', 'processing', 'pending', 'cancelled'].map(s => orders.filter(o => o.status ===
            s).length);
          orderStatusChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
              labels: ['Completed', 'Processing', 'Pending', 'Cancelled'],
              datasets: [{
                data: counts,
                backgroundColor: ['#00E676', '#00BCD4', '#FFC107', '#FF1744'],
                borderColor: '#14141E',
                borderWidth: 3
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: getComputedStyle(
                    document.documentElement).getPropertyValue('--text-secondary') } } } }
          });
        }
      } catch (e) { console.warn('initAnalyticsCharts error:', e); }
    }

    // ============================================================
    //  ANALYTICS
    // ============================================================
    function loadAnalytics() {
      try {
        const orders = appData.orders || [];
        const totalRevenue = orders.reduce((s, o) => s + (o.user_price || 0), 0);
        const today = new Date().toISOString().split('T')[0];
        const todayRev = orders.filter(o => o.created_at && o.created_at.includes(today)).reduce((s, o) => s + (o
          .user_price || 0), 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().split('T')[0];
        const weekRev = orders.filter(o => o.created_at && o.created_at >= weekStr).reduce((s, o) => s + (o.user_price ||
          0), 0);
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthStr = monthAgo.toISOString().split('T')[0];
        const monthRev = orders.filter(o => o.created_at && o.created_at >= monthStr).reduce((s, o) => s + (o
          .user_price || 0), 0);
        document.getElementById('todayRevenue').textContent = formatCurrency(todayRev);
        document.getElementById('weekRevenue').textContent = formatCurrency(weekRev);
        document.getElementById('monthRevenue').textContent = formatCurrency(monthRev);
        document.getElementById('totalRevenueAnalytics').textContent = formatCurrency(totalRevenue);
        initAnalyticsCharts();
      } catch (e) { console.warn('loadAnalytics error:', e); }
    }

    // ============================================================
    //  SCROLL ANIMATION
    // ============================================================
    function observeScroll() {
      try {
        const elements = document.querySelectorAll('.scroll-animate');
        if (!elements.length) return;
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
        elements.forEach(el => observer.observe(el));
      } catch (e) { /* ignore */ }
    }

    // ============================================================
    //  BOT STATUS
    // ============================================================
    function renderBotHealth(data) {
      try {
        const dotEl = document.getElementById('botStatusDot');
        const textEl = document.getElementById('botStatusText');
        const statusEl = document.getElementById('botStatus');
        if (!data) {
          if (dotEl) dotEl.className = 'status-dot offline';
          if (textEl) textEl.textContent = 'No data';
          if (statusEl) statusEl.textContent = '⚠️ No data';
          return;
        }
        const telegramOk = data.telegram_api_ok === true || data.telegram_getme_ok === true;
        const serverOk = data.server_ok === true;
        const webhookOk = data.webhook_configured === true;
        const webhookMatch = data.webhook_url_matches !== false;
        const hasWebhookError = !!data.last_error_message || !!data.last_webhook_error;
        let state = 'offline',
          label = 'Offline',
          card = '🔴 Offline';
        if (serverOk && !telegramOk) { state='online'; label='Server Online • Telegram not configured'; card='🟢 Server Online'; } else if (telegramOk && webhookOk && webhookMatch && !hasWebhookError) {
          if (Number(data.active_service_count||0) === 0) { state='online'; label='Telegram Connected • No Active Services'; card='🟡 No Services'; }
          else { state = 'online'; label = 'Online • Webhook OK'; card = '🟢 Online'; }
        } else if (telegramOk) {
          state = 'online';
          if (!webhookOk) { label = 'Telegram OK • Webhook Missing';
            card = '🟡 Webhook Missing'; } else if (!webhookMatch) { label = 'Telegram OK • Wrong Webhook';
            card = '🟡 Wrong Webhook'; } else { label = 'Telegram OK • Webhook Error';
            card = '🟡 Webhook Error'; }
        } else {
          label = 'Telegram API Error';
          card = '🔴 API Error';
        }
        if (dotEl) dotEl.className = 'status-dot ' + state;
        if (textEl) textEl.textContent = label;
        if (statusEl) statusEl.textContent = card;
        const err = data.last_error_message || data.last_webhook_error || '';
        if (err) statusEl?.setAttribute('title', err);
        else statusEl?.removeAttribute('title');
      } catch (e) { console.warn('renderBotHealth error:', e); }
    }

    function checkBotStatus() {
      if (botStatusBusy) return;
      botStatusBusy = true;
      const statusEl = document.getElementById('botStatus');
      if (statusEl) statusEl.textContent = '🔄 Checking…';
      safeApi('botStatus', {}, 'GET').then(data => renderBotHealth(data)).catch(err => {
        const dotEl = document.getElementById('botStatusDot');
        const textEl = document.getElementById('botStatusText');
        if (dotEl) dotEl.className = 'status-dot offline';
        if (textEl) textEl.textContent = err?.name === 'AbortError' ? 'Status Timeout' : 'Connection Error';
        if (statusEl) statusEl.textContent = err?.name === 'AbortError' ? '⏱️ Timeout' : '⚠️ Error';
        renderBotHealth({ telegram_api_ok: false, webhook_configured: false });
      }).finally(() => { botStatusBusy = false; });
    }

    setInterval(checkBotStatus, 45000);

    // ============================================================
    //  DIAGNOSTICS
    // ============================================================
    function loadDiagnostics() {
      try {
        const minutes = parseInt(document.getElementById('diagMinutes')?.value || '5', 10);
        const details = document.getElementById('diagDetails');
        const log = document.getElementById('diagLogText');
        if (details) details.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking Telegram, webhook, database and logs…';
        safeApi('getDiagnostics', { minutes }, 'GET').then(res => {
          if (!res.success) throw new Error(res.error || 'Diagnostic request failed');
          const h = res.health || {};
          const yes = v => v ? '<span class="badge badge-success">YES</span>' :
            '<span class="badge badge-danger">NO</span>';
          document.getElementById('diagTelegram').innerHTML = yes(h.telegram_getme_ok);
          document.getElementById('diagWebhook').innerHTML = h.webhook_url ? (h.webhook_url_matches ?
            '<span class="badge badge-success">Configured</span>' :
            '<span class="badge badge-danger">Wrong URL</span>') :
            '<span class="badge badge-danger">Not Set</span>';
          document.getElementById('diagPending').textContent = h.pending_update_count ?? 0;
          document.getElementById('diagDb').innerHTML = yes(h.db_ok);
          const webhookErr = h.webhook_last_error ? '<div><b>Telegram webhook error:</b> ' + escapeHtml(h
            .webhook_last_error) + '</div>' : '';
          const internalErr = h.last_internal_error ? '<div><b>Last internal webhook error:</b> ' + escapeHtml(h
            .last_internal_error) + '</div>' : '';
          details.innerHTML = `
          <div><b>Bot:</b> @${escapeHtml(h.bot_username || 'unknown')} (ID ${escapeHtml(String(h.bot_id || '—'))})</div>
          <div><b>Webhook URL:</b> <code>${escapeHtml(h.webhook_url || 'NOT CONFIGURED')}</code></div>
          <div><b>Expected URL:</b> <code>${escapeHtml(h.expected_webhook_url || '—')}</code></div>
          <div><b>Last webhook received:</b> ${escapeHtml(h.last_webhook_received || 'Never')}</div>
          <div><b>Last webhook processed:</b> ${escapeHtml(h.last_webhook_processed || 'Never')}</div>
          <div><b>Last update ID:</b> ${escapeHtml(String(h.last_webhook_update_id || '—'))}</div>
          <div><b>Active services:</b> ${escapeHtml(String(h.service_count ?? '—'))} &nbsp; <b>Users:</b> ${escapeHtml(String(h.user_count ?? '—'))}</div>
          <div><b>PHP:</b> ${escapeHtml(h.php_version || '—')} &nbsp; <b>cURL:</b> ${yes(h.curl_extension)} &nbsp; <b>SQLite3:</b> ${yes(h.sqlite3_extension)}</div>
          ${webhookErr}${internalErr}
        `;
          if (log) log.textContent = res.report || 'No report';
          const count = document.getElementById('diagLogCount');
          if (count) count.textContent = (res.entries || 0) + ' entries';
          renderBotHealth({ telegram_api_ok: h.telegram_getme_ok, webhook_configured: h.webhook_url_matches });
        }).catch(err => {
          if (details) details.innerHTML = '<span style="color:var(--danger);">❌ ' + escapeHtml(err.message ||
            'Diagnostics failed') + '</span>';
        });
      } catch (e) { console.warn('loadDiagnostics error:', e); }
    }

    function downloadDiagnosticReport() {
      try {
        const minutes = parseInt(document.getElementById('diagMinutes')?.value || '5', 10);
        safeApi('getDiagnostics', { minutes }, 'GET').then(res => {
          if (!res.success) throw new Error(res.error || 'Failed');
          const blob = new Blob([res.report || ''], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'bihari-bot-diagnostic-' + minutes + 'min-' + new Date().toISOString().replace(/[:.]/g,
            '-') + '.txt';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          showToast('success', 'Report Ready', 'Diagnostic report downloaded');
        }).catch(e => showToast('error', 'Download Failed', e.message || 'Unable to download report'));
      } catch (e) { showToast('error', 'Error', 'Download failed'); }
    }

    function repairWebhook() {
      if (!confirm('Repair the Telegram webhook using the current bot.php URL?')) return;
      showToast('info', 'Repairing Webhook', 'Please wait…');
      safeApi('set_webhook', {}, 'GET').then(res => {
        if (res.success) { showToast('success', 'Webhook Repaired', 'Telegram webhook is configured again');
          loadDiagnostics();
          checkBotStatus(); } else showToast('error', 'Repair Failed', res.error || res.message ||
          'Telegram rejected the webhook');
      }).catch(e => showToast('error', 'Repair Failed', e.message || 'Network error'));
    }

    // ============================================================
    //  SEED SAMPLE DATA
    // ============================================================
    function seedSampleData() {
      try {
        if (appData.users.length === 0) {
          appData.users = [
            { id: 1, user_id: '123456789', first_name: 'Vikram', last_name: 'Kumar', username: 'vikram_k',
              phone: '+919876543210', balance: 1250.00, total_spent: 450.00, total_orders: 12,
              is_vip: true, is_banned: false, referrals: 5, earned: 250, join_date: '2024-01-15',
              last_active: new Date().toISOString() },
            { id: 2, user_id: '987654321', first_name: 'Priya', last_name: 'Singh', username: 'priya_s',
              phone: '+919123456789', balance: 320.50, total_spent: 180.00, total_orders: 6,
              is_vip: false, is_banned: false, referrals: 2, earned: 80, join_date: '2024-02-20',
              last_active: new Date().toISOString() },
            { id: 3, user_id: '456789123', first_name: 'Rahul', last_name: 'Sharma', username: 'rahul_s',
              phone: '+917894561230', balance: 75.00, total_spent: 300.00, total_orders: 8,
              is_vip: false, is_banned: false, referrals: 0, earned: 0, join_date: '2024-03-10',
              last_active: new Date(Date.now() - 86400000 * 35).toISOString() }
          ];
          appData.orders = [
            { id: 101, user_id: '123456789', service_name: 'Instagram Followers', link: 'https://instagram.com/123',
              quantity: 1000, user_price: 150.00, profit: 50.00, status: 'completed',
              created_at: '2024-12-10T10:30:00', completed_at: '2024-12-10T12:00:00' },
            { id: 102, user_id: '987654321', service_name: 'YouTube Views', link: 'https://youtube.com/watch?v=abc',
              quantity: 500, user_price: 80.00, profit: 20.00, status: 'pending',
              created_at: '2024-12-12T14:20:00' },
            { id: 103, user_id: '456789123', service_name: 'Facebook Likes', link: 'https://facebook.com/post/456',
              quantity: 300, user_price: 45.00, profit: 15.00, status: 'processing',
              created_at: '2024-12-13T09:15:00' }
          ];
          appData.payments = [
            { id: 201, user_id: '123456789', amount: 500, bonus: 25, total_credit: 525, utr: 'UTR123456',
              method: 'UPI', status: 'approved', created_at: '2024-12-11T11:00:00',
              approved_at: '2024-12-11T11:30:00' },
            { id: 202, user_id: '987654321', amount: 200, bonus: 10, total_credit: 210, utr: 'UTR789012',
              method: 'Paytm', status: 'pending', created_at: '2024-12-13T16:45:00' }
          ];
          appData.services = [
            { id: 1, name: 'Instagram Followers', category: 'Instagram', api_rate: 8, selling_price: 15,
              min_order: 100, max_order: 100000, is_active: true, profit_per_1000: 7 },
            { id: 2, name: 'YouTube Views', category: 'YouTube', api_rate: 10, selling_price: 18,
              min_order: 50, max_order: 50000, is_active: true, profit_per_1000: 8 },
            { id: 3, name: 'Facebook Likes', category: 'Facebook', api_rate: 5, selling_price: 10,
              min_order: 50, max_order: 100000, is_active: true, profit_per_1000: 5 }
          ];
          appData.messages = [
            { id: 301, user_id: '123456789', message: 'Hi, I need help with my order.',
              source: 'telegram', created_at: '2024-12-12T10:00:00', is_admin_reply: 0 },
            { id: 302, user_id: '987654321', message: 'When will my order be completed?',
              source: 'telegram', created_at: '2024-12-13T15:30:00', is_admin_reply: 0 }
          ];
          appData.tickets = [
            { id: 401, user_id: '456789123', subject: 'Payment Issue', message: 'I sent money but not credited',
              status: 'open', created_at: '2024-12-13T12:00:00' }
          ];
          appData.apiLogs = [
            { id: 501, action: 'sync', error: 'Connection timeout', created_at: '2024-12-13T08:00:00' }
          ];
          saveData();
        }
        if (appData.orders.length < 3) {
          appData.orders.push(
            { id: 104, user_id: '123456789', service_name: 'Twitter Followers', link: 'https://twitter.com/xyz',
              quantity: 500, user_price: 200.00, profit: 50.00, status: 'completed',
              created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
            { id: 105, user_id: '987654321', service_name: 'Instagram Likes', link: 'https://instagram.com/p/def',
              quantity: 1000, user_price: 300.00, profit: 80.00, status: 'processing',
              created_at: new Date(Date.now() - 86400000 * 2).toISOString() }
          );
          saveData();
        }
        if (!localStorage.getItem('bihari_profits')) {
          const profits = [
            { id: 1, category: 'Instagram', subcategory: 'Followers', profit_per_1000: 30 },
            { id: 2, category: 'Instagram', subcategory: 'Likes', profit_per_1000: 14 },
            { id: 3, category: 'YouTube', subcategory: 'Subscribers', profit_per_1000: 30 },
            { id: 4, category: 'YouTube', subcategory: 'Views', profit_per_1000: 15 },
            { id: 5, category: 'Facebook', subcategory: 'Page Likes', profit_per_1000: 20 }
          ];
          localStorage.setItem('bihari_profits', JSON.stringify(profits));
        }
        if (!localStorage.getItem(SETTINGS_KEY)) {
          const settings = {
            announcement: '🚀 Welcome to Bihari SMM Bot!',
            ref_bonus: 5,
            signup_bonus: 3,
            maintenance_mode: 0,
            whitelist_enabled: 0,
            upi_id: 'code-breakerkumar@fam',
            paytm: '',
            bank_details: 'Account: 1234567890\nIFSC: SBIN0001234\nBank: SBI',
            force_join_offers: '9aNes6okCnE5ZmE1',
            force_join_support: '7SFmz6Y6IvIzNTA1',
            force_join_whatsapp: 'https://whatsapp.com/channel/0029Va6kwbV0lwgx7gwx8G43',
            ip_whitelist: '',
            default_currency: 'INR'
          };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
      } catch (e) { console.warn('seedSampleData error:', e); }
    }

    // ============================================================
    //  ACTIVITY LOG
    // ============================================================
    function addActivity(user, action, icon = 'fa-circle', color = 'var(--text-secondary)') {
      try {
        activityLog.push({
          id: Date.now(),
          user: user || 'System',
          action: action || 'Performed action',
          time: new Date().toLocaleString(),
          icon: icon || 'fa-circle',
          color: color || 'var(--text-secondary)'
        });
        saveData();
        safeApi('addActivity', { user: user, action: action, icon: icon, color: color }, 'POST').then(res => {
          if (!res.success) console.warn('Activity not saved on server:', res.message);
        });
      } catch (e) { /* ignore */ }
    }

    // ============================================================
    //  NOTIFICATIONS + ADMIN PROFILE
    // ============================================================
    function buildNotifications() {
      try {
        const list = document.getElementById('notificationList');
        if (!list) return;
        const items = [];
        const po = (appData.orders || []).filter(o => o.status === 'pending' || o.status === 'processing').length;
        const pp = (appData.payments || []).filter(p => p.status === 'pending').length;
        const ot = (appData.tickets || []).filter(t => t.status === 'open').length;
        if (po) items.push(['fa-shopping-cart', 'Orders need attention', po + ' pending/processing order(s)']);
        if (pp) items.push(['fa-wallet', 'Payment review', pp + ' payment(s) awaiting review']);
        if (ot) items.push(['fa-headset', 'Support queue', ot + ' open ticket(s)']);
        const im = (appData.messages || []).length;
        if (im) items.push(['fa-inbox', 'Inbox activity', im + ' message(s)']);
        list.innerHTML = items.length ? items.map(x =>
          `<div class="notification-item"><div class="ni"><i class="fas ${x[0]}"></i></div><div><strong>${x[1]}</strong><small>${x[2]}</small></div></div>`
        ).join('') :
          '<div class="notification-empty"><i class="fas fa-check-circle" style="font-size:30px"></i><div>All clear — no urgent alerts.</div></div>';
        const c = document.getElementById('notificationCount');
        if (c) c.textContent = items.length || 0;
      } catch (e) { /* ignore */ }
    }

    function toggleNotifications() {
      try {
        const p = document.getElementById('notificationPanel');
        if (!p) return;
        buildNotifications();
        p.classList.toggle('open');
      } catch (e) { /* ignore */ }
    }

    function markNotificationsRead() {
      try {
        const p = document.getElementById('notificationPanel');
        if (p) p.classList.remove('open');
        showToast('success', 'Notifications', 'Marked as read');
      } catch (e) { /* ignore */ }
    }

    function saveAdminProfile() {
      try {
        const name = (document.getElementById('adminDisplayName') || {}).value || 'Vikram Kumar';
        const email = (document.getElementById('adminEmail') || {}).value || '';
        localStorage.setItem('bihari_admin_profile', JSON.stringify({ name, email }));
        showToast('success', 'Profile Saved', 'Admin profile updated successfully.');
        addActivity('Admin', 'Updated admin profile');
      } catch (e) { showToast('error', 'Error', 'Failed to save profile'); }
    }

    function loadAdminProfile() {
      try {
        const p = JSON.parse(localStorage.getItem('bihari_admin_profile') || '{}');
        if (p.name && document.getElementById('adminDisplayName')) document.getElementById('adminDisplayName').value = p
          .name;
        if (p.email && document.getElementById('adminEmail')) document.getElementById('adminEmail').value = p.email;
      } catch (e) { /* ignore */ }
    }

    // ============================================================
    //  3D FX / CLOCK / SOUND
    // ============================================================
    function playUiSound(kind = 'click') {
      if (!soundEnabled) return;
      try {
        audioCtx = audioCtx || new(window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(),
          g = audioCtx.createGain();
        o.type = kind === 'success' ? 'sine' : 'triangle';
        o.frequency.value = kind === 'success' ? 720 : 420;
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + .01);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + .11);
        o.connect(g).connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + .12);
      } catch (_) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      localStorage.setItem('bihari_sound', soundEnabled ? '1' : '0');
      const b = document.getElementById('soundToggle');
      if (b) { b.classList.toggle('on', soundEnabled);
        b.innerHTML = soundEnabled ? '<i class="fas fa-volume-high"></i>' :
        '<i class="fas fa-volume-xmark"></i>'; }
      playUiSound('success');
      if (soundEnabled) showToast('success', 'UI Sounds', 'Interface sounds enabled');
    }

    function updateLiveClock() {
      try {
        const d = new Date(),
          t = document.getElementById('liveClock'),
          dt = document.getElementById('liveDate');
        if (t) t.textContent = d.toLocaleTimeString('en-IN', { hour12: true });
        if (dt) dt.textContent = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) { /* ignore */ }
    }

    function init3DFx() {
      try {
        soundEnabled = localStorage.getItem('bihari_sound') === '1';
        const b = document.getElementById('soundToggle');
        if (b) { b.classList.toggle('on', soundEnabled);
          b.innerHTML = soundEnabled ? '<i class="fas fa-volume-high"></i>' :
          '<i class="fas fa-volume-xmark"></i>'; }
        updateLiveClock();
        setInterval(updateLiveClock, 1000);
        const wrap = document.getElementById('fxParticles');
        const ui=getUiSettings(); if(wrap && ui.particles===false) wrap.style.display='none';
        if (wrap && !wrap.children.length) {
          for (let i = 0; i < 10; i++) {
            const x = document.createElement('span');
            x.style.setProperty('--x', Math.random() * 100 + 'vw');
            x.style.setProperty('--d', (6 + Math.random() * 12) + 's');
            x.style.setProperty('--s', (2 + Math.random() * 5) + 'px');
            x.style.setProperty('--delay', (-Math.random() * 12) + 's');
            wrap.appendChild(x);
          }
        }
        // Sidebar overlay for mobile
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !document.getElementById('proSidebarOverlay')) {
          const overlay = document.createElement('div');
          overlay.id = 'proSidebarOverlay';
          overlay.className = 'pro-sidebar-overlay';
          document.body.appendChild(overlay);
          overlay.onclick = () => { if (sidebar.classList.contains('open')) toggleSidebar(); };
        }
        document.addEventListener('click', e => {
          if (e.target.closest('button,.nav-item,.btn')) { playUiSound('click'); syncEffectClick(e); }
        }, { passive: true });
      } catch (e) { /* ignore */ }
    }

    // ============================================================
    //  ADMIN PANEL LOAD
    // ============================================================
    async function loadAdminContent(){
      try{
        loadData();
        renderAll();
        loadAdminProfile();
        buildNotifications();
        initIdleLogout();
        // UI is never blocked by the backend. Live sync/status run in the background.
        setTimeout(()=>{try{initCharts();generateQR();loadQRDisplay();checkBotStatus();observeScroll();}catch(e){console.warn('Post-load init error:',e);}},250);
        refreshServerData(false).catch(e=>console.warn('Background server sync:',e));
      }catch(e){console.error('loadAdminContent error:',e);try{renderAll()}catch(_){} }
    }

    // ============================================================
    //  AUTO-REFRESH & KEYBOARD SHORTCUTS
    // ============================================================
    let autoRefreshTimer=null;
    function scheduleAutoRefresh(){clearInterval(autoRefreshTimer);const ms=parseInt(localStorage.getItem('bihari_auto_refresh')||'120000',10);if(!ms)return;autoRefreshTimer=setInterval(()=>{if(document.getElementById('adminPanel')?.style.display!=='none')refreshServerData(false);},ms);}
    scheduleAutoRefresh();

    document.addEventListener('keydown', function(e) {
      try {
        if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
          e.preventDefault();
          const pages = ['dashboard', 'users', 'orders', 'payments', 'services', 'broadcast', 'analytics',
            'qrpayment', 'settings'
          ];
          const idx = parseInt(e.key) - 1;
          if (pages[idx]) showPage(pages[idx]);
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'L') logout();
        if (e.ctrlKey && e.key === 'r') { e.preventDefault();
          renderAll();
          showToast('info', 'Refreshed', 'Data reloaded!'); }
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
          const sidebar = document.getElementById('sidebar');
          if (sidebar && sidebar.classList.contains('open')) toggleSidebar();
        }
      } catch (e) { /* ignore */ }
    });

    document.addEventListener('click', e => {
      try {
        const p = document.getElementById('notificationPanel'),
          b = document.querySelector('.notification-trigger');
        if (p && p.classList.contains('open') && !p.contains(e.target) && b && !b.contains(e.target)) p.classList.remove(
          'open');
      } catch (e) { /* ignore */ }
    });

    const pass = document.getElementById('adminPassword');
    if (pass) pass.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    if(document.getElementById('year')) document.getElementById('year').textContent = new Date().getFullYear();

    // ============================================================
    //  INIT
    // ============================================================
    init3DFx();
    console.log('⚡ Bihari SMM Pro Control Center v14.0 Loaded!');

    // ============================================================
    //  FALLBACK: Agar QRCode ya Chart load nahi hua
    // ============================================================
    if (typeof QRCode === 'undefined') {
      console.warn('QRCode not loaded, using fallback');
      window.QRCode = function(container, options) {
        this._container = container;
        this._options = options;
        this.makeCode = function(text) {
          container.innerHTML =
            `<div style="padding:20px;background:#1a1a1a;border-radius:12px;color:#fff;border:2px dashed var(--primary);">
            <i class="fas fa-qrcode" style="font-size:60px;color:var(--primary);"></i>
            <p style="margin-top:10px;font-size:13px;color:var(--text-secondary);">QR Code: ${text}</p>
          </div>`;
        };
        if (options.text) this.makeCode(options.text);
      };
    }
    if (typeof Chart === 'undefined') {
      console.warn('Chart not loaded, using fallback');
      window.Chart = function(ctx, config) {
        console.warn('Chart.js fallback - no charts will be rendered');
        return { destroy: function() {}, update: function() {} };
      };
    }
  
    // ===== v13 LIVE SERVER DATA LAYER =====
    // The browser is a view; important changes are persisted in bot.php/SQLite.
    async function saveUserDetails(id){
      try{const u=appData.users.find(x=>x.id===id);if(!u)return;const fields={notes:document.getElementById('userNotes').value,phone:document.getElementById('userPhone').value,email:document.getElementById('userEmail').value,city:document.getElementById('userCity').value};for(const [field,value] of Object.entries(fields)){const r=await safeApi('updateUser',{id:u.user_id,field,value},'POST');if(!r?.success)throw Error(r?.error||r?.message||'Failed '+field);}await refreshServerData(false);showToast('success','Saved','User details saved to server.');addActivity('Admin','Updated user details for '+(u.first_name||u.user_id));}catch(e){showToast('error','Error',e.message||'Failed to save user');}
    }
    async function toggleVIP(id){try{const u=appData.users.find(x=>x.id===id);if(!u)return;const r=await safeApi('updateUser',{id:u.user_id,field:'is_vip',value:u.is_vip?0:1},'POST');if(!r?.success)throw Error(r?.error||r?.message);await refreshServerData(false);showToast('success','VIP Updated',(u.first_name||u.user_id)+' updated.');}catch(e){showToast('error','Error',e.message||'Failed to toggle VIP');}}
    async function toggleBan(id){try{const u=appData.users.find(x=>x.id===id);if(!u)return;const r=await safeApi('updateUser',{id:u.user_id,field:'is_banned',value:u.is_banned?0:1},'POST');if(!r?.success)throw Error(r?.error||r?.message);await refreshServerData(false);showToast(u.is_banned?'success':'warning','User Updated',(u.first_name||u.user_id)+' '+(u.is_banned?'unbanned':'banned'));}catch(e){showToast('error','Error',e.message||'Failed to update user');}}
    async function addUser(){try{const data={user_id:document.getElementById('addUserId').value.trim(),first_name:document.getElementById('addFirstName').value.trim()||'User',last_name:document.getElementById('addLastName').value.trim(),username:document.getElementById('addUsername').value.trim(),phone:document.getElementById('addPhone').value.trim(),balance:parseFloat(document.getElementById('addBalance').value)||0,is_vip:parseInt(document.getElementById('addVIP').value)||0};if(!data.user_id){showToast('warning','Invalid','Telegram User ID is required');return;}const r=await safeApi('addUser',data,'POST');if(!r?.success)throw Error(r?.error||r?.message||'Failed to add user');closeModal('userModal');await refreshServerData(false);showToast('success','Added','User added to server.');}catch(e){showToast('error','Error',e.message||'Failed to add user');}}
    async function loadProfits(){try{const r=await safeApi('getProfitSettings',{},'GET');if(!r?.success)throw Error(r?.error||r?.message||'Could not load profits');appData.profits=Array.isArray(r.data)?r.data:[];localStorage.setItem('bihari_profits',JSON.stringify(appData.profits));const list=document.getElementById('profitsList');if(!list)return;list.innerHTML=appData.profits.map(x=>`<tr><td><strong>${escapeHtml(x.category||'')}</strong></td><td>${escapeHtml(x.subcategory||'—')}</td><td style="color:var(--gold);font-weight:600">${formatCurrency(x.profit_per_1000||0)}</td><td><button class="btn btn-xs btn-info" onclick="editProfit(${x.id})"><i class="fas fa-edit"></i></button><button class="btn btn-xs btn-danger" onclick="deleteProfit(${x.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:30px">No profit settings</td></tr>';}catch(e){showToast('warning','Profit Settings',e.message||'Could not load server profit settings');}}
    async function addProfit(){try{const category=document.getElementById('profitCategory').value.trim(),subcategory=document.getElementById('profitSubcategory').value.trim(),profit=parseFloat(document.getElementById('profitAmount').value);if(!category||!Number.isFinite(profit)||profit<0){showToast('warning','Invalid','Enter valid profit settings');return;}const r=await safeApi('updateProfitSetting',{category,subcategory,profit_per_1000:profit},'POST');if(!r?.success)throw Error(r?.error||r?.message);closeModal('profitModal');await refreshServerData(false);showToast('success','Saved','Profit setting saved and service prices updated.');}catch(e){showToast('error','Error',e.message||'Failed to save profit');}}
    async function saveProfitEdit(id){return addProfitEditServer(id)}
    async function addProfitEditServer(id){try{const category=document.getElementById('profitCategory').value.trim(),subcategory=document.getElementById('profitSubcategory').value.trim(),profit=parseFloat(document.getElementById('profitAmount').value)||0;const old=appData.profits.find(x=>x.id===id);if(!old){return addProfit();}if(category===old.category&&subcategory===old.subcategory){const r=await safeApi('updateProfitSetting',{category,subcategory,profit_per_1000:profit},'POST');if(!r?.success)throw Error(r?.error||r?.message);}else{await safeApi('deleteProfitSetting',{id},'POST');const r=await safeApi('updateProfitSetting',{category,subcategory,profit_per_1000:profit},'POST');if(!r?.success)throw Error(r?.error||r?.message);}closeModal('profitModal');await refreshServerData(false);showToast('success','Updated','Profit setting saved.');}catch(e){showToast('error','Error',e.message||'Failed to update profit');}}
    async function deleteProfit(id){if(!confirm('Delete this profit setting?'))return;try{const r=await safeApi('deleteProfitSetting',{id},'POST');if(!r?.success)throw Error(r?.error||r?.message);await refreshServerData(false);showToast('success','Deleted','Profit setting deleted.');}catch(e){showToast('error','Error',e.message||'Failed to delete profit');}}
    async function bulkAction(type,action){const ids=getSelected(type);if(!ids.length){showToast('warning','No items','Select at least one');return;}if(!confirm('Are you sure you want to '+action+' '+ids.length+' item(s)?'))return;try{for(const id of ids){if(type==='order'){const r=await safeApi('updateOrderStatus',{id,status:action==='complete'?'completed':'cancelled'},'POST');if(!r?.success)throw Error(r?.error||r?.message||'Order update failed');}else if(type==='payment'){const r=await safeApi(action==='approve'?'approvePayment':'rejectPayment',{id},'POST');if(!r?.success)throw Error(r?.error||r?.message||'Payment update failed');}}await refreshServerData(false);clearBulkSelection(type);showToast('success','Bulk Action','Server updated successfully.');}catch(e){showToast('error','Bulk Action',e.message||'Bulk operation failed');}}


/* ============================================================
   BIHARI SMM PRO — CLEAN MULTI-PAGE BOOT
   Keeps the original design/animations; only changes page routing.
   ============================================================ */
(function(){
  'use strict';
  const raw=(location.pathname.split('/').pop()||'dashboard').replace(/\.html$/i,'')||'dashboard';
  const page=raw==='api-logs'?'apilogs':raw==='qr-payment'?'qrpayment':raw;
  const titles={dashboard:'Dashboard',users:'Users',orders:'Orders',payments:'Payments',services:'Services',inbox:'Unified Inbox',broadcast:'Broadcast',support:'Support',trash:'Trash',apilogs:'API Logs',referrals:'Referrals',blacklist:'Blacklist',whitelist:'Whitelist',faq:'FAQ',campaigns:'Campaigns',analytics:'Analytics',qrpayment:'QR Payment',leaderboard:'Leaderboard',activity:'Activity',diagnostics:'Bot Diagnostics',backup:'Backup',profits:'Profit Settings',profile:'Admin Profile',settings:'Settings'};
  const boot=()=>{
    try{
      if(localStorage.getItem('bihari_admin_session')!=='1'){ location.replace('index.html'); return; }
      const panel=document.getElementById('adminPanel'); if(panel){panel.style.display='block';panel.removeAttribute('aria-hidden');}
      document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
      const current=document.getElementById('page-'+page);
      if(current){current.classList.add('active');current.style.display='block';current.style.visibility='visible';current.style.opacity='1';}
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
      const t=document.getElementById('pageTitle'),sub=document.getElementById('pageSubtitle');
      if(t)t.textContent=titles[page]||'Dashboard'; if(sub)sub.textContent='Manage '+(titles[page]||'Dashboard');
      if(typeof loadData==='function')loadData();
      if(typeof renderAll==='function')renderAll();
      if(typeof showPageDataOnly==='function')setTimeout(()=>{try{showPageDataOnly(page)}catch(e){console.warn('Page data render:',e)}},0);
      // background sync only; never hold page rendering hostage
      if(typeof refreshServerData==='function')setTimeout(()=>refreshServerData(false).catch(()=>{}),120);
    }catch(e){console.error('Boot error',e);}
  };
  window.showPage=showPage;
  window.logout=function(){try{localStorage.removeItem('bihari_admin_session')}catch(_){};fetch('/api/logout',{method:'POST',credentials:'same-origin'}).finally(()=>location.href='index.html');};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
