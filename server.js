// ════════════════════════════════════════════════════════════
// VIKRAM PORTFOLIO + STORE — server.js v2.0
// PART 1: Setup + Config + Database + Security + Helpers
// ════════════════════════════════════════════════════════════
// ✅ 100% FREE — Telegram + Email only
// ✅ 10 Templates system
// ✅ 200+ Admin settings
// ✅ Maintenance mode support
// ════════════════════════════════════════════════════════════

// ------------------------------------------------------------
// 1. IMPORTS
// ------------------------------------------------------------
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// ------------------------------------------------------------
// 2. LOAD CONFIG
// ------------------------------------------------------------
const config = require('./config');

// ------------------------------------------------------------
// 3. DIRECTORY SETUP
// ------------------------------------------------------------
const ROOT = __dirname;
const dataDir = config.app.dataDir;
const uploadDir = config.app.uploadDir;
const logsDir = config.app.logsDir;
const filesDir = config.paths.uploadsFiles;
const proofsDir = config.paths.uploadsProofs;
const imagesDir = config.paths.uploadsImages;
const avatarsDir = config.paths.uploadsAvatars;
const portfoliosDir = config.paths.uploadsPortfolios;
const publicDir = path.join(ROOT, 'public');
const templatesDir = path.join(ROOT, 'assets', 'templates');

// Create all required directories
[
  dataDir,
  uploadDir,
  logsDir,
  filesDir,
  proofsDir,
  imagesDir,
  avatarsDir,
  portfoliosDir
].forEach(dir => {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
});

// Startup file check
function verifyPublicFiles() {
  const required = ['index.html', 'login.html', 'dashboard.html', 'admin.html', 'file.html'];
  const missing = [];
  const found = [];

  for (const file of required) {
    const fullPath = path.join(publicDir, file);
    if (fs.existsSync(fullPath)) found.push(file);
    else missing.push(file);
  }

  console.log('📁 Public folder:', publicDir);
  console.log('✅ Found:', found.join(', ') || '(none)');
  if (missing.length) {
    console.warn('⚠️  MISSING:', missing.join(', '));
    console.warn('⚠️  ये files public/ folder में होनी चाहिए!');
  }
  return { found, missing };
}

// Template files check
function verifyTemplates() {
  const templates = config.templates.map(t => t.id);
  const found = [];
  const missing = [];

  for (const id of templates) {
    const filePath = path.join(templatesDir, `${id}.css`);
    if (fs.existsSync(filePath)) found.push(id);
    else missing.push(id);
  }

  console.log('🎨 Templates found:', found.length, '/', templates.length);
  if (missing.length) {
    console.warn('⚠️  Missing templates:', missing.join(', '));
  }
  return { found, missing };
}

// ------------------------------------------------------------
// 4. DATABASE CONNECTION
// ------------------------------------------------------------
const db = new Database(path.join(dataDir, 'portfolio.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

// Load schema only if tables don't exist yet
try {
  const tablesExist = db.prepare(
    "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='users'"
  ).get().c > 0;

  if (!tablesExist) {
    const schemaPath = path.join(ROOT, 'database', 'init.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);
      console.log('✅ Database schema loaded (fresh install)');
    } else {
      console.warn('⚠️  init.sql not found at', schemaPath);
    }
  } else {
    console.log('✅ Database already initialized');
  }
} catch (err) {
  console.error('❌ Database schema error:', err.message);
}

// ------------------------------------------------------------
// 5. LOGGER
// ------------------------------------------------------------
const logFile = path.join(logsDir, 'activity.log');
const errorFile = path.join(logsDir, 'errors.log');

function writeLog(file, line) {
  try {
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`);
  } catch (e) {
    console.error('Log write failed:', e.message);
  }
}

const log = (actor, action, details = null) => {
  try {
    db.prepare('INSERT INTO activity_log (actor_type, action, details) VALUES (?, ?, ?)')
      .run(actor, action, details);
    writeLog(logFile, `${actor} → ${action} ${details || ''}`);
  } catch (e) {
    console.error('Log error:', e.message);
  }
};

// ------------------------------------------------------------
// 6. SECURITY HELPERS
// ------------------------------------------------------------
const JWT_SECRET = config.server.jwtSecret;
const SESSION_HOURS = config.server.sessionHours || 2;
const BCRYPT_ROUNDS = config.security.bcryptRounds || 10;
const OTP_EXPIRY_MIN = config.security.otpExpiryMinutes || 5;
const OTP_MAX_ATTEMPTS = config.security.otpMaxAttempts || 3;

// -------- Password --------
const hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS);

const comparePassword = async (pw, hash) => {
  try { return await bcrypt.compare(pw, hash); }
  catch { return false; }
};

// -------- JWT --------
const signToken = (user) => jwt.sign(
  {
    id: user.id,
    role: user.role || 'user',
    email: user.email,
    name: user.name,
    is_vip: user.is_vip || 0,
    type: user.type || 'user'
  },
  JWT_SECRET,
  { expiresIn: `${SESSION_HOURS}h` }
);

const verifyToken = (token) => {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
};

// -------- Auth Middleware --------
function auth(req, res, next) {
  try {
    const token = req.cookies?.session || req.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Login required.', loginRequired: true });
    }
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Login again.', loginRequired: true });
  }
}

function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.session || req.headers?.authorization?.replace('Bearer ', '');
    if (token) req.user = jwt.verify(token, JWT_SECRET);
  } catch {}
  next();
}

function adminOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login required.' });
  if (req.user.role !== 'admin' && req.user.type !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// -------- OTP --------
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const saveOTP = async (identifier, otp, purpose = 'admin_login') => {
  const hash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000).toISOString();
  db.prepare('INSERT INTO otps (identifier, otp_hash, purpose, expires_at) VALUES (?, ?, ?, ?)')
    .run(identifier, hash, purpose, expiresAt);
  return { otp, expiresAt };
};

const checkOTP = async (identifier, otp, purpose = 'admin_login') => {
  const record = db.prepare(`
    SELECT * FROM otps WHERE identifier = ? AND purpose = ? AND is_used = 0
    ORDER BY id DESC LIMIT 1
  `).get(identifier, purpose);

  if (!record) return { valid: false, error: 'OTP not found.' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, error: 'OTP expired.' };
  if (record.attempts >= OTP_MAX_ATTEMPTS) return { valid: false, error: 'Too many attempts.' };

  const ok = await bcrypt.compare(otp, record.otp_hash);
  if (!ok) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    return { valid: false, error: 'Wrong OTP.' };
  }
  db.prepare('UPDATE otps SET is_used = 1 WHERE id = ?').run(record.id);
  return { valid: true };
};

// ------------------------------------------------------------
// 7. VALIDATION HELPERS
// ------------------------------------------------------------
const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

const validatePassword = (pw) => {
  if (!pw || pw.length < 8) return { valid: false, error: 'Password 8+ characters ka hona chahiye.' };
  if (!/[A-Z]/.test(pw)) return { valid: false, error: 'Ek uppercase letter chahiye.' };
  if (!/[a-z]/.test(pw)) return { valid: false, error: 'Ek lowercase letter chahiye.' };
  if (!/[0-9]/.test(pw)) return { valid: false, error: 'Ek number chahiye.' };
  return { valid: true };
};

const validatePhone = (phone) => /^[6-9]\d{9}$/.test((phone || '').replace(/\D/g, ''));

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').trim();
};

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = {};
  for (const key in obj) {
    clean[key] = typeof obj[key] === 'string' ? sanitizeInput(obj[key]) : obj[key];
  }
  return clean;
};

const cleanRemoteUrl = (value) => {
  if (!value) return null;
  try {
    const u = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString().slice(0, 2000);
  } catch { return null; }
};

// ------------------------------------------------------------
// 8. UTILITIES
// ------------------------------------------------------------
const generateRandomString = (len = 32) =>
  crypto.randomBytes(len).toString('hex').slice(0, len);

const hashString = (str) => crypto.createHash('sha256').update(str).digest('hex');

const generateSlug = (text) => (text || '')
  .toLowerCase().trim()
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const generateReferralCode = (userId) => {
  const base = Buffer.from(`vikram-${userId}-${Date.now()}`).toString('base64');
  return base.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
};

const getClientIP = (req) =>
  req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

const anonymizeIP = (ip) => {
  if (!ip) return 'unknown';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  return ip;
};

const getUA = (req) => (req.get('user-agent') || '').slice(0, 500);

const getFileSize = (filePath) => {
  try { return fs.statSync(filePath).size; } catch { return 0; }
};

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
};

const deleteFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) { console.error('Delete file error:', e.message); }
  return false;
};

const deleteProductFile = (relativePath) => {
  if (!relativePath) return false;
  const full = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(filesDir, path.basename(relativePath));
  return deleteFile(full);
};

// ------------------------------------------------------------
// 9. RATE LIMITERS
// ------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.security.loginAttemptsPerMinute || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait 1 minute.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' }
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests.' }
});

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Download limit reached. Try after 1 hour.' }
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Wait a minute.' }
});

// ------------------------------------------------------------
// 10. FILE SERVICE (Multer)
// ------------------------------------------------------------
const MAX_UPLOAD_MB = config.security.maxUploadMB || 100;
const TOKEN_MINUTES = config.security.downloadTokenMinutes || 10;

const allowedFileTypes = [
  'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
  'application/x-7z-compressed', 'application/pdf',
  'application/vnd.android.package-archive', 'application/octet-stream',
  'video/mp4', 'video/x-matroska', 'video/quicktime',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

function makeStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(destDir, { recursive: true });
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
      const ext = path.extname(file.originalname);
      const safeName = path.basename(file.originalname, ext)
        .replace(/[^\w\-]/g, '_').slice(0, 50);
      cb(null, `${safeName}-${unique}${ext}`);
    }
  });
}

const productUpload = multer({
  storage: makeStorage(filesDir),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedFileTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
});

const imageUpload = multer({
  storage: makeStorage(imagesDir),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

const proofUpload = multer({
  storage: makeStorage(proofsDir),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG/JPG/WEBP allowed'), false);
  }
});

// ------------------------------------------------------------
// 11. DOWNLOAD TOKENS + FILE STREAMING
// ------------------------------------------------------------
const generateDownloadToken = (userId, productId, ipAddress = null) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_MINUTES * 60 * 1000).toISOString();
  db.prepare('INSERT INTO download_tokens (token, user_id, product_id, ip_address, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, userId, productId, ipAddress, expiresAt);
  return { token, expiresAt, expiresInMinutes: TOKEN_MINUTES };
};

const verifyDownloadToken = (token, ipAddress = null) => {
  const record = db.prepare('SELECT * FROM download_tokens WHERE token = ? AND is_used = 0').get(token);
  if (!record) return { valid: false, error: 'Token not found or already used' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, error: 'Token expired' };
  return { valid: true, record };
};

const markTokenUsed = (token) => {
  try { db.prepare('UPDATE download_tokens SET is_used = 1 WHERE token = ?').run(token); }
  catch (e) { console.error('Token mark error:', e.message); }
};

const trackDownload = (productId, userId, ip, userAgent) => {
  try {
    db.prepare('INSERT INTO download_history (user_id, product_id, ip_address, user_agent) VALUES (?, ?, ?, ?)')
      .run(userId, productId, ip, userAgent);
    db.prepare('UPDATE products SET download_count = download_count + 1 WHERE id = ?').run(productId);
    db.prepare('UPDATE purchases SET download_count = download_count + 1 WHERE user_id = ? AND product_id = ?')
      .run(userId, productId);
    db.prepare('INSERT INTO analytics_downloads (product_id, user_id, ip_address) VALUES (?, ?, ?)')
      .run(productId, userId, ip);
  } catch (e) { console.error('Track download error:', e.message); }
};

const streamFile = (res, filePath, downloadName) => {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on server' });
  }
  const stat = fs.statSync(filePath);
  const safeName = (downloadName || path.basename(filePath)).replace(/[^\w\-\.]/g, '_');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('Stream error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'File stream failed' });
  });
};

// ------------------------------------------------------------
// 12. ACCESS CONTROL
// ------------------------------------------------------------
const canDownload = (userId, productId) => {
  if (!userId || !productId) return false;
  const purchase = db.prepare(
    'SELECT * FROM purchases WHERE user_id = ? AND product_id = ? AND is_active = 1'
  ).get(userId, productId);
  if (!purchase) return false;
  if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) return false;
  return true;
};

const hasAccess = (userId, productId, userIsVip = false) => {
  const product = db.prepare('SELECT access_type FROM products WHERE id = ?').get(productId);
  if (!product) return { allowed: false, reason: 'Product not found' };
  if (product.access_type === 'free') return { allowed: true, reason: 'free' };
  if (product.access_type === 'vip') {
    if (userIsVip) return { allowed: true, reason: 'vip' };
    return { allowed: false, reason: 'VIP required' };
  }
  if (canDownload(userId, productId)) return { allowed: true, reason: 'purchased' };
  if (userIsVip) return { allowed: true, reason: 'vip_access' };
  return { allowed: false, reason: 'Purchase required' };
};

// ------------------------------------------------------------
// 13. SECURITY HELPERS
// ------------------------------------------------------------
const setSessionCookie = (req, res, token) => {
  const isProd = process.env.NODE_ENV === 'production' ||
                 req.headers['x-forwarded-proto'] === 'https';
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/'
  });
};

const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  is_vip: u.is_vip,
  avatar: u.avatar,
  is_verified: u.is_verified
});

// ------------------------------------------------------------
// 14. DETECT HELPERS (Analytics)
// ------------------------------------------------------------
const detectDevice = (ua = '') => {
  const u = ua.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(u)) {
    return /ipad|tablet/.test(u) ? 'tablet' : 'mobile';
  }
  if (/bot|crawler|spider/.test(u)) return 'bot';
  return 'desktop';
};

const detectBrowser = (ua = '') => {
  if (/edg/i.test(ua)) return 'Edge';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/opera|opr/i.test(ua)) return 'Opera';
  return 'Other';
};

const detectOS = (ua = '') => {
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os|macintosh/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
};

const trackVisit = (page, ip, userAgent = '', referrer = '', userId = null) => {
  try {
    const device = detectDevice(userAgent);
    if (device === 'bot') return;
    db.prepare(`
      INSERT INTO analytics_visits (page, ip_address, user_agent, device, browser, os, referrer, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      (page || '').split('?')[0].slice(0, 200),
      ip || 'unknown',
      (userAgent || '').slice(0, 500),
      device,
      detectBrowser(userAgent),
      detectOS(userAgent),
      (referrer || '').slice(0, 500),
      userId
    );
  } catch (e) { console.error('Analytics visit error:', e.message); }
};

// ------------------------------------------------------------
// 15. SETTINGS CACHE SERVICE (NEW)
// ------------------------------------------------------------
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_MS = 30 * 1000; // 30 seconds

function loadSettings() {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_MS) {
    return settingsCache;
  }
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    settingsCache = settings;
    settingsCacheTime = now;
    return settings;
  } catch (err) {
    console.error('Settings load error:', err.message);
    return settingsCache || {};
  }
}

function clearSettingsCache() {
  settingsCache = null;
  settingsCacheTime = 0;
}

function getSetting(key, defaultValue = null) {
  const settings = loadSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

function getBoolSetting(key, defaultValue = false) {
  const val = getSetting(key, null);
  if (val === null) return defaultValue;
  return val === 'true' || val === '1';
}

// ------------------------------------------------------------
// 16. TEMPLATE SERVICE (NEW)
// ------------------------------------------------------------
function getActiveTemplate() {
  const templateId = getSetting('active_template', config.defaultTemplate);
  const template = config.templates.find(t => t.id === templateId) || config.templates[0];
  return template;
}

function getMaintenanceMode() {
  return getBoolSetting('maintenance_mode', false);
}

// ------------------------------------------------------------
// 17. EMAIL SERVICE
// ------------------------------------------------------------
const EMAIL_ENABLED = !!(config.email?.enabled && config.email?.smtp?.host);
let mailer = null;

if (EMAIL_ENABLED) {
  try {
    mailer = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port || 587,
      secure: config.email.smtp.port === 465,
      auth: { user: config.email.smtp.user, pass: config.email.smtp.pass }
    });
    console.log('✅ Email service initialized');
  } catch (err) {
    console.error('❌ Email setup failed:', err.message);
  }
}

const sendEmail = async ({ to, subject, html }) => {
  if (!EMAIL_ENABLED || !mailer) return { sent: false, reason: 'Email not configured' };
  try {
    const info = await mailer.sendMail({
      from: `"${config.app.name}" <${config.email.from}>`,
      to, subject, html
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { sent: false, reason: err.message };
  }
};

// ------------------------------------------------------------
// 18. TELEGRAM SERVICE
// ------------------------------------------------------------
const TG_ENABLED = !!(config.telegram?.enabled && config.telegram?.botToken);
const TG_API = `https://api.telegram.org/bot${config.telegram?.botToken}`;

const sendTelegram = async (text) => {
  if (!TG_ENABLED) return { sent: false, reason: 'Telegram not configured' };
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { sent: false, reason: data.description };
    return { sent: true, messageId: data.result?.message_id };
  } catch (err) {
    console.error('Telegram error:', err.message);
    return { sent: false, reason: err.message };
  }
};

const sendTelegramOTP = (otp, purpose = 'Admin Login') =>
  sendTelegram(`🔐 <b>OTP</b>\n\n<code>${otp}</code>\n\nPurpose: ${purpose}\nValid: 5 min`);

const sendTelegramPaymentAlert = (p) =>
  sendTelegram(`💰 <b>NEW PAYMENT</b>\n\nUser: ${p.userName}\nEmail: ${p.userEmail || '—'}\nFile: ${p.fileName}\nAmount: ₹${p.amount}\nUTR: <code>${p.utr}</code>`);

// ------------------------------------------------------------
// PART 1 ENDS HERE
// ------------------------------------------------------------
// Next: PART 2 (Payment service + Express setup + Public routes)
// ------------------------------------------------------------

module.exports = { db, log, loadSettings, clearSettingsCache };

// ════════════════════════════════════════════════════════════
// PART 2: Payment Service + Admin Helpers + Analytics
//         + Express App + Middleware + Public Routes
// ════════════════════════════════════════════════════════════

// ------------------------------------------------------------
// 19. PAYMENT SERVICE
// ------------------------------------------------------------
const paymentSubmit = ({ userId, productId, amount, utr, proofName, whatsapp, note }) => {
  if (!userId || !productId || !amount || !utr) throw new Error('Missing required fields');
  if (utr.length < 6) throw new Error('UTR must be at least 6 characters');

  const existing = db.prepare('SELECT id FROM payments WHERE utr = ? AND status != ?').get(utr, 'rejected');
  if (existing) throw new Error('This UTR is already submitted');

  const result = db.prepare(`
    INSERT INTO payments (user_id, product_id, amount, utr, proof_name, whatsapp, note, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(userId, productId, amount, utr.trim(), proofName || null, whatsapp || null, (note || '').slice(0, 500));

  log(String(userId), `payment submitted: product=${productId} amount=${amount} utr=${utr}`);
  return {
    id: result.lastInsertRowid,
    status: 'pending',
    message: 'Payment submitted. Verification in 24 hours.'
  };
};

const paymentGetById = (id) => db.prepare(`
  SELECT p.*, u.name as user_name, u.email as user_email,
         pr.title as product_title, pr.slug as product_slug
  FROM payments p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN products pr ON p.product_id = pr.id
  WHERE p.id = ?
`).get(id);

const paymentGetByUser = (userId) => db.prepare(`
  SELECT p.*, pr.title as product_title, pr.slug as product_slug, pr.thumbnail
  FROM payments p
  LEFT JOIN products pr ON p.product_id = pr.id
  WHERE p.user_id = ?
  ORDER BY p.created_at DESC
`).all(userId);

const paymentGetPending = () => db.prepare(`
  SELECT p.*, u.name as user_name, u.email as user_email, u.whatsapp as user_whatsapp,
         pr.title as product_title, pr.slug as product_slug
  FROM payments p
  LEFT JOIN users u ON p.user_id = u.id
  LEFT JOIN products pr ON p.product_id = pr.id
  WHERE p.status = 'pending'
  ORDER BY p.created_at ASC
`).all();

const paymentGetAll = ({ status, limit = 100, offset = 0 } = {}) => {
  let query = `
    SELECT p.*, u.name as user_name, u.email as user_email, pr.title as product_title
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN products pr ON p.product_id = pr.id
  `;
  const params = [];
  if (status && status !== 'all') {
    query += ' WHERE p.status = ?';
    params.push(status);
  }
  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(query).all(...params);
};

const paymentApprove = (id, adminId = null) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'approved') throw new Error('Already approved');

  const now = new Date().toISOString();
  const product = db.prepare('SELECT access_duration_days, slug, title FROM products WHERE id = ?')
    .get(payment.product_id);
  const durationDays = product?.access_duration_days || 365;
  const expiresAt = durationDays > 0
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const productLink = product?.slug ? `/file.html?slug=${product.slug}` : '/dashboard.html#purchases';

  const tx = db.transaction(() => {
    db.prepare('UPDATE payments SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?')
      .run('approved', adminId, now, id);

    db.prepare(`
      INSERT INTO purchases (user_id, product_id, payment_id, amount_paid, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        payment_id = excluded.payment_id,
        amount_paid = excluded.amount_paid,
        expires_at = excluded.expires_at,
        is_active = 1
    `).run(payment.user_id, payment.product_id, payment.id, payment.amount, expiresAt);

    try {
      db.prepare("INSERT INTO analytics_revenue (payment_id, amount, date) VALUES (?, ?, date('now'))")
        .run(payment.id, payment.amount);
    } catch (e) {}

    try {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (?, ?, ?, 'success', ?)
      `).run(
        payment.user_id,
        'Payment Approved ✅',
        `Aapka payment ₹${payment.amount} approve ho gaya. Ab download kar sakte ho.`,
        productLink
      );
    } catch (e) {}

    try {
      const invoiceNo = `VKR-${Date.now().toString(36).toUpperCase()}-${payment.id}`;
      db.prepare(`
        INSERT INTO invoices (invoice_no, user_id, payment_id, amount, total)
        VALUES (?, ?, ?, ?, ?)
      `).run(invoiceNo, payment.user_id, payment.id, payment.amount, payment.amount);
    } catch (e) {}
  });

  tx();
  log(String(adminId || 'admin'), `payment approved: ${id}`);
  return { ...payment, status: 'approved', expiresAt };
};

const paymentReject = (id, reason, adminId = null) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!payment) throw new Error('Payment not found');
  if (payment.status === 'rejected') throw new Error('Already rejected');

  db.prepare(`
    UPDATE payments SET status = 'rejected', rejected_reason = ?, approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(reason || 'Invalid payment proof', adminId, new Date().toISOString(), id);

  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'error')
    `).run(payment.user_id, 'Payment Rejected ❌',
      `Reason: ${reason || 'Invalid proof'}. Dobara try karo.`);
  } catch (e) {}

  log(String(adminId || 'admin'), `payment rejected: ${id} reason=${reason}`);
  return { ...payment, status: 'rejected', reason };
};

const paymentStats = () => {
  const total = db.prepare(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as sum
    FROM payments WHERE status = 'approved'
  `).get();
  const pending = db.prepare(`
    SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as sum
    FROM payments WHERE status = 'pending'
  `).get();
  const rejected = db.prepare("SELECT COUNT(*) as c FROM payments WHERE status = 'rejected'").get();
  const today = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as sum FROM payments
    WHERE status = 'approved' AND date(approved_at) = date('now')
  `).get();
  const month = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as sum FROM payments
    WHERE status = 'approved' AND strftime('%Y-%m', approved_at) = strftime('%Y-%m', 'now')
  `).get();

  return {
    totalRevenue: total.sum,
    totalApproved: total.c,
    pendingCount: pending.c,
    pendingAmount: pending.sum,
    rejectedCount: rejected.c,
    todayRevenue: today.sum,
    monthRevenue: month.sum
  };
};

const paymentTopSelling = (limit = 10) => db.prepare(`
  SELECT pr.id, pr.title, pr.slug, pr.price,
         COUNT(p.id) as sales_count,
         COALESCE(SUM(p.amount), 0) as total_revenue
  FROM payments p
  JOIN products pr ON p.product_id = pr.id
  WHERE p.status = 'approved'
  GROUP BY pr.id
  ORDER BY sales_count DESC LIMIT ?
`).all(limit);

const paymentTopBuyers = (limit = 10) => db.prepare(`
  SELECT u.id, u.name, u.email,
         COUNT(p.id) as purchase_count,
         COALESCE(SUM(p.amount), 0) as total_spent
  FROM payments p
  JOIN users u ON p.user_id = u.id
  WHERE p.status = 'approved'
  GROUP BY u.id
  ORDER BY total_spent DESC LIMIT ?
`).all(limit);

const paymentRevenueChart = (days = 30) => db.prepare(`
  SELECT date(approved_at) as day, COUNT(*) as count,
         COALESCE(SUM(amount), 0) as revenue
  FROM payments
  WHERE status = 'approved' AND approved_at >= datetime('now', '-' || ? || ' days')
  GROUP BY date(approved_at)
  ORDER BY day ASC
`).all(days);

// ------------------------------------------------------------
// 20. ADMIN HELPERS
// ------------------------------------------------------------
const adminStats = () => {
  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const pending = db.prepare("SELECT COUNT(*) c FROM payments WHERE status='pending'").get().c;
  const approved = db.prepare("SELECT COUNT(*) c FROM payments WHERE status='approved'").get().c;
  const revenue = db.prepare("SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status='approved'").get().c;
  const downloads = db.prepare('SELECT COALESCE(SUM(download_count),0) c FROM products').get().c;
  const messages = db.prepare("SELECT COUNT(*) c FROM messages WHERE status='unread'").get().c;
  const subscribers = db.prepare('SELECT COUNT(*) c FROM subscribers WHERE is_active=1').get().c;
  const reviews = db.prepare('SELECT COUNT(*) c FROM product_reviews WHERE is_approved=0').get().c;

  return {
    users, products, pending, approved, revenue, downloads, messages, subscribers, reviews,
    vipUsers: db.prepare('SELECT COUNT(*) c FROM users WHERE is_vip=1').get().c,
    todayUsers: db.prepare("SELECT COUNT(*) c FROM users WHERE date(created_at) = date('now')").get().c,
    todayRevenue: db.prepare(`
      SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE status='approved' AND date(approved_at) = date('now')
    `).get().c,
    monthRevenue: db.prepare(`
      SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE status='approved' AND strftime('%Y-%m', approved_at) = strftime('%Y-%m','now')
    `).get().c
  };
};

// ------------------------------------------------------------
// 21. ANALYTICS HELPERS
// ------------------------------------------------------------
const analyticsSummary = (days = 30) => {
  return {
    totalVisits: db.prepare('SELECT COUNT(*) c FROM analytics_visits').get().c,
    uniqueVisitors: db.prepare('SELECT COUNT(DISTINCT ip_address) c FROM analytics_visits').get().c,
    totalDownloads: db.prepare('SELECT COUNT(*) c FROM analytics_downloads').get().c,
    totalRevenue: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status='approved'").get().c,
    totalUsers: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    realtime: db.prepare(`
      SELECT COUNT(DISTINCT ip_address) c FROM analytics_visits
      WHERE created_at >= datetime('now', '-5 minutes')
    `).get().c,
    visits: db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count FROM analytics_visits
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(created_at) ORDER BY day
    `).all(days),
    topPages: db.prepare(`
      SELECT page, COUNT(*) as count FROM analytics_visits
      GROUP BY page ORDER BY count DESC LIMIT 10
    `).all()
  };
};

// ------------------------------------------------------------
// 22. EXPRESS APP SETUP
// ------------------------------------------------------------
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// -------- Helmet Security Headers --------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://accounts.google.com",
        "https://pagead2.googlesyndication.com",
        "https://unpkg.com"
      ],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "data:"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://oauth2.googleapis.com",
        "https://api.qrserver.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.youtube.com",
        "https://www.google.com",
        "https://accounts.google.com",
        "https://googleads.g.doubleclick.net"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      mediaSrc: ["'self'", "https:"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// -------- CORS --------
app.use(cors({
  origin: [
    config.app.baseUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// -------- Body Parsers --------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(compression());

// -------- Global Rate Limit --------
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
}));

// ------------------------------------------------------------
// 23. ANALYTICS MIDDLEWARE
// ------------------------------------------------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/admin')) return next();
  if (req.path.includes('.')) return next();
  if (req.method !== 'GET') return next();

  try {
    trackVisit(
      req.path,
      getClientIP(req),
      req.get('user-agent') || '',
      req.get('referer') || '',
      req.user?.id || null
    );
  } catch (e) { /* silent */ }

  next();
});

// ------------------------------------------------------------
// 24. TEMPLATE + MAINTENANCE MIDDLEWARE (NEW)
// ------------------------------------------------------------
// Maintenance mode check — हर HTML page से पहले
app.use((req, res, next) => {
  // API calls को bypass करो
  if (req.path.startsWith('/api/')) return next();
  // Assets को bypass करो
  if (req.path.startsWith('/assets/')) return next();
  if (req.path.startsWith('/uploads/')) return next();
  // Admin को bypass करो
  if (req.path.startsWith('/admin')) return next();
  // Favicon
  if (req.path === '/favicon.ico') return next();

  // Maintenance mode check
  if (getMaintenanceMode()) {
    // Admin session check
    const token = req.cookies?.session;
    let isAdmin = false;
    if (token) {
      try {
        const u = jwt.verify(token, JWT_SECRET);
        if (u.role === 'admin' || u.type === 'admin') isAdmin = true;
      } catch {}
    }

    // IP whitelist check
    const allowedIPs = (getSetting('maintenance_allowed_ips', '') || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const clientIP = getClientIP(req);
    const isWhitelisted = allowedIPs.includes(clientIP);

    if (!isAdmin && !isWhitelisted) {
      const message = getSetting('maintenance_message', 'Site is under maintenance. We will be back soon!');
      res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Under Maintenance — ${getSetting('site_name', 'Vikram Portfolio')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 100%);color:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center}
.card{max-width:520px;padding:60px 40px;background:rgba(23,23,34,.6);backdrop-filter:blur(20px);border:1px solid rgba(212,175,55,.2);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.logo{font-family:'Poppins',sans-serif;font-size:32px;font-weight:800;letter-spacing:-.05em;color:#fff;margin-bottom:24px}
.logo span{color:#d4af37}
.icon{font-size:80px;margin-bottom:24px;animation:spin 4s linear infinite}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
h1{font-family:'Poppins',sans-serif;font-size:28px;margin-bottom:16px;color:#fff}
p{color:#8b8b9a;font-size:15px;line-height:1.6;margin-bottom:24px}
.small{font-size:13px;color:#63637a;margin-top:20px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">VIKRAM<span>.</span></div>
  <div class="icon">🔧</div>
  <h1>Under Maintenance</h1>
  <p>${message}</p>
  <p class="small">We'll be back soon!</p>
</div>
</body>
</html>`);
      return;
    }
  }

  next();
});

// Template injection — हर HTML response में active template CSS inject करो
app.use((req, res, next) => {
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    // Only modify HTML responses
    if (
      typeof body === 'string' &&
      body.includes('<!DOCTYPE html>') &&
      body.includes('<head>') &&
      !body.includes('data-template-injected')
    ) {
      const template = getActiveTemplate();
      const templateCSS = `<link rel="stylesheet" href="/assets/templates/${template.id}.css" data-template-injected>`;
      body = body.replace('</head>', `${templateCSS}\n</head>`);
      body = body.replace('<body', `<body data-template="${template.id}"`);
    }
    return originalSend(body);
  };
  next();
});

// ------------------------------------------------------------
// 25. PAGE ROUTES + STATIC FILES
// ------------------------------------------------------------
const page = (name) => (req, res) => {
  const target = path.join(publicDir, name);
  if (fs.existsSync(target)) return res.sendFile(target);
  console.error(`❌ Page not found: ${target}`);
  return res.status(404).send(`Page not found: ${name}`);
};

app.get('/', page('index.html'));
app.get('/index.html', page('index.html'));
app.get('/login', page('login.html'));
app.get('/login.html', page('login.html'));
app.get('/dashboard', page('dashboard.html'));
app.get('/dashboard.html', page('dashboard.html'));
app.get('/admin', page('admin.html'));
app.get('/admin.html', page('admin.html'));
app.get('/file', page('file.html'));
app.get('/file.html', page('file.html'));
app.get('/legal', page('legal.html'));
app.get('/legal.html', page('legal.html'));
app.get('/resume', page('resume.html'));
app.get('/resume.html', page('resume.html'));

// Static files
app.use('/assets', express.static(path.join(ROOT, 'assets'), {
  maxAge: '1d',
  etag: true
}));

app.use(express.static(publicDir, {
  maxAge: '1d',
  etag: true,
  extensions: ['html']
}));

// Uploads static
app.use('/uploads/portfolios', express.static(portfoliosDir, { maxAge: '1h' }));
app.use('/uploads/images', express.static(imagesDir, {
  maxAge: '7d',
  etag: true
}));

// ------------------------------------------------------------
// 26. HEALTH & PUBLIC CONFIG APIs
// ------------------------------------------------------------
app.get('/api/health', (req, res) => {
  let dbStatus = 'unknown';
  try { db.prepare('SELECT 1').get(); dbStatus = 'connected'; }
  catch (e) { dbStatus = 'error: ' + e.message; }

  res.json({
    ok: true,
    service: config.app.name,
    version: config.app.version,
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    telegram: TG_ENABLED ? 'on' : 'off',
    email: EMAIL_ENABLED ? 'on' : 'off',
    template: getActiveTemplate().id,
    maintenance: getMaintenanceMode()
  });
});

app.get('/api/config/public', (req, res) => {
  res.json({
    profile: config.profile,
    theme: config.theme,
    store: config.store,
    access: config.access,
    google: {
      enabled: config.google.enabled,
      clientId: config.google.clientId
    },
    ads: config.ads.enabled ? config.ads : {},
    telegram: { enabled: config.telegram.enabled },
    email: { enabled: config.email.enabled },
    features: config.features || {},
    templates: config.templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      preview: t.preview
    }))
  });
});

app.get('/api/templates', (req, res) => {
  try {
    res.json(config.templates);
  } catch (err) {
    res.status(500).json({ error: 'Templates load failed' });
  }
});

app.get('/api/active-template', (req, res) => {
  try {
    res.json(getActiveTemplate());
  } catch (err) {
    res.status(500).json({ error: 'Active template fetch failed' });
  }
});

// Settings — public API (sensitive values hide किए जाते हैं)
app.get('/api/settings', (req, res) => {
  try {
    const settings = { ...loadSettings() };

    // Sensitive fields hide करो
    const sensitiveKeys = [
      'smtp_pass', 'telegram_bot_token', 'google_analytics_id',
      'search_console_code', 'adsense_publisher_id'
    ];

    // सिर्फ public-safe fields return करो
    const publicKeys = [
      'site_name', 'site_tagline', 'site_description', 'site_url',
      'site_logo_url', 'site_favicon_url', 'site_language',
      'footer_text', 'copyright_text',
      'meta_title', 'meta_description', 'meta_keywords', 'og_image_url',

      'active_template', 'active_theme',
      'custom_primary', 'custom_secondary', 'custom_accent',
      'font_family', 'border_radius', 'shadow_style', 'animation_speed',
      'hero_layout', 'menu_button_style', 'navbar_style', 'footer_style',

      'profile_name', 'profile_title', 'profile_bio_short', 'profile_bio_long',
      'profile_photo_url', 'signature_url',
      'availability_status', 'availability_text',
      'profile_location', 'profile_years_experience', 'profile_languages',

      'hero_greeting', 'hero_tagline', 'hero_description', 'hero_badge_text',
      'hero_typewriter_words', 'hero_cta1_text', 'hero_cta1_link',
      'hero_cta2_text', 'hero_cta2_link', 'hero_cta3_text', 'hero_cta3_link',

      'stat_projects', 'stat_downloads', 'stat_clients', 'stat_views', 'stat_years',

      'about_title', 'about_education', 'about_languages', 'about_status',
      'about_fact1', 'about_fact2', 'about_fact3', 'about_fact4',

      'contact_email', 'contact_phone', 'contact_whatsapp', 'contact_telegram',
      'contact_address', 'contact_maps_url', 'contact_note',

      'social_github', 'social_youtube', 'social_instagram', 'social_telegram',
      'social_twitter', 'social_linkedin', 'social_facebook',

      'store_upi', 'store_upi_merchant', 'store_upi_qr_url',
      'store_bank_name', 'store_bank_account', 'store_bank_ifsc',
      'store_currency', 'store_currency_symbol',
      'store_announcement', 'store_payment_instructions',
      'store_verification_hours', 'store_payment_terms',

      'announcement_enabled', 'announcement_text', 'announcement_color', 'announcement_link',

      'feature_registration', 'feature_google_login', 'feature_email',
      'feature_telegram', 'feature_reviews', 'feature_messages',
      'feature_referral', 'feature_portfolio_pdf',

      'referral_enabled', 'referral_referrer_reward', 'referral_referred_reward',

      'legal_updated', 'legal_privacy', 'legal_terms', 'legal_refund', 'legal_cookies',

      'adsense_enabled', 'adsense_auto_ads',
      'adsense_header_slot', 'adsense_sidebar_slot', 'adsense_content_slot',
      'adsense_footer_slot', 'adsense_popup_slot'
    ];

    const publicSettings = {};
    publicKeys.forEach(key => {
      if (settings[key] !== undefined) publicSettings[key] = settings[key];
    });

    // AdSense publisher ID को अलग से add करो (public safe)
    if (settings.adsense_publisher_id) {
      publicSettings.adsense_publisher_id = settings.adsense_publisher_id;
    }

    res.json(publicSettings);
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Settings load failed' });
  }
});

// ------------------------------------------------------------
// 27. PUBLIC DATA APIs
// ------------------------------------------------------------

// Products list with filters
app.get('/api/products', (req, res) => {
  try {
    const { category, search, sort, limit, offset } = req.query;
    let query = 'SELECT * FROM products WHERE is_published = 1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += sort === 'price' ? ' ORDER BY price ASC'
      : sort === 'price_desc' ? ' ORDER BY price DESC'
      : sort === 'popular' ? ' ORDER BY download_count DESC'
      : sort === 'rating' ? ' ORDER BY rating_avg DESC'
      : sort === 'oldest' ? ' ORDER BY id ASC'
      : ' ORDER BY id DESC';

    const lim = Math.min(parseInt(limit) || 50, 100);
    const off = parseInt(offset) || 0;
    query += ` LIMIT ${lim} OFFSET ${off}`;

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: 'Products load fail hua.' });
  }
});

// Categories
app.get('/api/categories', (req, res) => {
  try {
    const cats = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM products WHERE category = c.slug AND is_published = 1) as product_count
      FROM product_categories c
      ORDER BY c.sort_order
    `).all();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Categories load fail hua.' });
  }
});

// Single product by slug
app.get('/api/products/:slug', optionalAuth, (req, res) => {
  try {
    const product = db.prepare(`
      SELECT * FROM products WHERE slug = ? AND is_published = 1
    `).get(req.params.slug);

    if (!product) return res.status(404).json({ error: 'Product nahi mila.' });

    try {
      db.prepare('UPDATE products SET view_count = view_count + 1 WHERE id = ?').run(product.id);
    } catch (e) {}

    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name, u.avatar
      FROM product_reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC LIMIT 20
    `).all(product.id);

    let userAccess;
    if (req.user) {
      userAccess = hasAccess(req.user.id, product.id, req.user.is_vip);
    } else {
      userAccess = product.access_type === 'free'
        ? { allowed: true, reason: 'free' }
        : { allowed: false, reason: 'login_required' };
    }

    const related = db.prepare(`
      SELECT id, slug, title, thumbnail, price, mrp, accent
      FROM products
      WHERE category = ? AND id != ? AND is_published = 1
      ORDER BY RANDOM() LIMIT 4
    `).all(product.category, product.id);

    res.json({ ...product, reviews, userAccess, related });
  } catch (err) {
    console.error('Product load error:', err);
    res.status(500).json({ error: 'Product load fail hua.' });
  }
});

// Projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT * FROM projects WHERE is_published = 1
      ORDER BY sort_order, id DESC
    `).all();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Projects load failed' });
  }
});

// Skills
app.get('/api/skills', (req, res) => {
  try {
    const skills = db.prepare('SELECT * FROM skills ORDER BY category, sort_order').all();
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: 'Skills load failed' });
  }
});

// Services
app.get('/api/services', (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order').all();
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Services load failed' });
  }
});

// Experience
app.get('/api/experience', (req, res) => {
  try {
    const exp = db.prepare('SELECT * FROM experience ORDER BY sort_order, id DESC').all();
    res.json(exp);
  } catch (err) {
    res.status(500).json({ error: 'Experience load failed' });
  }
});

// Education
app.get('/api/education', (req, res) => {
  try {
    const edu = db.prepare('SELECT * FROM education ORDER BY sort_order').all();
    res.json(edu);
  } catch (err) {
    res.status(500).json({ error: 'Education load failed' });
  }
});

// Certifications
app.get('/api/certifications', (req, res) => {
  try {
    const certs = db.prepare('SELECT * FROM certifications ORDER BY sort_order').all();
    res.json(certs);
  } catch (err) {
    res.status(500).json({ error: 'Certifications load failed' });
  }
});

// Blog posts
app.get('/api/blog', (req, res) => {
  try {
    const posts = db.prepare(`
      SELECT id, title, slug, excerpt, thumbnail, category, read_time, published_at, view_count
      FROM blog_posts
      WHERE is_published = 1
      ORDER BY published_at DESC LIMIT 12
    `).all();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Blog load failed' });
  }
});

app.get('/api/blog/:slug', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1').get(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    db.prepare('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?').run(post.id);

    const comments = db.prepare(`
      SELECT id, name, comment, created_at
      FROM blog_comments
      WHERE post_id = ? AND is_approved = 1
      ORDER BY created_at DESC
    `).all(post.id);

    res.json({ ...post, comments });
  } catch (err) {
    res.status(500).json({ error: 'Post load failed' });
  }
});

// FAQs
app.get('/api/faqs', (req, res) => {
  try {
    const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order').all();
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ error: 'FAQs load failed' });
  }
});

// Testimonials
app.get('/api/testimonials', (req, res) => {
  try {
    const t = db.prepare('SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY sort_order').all();
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: 'Testimonials load failed' });
  }
});

// Banners
app.get('/api/banners', (req, res) => {
  try {
    const banners = db.prepare(`
      SELECT * FROM banners WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= date('now'))
      AND (end_date IS NULL OR end_date >= date('now'))
      ORDER BY priority DESC, id DESC
    `).all();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: 'Banners load failed' });
  }
});

// Social links
app.get('/api/social-links', (req, res) => {
  try {
    const links = db.prepare('SELECT * FROM social_links WHERE is_active = 1 ORDER BY sort_order').all();
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: 'Links load failed' });
  }
});

// Ads by position
app.get('/api/ads/:position', (req, res) => {
  try {
    let adsEnabled = true;
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'ads_enabled'").get();
      if (row) adsEnabled = (row.value === '1' || row.value === 'true');
    } catch (e) {}
    if (!adsEnabled) return res.json({ ads: [] });

    const { position } = req.params;
    const ads = db.prepare(`
      SELECT id, name, type, code, position, device, user_type
      FROM ads
      WHERE is_active = 1 AND position = ?
      AND (start_date IS NULL OR start_date <= date('now'))
      AND (end_date IS NULL OR end_date >= date('now'))
      ORDER BY priority DESC
    `).all(position);

    ads.forEach(ad => {
      db.prepare('UPDATE ads SET impressions = impressions + 1 WHERE id = ?').run(ad.id);
    });

    res.json({ ads });
  } catch (err) {
    res.status(500).json({ error: 'Ads load failed' });
  }
});

// ------------------------------------------------------------
// 28. CONTACT + NEWSLETTER + SEARCH
// ------------------------------------------------------------

// Contact form
app.post('/api/contact', strictLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email aur message zaroori hai.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email sahi nahi hai.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Message bahut chhota hai.' });
    }

    const result = db.prepare(`
      INSERT INTO messages (name, email, subject, message, type, status)
      VALUES (?, ?, ?, ?, 'contact', 'unread')
    `).run(name, email, subject || 'Contact Form', message);

    log('guest', 'contact_form', `from ${email}`);

    if (TG_ENABLED && config.telegram.alerts?.newMessage) {
      sendTelegram(`📩 <b>New Contact</b>\n\nFrom: ${name}\nEmail: ${email}\nSubject: ${subject || 'Contact'}`).catch(() => {});
    }

    res.json({ success: true, message: 'Message sent! Hum 24 hours me reply karenge.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Message send nahi hua.' });
  }
});

// Newsletter subscribe
app.post('/api/subscribe', strictLimiter, (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Valid email daalo.' });
    }

    const existing = db.prepare('SELECT id FROM subscribers WHERE email = ?').get(email);
    if (existing) {
      return res.json({ success: true, message: 'Already subscribed!' });
    }

    db.prepare('INSERT INTO subscribers (email, name) VALUES (?, ?)').run(email, name || null);
    log('guest', 'newsletter_subscribe', email);
    res.json({ success: true, message: 'Subscribe ho gaya!' });
  } catch (err) {
    res.status(500).json({ error: 'Subscribe fail hua.' });
  }
});

// Search
app.get('/api/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ products: [], posts: [], projects: [] });

    const products = db.prepare(`
      SELECT id, title, slug, description, thumbnail, price, mrp
      FROM products
      WHERE is_published = 1 AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)
      LIMIT 8
    `).all(`%${q}%`, `%${q}%`, `%${q}%`);

    const posts = db.prepare(`
      SELECT id, title, slug, excerpt, thumbnail
      FROM blog_posts
      WHERE is_published = 1 AND (title LIKE ? OR content LIKE ?)
      LIMIT 5
    `).all(`%${q}%`, `%${q}%`);

    const projects = db.prepare(`
      SELECT id, title, slug, description, thumbnail
      FROM projects
      WHERE is_published = 1 AND (title LIKE ? OR description LIKE ?)
      LIMIT 5
    `).all(`%${q}%`, `%${q}%`);

    res.json({ products, posts, projects });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ------------------------------------------------------------
// PART 2 ENDS HERE
// ------------------------------------------------------------
// Next: PART 3 (Auth routes + User routes + Admin routes + Startup)
// ------------------------------------------------------------

// ════════════════════════════════════════════════════════════
// PART 3: Auth + User + Payment + Download + Admin + Startup
// ════════════════════════════════════════════════════════════

// ------------------------------------------------------------
// 29. AUTH ROUTES
// ------------------------------------------------------------

// -------- Signup --------
app.post('/api/auth/signup', loginLimiter, async (req, res) => {
  if (!getBoolSetting('feature_registration', true)) {
    return res.status(503).json({ error: 'Registration temporarily disabled.' });
  }

  const { name, email, password, ref, whatsapp } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email aur password zaroori hai.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!validateEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Valid email daalo.' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Ye email already registered hai.' });
  }

  try {
    const hash = await hashPassword(password);
    const referralCode = generateReferralCode(Date.now());
    const verificationToken = generateRandomString(32);

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, referral_code, verification_token, whatsapp, login_method)
      VALUES (?, ?, ?, ?, ?, ?, 'email')
    `).run(
      sanitizeInput(name),
      cleanEmail,
      hash,
      referralCode,
      verificationToken,
      sanitizeInput(whatsapp || '')
    );

    const user = db.prepare(`
      SELECT id, name, email, role, is_vip, avatar, is_verified FROM users WHERE id = ?
    `).get(result.lastInsertRowid);

    // Referral tracking
    if (ref) {
      try {
        const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(ref);
        if (referrer && referrer.id !== user.id) {
          db.prepare('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)')
            .run(referrer.id, user.id);
          db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run(referrer.id, user.id);
        }
      } catch (e) {}
    }

    // Login history
    try {
      db.prepare(`
        INSERT INTO login_history (user_id, ip_address, user_agent, status)
        VALUES (?, ?, ?, 'success')
      `).run(user.id, getClientIP(req), getUA(req));
    } catch (e) {}

    // Welcome notification
    try {
      const welcomeTitle = getSetting('notif_welcome_title', 'Welcome! 🎉');
      const welcomeMsg = getSetting('notif_welcome_msg', 'Aapka account ban gaya.');
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')
      `).run(user.id, welcomeTitle, welcomeMsg);
    } catch (e) {}

    const token = signToken(user);
    setSessionCookie(req, res, token);

    // Telegram alert (new user)
    if (TG_ENABLED && config.telegram.alerts?.newUser) {
      sendTelegram(`👤 <b>New User</b>\n\nName: ${user.name}\nEmail: ${user.email}`).catch(() => {});
    }

    log(cleanEmail, 'signup');
    res.json({ user: safeUser(user), success: true });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup fail hua. Dobara try karo.' });
  }
});

// -------- Login --------
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email aur password zaroori hai.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user || !await comparePassword(password, user.password_hash)) {
      try {
        db.prepare(`
          INSERT INTO login_history (user_id, ip_address, user_agent, status)
          VALUES (?, ?, ?, 'failed')
        `).run(user?.id || null, getClientIP(req), getUA(req));
      } catch (e) {}
      return res.status(401).json({ error: 'Email ya password galat hai.' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Aapka account ban hai. Support se contact karo.' });
    }

    let isVip = user.is_vip;
    if (isVip && user.vip_expires_at && new Date(user.vip_expires_at) < new Date()) {
      db.prepare('UPDATE users SET is_vip = 0 WHERE id = ?').run(user.id);
      isVip = 0;
    }

    db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);

    try {
      db.prepare(`
        INSERT INTO login_history (user_id, ip_address, user_agent, status)
        VALUES (?, ?, ?, 'success')
      `).run(user.id, getClientIP(req), getUA(req));
    } catch (e) {}

    const safe = { ...user, is_vip: isVip };
    const token = signToken(safe);
    setSessionCookie(req, res, token);

    log(cleanEmail, 'login');
    res.json({ user: safeUser(safe) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login fail hua.' });
  }
});

// -------- Google Login --------
app.post('/api/auth/google', loginLimiter, async (req, res) => {
  if (!config.google.enabled || !config.google.clientId) {
    return res.status(503).json({ error: 'Google login configured nahi hai.' });
  }

  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential missing.' });

  try {
    // Verify token with Google
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const payload = await verifyRes.json();

    console.log('[Google Login] Payload:', JSON.stringify({
      aud: payload.aud,
      iss: payload.iss,
      email: payload.email,
      email_verified: payload.email_verified,
      email_verified_type: typeof payload.email_verified
    }));

    // ✅ FIX 1: Flexible email_verified check (string OR boolean)
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

    // ✅ FIX 2: Audience check (accept both with/without trailing)
    const audMatches = payload.aud === config.google.clientId;

    // ✅ FIX 3: Issuer check (accept both google issuers)
    const validIssuer = payload.iss === 'https://accounts.google.com' ||
                        payload.iss === 'accounts.google.com';

    if (!audMatches || !validIssuer || !emailVerified) {
      console.error('[Google Login] Invalid token:', {
        audMatches,
        validIssuer,
        emailVerified,
        receivedAud: payload.aud,
        expectedAud: config.google.clientId
      });
      return res.status(401).json({
        error: 'Invalid Google token. ' +
               (!audMatches ? 'Client ID mismatch. ' : '') +
               (!validIssuer ? 'Issuer invalid. ' : '') +
               (!emailVerified ? 'Email not verified.' : '')
      });
    }

    const cleanEmail = String(payload.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return res.status(400).json({ error: 'Google email not received.' });
    }

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      // ✅ New user via Google
      const randomPw = generateRandomString(16);
      const hash = await hashPassword(randomPw);
      const referralCode = generateReferralCode(Date.now());
      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, avatar, google_id, login_method, is_verified, referral_code)
        VALUES (?, ?, ?, ?, ?, 'google', 1, ?)
      `).run(
        payload.name || cleanEmail.split('@')[0],
        cleanEmail,
        hash,
        payload.picture || null,
        payload.sub,
        referralCode
      );

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

      // Welcome notification
      try {
        const welcomeTitle = getSetting('notif_welcome_title', 'Welcome! 🎉');
        const welcomeMsg = getSetting('notif_welcome_msg', 'Aapka account ban gaya.');
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'success')
        `).run(user.id, welcomeTitle, welcomeMsg);
      } catch (e) {}

      log(cleanEmail, 'google signup');
      console.log('[Google Login] New user created:', user.id, cleanEmail);
    } else {
      // Existing user — update google_id if missing
      if (!user.google_id) {
        db.prepare('UPDATE users SET google_id = ?, avatar = COALESCE(avatar, ?) WHERE id = ?')
          .run(payload.sub, payload.picture || null, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
      db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id);
      log(cleanEmail, 'google login');
      console.log('[Google Login] Existing user:', user.id, cleanEmail);
    }

    // Check banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'Aapka account ban hai. Support se contact karo.' });
    }

    // Login history
    try {
      db.prepare(`
        INSERT INTO login_history (user_id, ip_address, user_agent, status)
        VALUES (?, ?, ?, 'success')
      `).run(user.id, getClientIP(req), getUA(req));
    } catch (e) {}

    // ✅ FIX 4: Robust session cookie
    const token = signToken(user);

    const isProd = process.env.NODE_ENV === 'production' ||
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.secure === true;

    const cookieOptions = {
      httpOnly: true,
      maxAge: SESSION_HOURS * 60 * 60 * 1000,
      path: '/',
      // ✅ FIX: sameSite none for cross-site (requires secure), lax for local
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd
    };

    res.cookie('session', token, cookieOptions);

    console.log('[Google Login] Cookie set with options:', {
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      user: user.id
    });

    // ✅ Return user data
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        type: user.role === 'admin' ? 'admin' : 'user',
        is_vip: user.is_vip || 0,
        avatar: user.avatar,
        is_verified: user.is_verified
      }
    });

  } catch (err) {
    console.error('[Google Login] Error:', err.message, err.stack);
    res.status(401).json({ error: 'Google login fail hua: ' + err.message });
  }
});

// -------- Logout --------
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

// -------- Me --------
app.get('/api/auth/me', auth, (req, res) => {
  try {
    // Admin special case — admin id=0 has no row in users table
    if (req.user.id === 0 && (req.user.role === 'admin' || req.user.type === 'admin')) {
      return res.json({
        user: {
          id: 0,
          name: req.user.name || 'Admin',
          email: req.user.email || 'admin',
          role: 'admin',
          type: 'admin',
          is_vip: 0,
          avatar: null,
          is_verified: 1,
          referral_code: null,
          created_at: new Date().toISOString()
        }
      });
    }

    const user = db.prepare(`
      SELECT id, name, email, phone, whatsapp, role, is_vip, vip_expires_at,
             avatar, bio, is_verified, referral_code, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) {
      res.clearCookie('session', { path: '/' });
      return res.status(401).json({ error: 'User not found' });
    }

    // Check VIP expiry
    if (user.is_vip && user.vip_expires_at && new Date(user.vip_expires_at) < new Date()) {
      db.prepare('UPDATE users SET is_vip = 0 WHERE id = ?').run(user.id);
      user.is_vip = 0;
    }

    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Session load failed' });
  }
});

// -------- Forgot Password --------
app.post('/api/auth/forgot-password', otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: 'Valid email daalo.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(cleanEmail);

  if (user) {
    const resetToken = generateRandomString(40);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?')
      .run(resetToken, expiresAt, user.id);

    if (EMAIL_ENABLED) {
      const link = `${config.app.baseUrl}/login?token=${resetToken}&reset=true`;
      sendEmail({
        to: user.email,
        subject: 'Password Reset — Vikram Portfolio',
        html: `<p>Password reset karne ke liye <a href="${link}">click karo</a>. Link 1 hour valid hai.</p>`
      }).catch(() => {});
    }
    log(cleanEmail, 'forgot-password request');
  }

  res.json({ success: true, message: 'Agar account hai toh email bhej diya.' });
});

// -------- Reset Password --------
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token aur password zaroori hai.' });
  }

  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

  try {
    const user = db.prepare(`
      SELECT id, email FROM users
      WHERE reset_token = ? AND reset_expires_at > datetime('now')
    `).get(token);

    if (!user) {
      return res.status(400).json({ error: 'Token invalid ya expire ho gaya.' });
    }

    const hash = await hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?')
      .run(hash, user.id);

    log(user.email, 'password reset');
    res.json({ success: true, message: 'Password reset ho gaya. Ab login karo.' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Reset fail hua.' });
  }
});

// ------------------------------------------------------------
// 30. USER ROUTES
// ------------------------------------------------------------

// -------- Dashboard --------
app.get('/api/users/dashboard', auth, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare(`
      SELECT id, name, email, avatar, is_vip, vip_expires_at, referral_code, created_at
      FROM users WHERE id = ?
    `).get(userId);

    const stats = {
      purchases: db.prepare('SELECT COUNT(*) c FROM purchases WHERE user_id = ? AND is_active = 1').get(userId).c,
      downloads: db.prepare('SELECT COUNT(*) c FROM download_history WHERE user_id = ?').get(userId).c,
      favorites: db.prepare('SELECT COUNT(*) c FROM favorites WHERE user_id = ?').get(userId).c,
      reviews: db.prepare('SELECT COUNT(*) c FROM product_reviews WHERE user_id = ?').get(userId).c,
      pendingPayments: db.prepare("SELECT COUNT(*) c FROM payments WHERE user_id = ? AND status = 'pending'").get(userId).c,
      notifications: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).c
    };

    const recentPurchases = db.prepare(`
      SELECT p.id, pr.title, pr.slug, pr.thumbnail, p.created_at
      FROM purchases p
      JOIN products pr ON pr.id = p.product_id
      WHERE p.user_id = ? AND p.is_active = 1
      ORDER BY p.id DESC LIMIT 3
    `).all(userId);

    const recentNotifications = db.prepare(`
      SELECT id, title, message, type, is_read, created_at FROM notifications
      WHERE user_id = ? OR is_global = 1
      ORDER BY id DESC LIMIT 5
    `).all(userId);

    res.json({ user, stats, recentPurchases, recentNotifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Dashboard load fail hua.' });
  }
});

// -------- Update Profile --------
app.put('/api/users/profile', auth, (req, res) => {
  try {
    const { name, phone, whatsapp, bio } = req.body;
    const updates = [];
    const values = [];

    if (name) { updates.push('name = ?'); values.push(sanitizeInput(name).slice(0, 60)); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(sanitizeInput(phone).slice(0, 15)); }
    if (whatsapp !== undefined) { updates.push('whatsapp = ?'); values.push(sanitizeInput(whatsapp).slice(0, 15)); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(sanitizeInput(bio).slice(0, 500)); }

    if (!updates.length) {
      return res.status(400).json({ error: 'Kuch update nahi kiya.' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare(`
      SELECT id, name, email, phone, whatsapp, avatar, bio, role, is_vip FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({ ok: true, user });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Update fail hua.' });
  }
});

// -------- Change Password --------
app.post('/api/users/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Dono password zaroori hai.' });
  }

  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.error });

  try {
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user || !await comparePassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password galat hai.' });
    }

    const hash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    log(req.user.email, 'password changed');
    res.json({ ok: true, message: 'Password change ho gaya.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Change fail hua.' });
  }
});

// -------- Upload Avatar --------
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(avatarsDir, { recursive: true });
      cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
      const unique = `avatar-${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`;
      cb(null, unique);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(png|jpeg|jpg|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

app.post('/api/users/avatar', auth, avatarUpload.single('avatar'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image upload karo.' });
    const avatarPath = `/uploads/images/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, req.user.id);
    res.json({ ok: true, avatar: avatarPath });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Avatar upload fail hua.' });
  }
});

// -------- Delete Account --------
app.delete('/api/users/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password confirm karo.' });

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user || !await comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Password galat hai.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    res.clearCookie('session', { path: '/' });
    log(req.user.email, 'account deleted');
    res.json({ ok: true, message: 'Account delete ho gaya.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Delete fail hua.' });
  }
});

// -------- Purchases --------
app.get('/api/users/purchases', auth, (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT p.*, pr.title, pr.slug, pr.thumbnail, pr.accent,
             pr.file_type, pr.file_size, pr.version, pr.access_duration_days
      FROM purchases p
      JOIN products pr ON pr.id = p.product_id
      WHERE p.user_id = ? AND p.is_active = 1
      ORDER BY p.id DESC
    `).all(req.user.id);

    const now = new Date();
    const enriched = purchases.map(p => ({
      ...p,
      is_expired: p.expires_at ? new Date(p.expires_at) < now : false,
      days_remaining: p.expires_at ? Math.max(0, Math.ceil((new Date(p.expires_at) - now) / (1000 * 60 * 60 * 24))) : null
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Purchases error:', err);
    res.status(500).json({ error: 'Purchases load fail hua.' });
  }
});

// -------- User Payments --------
app.get('/api/users/payments', auth, (req, res) => {
  try {
    const payments = paymentGetByUser(req.user.id);
    res.json(payments);
  } catch (err) {
    console.error('Payments error:', err);
    res.status(500).json({ error: 'Payments load fail hua.' });
  }
});

// -------- Downloads --------
app.get('/api/users/downloads', auth, (req, res) => {
  try {
    const downloads = db.prepare(`
      SELECT dh.*, pr.title, pr.slug, pr.thumbnail, pr.file_type
      FROM download_history dh
      LEFT JOIN products pr ON pr.id = dh.product_id
      WHERE dh.user_id = ?
      ORDER BY dh.id DESC LIMIT 100
    `).all(req.user.id);
    res.json(downloads);
  } catch (err) {
    console.error('Downloads error:', err);
    res.status(500).json({ error: 'Downloads load fail hua.' });
  }
});

// -------- Favorites --------
app.get('/api/users/favorites', auth, (req, res) => {
  try {
    const favorites = db.prepare(`
      SELECT f.id as fav_id, f.created_at as fav_date,
             pr.id, pr.title, pr.slug, pr.thumbnail, pr.description,
             pr.price, pr.mrp, pr.accent, pr.rating_avg, pr.download_count
      FROM favorites f
      JOIN products pr ON pr.id = f.product_id
      WHERE f.user_id = ? AND pr.is_published = 1
      ORDER BY f.id DESC
    `).all(req.user.id);
    res.json(favorites);
  } catch (err) {
    console.error('Favorites error:', err);
    res.status(500).json({ error: 'Favorites load fail hua.' });
  }
});

app.post('/api/users/favorites/:productId', auth, (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const product = db.prepare('SELECT id FROM products WHERE id = ? AND is_published = 1').get(productId);
    if (!product) return res.status(404).json({ error: 'Product nahi mila.' });

    db.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)')
      .run(req.user.id, productId);
    res.json({ ok: true, message: 'Favorites me add ho gaya.' });
  } catch (err) {
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Add fail hua.' });
  }
});

app.delete('/api/users/favorites/:productId', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?')
      .run(req.user.id, Number(req.params.productId));
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Remove fail hua.' });
  }
});

// -------- Reviews --------
app.get('/api/users/reviews', auth, (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, pr.title as product_title, pr.slug as product_slug, pr.thumbnail
      FROM product_reviews r
      LEFT JOIN products pr ON pr.id = r.product_id
      WHERE r.user_id = ?
      ORDER BY r.id DESC
    `).all(req.user.id);
    res.json(reviews);
  } catch (err) {
    console.error('Reviews error:', err);
    res.status(500).json({ error: 'Reviews load fail hua.' });
  }
});

app.delete('/api/users/reviews/:id', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM product_reviews WHERE id = ? AND user_id = ?')
      .run(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Delete fail hua.' });
  }
});

// -------- Notifications --------
app.get('/api/users/notifications', auth, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? OR is_global = 1
      ORDER BY id DESC LIMIT 50
    `).all(req.user.id);

    const unread = db.prepare(`
      SELECT COUNT(*) c FROM notifications
      WHERE (user_id = ? OR is_global = 1) AND is_read = 0
    `).get(req.user.id).c;

    res.json({ notifications, unread });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Notifications load fail hua.' });
  }
});

app.post('/api/users/notifications/read-all', auth, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Mark fail hua.' });
  }
});

// -------- Messages --------
app.get('/api/users/messages', auth, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT 50
    `).all(req.user.id);
    res.json(messages);
  } catch (err) {
    console.error('User messages error:', err);
    res.status(500).json({ error: 'Messages load fail hua.' });
  }
});

app.post('/api/users/messages', auth, (req, res) => {
  try {
    const { subject, message, type = 'inquiry' } = req.body;
    if (!message || message.length < 5) {
      return res.status(400).json({ error: 'Message bahut chhota hai.' });
    }

    const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
    const result = db.prepare(`
      INSERT INTO messages (user_id, name, email, subject, message, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      user.name,
      user.email,
      sanitizeInput(subject || 'User Message'),
      sanitizeInput(message).slice(0, 2000),
      type
    );

    // Telegram alert
    if (TG_ENABLED && config.telegram.alerts?.newMessage) {
      sendTelegram(`📩 <b>New Message</b>\n\nFrom: ${user.name}\nEmail: ${user.email}\nSubject: ${subject || 'User Message'}`).catch(() => {});
    }

    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Message send fail hua.' });
  }
});

// -------- Referral --------
app.get('/api/users/referral', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(req.user.id);
    let code = user.referral_code;

    if (!code) {
      code = generateReferralCode(req.user.id);
      db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').run(code, req.user.id);
    }

    const clicks = db.prepare('SELECT COUNT(*) c FROM referral_clicks WHERE referrer_id = ?').get(req.user.id).c;
    const signups = db.prepare('SELECT COUNT(*) c FROM referrals WHERE referrer_id = ?').get(req.user.id).c;

    const recent = db.prepare(`
      SELECT r.*, u.name as referred_name, u.created_at as joined_at
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ?
      ORDER BY r.id DESC LIMIT 10
    `).all(req.user.id);

    res.json({
      code,
      link: `${config.app.baseUrl}/?ref=${code}`,
      clicks,
      signups,
      recent
    });
  } catch (err) {
    console.error('Referral error:', err);
    res.status(500).json({ error: 'Referral load fail hua.' });
  }
});

// -------- VIP Info --------
app.get('/api/users/vip', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT is_vip, vip_expires_at FROM users WHERE id = ?').get(req.user.id);
    const isExpired = user.vip_expires_at && new Date(user.vip_expires_at) < new Date();

    if (isExpired && user.is_vip) {
      db.prepare('UPDATE users SET is_vip = 0 WHERE id = ?').run(req.user.id);
      user.is_vip = 0;
    }

    res.json({
      is_vip: !!user.is_vip,
      expires_at: user.vip_expires_at,
      days_remaining: user.vip_expires_at
        ? Math.max(0, Math.ceil((new Date(user.vip_expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : null,
      benefits: user.is_vip ? [
        'Free access to select files',
        'Extra discounts',
        'Early access to new products',
        'Priority support',
        'No ads'
      ] : []
    });
  } catch (err) {
    console.error('VIP error:', err);
    res.status(500).json({ error: 'VIP load fail hua.' });
  }
});

// -------- Login History --------
app.get('/api/users/login-history', auth, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT id, ip_address, user_agent, status, created_at
      FROM login_history
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 20
    `).all(req.user.id);
    res.json(history);
  } catch (err) {
    console.error('Login history error:', err);
    res.status(500).json({ error: 'History load fail hua.' });
  }
});

// ------------------------------------------------------------
// 31. PRODUCT REVIEW (User)
// ------------------------------------------------------------
app.post('/api/products/:id/review', auth, (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating 1 se 5 ke beech do.' });
    }

    const purchased = db.prepare(`
      SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ? AND is_active = 1
    `).get(req.user.id, productId);

    if (!purchased) {
      return res.status(403).json({ error: 'Sirf khareedar review de sakte hai.' });
    }

    const existing = db.prepare(
      'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ?'
    ).get(productId, req.user.id);

    if (existing) {
      db.prepare('UPDATE product_reviews SET rating = ?, review = ?, is_approved = 0 WHERE id = ?')
        .run(rating, sanitizeInput(review || ''), existing.id);
      return res.json({ ok: true, message: 'Review update ho gaya. Approval pending.' });
    }

    db.prepare('INSERT INTO product_reviews (product_id, user_id, rating, review) VALUES (?, ?, ?, ?)')
      .run(productId, req.user.id, rating, sanitizeInput(review || ''));

    res.json({ ok: true, message: 'Review submit ho gaya. Approval pending.' });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Review submit fail hua.' });
  }
});

// ------------------------------------------------------------
// 32. DOWNLOAD ROUTES
// ------------------------------------------------------------

// -------- Generate download token --------
app.post('/api/files/:id/download', auth, (req, res) => {
  try {
    const productId = Number(req.params.id);
    const product = db.prepare('SELECT id, slug, title, access_type FROM products WHERE id = ? AND is_published = 1')
      .get(productId);

    if (!product) return res.status(404).json({ error: 'Product nahi mila.' });

    const access = hasAccess(req.user.id, productId, req.user.is_vip);
    if (!access.allowed) {
      return res.status(403).json({
        error: access.reason === 'Purchase required' ? 'Pehle purchase karo.' : access.reason
      });
    }

    const result = generateDownloadToken(req.user.id, productId, getClientIP(req));

    try {
      db.prepare(`
        INSERT INTO analytics_engagement (user_id, action, target_type, target_id)
        VALUES (?, 'download_token', 'product', ?)
      `).run(req.user.id, productId);
    } catch (e) {}

    res.json({
      ok: true,
      token: result.token,
      expiresAt: result.expiresAt,
      expiresInMinutes: result.expiresInMinutes,
      downloadUrl: `/api/files/download/${result.token}`,
      message: 'Download link ready hai.'
    });
  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Download token fail hua.' });
  }
});

// -------- Download file via token --------
app.get('/api/files/download/:token', downloadLimiter, (req, res) => {
  try {
    const { token } = req.params;
    const verification = verifyDownloadToken(token, getClientIP(req));

    if (!verification.valid) {
      return res.status(403).json({ error: verification.error });
    }

    const { record } = verification;
    const product = db.prepare(`
      SELECT id, slug, title, file_name, file_path, file_type, file_size
      FROM products WHERE id = ?
    `).get(record.product_id);

    if (!product || !product.file_name) {
      return res.status(404).json({ error: 'File available nahi hai.' });
    }

    // Prevent path traversal
    if (path.basename(product.file_name) !== product.file_name) {
      return res.status(500).json({ error: 'Invalid file path configuration.' });
    }

    const fullPath = path.join(filesDir, product.file_name);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File server pe nahi mili.' });
    }

    markTokenUsed(token);
    trackDownload(product.id, record.user_id, getClientIP(req), getUA(req));

    const ext = path.extname(product.file_name);
    const base = product.slug || 'file';
    const downloadName = `${base}-vikram${ext}`;

    streamFile(res, fullPath, downloadName);
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Download fail hua.' });
  }
});

// ------------------------------------------------------------
// 33. PAYMENT ROUTES (User)
// ------------------------------------------------------------

app.post('/api/payments', auth, proofUpload.single('proof'), async (req, res) => {
  try {
    const productId = Number(req.body.product_id);
    const { utr, note, whatsapp } = req.body;

    if (!productId) {
      if (req.file) deleteFile(req.file.path);
      return res.status(400).json({ error: 'Product ID zaroori hai.' });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_published = 1').get(productId);
    if (!product) {
      if (req.file) deleteFile(req.file.path);
      return res.status(404).json({ error: 'Product nahi mila.' });
    }

    // Free product — direct add to library
    if (!product.price || product.access_type === 'free') {
      const expiresAt = product.access_duration_days > 0
        ? new Date(Date.now() + product.access_duration_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      db.prepare(`
        INSERT OR IGNORE INTO purchases (user_id, product_id, amount_paid, expires_at, is_active)
        VALUES (?, ?, 0, ?, 1)
      `).run(req.user.id, product.id, expiresAt);

      if (req.file) deleteFile(req.file.path);
      return res.json({ ok: true, free: true, message: 'Free product library me add ho gaya!' });
    }

    if (!utr || !/^[-\w\s]{6,80}$/.test(utr.trim())) {
      if (req.file) deleteFile(req.file.path);
      return res.status(400).json({ error: 'Valid UTR / Transaction ID daalo (6-80 chars).' });
    }

    const existing = db.prepare("SELECT id FROM payments WHERE utr = ? AND status != 'rejected'").get(utr.trim());
    if (existing) {
      if (req.file) deleteFile(req.file.path);
      return res.status(409).json({ error: 'Ye UTR already submit ho chuka hai.' });
    }

    const alreadyPurchased = db.prepare(`
      SELECT 1 FROM purchases WHERE user_id = ? AND product_id = ? AND is_active = 1
    `).get(req.user.id, product.id);

    if (alreadyPurchased) {
      if (req.file) deleteFile(req.file.path);
      return res.status(409).json({ error: 'Ye product already aapke paas hai.' });
    }

    const paymentId = paymentSubmit({
      userId: req.user.id,
      productId: product.id,
      amount: product.price,
      utr: utr.trim(),
      proofName: req.file?.filename || null,
      whatsapp: whatsapp || null,
      note: note || ''
    });

    if (TG_ENABLED && config.telegram.alerts?.newPayment) {
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
      sendTelegramPaymentAlert({
        userName: user.name,
        userEmail: user.email,
        fileName: product.title,
        amount: product.price,
        utr: utr.trim()
      }).catch(() => {});
    }

    res.json({
      ok: true,
      payment_id: paymentId.id,
      message: 'Proof submit ho gaya. 24 hours me verify hoga.'
    });
  } catch (err) {
    console.error('Payment submit error:', err);
    if (req.file) deleteFile(req.file.path);
    res.status(500).json({ error: err.message || 'Submit fail hua.' });
  }
});

app.get('/api/payments/my', auth, (req, res) => {
  try {
    const payments = paymentGetByUser(req.user.id);
    res.json(payments);
  } catch (err) {
    console.error('My payments error:', err);
    res.status(500).json({ error: 'Payments load fail hua.' });
  }
});

app.get('/api/payments/:id', auth, (req, res) => {
  try {
    const payment = paymentGetById(Number(req.params.id));
    if (!payment) return res.status(404).json({ error: 'Payment nahi mila.' });
    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    res.json(payment);
  } catch (err) {
    console.error('Payment detail error:', err);
    res.status(500).json({ error: 'Load fail hua.' });
  }
});

// ------------------------------------------------------------
// 34. PORTFOLIO PDF BUILDER
// ------------------------------------------------------------
app.post('/api/portfolio/generate', auth, (req, res) => {
  try {
    const options = req.body?.options || {};
    const user = db.prepare('SELECT id, name, email, phone, whatsapp, bio FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Profile not found.' });

    const templateSlug = options.template || getSetting('active_template', 'dark-premium');
    const template = config.templates.find(t => t.id === templateSlug) || config.templates[0];

    const esc = (v) => String(v || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));

    const title = esc(user.name);
    const bio = esc(user.bio || getSetting('profile_bio_long', 'Creative professional and digital creator.'));
    const profileTitle = esc(getSetting('profile_title', 'Developer • Video Editor • Designer'));
    const location = esc(getSetting('profile_location', 'Bihar Sharif, India'));

    const html = `<article style="font-family:Inter,Arial;max-width:820px;margin:auto;padding:48px;color:#172033">
      <h1 style="font-size:38px;margin:0 0 8px">${title}</h1>
      <p style="color:#7568ef;font-weight:700">${profileTitle}</p>
      <p style="color:#8b8b9a;font-size:14px">${location}</p>
      <hr>
      <h2>About</h2>
      <p>${bio}</p>
      <h2>Contact</h2>
      <p>${esc(user.email)}${user.phone ? ' · ' + esc(user.phone) : ''}</p>
    </article>`;

    if (req.body.preview) return res.json({ ok: true, html });

    const filename = `portfolio-${user.id}-${Date.now()}.pdf`;
    const filePath = path.join(portfoliosDir, filename);
    const doc = new PDFDocument({ size: 'A4', margin: 52 });
    const stream = fs.createWriteStream(filePath);

    stream.on('finish', () => {
      res.json({ ok: true, pdfUrl: `/uploads/portfolios/${filename}` });
    });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ error: 'PDF save fail hua.' });
    });

    doc.pipe(stream);
    doc.fillColor('#8b5cf6').fontSize(11).text(template.name.toUpperCase());
    doc.moveDown(0.5).fillColor('#111827').fontSize(30).text(user.name || 'Portfolio');
    doc.moveDown(0.4).fillColor('#8b8b9a').fontSize(12).text(profileTitle);
    doc.moveDown(0.3).fillColor('#8b8b9a').fontSize(10).text(location);
    doc.moveDown(1).strokeColor('#d9d6fe').moveTo(52, 195).lineTo(543, 195).stroke();
    doc.moveDown(2).fillColor('#111827').fontSize(18).text('About');
    doc.moveDown(0.4).fontSize(12).fillColor('#374151').text(
      user.bio || getSetting('profile_bio_long', 'Creative professional.'),
      { width: 490, lineGap: 5 }
    );
    doc.moveDown(1.5).fillColor('#111827').fontSize(18).text('Contact');
    doc.moveDown(0.4).fontSize(12).fillColor('#374151').text(
      [user.email, user.phone, user.whatsapp].filter(Boolean).join('  ·  ')
    );
    doc.end();
  } catch (err) {
    console.error('Portfolio PDF error:', err);
    res.status(500).json({ error: 'Portfolio generate fail hua.' });
  }
});

// ------------------------------------------------------------
// 35. ADMIN ROUTES
// ------------------------------------------------------------

// -------- Admin Login (with OTP fallback) --------
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password zaroori hai.' });

  if (!config.server.adminPassword) {
    return res.status(503).json({ error: 'Admin password configured nahi hai.' });
  }

  if (password !== config.server.adminPassword) {
    log('admin', `failed login from ${getClientIP(req)}`);
    return res.status(401).json({ error: 'Password galat hai.' });
  }

  // Try Telegram OTP
  if (TG_ENABLED && getBoolSetting('telegram_otp_enabled', true)) {
    try {
      const otp = generateOTP();
      await saveOTP('admin', otp, 'admin_login');
      const result = await sendTelegramOTP(otp, 'Admin Login');

      if (result.sent) {
        return res.json({ success: true, step: 'otp', message: 'Telegram pe OTP bheja gaya.' });
      }

      console.warn('⚠️ Telegram OTP failed, using direct login fallback');
    } catch (err) {
      console.warn('⚠️ OTP error, using direct login fallback:', err.message);
    }
  }

  // Fallback: Direct login
  const adminUser = {
    id: 0,
    name: (config.profile?.name || 'Vikram') + ' Admin',
    email: config.profile?.email || 'admin',
    role: 'admin',
    type: 'admin'
  };
  const token = signToken(adminUser);
  setSessionCookie(req, res, token);
  log('admin', `login (direct) from ${getClientIP(req)}`);
  res.json({ success: true, step: 'done', user: adminUser });
});

// -------- Verify OTP --------
app.post('/api/admin/verify-otp', loginLimiter, async (req, res) => {
  const { otp } = req.body;
  if (!otp) return res.status(400).json({ error: 'OTP zaroori hai.' });

  try {
    const result = await checkOTP('admin', otp, 'admin_login');
    if (!result.valid) return res.status(401).json({ error: result.error });

    const adminUser = {
      id: 0,
      name: (config.profile?.name || 'Vikram') + ' Admin',
      email: config.profile?.email || 'admin',
      role: 'admin',
      type: 'admin'
    };
    const token = signToken(adminUser);
    setSessionCookie(req, res, token);
    log('admin', `login success from ${getClientIP(req)}`);
    res.json({ success: true, user: adminUser });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verify fail hua.' });
  }
});

// -------- Admin Logout --------
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  log('admin', 'logout');
  res.json({ ok: true });
});

// -------- Stats --------
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  try { res.json(adminStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/dashboard', auth, adminOnly, (req, res) => {
  try {
    res.json({
      stats: adminStats(),
      recentPayments: paymentGetAll({ limit: 5 }),
      recentUsers: db.prepare('SELECT id, name, email, created_at FROM users ORDER BY id DESC LIMIT 5').all()
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Dashboard load fail hua.' });
  }
});

// -------- Payments (Admin) --------
app.get('/api/admin/payments', auth, adminOnly, (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query;
  res.json(paymentGetAll({ status, limit: Number(limit), offset: Number(offset) }));
});

app.get('/api/admin/payments/pending', auth, adminOnly, (req, res) => {
  res.json(paymentGetPending());
});

app.post('/api/admin/payments/:id/approve', auth, adminOnly, (req, res) => {
  try {
    const result = paymentApprove(Number(req.params.id), 0);
    if (TG_ENABLED && config.telegram.alerts?.paymentApproved) {
      sendTelegram(`✅ Payment #${result.id} approved\nAmount: ₹${result.amount}`).catch(() => {});
    }
    res.json({ ok: true, payment: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/payments/:id/reject', auth, adminOnly, (req, res) => {
  try {
    const reason = req.body.reason || 'Invalid proof';
    const result = paymentReject(Number(req.params.id), reason, 0);
    if (TG_ENABLED && config.telegram.alerts?.paymentRejected) {
      sendTelegram(`❌ Payment #${result.id} rejected\nReason: ${reason}`).catch(() => {});
    }
    res.json({ ok: true, payment: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/revenue', auth, adminOnly, (req, res) => {
  try {
    res.json({
      stats: paymentStats(),
      topSelling: paymentTopSelling(10),
      topBuyers: paymentTopBuyers(10),
      chart: paymentRevenueChart(30)
    });
  } catch (err) {
    console.error('Revenue error:', err);
    res.status(500).json({ error: 'Revenue load fail hua.' });
  }
});

// -------- Users (Admin) --------
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const { search, limit = 200, offset = 0 } = req.query;
  let q = `
    SELECT u.id, u.name, u.email, u.phone, u.role, u.is_vip, u.is_banned,
           u.login_method, u.created_at,
           (SELECT COUNT(*) FROM purchases p WHERE p.user_id = u.id AND p.is_active = 1) as purchases_count,
           (SELECT COALESCE(SUM(amount_paid), 0) FROM purchases p WHERE p.user_id = u.id AND p.is_active = 1) as total_spent
    FROM users u
  `;
  const params = [];
  if (search) {
    q += ' WHERE u.name LIKE ? OR u.email LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  q += ' ORDER BY u.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json(db.prepare(q).all(...params));
});

app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, phone, whatsapp, avatar, bio, role, is_vip, vip_expires_at,
           is_verified, login_method, last_login, is_banned, referral_code, created_at
    FROM users WHERE id = ?
  `).get(Number(req.params.id));

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.purchases = db.prepare(`
    SELECT p.*, pr.title as product_title FROM purchases p
    LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.user_id = ? ORDER BY p.id DESC
  `).all(user.id);

  user.payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(user.id);
  user.downloads = db.prepare('SELECT * FROM download_history WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(user.id);

  res.json(user);
});

app.put('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'whatsapp', 'bio', 'avatar', 'role', 'is_vip', 'vip_expires_at', 'is_banned', 'is_verified'];
    const booleanFields = ['is_vip', 'is_banned', 'is_verified'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        let val = req.body[key];
        if (booleanFields.includes(key)) {
          val = (val === true || val === 1 || val === '1' || val === 'true') ? 1 : 0;
        }
        values.push(val);
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(Number(req.params.id));
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    log('admin', `updated user ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(Number(req.params.id));
    log('admin', `deleted user ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/ban', auth, adminOnly, (req, res) => {
  try {
    const banned = req.body.banned !== false;
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, Number(req.params.id));
    log('admin', `${banned ? 'banned' : 'unbanned'} user ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/:id/vip', auth, adminOnly, (req, res) => {
  try {
    const { days = 30, reason = '' } = req.body;
    const expiresAt = days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    db.prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE id = ?')
      .run(expiresAt, Number(req.params.id));

    try {
      db.prepare('INSERT INTO vip_users (user_id, expires_at, reason) VALUES (?, ?, ?)')
        .run(Number(req.params.id), expiresAt, reason);
    } catch (e) {}

    log('admin', `granted VIP to user ${req.params.id} for ${days} days`);
    res.json({ ok: true, expiresAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id/vip', auth, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE users SET is_vip = 0, vip_expires_at = NULL WHERE id = ?').run(Number(req.params.id));
    log('admin', `revoked VIP from user ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------- Products (Admin) --------
app.get('/api/admin/products', auth, adminOnly, (req, res) => {
  const { search, category, limit = 200 } = req.query;
  let q = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (search) { q += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (category) { q += ' AND category = ?'; params.push(category); }
  q += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(q).all(...params));
});

app.post('/api/admin/products', auth, adminOnly, productUpload.single('file'), (req, res) => {
  try {
    const {
      title, description, long_description, category, price, mrp,
      access_type = 'paid', version = '1.0', preview_url, thumbnail, accent, slug, seo_title
    } = req.body;

    if (!title || !description || !category) {
      if (req.file) deleteFile(req.file.path);
      return res.status(400).json({ error: 'Title, description aur category zaroori hai.' });
    }

    const finalSlug = slug || generateSlug(title);

    const result = db.prepare(`
      INSERT INTO products (
        slug, title, description, long_description, category, price, mrp, access_type,
        file_path, file_name, file_size, file_type, version, preview_url, thumbnail, accent,
        seo_title, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      finalSlug,
      sanitizeInput(title),
      sanitizeInput(description),
      sanitizeInput(long_description || ''),
      category,
      parseInt(price) || 0,
      parseInt(mrp) || 0,
      access_type,
      req.file ? path.join('uploads', 'files', req.file.filename) : null,
      req.file?.filename || null,
      req.file?.size || 0,
      req.file?.mimetype || null,
      version,
      cleanRemoteUrl(preview_url),
      cleanRemoteUrl(thumbnail),
      accent || '#8b5cf6',
      seo_title || title
    );

    log('admin', `created product: ${title}`);
    res.json({ ok: true, product: { id: result.lastInsertRowid, slug: finalSlug, title } });
  } catch (err) {
    console.error('Product create error:', err);
    if (req.file) deleteFile(req.file.path);
    res.status(500).json({ error: 'Product create fail hua: ' + err.message });
  }
});

app.put('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = ['title', 'description', 'long_description', 'category', 'tags', 'price', 'mrp', 'access_type', 'version', 'changelog', 'requirements', 'how_to_use', 'preview_url', 'thumbnail', 'screenshots', 'accent', 'is_featured', 'is_published', 'access_duration_days', 'seo_title', 'seo_description'];
    const updates = [];
    const values = [];

    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(
          ['thumbnail', 'preview_url'].includes(f)
            ? cleanRemoteUrl(req.body[f])
            : (typeof req.body[f] === 'string' ? sanitizeInput(req.body[f]) : req.body[f])
        );
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'Kuch update nahi kiya.' });

    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    log('admin', `updated product ${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ error: 'Update fail hua.' });
  }
});

app.delete('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare('SELECT file_name FROM products WHERE id = ?').get(id);
    if (product?.file_name) deleteProductFile(product.file_name);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    log('admin', `deleted product ${id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Product delete error:', err);
    res.status(500).json({ error: 'Delete fail hua.' });
  }
});

// -------- Categories --------
app.post('/api/admin/categories', auth, adminOnly, (req, res) => {
  try {
    const { name, icon = 'folder', color = '#8b5cf6' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name zaroori hai.' });
    const slug = generateSlug(name);
    const result = db.prepare('INSERT INTO product_categories (name, slug, icon, color) VALUES (?, ?, ?, ?)')
      .run(name, slug, icon, color);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/categories/:id', auth, adminOnly, (req, res) => {
  try {
    db.prepare('DELETE FROM product_categories WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------- Coupons --------
app.get('/api/admin/coupons', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
  res.json(list);
});

app.post('/api/admin/coupons', auth, adminOnly, (req, res) => {
  try {
    const { code, discount_type = 'percent', discount_value, min_amount = 0, max_uses = 100, expires_at } = req.body;
    if (!code || !discount_value) return res.status(400).json({ error: 'Code aur value zaroori hai.' });

    const result = db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_amount, max_uses, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code.toUpperCase(), discount_type, Number(discount_value), Number(min_amount), Number(max_uses), expires_at || null);

    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/coupons/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Orders --------
app.get('/api/admin/orders', auth, adminOnly, (req, res) => {
  const orders = db.prepare(`
    SELECT p.*, u.name as user_name, u.email as user_email, pr.title as product_title
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN products pr ON p.product_id = pr.id
    WHERE p.status = 'approved'
    ORDER BY p.id DESC LIMIT 200
  `).all();
  res.json(orders);
});

// -------- Downloads --------
app.get('/api/admin/downloads', auth, adminOnly, (req, res) => {
  const downloads = db.prepare(`
    SELECT dh.*, u.name as user_name, pr.title as product_title
    FROM download_history dh
    LEFT JOIN users u ON u.id = dh.user_id
    LEFT JOIN products pr ON pr.id = dh.product_id
    ORDER BY dh.id DESC LIMIT 500
  `).all();
  res.json(downloads);
});

// -------- Messages --------
app.get('/api/admin/messages', auth, adminOnly, (req, res) => {
  const messages = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all();
  res.json(messages);
});

app.post('/api/admin/messages/:id/reply', auth, adminOnly, (req, res) => {
  try {
    db.prepare(`
      UPDATE messages SET admin_reply = ?, replied_at = ?, status = 'replied'
      WHERE id = ?
    `).run(req.body.reply, new Date().toISOString(), Number(req.params.id));
    log('admin', `replied to message ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/messages/:id/read', auth, adminOnly, (req, res) => {
  db.prepare("UPDATE messages SET status = 'read' WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/messages/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Reviews --------
app.get('/api/admin/reviews', auth, adminOnly, (req, res) => {
  const list = db.prepare(`
    SELECT r.*, u.name as user_name, pr.title as product_title
    FROM product_reviews r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN products pr ON pr.id = r.product_id
    ORDER BY r.id DESC
  `).all();
  res.json(list);
});

app.post('/api/admin/reviews/:id/approve', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE product_reviews SET is_approved = 1 WHERE id = ?').run(Number(req.params.id));

  try {
    const review = db.prepare('SELECT product_id FROM product_reviews WHERE id = ?').get(Number(req.params.id));
    if (review) {
      const stats = db.prepare(`
        SELECT COUNT(*) as cnt, AVG(rating) as avg FROM product_reviews
        WHERE product_id = ? AND is_approved = 1
      `).get(review.product_id);
      db.prepare('UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?')
        .run(stats.avg || 0, stats.cnt || 0, review.product_id);
    }
  } catch (e) {}

  res.json({ ok: true });
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM product_reviews WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Comments --------
app.get('/api/admin/comments', auth, adminOnly, (req, res) => {
  const list = db.prepare(`
    SELECT c.*, b.title as post_title
    FROM blog_comments c
    LEFT JOIN blog_posts b ON b.id = c.post_id
    ORDER BY c.id DESC
  `).all();
  res.json(list);
});

app.post('/api/admin/comments/:id/approve', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE blog_comments SET is_approved = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/comments/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM blog_comments WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Testimonials --------
app.get('/api/admin/testimonials', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id DESC').all();
  res.json(list);
});

app.post('/api/admin/testimonials', auth, adminOnly, (req, res) => {
  try {
    const { name, role, message, photo, rating = 5 } = req.body;
    const result = db.prepare(`
      INSERT INTO testimonials (name, role, photo, message, rating, is_approved)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(name, role || null, cleanRemoteUrl(photo), message, rating);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/testimonials/:id/approve', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE testimonials SET is_approved = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.delete('/api/admin/testimonials/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Subscribers --------
app.get('/api/admin/subscribers', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM subscribers ORDER BY id DESC').all();
  res.json(list);
});

app.delete('/api/admin/subscribers/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Notifications (Admin) --------
app.get('/api/admin/notifications', auth, adminOnly, (req, res) => {
  const list = db.prepare(`
    SELECT n.*, u.name as user_name
    FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    ORDER BY n.id DESC LIMIT 200
  `).all();
  res.json(list);
});

app.get('/api/admin/notifications/feed', auth, adminOnly, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT id, actor_type as actor, action, details, ip_address, created_at
      FROM activity_log
      ORDER BY id DESC LIMIT 20
    `).all();
    res.json({ notifications: items, unread: 0 });
  } catch (err) {
    res.json({ notifications: [], unread: 0 });
  }
});

app.post('/api/admin/notifications', auth, adminOnly, (req, res) => {
  try {
    const { target = 'all', user_id, title, message, type = 'info', link } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title aur message zaroori hai.' });

    if (target === 'all') {
      const users = db.prepare('SELECT id FROM users').all();
      const stmt = db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, link, is_global)
        VALUES (?, ?, ?, ?, ?, 1)
      `);
      const tx = db.transaction(() => {
        for (const u of users) stmt.run(u.id, title, message, type, link || null);
      });
      tx();
      return res.json({ ok: true, sent: users.length });
    }

    if (target === 'vip') {
      const users = db.prepare('SELECT id FROM users WHERE is_vip = 1').all();
      const stmt = db.prepare('INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)');
      const tx = db.transaction(() => {
        for (const u of users) stmt.run(u.id, title, message, type, link || null);
      });
      tx();
      return res.json({ ok: true, sent: users.length });
    }

    if (target === 'specific' && user_id) {
      db.prepare('INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)')
        .run(user_id, title, message, type, link || null);
      return res.json({ ok: true, sent: 1 });
    }

    res.status(400).json({ error: 'Invalid target' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------- Banners --------
app.get('/api/admin/banners', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM banners ORDER BY priority DESC, id DESC').all();
  res.json(list);
});

app.post('/api/admin/banners', auth, adminOnly, (req, res) => {
  try {
    const { title, description, link, image, mobile_image, position = 'top', color, priority = 0 } = req.body;
    const result = db.prepare(`
      INSERT INTO banners (title, description, link, image, mobile_image, position, color, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, cleanRemoteUrl(link), cleanRemoteUrl(image), cleanRemoteUrl(mobile_image), position, color || '#8b5cf6', priority);
    log('admin', 'created banner');
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/banners/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Ads --------
app.get('/api/admin/ads', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM ads ORDER BY priority DESC, id DESC').all();
  res.json(list);
});

app.post('/api/admin/ads', auth, adminOnly, (req, res) => {
  try {
    const { name, type = 'custom', code, position, device = 'all', user_type = 'all', priority = 0 } = req.body;
    if (!name || !code || !position) return res.status(400).json({ error: 'Name, code aur position zaroori hai.' });
    const result = db.prepare(`
      INSERT INTO ads (name, type, code, position, device, user_type, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, code, position, device, user_type, priority);
    log('admin', `created ad: ${name}`);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/ads/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM ads WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Social Links --------
app.get('/api/admin/social-links', auth, adminOnly, (req, res) => {
  const list = db.prepare('SELECT * FROM social_links ORDER BY sort_order').all();
  res.json(list);
});

app.post('/api/admin/social-links', auth, adminOnly, (req, res) => {
  try {
    const { platform, url, icon, sort_order = 0 } = req.body;
    const result = db.prepare('INSERT INTO social_links (platform, url, icon, sort_order) VALUES (?, ?, ?, ?)')
      .run(platform, url, icon || null, sort_order);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/social-links/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM social_links WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Projects --------
app.get('/api/admin/projects', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM projects ORDER BY sort_order, id DESC').all());
});

app.post('/api/admin/projects', auth, adminOnly, (req, res) => {
  try {
    const { title, description, category, live_url, github_url, thumbnail } = req.body;
    const slug = generateSlug(title);
    const result = db.prepare(`
      INSERT INTO projects (title, slug, description, category, live_url, github_url, thumbnail)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, slug, description || null, category || null, cleanRemoteUrl(live_url), cleanRemoteUrl(github_url), cleanRemoteUrl(thumbnail));
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/projects/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Blog --------
app.get('/api/admin/blog', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM blog_posts ORDER BY id DESC').all());
});

app.post('/api/admin/blog', auth, adminOnly, (req, res) => {
  try {
    const { title, content, excerpt, category, thumbnail, is_published = 0 } = req.body;
    const slug = generateSlug(title);
    const result = db.prepare(`
      INSERT INTO blog_posts (title, slug, content, excerpt, thumbnail, category, is_published, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, slug, content, excerpt || null, cleanRemoteUrl(thumbnail),
      category || null, is_published ? 1 : 0,
      is_published ? new Date().toISOString() : null
    );
    log('admin', `created blog: ${title}`);
    res.json({ ok: true, id: result.lastInsertRowid, slug });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/blog/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Media --------
app.post('/api/admin/media', auth, adminOnly, (req, res) => {
  try {
    const url = cleanRemoteUrl(req.body?.url);
    if (!url) return res.status(400).json({ error: 'Valid https image URL zaroori hai.' });
    const name = String(req.body?.alt_text || url.split('/').pop() || 'remote-image').slice(0, 180);
    const result = db.prepare('INSERT INTO media (filename, original_name, file_path, file_type, file_size, alt_text, uploaded_by) VALUES (?, ?, ?, ?, 0, ?, ?)')
      .run(name, name, url, 'remote-url', req.body?.alt_text || null, req.user.id);
    res.json({ ok: true, id: result.lastInsertRowid, url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/media', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 500').all());
});

app.delete('/api/admin/media/:id', auth, adminOnly, (req, res) => {
  try {
    const media = db.prepare('SELECT file_path FROM media WHERE id = ?').get(Number(req.params.id));
    if (media?.file_path && !media.file_path.startsWith('http')) {
      const fullPath = path.join(imagesDir, path.basename(media.file_path));
      deleteFile(fullPath);
    }
    db.prepare('DELETE FROM media WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------- Skills --------
app.post('/api/admin/skills', auth, adminOnly, (req, res) => {
  try {
    const { name, category, level = 80, icon } = req.body;
    const result = db.prepare('INSERT INTO skills (name, category, level, icon) VALUES (?, ?, ?, ?)')
      .run(name, category, level, icon || null);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/skills/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM skills WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Services --------
app.post('/api/admin/services', auth, adminOnly, (req, res) => {
  try {
    const { title, description, icon, price = 0 } = req.body;
    const result = db.prepare('INSERT INTO services (title, description, icon, price) VALUES (?, ?, ?, ?)')
      .run(title, description, icon || null, price);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/services/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Experience / Education --------
app.post('/api/admin/experience', auth, adminOnly, (req, res) => {
  try {
    const { company, role, duration, description } = req.body;
    const result = db.prepare('INSERT INTO experience (company, role, duration, description) VALUES (?, ?, ?, ?)')
      .run(company, role, duration || null, description || null);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/experience/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM experience WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

app.post('/api/admin/education', auth, adminOnly, (req, res) => {
  try {
    const { degree, institution, year, description } = req.body;
    const result = db.prepare('INSERT INTO education (degree, institution, year, description) VALUES (?, ?, ?, ?)')
      .run(degree, institution, year || null, description || null);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/education/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM education WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// -------- Templates --------
app.get('/api/admin/templates', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM templates ORDER BY id').all();
  res.json(rows.map(t => ({
    ...t,
    config: (() => { try { return JSON.parse(t.config || '{}'); } catch { return {}; } })()
  })));
});

app.put('/api/admin/templates/:id', auth, adminOnly, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM templates WHERE id = ?').get(id)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const { is_active, preview_image, description, config } = req.body;
    if (is_active !== undefined) db.prepare('UPDATE templates SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
    if (preview_image !== undefined || description !== undefined || config !== undefined) {
      db.prepare('UPDATE templates SET preview_image = COALESCE(?, preview_image), description = COALESCE(?, description), config = COALESCE(?, config) WHERE id = ?')
        .run(cleanRemoteUrl(preview_image), description ?? null, config ? JSON.stringify(config) : null, id);
    }
    log('admin', `updated template ${id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -------- Settings (Admin) --------
app.get('/api/admin/settings', auth, adminOnly, (req, res) => {
  try {
    res.json(loadSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings', auth, adminOnly, (req, res) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(req.body)) stmt.run(k, String(v));
    });
    tx();

    // Cache clear — अगली request पर fresh data
    clearSettingsCache();

    log('admin', `updated ${Object.keys(req.body).length} settings`);
    res.json({ ok: true, updated: Object.keys(req.body).length });
  } catch (err) {
    console.error('Settings save error:', err);
    res.status(400).json({ error: err.message });
  }
});

// -------- Activity Log --------
app.get('/api/admin/activity', auth, adminOnly, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  res.json(db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(limit));
});

// -------- Analytics --------
app.get('/api/admin/analytics', auth, adminOnly, (req, res) => {
  const days = Number(req.query.days) || 30;
  res.json(analyticsSummary(days));
});

// -------- Backup --------
app.get('/api/admin/backups', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM backups ORDER BY id DESC').all());
});

app.post('/api/admin/backups', auth, adminOnly, (req, res) => {
  try {
    const filename = `backup-${Date.now()}.db`;
    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, filename);

    db.backup(backupPath).then(() => {
      const size = getFileSize(backupPath);
      db.prepare('INSERT INTO backups (filename, file_path, file_size) VALUES (?, ?, ?)')
        .run(filename, backupPath, size);
      log('admin', `created backup: ${filename}`);
      res.json({ ok: true, filename, size });
    }).catch(err => {
      res.status(500).json({ error: 'Backup fail hua: ' + err.message });
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup fail hua.' });
  }
});

// -------- Test Telegram --------
app.post('/api/admin/test-telegram', auth, adminOnly, async (req, res) => {
  try {
    if (!TG_ENABLED) return res.status(400).json({ error: 'Telegram enabled nahi hai.' });
    const result = await sendTelegram('✅ Test message from Vikram Portfolio');
    res.json({ ok: result.sent, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- Test Email --------
app.post('/api/admin/test-email', auth, adminOnly, async (req, res) => {
  try {
    if (!EMAIL_ENABLED) return res.status(400).json({ error: 'Email enabled nahi hai.' });
    const result = await sendEmail({
      to: req.body.email || config.profile.email,
      subject: 'Test Email',
      html: '<p>Test email from Vikram Portfolio ✅</p>'
    });
    res.json({ ok: result.sent, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- System Info --------
app.get('/api/admin/info', auth, adminOnly, (req, res) => {
  res.json({
    app: config.app.name,
    version: config.app.version,
    telegram: TG_ENABLED,
    email: EMAIL_ENABLED,
    google: config.google.enabled,
    ads: config.ads.enabled,
    template: getActiveTemplate().id,
    maintenance: getMaintenanceMode(),
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// ------------------------------------------------------------
// 36. ERROR HANDLERS
// ------------------------------------------------------------

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API route not found',
      path: req.path,
      method: req.method
    });
  }

  const notFoundPage = path.join(publicDir, '404.html');
  if (fs.existsSync(notFoundPage)) {
    res.status(404).sendFile(notFoundPage);
  } else if (req.method === 'GET' && req.accepts('html')) {
    res.status(404).send(`404 — Page not found: ${req.path}`);
  } else {
    res.status(404).send('404 — Not found');
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  writeLog(errorFile, `${req.method} ${req.path} → ${err.message}\n${err.stack}`);

  if (req.path.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      error: 'Something went wrong',
      message: config.app.nodeEnv === 'development' ? err.message : undefined
    });
  }

  res.status(500).send('500 — Server error');
});

// ------------------------------------------------------------
// 37. GRACEFUL SHUTDOWN
// ------------------------------------------------------------
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  try {
    db.close();
    console.log('✅ Database closed');
  } catch (e) {
    console.error('DB close error:', e.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  writeLog(errorFile, `UNCAUGHT: ${err.stack}`);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  writeLog(errorFile, `UNHANDLED: ${err}`);
});

// ------------------------------------------------------------
// 38. START SERVER
// ------------------------------------------------------------
const PORT = Number(process.env.PORT) || config.app.port || 3000;

// Startup checks
verifyPublicFiles();
verifyTemplates();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   🚀 VIKRAM PORTFOLIO + STORE v2.0            ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`   ✅ Server:       http://localhost:${PORT}`);
  console.log(`   ✅ Environment:  ${config.app.nodeEnv}`);
  console.log(`   ✅ Public dir:   ${publicDir}`);
  console.log(`   ✅ Templates:    ${config.templates.length} available`);
  console.log(`   ✅ Active:       ${getActiveTemplate().name}`);
  console.log(`   ✅ Database:     ${path.join(dataDir, 'portfolio.db')}`);
  console.log(`   ✅ Uploads:      ${uploadDir}`);
  console.log(`   ✅ Telegram:     ${TG_ENABLED ? 'ON ✅' : 'OFF'}`);
  console.log(`   ✅ Email:        ${EMAIL_ENABLED ? 'ON ✅' : 'OFF'}`);
  console.log(`   ✅ Google:       ${config.google.enabled ? 'ON ✅' : 'OFF'}`);
  console.log(`   ✅ Maintenance:  ${getMaintenanceMode() ? 'ON ⚠️' : 'OFF'}`);
  console.log('═══════════════════════════════════════════════\n');
  console.log(`👉 Open: http://localhost:${PORT}`);
  console.log(`👉 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`👉 Health: http://localhost:${PORT}/api/health\n`);
});

server.timeout = 120000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;

// ════════════════════════════════════════════════════════════
// FILE COMPLETE — 38 sections, all routes, all services
// ✅ 10 templates system
// ✅ 200+ admin settings
// ✅ Maintenance mode
// ✅ Google + Telegram + Email
// ✅ Payment verification
// ✅ Portfolio PDF generator
// ════════════════════════════════════════════════════════════