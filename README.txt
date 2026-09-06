BIHARI SMM PRO - ONE SHOT RENDER BUILD

This package is preconfigured for the existing bot.php endpoint.

Render:
1. Upload/push this folder to a PRIVATE GitHub repository.
2. In Render choose New -> Web Service and select the repository.
3. Build Command: npm install
4. Start Command: npm start
5. Deploy.

No Render Environment Variables are required by this package because the private .env file is included.

IMPORTANT SECURITY:
The .env file contains private credentials. Keep the GitHub repository PRIVATE and never share this ZIP publicly.
If the repository is ever made public or the credentials are exposed, rotate the affected credentials immediately.

The Node server proxies admin API requests server-side to the existing bot.php URL, so the API key is not sent to browser JavaScript.


FIX NOTES 20.1
- Fixed Render login failure caused by missing ADMIN_PASSWORD configuration. This project includes .env; make sure the .env file is committed to the GitHub repository if you want one-shot deployment without Render Environment Variables.
- Fixed the Content-Security-Policy that blocked the existing inline onclick handlers used throughout the original UI.
- Added cache-busting and direct event listeners for login/eye controls.
- Services edit/enable/disable/delete/bulk-price actions remain wired to the server API.
- IMPORTANT: If the GitHub repository is public, do not commit real secrets. Use a private repository or Render Environment Variables instead.
