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
