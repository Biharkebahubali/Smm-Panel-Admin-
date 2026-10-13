# 🚀 Vikram Portfolio + Store

A complete full-stack portfolio + digital store with 10 themes, admin panel, UPI payments, and PWA support.

**Developer • Video Editor • Designer from Bihar Sharif, India 🇮🇳**

---

## ✨ Features

### 🌐 Public Website
- 25 sections (Hero, About, Skills, Services, Projects, Store, Blog, Contact)
- **10 Themes** — Dark Premium, Modern Light, Creative Pink, Minimal Mono, Cyber Neon, Ocean Blue, Sunset Orange, Forest Green, Retro Vintage, Gradient Glass
- Live visitor counter, IST time, animations
- Client logos strip, Awards, Instagram feed
- Advanced hero with skill chips + floating badges
- Full SEO (structured data, OG tags, sitemap)

### 🛒 Digital Store
- Product catalog with filters, search, sort
- Free + Paid products
- UPI payment with QR code
- Manual payment verification
- Screenshots upload + UTR
- Download tokens (10 min validity)
- Reviews with ratings
- Wishlist / Favorites
- Related products

### 👤 User Dashboard (17 pages)
- Overview with charts + streak + achievements
- Portfolio PDF generator
- Purchases (filter by status/expiry)
- Payments (filter by date/UTR)
- Downloads (with export + clear history)
- Invoices
- Favorites (with sort + share)
- Reviews (filter by rating + status)
- Notifications (tabs + group by date)
- Messages (chat-style)
- Activity Log (timeline)
- Achievements (badges)
- Referral (QR code + leaderboard + rewards)
- Profile (login history + active sessions + 2FA)
- Settings (8 sections)
- VIP/Upgrade (3 plans)
- Help Center (search + shortcuts + status)

### 🔐 Admin Panel (32 sections)
- Login with password + Telegram OTP
- Dashboard with 8 stats + 2 charts
- Analytics (traffic, sources, devices, browsers)
- Revenue (top selling + top buyers + chart)
- Live Activity (real-time feed)
- Payments (bulk approve, proof viewer)
- Users (ban, VIP, edit)
- Products (upload, edit, delete)
- Categories, Coupons, Orders, Downloads
- Profile, Templates, Projects, Blog, Media, Skills, Services, Resume
- Banners, AdSense, Social, Subscribers, Notifications, SEO
- Messages, Reviews, Comments, Testimonials
- Settings (Site, Theme, Store, Email, Telegram, Security)
- Activity Log + Backup & Restore

### 🔧 Backend
- Node.js + Express + SQLite
- JWT authentication
- bcrypt password hashing
- Google Sign-In (mobile-friendly)
- Telegram Bot (OTP + alerts)
- Gmail SMTP (password reset)
- PDFKit (portfolio PDF)
- Helmet security headers
- Rate limiting (5 tiers)
- Input sanitization
- File uploads (Multer)
- 200+ admin settings
- Maintenance mode
- 10 template system

---

## 🛠️ Tech Stack

**Backend:** Node.js 22, Express 4.21, SQLite (better-sqlite3), JWT, bcryptjs  
**Frontend:** HTML5, CSS3, Vanilla JavaScript, Chart.js  
**Services:** Nodemailer (Gmail), Telegram Bot API, PDFKit  
**Deployment:** Render.com (free tier)

---

## 📁 Project Structure

```

vikram-portfolio-store/
├── config.js                    # Secrets & settings
├── server.js                    # Backend (all routes)
├── package.json                 # Dependencies
├── render.yaml                  # Deployment config
├── README.md                    # This file
├── .gitignore                   # Git ignore
│
├── database/
│   └── init.sql                 # Complete schema (37 tables, 200+ settings)
│
├── public/                      # Frontend HTML
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── admin.html
│   ├── file.html
│   ├── legal.html
│   └── resume.html
│
├── assets/
│   ├── style.css                # Main CSS
│   ├── script.js                # Main JS
│   ├── sw.js                    # Service Worker
│   ├── manifest.json            # PWA manifest
│   ├── templates/               # 10 theme files
│   │   ├── dark-premium.css
│   │   ├── modern-light.css
│   │   ├── creative-pink.css
│   │   ├── minimal-mono.css
│   │   ├── cyber-neon.css
│   │   ├── ocean-blue.css
│   │   ├── sunset-orange.css
│   │   ├── forest-green.css
│   │   ├── retro-vintage.css
│   │   └── gradient-glass.css
│   └── images/                  # SVG icons
│       ├── favicon.svg
│       ├── logo.svg
│       ├── profile.svg
│       ├── signature.svg
│       └── icon-{72,96,128,192,384,512}.svg
│
└── uploads/                     # Auto-created (files, proofs, images, portfolios)

```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ ([download](https://nodejs.org))
- Git

### Installation

```bash
# 1. Clone
git clone https://github.com/Biharkebahubali/vikram-portfolio-store.git
cd vikram-portfolio-store

# 2. Install dependencies
npm install

# 3. Configure
# Open config.js and update SECRETS section with your:
# - ADMIN_PASSWORD
# - JWT_SECRET
# - GOOGLE_CLIENT_ID
# - EMAIL_USER + EMAIL_PASS
# - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
# - UPI_ID

# 4. Start server
npm start
```

Open http://localhost:3000

Development mode

```bash
npm run dev
```

---

⚙️ Configuration

सब कुछ config.js में है — कोई .env file नहीं चाहिए।

Setting कहाँ मिलेगा
ADMIN_PASSWORD अपना बनाओ (12+ chars)
JWT_SECRET Random 64-char string
GOOGLE_CLIENT_ID Google Cloud Console
EMAIL_PASS Gmail App Password
TELEGRAM_BOT_TOKEN @BotFather
TELEGRAM_CHAT_ID @userinfobot
UPI_ID अपना UPI ID

Environment Auto-Detect

· Local → ./database/ + ./uploads/
· Render (/var/data exists) → /var/data/database/ + /var/data/uploads/

---

🌐 Deployment (Render.com)

Free Tier Setup:

1. Fork this repo
2. Sign up at render.com
3. New → Web Service → Connect GitHub
4. Configure:
   · Name: vikram-portfolio-store
   · Region: Singapore
   · Branch: main
   · Build: npm install
   · Start: npm start
   · Plan: Free
5. Add Disk:
   · Name: vikram-data
   · Mount: /var/data
   · Size: 1 GB
6. Deploy → 2-3 minutes

Note: Free tier sleeps after 15 min inactivity. First request takes 30-60 sec to wake.

---

🔐 Admin Login

1. Open /admin.html
2. Enter password from config.js
3. If Telegram OTP enabled → check Telegram bot
4. Enter 6-digit OTP

Fallback: अगर Telegram fail हो तो direct login works automatically.

---

🎨 10 Themes

Users/Admin can switch between:

1. Dark Premium (Gold + Purple)
2. Modern Light (Purple + Pink)
3. Creative Pink
4. Minimal Mono
5. Cyber Neon
6. Ocean Blue
7. Sunset Orange
8. Forest Green
9. Retro Vintage
10. Gradient Glass

Change from: Admin → Settings → Theme

---

📱 PWA Support

· ✅ Installable on Android/iOS/Desktop
· ✅ Offline support
· ✅ App shortcuts (Store, Dashboard, Resume, Login)
· ✅ Share target

---

🔒 Security

· bcrypt password hashing (10 rounds)
· JWT sessions (2-hour expiry)
· Helmet.js security headers
· CSP rules
· Rate limiting (5 tiers)
· Input sanitization
· SQL injection prevention (prepared statements)
· Path traversal protection
· XSS prevention
· CSRF protection

---

📊 Stats

· 📁 39 files
· 📝 12,000+ lines of code
· 🗄️ 37 database tables
· 🔌 80+ API endpoints
· 🎨 10 themes
· 🎛️ 32 admin sections
· 👤 17 dashboard pages
· 🌐 25 homepage sections

---

📄 License

MIT License — see LICENSE

Copyright (c) 2025 Vikram Laheri

---

👨‍💻 Contact

Vikram Laheri
📍 Bihar Sharif, Nalanda, Bihar, India
📧 vikramkumarart@gmail.com
📱 +91 88252 97632
💬 Telegram @code_breaker
🐙 GitHub

---

Made with ❤️ in Bihar Sharif

```

---

**✅ दोनों Save कर। बताओ "सब done"**

---

# 🎉 Complete! Project 100% तैयार है

## 📊 Final File List (39 files)

| # | File | Path |
|---|------|------|
| 1 | `.gitignore` | root |
| 2 | `package.json` | root |
| 3 | `config.js` | root |
| 4 | `render.yaml` | root |
| 5 | `README.md` | root |
| 6 | `server.js` | root |
| 7 | `init.sql` | `database/` |
| 8 | `style.css` | `assets/` |
| 9 | `script.js` | `assets/` |
| 10 | `sw.js` | `assets/` |
| 11 | `manifest.json` | `assets/` |
| 12-21 | 10 templates | `assets/templates/` |
| 22-31 | 10 SVG icons | `assets/images/` |
| 32-38 | 7 HTML pages | `public/` |

**+ `package-lock.json`** → `npm install` अपने आप बनाएगा ✅

**Total: 39 files + 1 auto-generated = 40 files**

---

# 🚀 अब Test कर

## 1. Terminal खोल (vikram-portfolio-store folder में)

## 2. Install
```bash
npm install
```

3. Start

```bash
npm start
```

4. Expected Output

```
╔═══════════════════════════════════════════════╗
║   🚀 VIKRAM PORTFOLIO + STORE v2.0            ║
╚═══════════════════════════════════════════════╝
   ✅ Server:       http://localhost:3000
   ✅ Environment:  development
   ✅ Templates:    10 available
   ✅ Active:       Dark Premium
   ✅ Database:     ./database/portfolio.db
   ✅ Telegram:     ON ✅
   ✅ Email:        ON ✅
```

5. Browser में खोल

· http://localhost:3000 → Homepage
· http://localhost:3000/admin → Admin panel
· http://localhost:3000/dashboard → User dashboard
· http://localhost:3000/api/health → Health check
