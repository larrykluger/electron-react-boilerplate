// Copy this file to config.js and update the settings.
// Don't store config.js in your repo!
// See the README_OAuth.md file for more information

// Example settings
const config = {
  schemeName: 'com.example.electron1',
  schemeSlashCount: 1, // 1 or 2 (not a string!)
  idpUrl: 'https://account-d.docusign.com',
  implicitClientId: 'b2b5xxxx-xxxx-xxxx-xxxx-xxxxxxxxxx6b',
  implicitReturnPath: 'implicit-result',
  implicitScopes: 'signature',
  implicitRedirectUrl: 'http://xxx.s3-website.us-east-2.amazonaws.com/',
};

export default config;
