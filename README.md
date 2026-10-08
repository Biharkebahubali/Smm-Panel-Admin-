# BIHARI SMM ADMIN PANEL — V8 FIXED

This package is a cleaned and security-hardened rebuild of the supplied v7 admin panel.

## Important
- The browser no longer contains the Telegram bot token, SMM provider key, GitHub token, or admin password hash.
- Login is handled by the backend with server-side password verification, Telegram OTP, attempt lockout and server-issued sessions.
- The web panel uses `Authorization: Bearer <session>` for protected API calls.
- Automatic GitHub restore on page load has been removed. Restore is an explicit admin action.
- Frontend automatic backup-on-page-load has been removed. Use the Backup page or a server cron/scheduler.
- POST requests use `application/x-www-form-urlencoded`, matching the existing PHP API's `$_POST` contract.
- Synthetic/demo audit/security/provider/ledger fallbacks should not be treated as authoritative production history; the remaining pages use backend data where their endpoints exist.

## Backend
Upload `bot.php` to the same PHP hosting environment as the bot. The first API call creates the admin-auth tables automatically.

The panel's `config.js` points to:
`https://rana-hosting.myvipsite.fun/bots/bot_6ac7791f6fd21/bot.php`

If your hosting system generates a different PHP path, edit only `API_URL` in `config.js`.

## Login
The backend uses the existing admin password hash from the supplied project and sends OTP to the configured Telegram admin ID through the server-side bot token.

The backend enforces:
- 3 failed password attempts → 5-minute lockout
- 3 OTP attempts per challenge
- 5-minute OTP expiry
- single active admin session
- normal 2-hour session
- optional 30-day remember session
- IP binding for active sessions

## API coverage
The frontend API methods were cross-checked against backend action cases. All actions used by the central API wrapper have matching backend cases in the supplied backend.

## Deployment
1. Upload `bot.php` to PHP hosting.
2. Set the generated/actual URL in `config.js`.
3. Upload the panel folder to your static hosting.
4. Open `index.html`.
5. Log in with the existing admin password.
6. Complete Telegram OTP.
7. Test Dashboard → Users → Orders → Payments → Services → Backup.

## Security
The original supplied project contained credentials in public frontend files. Rotate/revoke any credentials that were ever committed to a public repository. The fixed frontend intentionally does not carry those secrets.
