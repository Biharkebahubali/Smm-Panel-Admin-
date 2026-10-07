# Bihari SMM Admin Panel v7.0.1

यह static admin panel supplied `bot.php` backend से connect होता है। सभी pages `script.js` के common API wrapper का उपयोग करते हैं।

## सबसे जरूरी बदलाव

- इस file-only build में config और bot.php में direct-upload के लिए credentials रखे गए हैं। Public repository में इसे commit न करें और आवश्यकता होने पर tokens rotate करें।
- **Settings → API Settings → Admin Panel Backend** में अपना पूरा backend URL बदलें, जैसे:
  `https://rana-hosting.myvipsite.fun/bots/bot_6ab3b0ca457a0/bot.php`
- URL और API key browser के local runtime config में save होते हैं; URL बदलने के बाद अगली API request नए bot से जाएगी।
- Backup page भी अब उसी runtime URL का उपयोग करता है।
- `manus-routes.json` जोड़ दिया गया है।

## Backend contract

`bot.php` को CORS में केवल अपनी admin-panel origin allow करनी चाहिए और server-side secret रखना चाहिए। Expected actions:

- `GET/POST ?action=ping`
- `GET/POST ?action=getData`, `getDataPage`, `getTickets`, `getMessages`, `getSmmConfig` आदि
- `POST ?action=updateSetting` और बाकी mutation actions
- production login के लिए server-side `sendOTP`, `verifyOTP`, `verifyPassword` endpoints जरूरी हैं। OTP bot token और master password को frontend में कभी न डालें।

पुराने package में ये login endpoints मौजूद नहीं थे, इसलिए frontend को fake success देने की बजाय backend error दिखाने के लिए तैयार रखें।

## Deploy

1. पूरा folder hosting पर upload करें।
2. `index.html` खोलें और login के बाद Settings में backend URL set करें।
3. `bot.php` में CORS, API auth और login endpoints configure करें।
4. पुराने exposed credentials को Telegram BotFather, provider, GitHub और backend में rotate करें।

## Render deployment

यह project **Static Site नहीं** है, क्योंकि इसमें `bot.php` PHP backend है। Render पर इसे **Web Service → Docker** के रूप में deploy करें। ZIP में `Dockerfile` और `render.yaml` शामिल हैं।

File-only mode में `bot.php` के top पर API key, password, Telegram token और chat ID रखे गए हैं ताकि अलग environment setup आवश्यक न हो। यह सुविधाजनक है लेकिन public repository में सुरक्षित नहीं है।


## Real bot_v3.php integration

इस package में supplied `bot_v3.php` ही रखा गया है। Frontend API requests इस existing contract को use करती हैं:

- API URL: `https://rana-hosting.myvipsite.fun/bots/bot_6ab3b0ca457a0/bot.php`
- `X-API-Key`: `Vikram@8936`
- real actions: `getData`, `getDataPage`, `botStatus`, `getDiagnostics`, `getApiBalance`, `sync`, `approvePayment`, `rejectPayment`, `updateOrderStatus`, `broadcast`, `getSmmConfig`, `updateSmmConfig`, `updateSetting`, `getSetting`, users/services/messages/tickets/trash/backups and sync actions.

आपके supplied bot में `sendOTP`, `verifyOTP` और `verifyPassword` actions नहीं हैं, इसलिए login frontend का OTP/password flow local रखा गया है। यह existing bot को बदलकर fake server login नहीं बनाता।

Render पर पूरा project deploy करना हो तो **Web Service → Docker** चुनें; Static Site `bot.php` execute नहीं करेगी।


## Login flow

अब login क्रम यह है:

1. केवल admin password डालें।
2. Password सही होने पर Telegram OTP भेजा जाएगा।
3. OTP सही होने पर सीधे `pages/dashboard.html` खुलेगा।
4. Username field और अलग password step हटाए गए हैं; account identity `ADMIN_USERNAME` से आती है।
