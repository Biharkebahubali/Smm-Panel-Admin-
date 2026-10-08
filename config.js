/* ============================================================
   BIHARI SMM ADMIN PANEL — FILE-ONLY CONFIGURATION
   Credentials are included for the requested direct-upload setup.
   Do not publish this folder in a public repository.
   ============================================================ */
const CONFIG = Object.freeze({
    API_URL: 'https://rana-hosting.myvipsite.fun/bots/bot_6ac7791f6fd21/bot.php',
    OTP_BOT_TOKEN: '8621924474:AAExk1IoXD2x2awK4Y5UiijG4NfLpehClqc',
    OTP_CHAT_ID: '5207471711',
    MASTER_PASSWORD_HASH: '2456fbdb6551e3d3610f178345c7c906e437cbc378d71dee4b588bfcaa482f8e',
    SESSION_HOURS: 2,
    IDLE_TIMEOUT_MINUTES: 30,
    IDLE_WARNING_SECONDS: 60,
    OTP_LENGTH: 6,
    OTP_EXPIRY_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 3,
    LOGIN_MAX_ATTEMPTS: 3,
    LOGIN_LOCKOUT_MINUTES: 5,
    APP_NAME: 'Bihari SMM',
    APP_VERSION: '7.0.1',
    APP_LOGO: '🤖',
    AUTO_REFRESH_SECONDS: 30,
    TOAST_DURATION_MS: 3000,
    TABLE_PAGE_SIZE: 20,
    BOT_USERNAME: 'biharismmpannel_bot',
    ADMIN_USERNAME: '@code_breaker',
    SUPPORT_BOT: '@biharipleasehelpme_bot',
    UPI_ID: 'code-breakerkumar@fam',
    SMM_API_URL: 'https://tntsmm.in/api/v2',
    SMM_API_KEY: '79256c2e7ed8385e1c0f26993a706ea2',
    LOG_CHANNEL: '-1003825882347',
    GITHUB_TOKEN: 'ghp_r27rwtV9UdStiUa0Qcj61hEVK',
    GITHUB_DATA_REPO: 'Biharkebahubali/Bihari-Smm-Panel-Data',
    GITHUB_DATA_FILE: 'bot_data.json',
    SITE_URL: 'https://rana-hosting.myvipsite.fun',
});

const STORAGE_KEYS = Object.freeze({
    SESSION_TOKEN: 'bihari_admin_session',
    USERNAME: 'bihari_admin_username',
    DEVICE_TOKEN: 'bihari_admin_device',
    OTP_PENDING: 'bihari_admin_otp_pending',
    LOGIN_ATTEMPTS: 'bihari_admin_attempts',
    LAST_ACTIVITY: 'bihari_admin_last_activity',
    THEME: 'bihari_admin_theme',
    RUNTIME_CONFIG: 'bihari_admin_runtime_config',
});

function readRuntimeConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.RUNTIME_CONFIG) || '{}');
        return { ...CONFIG, API_URL: saved.API_URL || CONFIG.API_URL, API_KEY: saved.API_KEY || CONFIG.API_KEY };
    } catch (_) {
        return { ...CONFIG };
    }
}

function saveRuntimeConfig(values) {
    const allowed = {};
    if (typeof values.API_URL === 'string') allowed.API_URL = values.API_URL.trim();
    if (typeof values.API_KEY === 'string') allowed.API_KEY = values.API_KEY.trim();
    localStorage.setItem(STORAGE_KEYS.RUNTIME_CONFIG, JSON.stringify(allowed));
    return readRuntimeConfig();
}

window.CONFIG = CONFIG;
window.STORAGE_KEYS = STORAGE_KEYS;
window.readRuntimeConfig = readRuntimeConfig;
window.saveRuntimeConfig = saveRuntimeConfig;
