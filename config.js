/* ============================================================
   VIKRAM PORTFOLIO + STORE — CONFIGURATION FILE
   Keep this file private. Do not publish to GitHub.
   ============================================================ */

const path = require('path');
const fs = require('fs');

// ------------------------------------------------------------
// ROOT DIRECTORY
// ------------------------------------------------------------
const ROOT = __dirname;

// ------------------------------------------------------------
// STORAGE ROOT (Auto-detect for Render.com)
// Render mounts persistent disk at /var/data
// ------------------------------------------------------------
const storageRoot = fs.existsSync('/var/data') ? '/var/data' : ROOT;

// ------------------------------------------------------------
// CONFIGURATION EXPORT
// ------------------------------------------------------------
module.exports = {

  // ==========================================================
  // 1. APP
  // ==========================================================
  app: {
    name: 'Vikram Portfolio + Store',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    port: Number(process.env.PORT) || 3000,
    dataDir: path.join(storageRoot, 'database'),
    uploadDir: path.join(storageRoot, 'uploads'),
    logsDir: path.join(storageRoot, 'logs'),
    nodeEnv: 'production',
    version: '1.0.0'
  },

  // ==========================================================
  // 2. PROFILE
  // ==========================================================
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
    bio: 'Main Vikram hoon, Bihar Sharif (Nalanda, Bihar) se. BCA student aur freelancer. Mujhe coding, video editing aur design teeno me maza aata hai.',
    footer: 'Made with ♥ in Bihar Sharif'
  },

  // ==========================================================
  // 3. THEME
  // ==========================================================
  theme: {
    primary: '#d4af37',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    mode: 'dark'
  },

  // ==========================================================
  // 4. STORE
  // ==========================================================
  store: {
    currency: 'INR',
    upiId: 'code-breakerkumar@fam',
    announcement: 'New creator assets are live — explore the store.',
    paymentInstructions: 'UPI payment karo, screenshot aur UTR upload karo. Verification 24 hours ke andar hoga.'
  },

  // ==========================================================
  // 5. ACCESS RULES
  // ==========================================================
  access: {
    guestBrowsing: true,
    loginRequiredForDownload: true,
    loginRequiredForPurchase: true,
    loginRequiredForMessage: true,
    loginRequiredForReview: true
  },

  // ==========================================================
  // 6. GOOGLE SIGN-IN
  // ==========================================================
  google: {
    enabled: true,
    clientId: '1009454104796-v52v0ouj1qki9d2p8dkoatalvm3km982.apps.googleusercontent.com',
    redirectUri: 'https://vikram-portfolio-knzb.onrender.com/api/auth/google/callback'
  },

  // ==========================================================
  // 7. SERVER SECRETS
  // ==========================================================
  server: {
    jwtSecret: process.env.JWT_SECRET || 'change-this-development-secret',
    adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe@123',
    sessionHours: 2
  },

  // ==========================================================
  // 8. SECURITY
  // ==========================================================
  security: {
    maxUploadMB: 100,
    downloadTokenMinutes: 10,
    loginAttemptsPerMinute: 5,
    bcryptRounds: 10,
    otpExpiryMinutes: 5,
    otpMaxAttempts: 3
  },

  // ==========================================================
  // 9. ADS / ADSENSE
  // ==========================================================
  ads: {
    enabled: false,
    publisherId: '',
    autoAds: false,
    slots: {
      header: '',
      sidebar: '',
      content: '',
      footer: '',
      popup: ''
    }
  },

  // ==========================================================
  // 10. EMAIL
  // ==========================================================
  email: {
    enabled: true,
    from: 'gamergamerknock@gmail.com',
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      user: 'gamergamerknock@gmail.com',
      pass: 'eidw vbjr tckw icir'
    }
  },

  // ==========================================================
  // 11. TELEGRAM BOT
  // ==========================================================
  telegram: {
    enabled: true,
    botToken: '8621924474:AAExk1IoXD2x2awK4Y5UiijG4NfLpehClqc',
    chatId: '5207471711'
  },

  // ==========================================================
  // 12. ANALYTICS
  // ==========================================================
  analytics: {
    enabled: false,
    googleMeasurementId: ''
  },

  // ==========================================================
  // 13. DIRECTORY PATHS (Computed)
  // ==========================================================
  paths: {
    root: ROOT,
    public: path.join(ROOT, 'public'),
    database: path.join(storageRoot, 'database'),
    uploads: path.join(storageRoot, 'uploads'),
    uploadsFiles: path.join(storageRoot, 'uploads', 'files'),
    uploadsProofs: path.join(storageRoot, 'uploads', 'proofs'),
    uploadsImages: path.join(storageRoot, 'uploads', 'images'),
    uploadsPortfolios: path.join(storageRoot, 'uploads', 'portfolios'),
    logs: path.join(storageRoot, 'logs')
  }

};