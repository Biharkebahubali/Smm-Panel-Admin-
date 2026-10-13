/* ============================================================
   VIKRAM PORTFOLIO + STORE — config.js
   ============================================================
   ⚠️  PRIVATE FILE — GitHub पर upload मत करो
   ⚠️  सारे passwords यहीं हैं
   ⚠️  कोई .env file नहीं चाहिए — सब यहीं
   ============================================================ */

const path = require('path');
const fs = require('fs');

// ============================================================
// 🔐 SECRETS — अपने credentials यहाँ डालो
// ============================================================
const SECRETS = {

  // -------- ADMIN LOGIN --------
  ADMIN_PASSWORD: 'Vikram@8936',       // ⚠️ बदलना चाहो तो बदल लो
  ADMIN_USERNAME: 'vikram',

  // -------- JWT SECRET (ऐसा ही random रहने दो) --------
  JWT_SECRET: 'vikram-portfolio-jwt-secret-2025-do-not-share-xyz789abc123def456ghi012jkl345mno678',

  // -------- GOOGLE LOGIN --------
  GOOGLE_CLIENT_ID: '1009454104796-v52v0ouj1qki9d2p8dkoatalvm3km982.apps.googleusercontent.com',

  // -------- EMAIL (Gmail) --------
  EMAIL_USER: 'gamergamerknock@gmail.com',
  EMAIL_PASS: 'eidw vbjr tckw icir',

  // -------- TELEGRAM BOT --------
  TELEGRAM_BOT_TOKEN: '8621924474:AAExk1IoXD2x2awK4Y5UiijG4NfLpehClqc',
  TELEGRAM_CHAT_ID: '5207471711',

  // -------- UPI PAYMENT --------
  UPI_ID: 'code-breakerkumar@fam',

  // -------- URLs --------
  PRODUCTION_URL: 'https://vikram-portfolio-knzb.onrender.com',
  LOCAL_URL: 'http://localhost:3000'
};

// ============================================================
// 🌍 AUTO-DETECT (कुछ नहीं करना — अपने आप होगा)
// ============================================================
const IS_PRODUCTION = fs.existsSync('/var/data');
const ROOT = __dirname;
const storageRoot = IS_PRODUCTION ? '/var/data' : ROOT;
const BASE_URL = IS_PRODUCTION ? SECRETS.PRODUCTION_URL : SECRETS.LOCAL_URL;
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// ============================================================
// 🎨 10 TEMPLATES की LIST
// ============================================================
const TEMPLATES = [
  { id: 'dark-premium',   name: 'Dark Premium',   description: 'Royal gold & purple',        preview: 'https://placehold.co/400x300/0a0a0f/d4af37?text=Dark+Premium' },
  { id: 'modern-light',   name: 'Modern Light',   description: 'Clean professional',          preview: 'https://placehold.co/400x300/f7f9ff/6d5dfc?text=Modern+Light' },
  { id: 'creative-pink',  name: 'Creative Pink',  description: 'Playful feminine',            preview: 'https://placehold.co/400x300/fff8fb/ff6b9d?text=Creative+Pink' },
  { id: 'minimal-mono',   name: 'Minimal Mono',   description: 'Simple brutalist',            preview: 'https://placehold.co/400x300/ffffff/000000?text=Minimal+Mono' },
  { id: 'cyber-neon',     name: 'Cyber Neon',     description: 'Futuristic gamer',            preview: 'https://placehold.co/400x300/050510/00ffff?text=Cyber+Neon' },
  { id: 'ocean-blue',     name: 'Ocean Blue',     description: 'Calm trust',                  preview: 'https://placehold.co/400x300/f0f9ff/0ea5e9?text=Ocean+Blue' },
  { id: 'sunset-orange',  name: 'Sunset Orange',  description: 'Warm energetic',              preview: 'https://placehold.co/400x300/fff7ed/f97316?text=Sunset+Orange' },
  { id: 'forest-green',   name: 'Forest Green',   description: 'Natural organic',             preview: 'https://placehold.co/400x300/f7fee7/22c55e?text=Forest+Green' },
  { id: 'retro-vintage',  name: 'Retro Vintage',  description: 'Nostalgic warm',              preview: 'https://placehold.co/400x300/fef3c7/92400e?text=Retro+Vintage' },
  { id: 'gradient-glass', name: 'Gradient Glass', description: 'Glassmorphism premium',       preview: 'https://placehold.co/400x300/667eea/a855f7?text=Gradient+Glass' }
];

// ============================================================
// 📦 FULL CONFIG
// ============================================================
module.exports = {

  app: {
    name: 'Vikram Portfolio + Store',
    baseUrl: BASE_URL,
    port: PORT,
    dataDir: path.join(storageRoot, 'database'),
    uploadDir: path.join(storageRoot, 'uploads'),
    logsDir: path.join(storageRoot, 'logs'),
    nodeEnv: IS_PRODUCTION ? 'production' : 'development',
    version: '2.0.0',
    isProduction: IS_PRODUCTION
  },

  // 10 templates
  templates: TEMPLATES,
  defaultTemplate: 'dark-premium',

  features: {
    googleLogin: true,
    emailService: true,
    telegramBot: true,
    userRegistration: true,
    reviewsEnabled: true,
    messagesEnabled: true,
    portfolioPdf: true,
    referralEnabled: true,
    adsEnabled: false,
    analyticsEnabled: false
  },

  profile: {
    name: 'Vikram Laheri',
    title: 'Developer • Video Editor • Designer',
    tagline: 'I build. I edit. I create.',
    location: 'Bihar Sharif, Nalanda, Bihar, India',
    email: 'vikramkumarart@gmail.com',
    phone: '8825297632',
    whatsapp: '8825297632',
    telegram: '@code_breaker',
    github: 'https://github.com/Biharkebahubali',
    youtube: 'https://youtube.com/@bihar_ke_bahubali',
    instagram: 'https://www.instagram.com/vikram_life_',
    bio: 'Main Vikram hoon, Bihar Sharif se. BCA student aur freelancer.',
    footer: 'Made with ♥ in Bihar Sharif'
  },

  theme: {
    primary: '#d4af37',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    mode: 'dark'
  },

  store: {
    currency: 'INR',
    currencySymbol: '₹',
    upiId: SECRETS.UPI_ID,
    merchantName: 'Vikram Laheri',
    announcement: 'New creator assets are live — explore the store.',
    paymentInstructions: 'UPI payment karo, screenshot aur UTR upload karo.',
    verificationHours: 24
  },

  access: {
    guestBrowsing: true,
    loginRequiredForDownload: true,
    loginRequiredForPurchase: true,
    loginRequiredForMessage: true,
    loginRequiredForReview: true
  },

  google: {
    enabled: true,
    clientId: SECRETS.GOOGLE_CLIENT_ID,
    redirectUri: `${BASE_URL}/api/auth/google/callback`
  },

  server: {
    jwtSecret: SECRETS.JWT_SECRET,
    adminPassword: SECRETS.ADMIN_PASSWORD,
    adminUsername: SECRETS.ADMIN_USERNAME,
    sessionHours: 2
  },

  security: {
    maxUploadMB: 100,
    downloadTokenMinutes: 10,
    loginAttemptsPerMinute: 5,
    bcryptRounds: 10,
    otpExpiryMinutes: 5,
    otpMaxAttempts: 3,
    rateLimits: {
      globalPerMinute: 300,
      apiPerMinute: 300,
      loginPerMinute: 5,
      otpPerMinutes: 3,
      downloadPerHour: 20,
      strictPerMinute: 10
    }
  },

  ads: {
    enabled: false,
    publisherId: '',
    autoAds: false,
    slots: { header: '', sidebar: '', content: '', footer: '', popup: '' }
  },

  email: {
    enabled: true,
    from: SECRETS.EMAIL_USER,
    fromName: 'Vikram Portfolio',
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: SECRETS.EMAIL_USER,
      pass: SECRETS.EMAIL_PASS
    }
  },

  telegram: {
    enabled: true,
    botToken: SECRETS.TELEGRAM_BOT_TOKEN,
    chatId: SECRETS.TELEGRAM_CHAT_ID,
    alerts: {
      otp: true,
      newPayment: true,
      paymentApproved: true,
      paymentRejected: true,
      newUser: false,
      newMessage: true
    }
  },

  seo: {
    title: 'Vikram Laheri — Developer • Video Editor • Designer',
    description: 'BCA student, developer, video editor from Bihar Sharif.',
    keywords: 'Vikram Laheri, Developer Bihar, Video Editor, Portfolio',
    ogImage: 'https://placehold.co/1200x630/0a0a0f/d4af37?text=VIKRAM+Laheri'
  },

  analytics: {
    enabled: false,
    googleMeasurementId: ''
  },

  maintenance: {
    enabled: false,
    message: 'Site is under maintenance. Back soon!',
    allowedIPs: ['127.0.0.1', '::1']
  },

  paths: {
    root: ROOT,
    public: path.join(ROOT, 'public'),
    assets: path.join(ROOT, 'assets'),
    templates: path.join(ROOT, 'assets', 'templates'),
    database: path.join(storageRoot, 'database'),
    uploads: path.join(storageRoot, 'uploads'),
    uploadsFiles: path.join(storageRoot, 'uploads', 'files'),
    uploadsProofs: path.join(storageRoot, 'uploads', 'proofs'),
    uploadsImages: path.join(storageRoot, 'uploads', 'images'),
    uploadsAvatars: path.join(storageRoot, 'uploads', 'images', 'avatars'),
    uploadsPortfolios: path.join(storageRoot, 'uploads', 'portfolios'),
    logs: path.join(storageRoot, 'logs')
  }
};