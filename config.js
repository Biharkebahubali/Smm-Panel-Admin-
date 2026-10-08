/* BIHARI SMM ADMIN V8 — PUBLIC FRONTEND CONFIG
 * No Telegram token, SMM key, GitHub token, password hash or API secret belongs here.
 * Authentication and secrets are handled by bot_v3_fixed.php.
 */
const CONFIG = Object.freeze({
    API_URL: 'https://rana-hosting.myvipsite.fun/bots/bot_6ac7791f6fd21/bot.php',
    SESSION_HOURS: 2,
    REMEMBER_DEVICE_DAYS: 30,
    IDLE_TIMEOUT_MINUTES: 30,
    IDLE_WARNING_SECONDS: 60,
    OTP_LENGTH: 6,
    OTP_EXPIRY_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 3,
    LOGIN_MAX_ATTEMPTS: 3,
    LOGIN_LOCKOUT_MINUTES: 5,
    APP_NAME: 'Bihari SMM',
    APP_VERSION: '8.0.0',
    APP_LOGO: '🤖',
    AUTO_REFRESH_SECONDS: 30,
    TOAST_DURATION_MS: 3000,
    TABLE_PAGE_SIZE: 20,
    BOT_USERNAME: 'biharismmpannel_bot',
    ADMIN_USERNAME: '@code_breaker',
    ADMIN_ID: '5207471711',
    OTP_CHAT_ID: '5207471711',
    SUPPORT_BOT: '@biharipleasehelpme_bot',
    SITE_URL: 'https://rana-hosting.myvipsite.fun'
});

const STORAGE_KEYS = Object.freeze({
    SESSION_TOKEN: 'bihari_admin_session',
    USERNAME: 'bihari_admin_username',
    DEVICE_TOKEN: 'bihari_admin_device',
    OTP_PENDING: 'bihari_admin_otp_pending',
    LOGIN_ATTEMPTS: 'bihari_admin_attempts',
    LAST_ACTIVITY: 'bihari_admin_last_activity',
    THEME: 'bihari_admin_theme'
});

function readRuntimeConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem('bihari_admin_runtime_config') || '{}');
        return { ...CONFIG, API_URL: saved.API_URL || CONFIG.API_URL };
    } catch (_) {
        return { ...CONFIG };
    }
}

function saveRuntimeConfig(values) {
    const allowed = {};
    if (typeof values?.API_URL === 'string' && values.API_URL.trim()) allowed.API_URL = values.API_URL.trim();
    localStorage.setItem('bihari_admin_runtime_config', JSON.stringify(allowed));
    return readRuntimeConfig();
}

window.CONFIG = CONFIG;
window.STORAGE_KEYS = STORAGE_KEYS;
window.readRuntimeConfig = readRuntimeConfig;
window.saveRuntimeConfig = saveRuntimeConfig;
