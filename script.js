/* ============================================================
   BIHARI SMM ADMIN PANEL — MAIN JAVASCRIPT
   File: script.js
   Version: 7.0.2 (Auto Backup + GitHub Sync)
   ============================================================ */

'use strict';

/* ============================================================
   GLOBAL STATE
   ============================================================ */
const App = {
    user: null,
    sessionToken: null,
    currentPage: null,
    pageData: {},
    timers: {},
    settings: {},
    stats: {},
    initialized: false,
};

/* ============================================================
   1. UTILITY HELPERS
   ============================================================ */
const Utils = {

    /* ---- Escape HTML ---- */
    escape(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /* ---- Format number with Indian commas ---- */
    number(n, decimals = 0) {
        const num = parseFloat(n) || 0;
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    },

    /* ---- Format currency ---- */
    money(n, symbol = '₹') {
        const num = parseFloat(n) || 0;
        return symbol + num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    },

    /* ---- Format compact (1.2K, 5.3M) ---- */
    compact(n) {
        const num = parseFloat(n) || 0;
        if (num >= 1e7) return (num / 1e7).toFixed(1) + 'Cr';
        if (num >= 1e5) return (num / 1e5).toFixed(1) + 'L';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toString();
    },

    /* ---- Format date ---- */
    date(str, format = 'short') {
        if (!str) return '—';
        try {
            const d = new Date(str.replace(' ', 'T'));
            if (isNaN(d.getTime())) return str;

            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');

            if (format === 'date') return `${dd}/${mm}/${yyyy}`;
            if (format === 'time') return `${hh}:${min}`;
            if (format === 'full') return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
            return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
        } catch (e) {
            return str;
        }
    },

    /* ---- Time ago ---- */
    timeAgo(str) {
        if (!str) return '—';
        try {
            const d = new Date(str.replace(' ', 'T'));
            if (isNaN(d.getTime())) return str;

            const diff = Math.floor((Date.now() - d.getTime()) / 1000);
            if (diff < 60) return 'just now';
            if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
            if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
            if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
            return Utils.date(str, 'date');
        } catch (e) {
            return str;
        }
    },

    /* ---- Debounce ---- */
    debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /* ---- Throttle ---- */
    throttle(fn, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    },

    /* ---- Random ---- */
    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /* ---- Sleep ---- */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /* ---- Copy to clipboard ---- */
    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            Toast.success('Copied to clipboard!');
            return true;
        } catch (e) {
            Toast.error('Copy failed');
            return false;
        }
    },

    /* ---- Truncate ---- */
    truncate(str, len = 40) {
        if (!str) return '';
        str = String(str);
        return str.length > len ? str.substr(0, len - 1) + '…' : str;
    },

    /* ---- Get initials ---- */
    initials(name) {
        if (!name) return '?';
        return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    },

    /* ---- SHA-256 hash ---- */
    async sha256(text) {
        const buf = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(text)
        );
        return [...new Uint8Array(buf)]
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    /* ---- Storage helpers ---- */
    storage: {
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch (e) { return false; }
        },
        get(key, fallback = null) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch (e) { return fallback; }
        },
        remove(key) {
            try { localStorage.removeItem(key); return true; }
            catch (e) { return false; }
        },
        clear() {
            try { localStorage.clear(); return true; }
            catch (e) { return false; }
        }
    },

    /* ---- Query selector helpers ---- */
    $(sel, parent = document) { return parent.querySelector(sel); },
    $$(sel, parent = document) { return Array.from(parent.querySelectorAll(sel)); },

    /* ---- URL helpers ---- */
    getParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    /* ---- Simple ID generator ---- */
    uid() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },
};

/* ============================================================
   2. TOAST NOTIFICATION SYSTEM
   ============================================================ */
const Toast = {
    container: null,

    init() {
        this.container = Utils.$('#toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = null) {
        if (!this.container) this.init();

        duration = duration || CONFIG.TOAST_DURATION_MS;

        const icons = {
            success: '✅',
            error:   '❌',
            warning: '⚠️',
            info:    'ℹ️',
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <div class="toast-content">${Utils.escape(message)}</div>
            <button class="toast-close" aria-label="Close">✕</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.remove(toast), duration);
        }

        return toast;
    },

    remove(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    },

    success(msg, dur) { return this.show(msg, 'success', dur); },
    error(msg, dur)   { return this.show(msg, 'error', dur); },
    warning(msg, dur) { return this.show(msg, 'warning', dur); },
    info(msg, dur)    { return this.show(msg, 'info', dur); },

    clear() {
        if (this.container) this.container.innerHTML = '';
    },
};

/* ============================================================
   3. MODAL SYSTEM
   ============================================================ */
const Modal = {

    open(options = {}) {
        const {
            title = '',
            body = '',
            footer = '',
            size = '',
            onClose = null,
            onOpen = null,
        } = options;

        const existing = Utils.$('#dynamicModal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.id = 'dynamicModal';
        overlay.innerHTML = `
            <div class="modal ${size ? 'modal-' + size : ''}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" aria-label="Close">✕</button>
                </div>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('no-scroll');

        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        const close = () => {
            overlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (typeof onClose === 'function') onClose();
            }, 250);
        };

        overlay.querySelector('.modal-close').addEventListener('click', close);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                close();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        overlay.close = close;

        if (typeof onOpen === 'function') onOpen(overlay);

        return overlay;
    },

    close() {
        const overlay = Utils.$('#dynamicModal');
        if (overlay && overlay.close) overlay.close();
    },

    confirm(options = {}) {
        const {
            title = 'Confirm',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            type = 'warning',
            onConfirm = null,
        } = options;

        const btnClass = {
            warning: 'btn-warning',
            danger: 'btn-danger',
            success: 'btn-success',
            info: 'btn-primary',
        }[type] || 'btn-primary';

        const body = `<p style="color: var(--text-secondary); line-height: 1.6;">${Utils.escape(message)}</p>`;

        const footer = `
            <button class="btn btn-secondary" data-modal-cancel>${Utils.escape(cancelText)}</button>
            <button class="btn ${btnClass}" data-modal-confirm>${Utils.escape(confirmText)}</button>
        `;

        return new Promise((resolve) => {
            const overlay = this.open({
                title,
                body,
                footer,
                size: 'sm',
                onOpen: (el) => {
                    el.querySelector('[data-modal-cancel]').addEventListener('click', () => {
                        el.close();
                        resolve(false);
                    });
                    el.querySelector('[data-modal-confirm]').addEventListener('click', () => {
                        el.close();
                        resolve(true);
                        if (typeof onConfirm === 'function') onConfirm();
                    });
                },
                onClose: () => resolve(false),
            });
        });
    },

    alert(title, message, type = 'info') {
        return this.open({
            title,
            body: `<p style="color: var(--text-secondary); line-height: 1.6;">${Utils.escape(message)}</p>`,
            footer: `<button class="btn btn-primary" onclick="Modal.close()">OK</button>`,
            size: 'sm',
        });
    },
};

/* ============================================================
   4. LOADER
   ============================================================ */
const Loader = {
    show() {
        const el = Utils.$('#loaderOverlay');
        if (el) el.classList.add('active');
    },
    hide() {
        const el = Utils.$('#loaderOverlay');
        if (el) el.classList.remove('active');
    },
};

/* ============================================================
   5. ALERT (Login page)
   ============================================================ */
const Alert = {
    show(message, type = 'info', autoHide = 5000) {
        const box = Utils.$('#alertBox');
        if (!box) return;

        box.className = `login-alert ${type} show`;
        box.textContent = message;

        if (this._timer) clearTimeout(this._timer);

        if (autoHide > 0) {
            this._timer = setTimeout(() => this.hide(), autoHide);
        }
    },
    hide() {
        const box = Utils.$('#alertBox');
        if (box) box.classList.remove('show');
    },
};

/* ============================================================
   6. API WRAPPER
   ============================================================ */
const API = {

    runtime() { return typeof readRuntimeConfig === 'function' ? readRuntimeConfig() : CONFIG; },

    /* ---- Base request ---- */
    async request(action, data = {}, options = {}) {
        const {
            method = 'POST',
            silent = false,
            timeout = 30000,
        } = options;

        const runtime = this.runtime();
        if (!runtime.API_URL) throw new Error('Backend API URL configured nahi hai');
        const url = `${runtime.API_URL}?action=${encodeURIComponent(action)}`;

        const headers = {
            'X-API-Key': runtime.API_KEY,
            'Accept': 'application/json',
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let fetchOptions = {
            method,
            headers,
            signal: controller.signal,
        };

        if (method === 'POST' || method === 'PUT') {
            if (data instanceof FormData) {
                fetchOptions.body = data;
            } else {
                headers['Content-Type'] = 'application/json';
                fetchOptions.body = JSON.stringify(data);
            }
        }

        if (!silent) Loader.show();

        try {
            const res = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const json = await res.json();
            return json;

        } catch (err) {
            clearTimeout(timeoutId);
            console.error('API Error:', action, err);

            if (err.name === 'AbortError') {
                throw new Error('Request timeout — server se response nahi aaya');
            }

            throw new Error(err.message || 'Network error');

        } finally {
            if (!silent) Loader.hide();
        }
    },

    /* ---- GET ---- */
    async get(action, params = {}) {
        const runtime = this.runtime();
        if (!runtime.API_URL) throw new Error('Backend API URL configured nahi hai');
        let url = `${runtime.API_URL}?action=${encodeURIComponent(action)}`;
        Object.keys(params).forEach(k => {
            url += `&${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`;
        });

        Loader.show();
        try {
            const res = await fetch(url, {
                headers: {
                    'X-API-Key': runtime.API_KEY,
                    'Accept': 'application/json',
                },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error('API GET Error:', action, err);
            throw err;
        } finally {
            Loader.hide();
        }
    },

    /* ---- POST ---- */
    async post(action, data = {}) {
        return this.request(action, data, { method: 'POST' });
    },

    /* ---- POST FormData ---- */
    async upload(action, formData) {
        return this.request(action, formData, { method: 'POST', timeout: 60000 });
    },

    /* ============================================================
       API SHORTCUTS — Common endpoints
       ============================================================ */

    ping()                  { return this.get('ping', {}, { silent: true }); },
    getData()               { return this.get('getData'); },
    getDataPage(table, page = 1, limit = 20, search = '') {
        return this.get('getDataPage', { table, page, limit, search });
    },
    botStatus()             { return this.get('botStatus'); },
    getDiagnostics(min = 5) { return this.get('getDiagnostics', { minutes: min }); },

    approvePayment(id)      { return this.post('approvePayment', { id }); },
    rejectPayment(id, reason) { return this.post('rejectPayment', { id, reason }); },
    updateOrderStatus(id, status) { return this.post('updateOrderStatus', { id, status }); },
    checkOrders()           { return this.post('checkOrders'); },

    sync()                  { return this.post('sync'); },
    syncToGitHub()          { return this.post('syncToGitHub'); },
    restoreFromGitHub()     { return this.post('restoreFromGitHub'); },

    addUser(data)           { return this.post('addUser', data); },
    updateUser(id, field, value) { return this.post('updateUser', { id, field, value }); },
    deleteUser(id)          { return this.post('deleteUser', { id }); },

    addService(data)        { return this.post('addService', data); },
    updateService(id, field, value) { return this.post('updateService', { id, field, value }); },
    deleteService(id)       { return this.post('deleteService', { id }); },

    updateSetting(key, value) { return this.post('updateSetting', { key, value }); },
    getSetting(key)         { return this.get('getSetting', { key }); },

    createBackup(format = 'json') { return this.get('createBackup', { format }); },
    getBackupHistory()      { return this.get('getBackupHistory'); },
    deleteBackup(id)        { return this.post('deleteBackup', { id }); },

    getBroadcastHistory()   { return this.get('getBroadcastHistory'); },
    broadcast(data)         { return this.post('broadcast', data); },

    getTickets()            { return this.get('getTickets'); },
    replyTicket(id, reply)  { return this.post('replyTicket', { id, reply }); },

    getMessages()           { return this.get('getMessages'); },
    replyInbox(id, reply)   { return this.post('replyInbox', { id, reply }); },

    getTrash()              { return this.get('getTrash'); },
    restoreItem(id)         { return this.post('restoreItem', { id }); },
    emptyTrash()            { return this.post('emptyTrash'); },

    getActivity()           { return this.get('getActivity'); },
    getApiLogs()            { return this.get('getApiLogs'); },
    getReferrals()          { return this.get('getReferrals'); },

    getApiBalance()         { return this.get('getApiBalance'); },
    getSmmConfig()          { return this.get('getSmmConfig'); },
    updateSmmConfig(url, key) { return this.post('updateSmmConfig', { api_url: url, api_key: key }); },

    syncDatabase()          { return this.post('syncDatabase'); },
};

/* ============================================================
   7. OTP SYSTEM (via Telegram Bot)
   ============================================================ */

const OTP = {
    current: null,
    expiresAt: 0,
    timerInterval: null,
    resendCooldown: 0,
    resendInterval: null,

    /* ---- Generate 6-digit OTP ---- */
    generate() {
        const len = CONFIG.OTP_LENGTH;
        let otp = '';
        for (let i = 0; i < len; i++) {
            otp += Utils.random(0, 9);
        }
        return otp;
    },

    /* ---- Send OTP via Telegram Bot ---- */
    async send(username) {
        const otp = this.generate();
        const expiry = CONFIG.OTP_EXPIRY_SECONDS;

        this.current = otp;
        this.expiresAt = Date.now() + (expiry * 1000);

        const message = [
            '🔐 *Bihari SMM Admin Panel*',
            '',
            '━━━━━━━━━━━━━━━━━━━━',
            '🔑 *OTP Login Code*',
            '━━━━━━━━━━━━━━━━━━━━',
            '',
            `👤 Username: \`${username}\``,
            `🔢 OTP: \`${otp}\``,
            '',
            `⏱️ Expires in: ${Math.floor(expiry / 60)} minutes`,
            `🕐 Time: ${new Date().toLocaleString('en-IN')}`,
            '',
            '⚠️ _Ye code kisi ke saath share na karein._',
            '❌ _Agar aapne ye request nahi ki, ignore karein._',
        ].join('\n');

        const token = CONFIG.OTP_BOT_TOKEN;
        const chatId = CONFIG.OTP_CHAT_ID;

        if (!token || token.includes('YAHAN')) {
            throw new Error('OTP Bot Token config me set nahi hai');
        }

        if (!chatId) {
            throw new Error('OTP Chat ID set nahi hai');
        }

        /* ---- Send via Telegram API using image trick (CORS bypass) ---- */
        const url = `https://api.telegram.org/bot${token}/sendMessage` +
                    `?chat_id=${encodeURIComponent(chatId)}` +
                    `&text=${encodeURIComponent(message)}` +
                    `&parse_mode=Markdown`;

        return new Promise((resolve, reject) => {
            const img = new Image();
            const timer = setTimeout(() => {
                resolve({ sent: true, otp });
            }, 3000);

            img.onload = () => {
                clearTimeout(timer);
                resolve({ sent: true, otp });
            };
            img.onerror = () => {
                clearTimeout(timer);
                resolve({ sent: true, otp });
            };
            img.src = url;
        });
    },

    /* ---- Verify OTP ---- */
    verify(input) {
        if (!this.current) return { success: false, reason: 'No OTP generated' };
        if (Date.now() > this.expiresAt) return { success: false, reason: 'expired' };
        if (String(input) !== String(this.current)) return { success: false, reason: 'invalid' };
        return { success: true };
    },

    /* ---- Clear OTP ---- */
    clear() {
        this.current = null;
        this.expiresAt = 0;
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.resendInterval) clearInterval(this.resendInterval);
        this.timerInterval = null;
        this.resendInterval = null;
    },

    /* ---- Start countdown ---- */
    startTimer(onExpire, onTick) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            const remaining = Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1000));

            if (typeof onTick === 'function') onTick(remaining);

            if (remaining <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                if (typeof onExpire === 'function') onExpire();
            }
        }, 1000);
    },

    /* ---- Start resend cooldown ---- */
    startResendCooldown(seconds, onUpdate) {
        this.resendCooldown = seconds;

        if (this.resendInterval) clearInterval(this.resendInterval);

        this.resendInterval = setInterval(() => {
            this.resendCooldown--;
            if (typeof onUpdate === 'function') onUpdate(this.resendCooldown);

            if (this.resendCooldown <= 0) {
                clearInterval(this.resendInterval);
                this.resendInterval = null;
            }
        }, 1000);
    },

    /* ---- Format seconds to MM:SS ---- */
    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
};

/* ============================================================
   8. SESSION MANAGEMENT
   ============================================================ */

const Session = {

    /* ---- Create session ---- */
    create(username) {
        const token = this.generateToken();
        const expiresAt = Date.now() + (CONFIG.SESSION_HOURS * 60 * 60 * 1000);

        const session = {
            token,
            username,
            expiresAt,
            loginAt: Date.now(),
            lastActivity: Date.now(),
            device: this.getDeviceId(),
        };

        Utils.storage.set(STORAGE_KEYS.SESSION_TOKEN, session);
        Utils.storage.set(STORAGE_KEYS.USERNAME, username);
        Utils.storage.set(STORAGE_KEYS.LAST_ACTIVITY, Date.now());

        App.sessionToken = token;
        App.user = { username };

        return session;
    },

    /* ---- Generate token ---- */
    generateToken() {
        const arr = new Uint8Array(32);
        crypto.getRandomValues(arr);
        return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /* ---- Get/create device ID ---- */
    getDeviceId() {
        let device = Utils.storage.get(STORAGE_KEYS.DEVICE_TOKEN);
        if (!device) {
            device = this.generateToken().substr(0, 32);
            Utils.storage.set(STORAGE_KEYS.DEVICE_TOKEN, device);
        }
        return device;
    },

    /* ---- Check if session valid ---- */
    isValid() {
        const session = Utils.storage.get(STORAGE_KEYS.SESSION_TOKEN);
        if (!session || !session.token) return false;
        if (Date.now() > session.expiresAt) return false;
        return true;
    },

    /* ---- Check idle timeout ---- */
    isIdle() {
        const last = Utils.storage.get(STORAGE_KEYS.LAST_ACTIVITY);
        if (!last) return true;
        const idleMs = Date.now() - last;
        return idleMs > (CONFIG.IDLE_TIMEOUT_MINUTES * 60 * 1000);
    },

    /* ---- Update activity ---- */
    touch() {
        Utils.storage.set(STORAGE_KEYS.LAST_ACTIVITY, Date.now());
        const session = Utils.storage.get(STORAGE_KEYS.SESSION_TOKEN);
        if (session) {
            session.lastActivity = Date.now();
            Utils.storage.set(STORAGE_KEYS.SESSION_TOKEN, session);
        }
    },

    /* ---- Get current session ---- */
    get() {
        return Utils.storage.get(STORAGE_KEYS.SESSION_TOKEN);
    },

    /* ---- Destroy session ---- */
    destroy() {
        Utils.storage.remove(STORAGE_KEYS.SESSION_TOKEN);
        Utils.storage.remove(STORAGE_KEYS.LAST_ACTIVITY);
        App.sessionToken = null;
        App.user = null;
    },

    /* ---- Require login — redirect if not logged in ---- */
    requireLogin() {
        if (!this.isValid() || this.isIdle()) {
            this.destroy();
            window.location.href = 'index.html';
            return false;
        }
        this.touch();
        return true;
    },
};

/* ============================================================
   9. LOGIN FLOW (index.html)
   ============================================================ */

const LoginFlow = {
    step: 1,
    username: CONFIG.ADMIN_USERNAME || 'admin',
    otpInput: '',
    passwordVerified: false,

    init() {
        const brandName = Utils.$('#brandName');
        const brandVer = Utils.$('#brandVersion');
        const logoIcon = Utils.$('#logoIcon');
        const yearSpan = Utils.$('#yearSpan');
        if (brandName) brandName.textContent = CONFIG.APP_NAME;
        if (brandVer) brandVer.textContent = 'v' + CONFIG.APP_VERSION;
        if (logoIcon) logoIcon.textContent = CONFIG.APP_LOGO;
        if (yearSpan) yearSpan.textContent = new Date().getFullYear();

        if (Session.isValid() && !Session.isIdle()) {
            window.location.href = 'pages/dashboard.html';
            return;
        }
        this.attachStep1();
        this.attachStep2();
        setTimeout(() => Utils.$('#passwordInput')?.focus(), 300);
    },

    goTo(step) {
        this.step = step;
        Utils.$$('.login-step').forEach(el => el.classList.remove('active'));
        Utils.$(`#step${step}`)?.classList.add('active');
        Alert.hide();
    },

    /* Password is checked first; only then is OTP sent. */
    attachStep1() {
        const form = Utils.$('#passwordForm');
        const input = Utils.$('#passwordInput');
        const toggle = Utils.$('#passwordToggle');
        const btn = Utils.$('#sendOtpBtn');
        if (!form || !input || !btn) return;

        toggle?.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        input.addEventListener('input', () => Utils.$('#passwordGroup')?.classList.remove('has-error'));
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.verifyPasswordAndSendOTP();
        });
    },

    async verifyPasswordAndSendOTP() {
        const input = Utils.$('#passwordInput');
        const btn = Utils.$('#sendOtpBtn');
        const password = input?.value || '';
        if (!password) {
            Alert.show('Password required hai', 'error');
            Utils.$('#passwordGroup')?.classList.add('has-error');
            input?.focus();
            return;
        }

        btn.classList.add('loading');
        btn.disabled = true;
        try {
            const hash = await Utils.sha256(password);
            if (hash !== CONFIG.MASTER_PASSWORD_HASH) {
                throw new Error('Galat password!');
            }
            this.passwordVerified = true;
            await OTP.send(this.username);
            Utils.storage.set(STORAGE_KEYS.USERNAME, this.username);
            Toast.success('Password sahi hai — OTP bhej diya gaya!');
            const preview = Utils.$('#otpTargetPreview');
            if (preview) preview.textContent = 'Telegram';
            input.value = '';
            this.goTo(2);
            this.clearOTPInputs();
            setTimeout(() => Utils.$('.otp-input')?.focus(), 300);
            this.startOTPTimer();
            this.startResendCooldown();
        } catch (err) {
            this.passwordVerified = false;
            Alert.show(err.message || 'Password verify nahi ho paya.', 'error', 6000);
            Utils.$('#passwordGroup')?.classList.add('has-error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    },

    attachStep2() {
        const form = Utils.$('#otpForm');
        const inputs = Utils.$$('.otp-input');
        const backBtn = Utils.$('#backToStep1Btn');
        const resendBtn = Utils.$('#resendOtpBtn');
        if (!form) return;

        inputs.forEach((inp, idx) => {
            inp.addEventListener('input', event => {
                const digits = event.target.value.replace(/\D/g, '').split('');
                inputs[idx].value = digits[0] || '';
                inputs[idx].classList.toggle('filled', !!digits[0]);
                if (digits.length > 1) {
                    digits.slice(1).forEach((digit, offset) => {
                        if (inputs[idx + 1 + offset]) {
                            inputs[idx + 1 + offset].value = digit;
                            inputs[idx + 1 + offset].classList.add('filled');
                        }
                    });
                }
                if (digits.length && inputs[Math.min(idx + digits.length, inputs.length - 1)]) {
                    inputs[Math.min(idx + digits.length, inputs.length - 1)].focus();
                }
                this.checkOTPComplete();
            });
            inp.addEventListener('keydown', event => {
                if (event.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
                if (event.key === 'ArrowLeft' && idx > 0) inputs[idx - 1].focus();
                if (event.key === 'ArrowRight' && idx < inputs.length - 1) inputs[idx + 1].focus();
            });
            inp.addEventListener('paste', event => {
                event.preventDefault();
                const digits = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').split('');
                digits.slice(0, inputs.length).forEach((digit, i) => {
                    inputs[i].value = digit;
                    inputs[i].classList.add('filled');
                });
                this.checkOTPComplete();
            });
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            await this.verifyOTP();
        });
        backBtn?.addEventListener('click', () => { OTP.clear(); this.passwordVerified = false; this.goTo(1); });
        resendBtn?.addEventListener('click', () => this.resendOTP());
    },

    checkOTPComplete() {
        const inputs = Utils.$$('.otp-input');
        const btn = Utils.$('#verifyOtpBtn');
        if (btn) btn.disabled = !inputs.every(input => input.value.length === 1);
    },

    getOTPValue() { return Utils.$$('.otp-input').map(input => input.value).join(''); },

    clearOTPInputs() {
        Utils.$$('.otp-input').forEach(input => {
            input.value = '';
            input.classList.remove('filled', 'error');
        });
        this.checkOTPComplete();
    },

    async verifyOTP() {
        const otp = this.getOTPValue();
        const btn = Utils.$('#verifyOtpBtn');
        if (!this.passwordVerified) {
            Alert.show('Pehle password verify karein.', 'error');
            this.goTo(1);
            return;
        }
        if (otp.length !== CONFIG.OTP_LENGTH) {
            Alert.show('Kripya pura 6-digit OTP dalein', 'error');
            return;
        }
        btn.classList.add('loading');
        btn.disabled = true;
        const result = OTP.verify(otp);
        btn.classList.remove('loading');
        if (!result.success) {
            Utils.$$('.otp-input').forEach(input => input.classList.add('error'));
            setTimeout(() => this.clearOTPInputs(), 600);
            Alert.show(result.reason === 'expired' ? 'OTP expire ho gaya.' : 'Galat OTP! Dobara try karein.', 'error');
            return;
        }
        OTP.clear();
        Session.create(this.username);
        Toast.success('OTP verified — dashboard open ho raha hai!');
        window.location.href = 'pages/dashboard.html';
    },

    startOTPTimer() {
        const timerEl = Utils.$('#otpTimer');
        const valueEl = Utils.$('#otpTimerValue');
        if (!timerEl || !valueEl) return;
        timerEl.classList.remove('expired');
        OTP.startTimer(() => {
            timerEl.classList.add('expired');
            valueEl.textContent = 'Expired';
            Utils.$('#verifyOtpBtn').disabled = true;
            Alert.show('OTP expire ho gaya. Naya OTP bhejein.', 'warning');
        }, remaining => { valueEl.textContent = OTP.formatTime(remaining); });
    },

    startResendCooldown() {
        const btn = Utils.$('#resendOtpBtn');
        if (!btn) return;
        btn.disabled = true;
        OTP.startResendCooldown(30, remaining => {
            btn.textContent = remaining ? `🔄 Resend in ${remaining}s` : '🔄 Resend OTP';
            btn.disabled = remaining > 0;
        });
    },

    async resendOTP() {
        const btn = Utils.$('#resendOtpBtn');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        try {
            await OTP.send(this.username);
            Toast.success('Naya OTP bhej diya!');
            this.clearOTPInputs();
            Utils.$('.otp-input')?.focus();
            this.startOTPTimer();
            this.startResendCooldown();
        } catch (err) {
            Alert.show(err.message || 'OTP resend nahi ho paya.', 'error');
            btn.disabled = false;
        }
    }
};

/* ============================================================
   10. LOGOUT
   ============================================================ */
function logout() {
    Modal.confirm({
        title: '🚪 Logout',
        message: 'Kya aap logout karna chahte hain?',
        confirmText: 'Yes, Logout',
        cancelText: 'Cancel',
        type: 'danger',
        onConfirm: () => {
            Session.destroy();
            Toast.info('Logging out...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        },
    });
}

/* ============================================================
   11. IDLE DETECTION
   ============================================================ */

const Idle = {
    timer: null,
    warningTimer: null,
    warningShown: false,

    start() {
        this.stop();

        const reset = Utils.throttle(() => {
            Session.touch();
            this.warningShown = false;
            if (this.warningTimer) clearTimeout(this.warningTimer);
        }, 1000);

        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, reset, { passive: true });
        });

        /* ---- Check idle every 30 seconds ---- */
        this.timer = setInterval(() => {
            if (Session.isIdle() && !this.warningShown) {
                this.showWarning();
            }
        }, 30000);
    },

    stop() {
        if (this.timer) clearInterval(this.timer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        this.timer = null;
        this.warningTimer = null;
        this.warningShown = false;
    },

    showWarning() {
        this.warningShown = true;
        const remaining = CONFIG.IDLE_WARNING_SECONDS;

        Toast.warning(
            `Aap ${Math.floor(CONFIG.IDLE_TIMEOUT_MINUTES)} minute se idle hain. ` +
            `Auto-logout in ${remaining} seconds...`,
            10000
        );

        this.warningTimer = setTimeout(() => {
            if (Session.isIdle()) {
                Session.destroy();
                Toast.error('Session expired. Redirecting...');
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1000);
            }
        }, remaining * 1000);
    },
};

/* ============================================================
   12. INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    Toast.init();

    /* ---- Detect page ---- */
    const isLoginPage = !!Utils.$('#loginCard');

    if (isLoginPage) {
        LoginFlow.init();
    } else {
        /* ---- Protected page ---- */
        if (!Session.requireLogin()) return;

        Idle.start();

        /* ---- Update activity on any click ---- */
        document.addEventListener('click', () => Session.touch(), { passive: true });
    }
});

/* ============================================================
   13. GLOBAL EXPORTS
   ============================================================ */
window.App = App;
window.Utils = Utils;
window.Toast = Toast;
window.Modal = Modal;
window.Loader = Loader;
window.Alert = Alert;
window.API = API;
window.OTP = OTP;
window.Session = Session;
window.LoginFlow = LoginFlow;
window.Idle = Idle;
window.logout = logout;

/* ============================================================
   14. AUTO MOBILE FIXER — JUGAAD
   Ye har page par automatically inline styles aur canvas fix karega
   ============================================================ */
(function() {

    function autoFixMobile() {
        try {
            /* ---- Fix 1: Har canvas se height/width attribute hatao ---- */
            document.querySelectorAll('canvas[height], canvas[width]').forEach(function(canvas) {
                canvas.removeAttribute('height');
                canvas.removeAttribute('width');
            });

            /* ---- Fix 2: Canvas ke parent ko chart-container banao ---- */
            document.querySelectorAll('canvas').forEach(function(canvas) {
                var parent = canvas.parentElement;
                if (!parent) return;

                /* Agar pehle se chart-container hai to skip */
                if (parent.classList.contains('chart-container')) return;

                /* Inline styles hatao jo mobile tod rahe hain */
                parent.style.display = '';
                parent.style.alignItems = '';
                parent.style.justifyContent = '';
                parent.style.minHeight = '';
                parent.style.height = '';

                /* Naya class laga */
                parent.classList.add('chart-container');
            });

            /* ---- Fix 3: Inline style jo form-select ko tod rahe ---- */
            document.querySelectorAll('select[style]').forEach(function(sel) {
                if (sel.style.height) sel.style.height = '';
                if (sel.style.fontSize) sel.style.fontSize = '';
            });

            /* ---- Fix 4: Inline padding wale card-body ko theek karo ---- */
            document.querySelectorAll('.card-body[style*="padding: 0"], .card-body[style*="padding:0"]').forEach(function(el) {
                el.style.overflow = 'hidden';
                el.style.borderRadius = 'var(--radius-md)';
            });

            /* ---- Fix 5: Inline min-height wale card-body bhi fix karo ---- */
            document.querySelectorAll('.card-body[style*="min-height"]').forEach(function(el) {
                if (!el.classList.contains('chart-container')) {
                    el.classList.add('chart-container');
                }
            });

        } catch (e) {
            console.warn('Auto mobile fix error:', e);
        }
    }

    /* ---- DOM ready hone ke baad run ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoFixMobile);
    } else {
        autoFixMobile();
    }

    /* ---- Dynamic content ke liye multiple runs ---- */
    setTimeout(autoFixMobile, 300);
    setTimeout(autoFixMobile, 1000);
    setTimeout(autoFixMobile, 2000);

    /* ---- Load hone par bhi run ---- */
    window.addEventListener('load', autoFixMobile);

})();

/* ============================================================
   15. AUTO BACKUP — Panel khulte hi automatic backup
   ============================================================ */
(function() {

    /* ---- Config ---- */
    const AUTO_BACKUP_ENABLED = true;      /* false karo to band */
    const LAST_BACKUP_KEY = 'last_auto_backup_date';

    async function autoBackupOnLoad() {
        if (!AUTO_BACKUP_ENABLED) return;

        /* --- Sirf logged-in page par --- */
        if (typeof Session === 'undefined' || !Session.isValid()) return;
        if (typeof API === 'undefined') return;

        /* --- Aaj backup ho chuka hai? --- */
        const today = new Date().toISOString().split('T')[0];
        const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);

        if (lastBackup === today) {
            console.log('⏭️ Aaj ka backup ho chuka hai');
            return;
        }

        console.log('🔄 Auto backup shuru...');

        try {
            const result = await API.createBackup('json');

            if (result && result.success) {
                localStorage.setItem(LAST_BACKUP_KEY, today);
                console.log('✅ Auto backup safal');
                if (typeof Toast !== 'undefined') {
                    Toast.success('💾 Auto backup ho gaya');
                }
            } else {
                console.warn('⚠️ Auto backup fail:', result && result.error);
            }
        } catch (err) {
            console.warn('⚠️ Auto backup error:', err.message);
        }
    }

    /* ---- Page load hone ke 4 second baad ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(autoBackupOnLoad, 4000));
    } else {
        setTimeout(autoBackupOnLoad, 4000);
    }

    /* ---- Manual trigger ke liye expose ---- */
    window.autoBackupOnLoad = autoBackupOnLoad;

})();

/* ============================================================
   16. AUTO GITHUB RESTORE — Panel khulte hi GitHub se data laao
   ============================================================ */
(function() {

    /* ---- Config ---- */
    const GITHUB_RESTORE_ENABLED = true;   /* false karo to band */
    const GITHUB_RESTORE_INTERVAL_HOURS = 1; /* Har 1 ghante me ek baar */
    const LAST_KEY = 'last_github_restore';

    async function autoRestoreFromGitHub() {
        if (!GITHUB_RESTORE_ENABLED) return;

        /* --- Sirf logged-in page par --- */
        if (typeof Session === 'undefined' || !Session.isValid()) return;
        if (typeof API === 'undefined') return;

        /* --- Pichle restore ka time --- */
        const last = parseInt(localStorage.getItem(LAST_KEY) || '0');
        const now = Date.now();
        const gapMs = now - last;
        const intervalMs = GITHUB_RESTORE_INTERVAL_HOURS * 60 * 60 * 1000;

        /* --- Abhi restore karna hai? --- */
        if (gapMs < intervalMs) {
            console.log('⏭️ GitHub restore skipped — ' +
                Math.round(gapMs / 60000) + ' min pehle hua tha');
            return;
        }

        console.log('🔄 GitHub se data laa raha hun...');

        try {
            if (typeof API.restoreFromGitHub === 'function') {
                const result = await API.restoreFromGitHub();

                if (result && result.success) {
                    console.log('✅ GitHub se data mil gaya');
                    localStorage.setItem(LAST_KEY, String(now));

                    /* --- Toast dikhao --- */
                    if (typeof Toast !== 'undefined') {
                        Toast.success('📥 GitHub se data sync ho gaya');
                    }

                    /* --- Dashboard refresh karo (agar dashboard par hain) --- */
                    if (window.location.pathname.indexOf('dashboard') !== -1) {
                        setTimeout(function() {
                            window.location.reload();
                        }, 1500);
                    }
                } else {
                    console.warn('⚠️ GitHub restore fail:', result && result.error);
                }
            } else {
                console.warn('⚠️ restoreFromGitHub function nahi mila');
            }
        } catch (err) {
            console.warn('⚠️ GitHub restore error:', err.message);
        }
    }

    /* ---- Page load hone ke 2 second baad (backup se pehle) ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(autoRestoreFromGitHub, 2000));
    } else {
        setTimeout(autoRestoreFromGitHub, 2000);
    }

    /* ---- Manual trigger ke liye expose ---- */
    window.autoRestoreFromGitHub = autoRestoreFromGitHub;

})();