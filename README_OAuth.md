# OAuth Implicit Grant Support

Support for Implicit Grant has been added to this project:
* A **Login** button was added to the home page.
* Clicking **Login** causes a browser window (using the computer's
  default browser) to be opened for the first step of the Implicit grant
  flow to the IdP (Identity Provider) server.
* After the user completes authentication and grants consent to the 
  Electron application, the OAuth flow is completed when
  the application receives the access_token from the IdP.
* The application then makes an additional API call
  to `/oauth/userinfo` obtain 
  more information about the user including their name, etc.
* The home page shows the logged in user's name and additional
  information. It includes a logout link.

## Configuring your Identity Provider (IdP)

**Step 1.** Decide if you want the IdP to redirect to the
Electron app, or to an intermediate web page.

If the IdP redirects to the Electron app, the browser will
show a blank page after the Electron app is opened.
The app attempts to close the browser tab, but 
programmatically closing the
tab does not work with all browsers.

A generic solution is to have the IdP redirect to a regular
web page, served by a static web server (eg, an AWS S3 website).
The webpage displays a "Please close me" message to the 
user and opens the Electron app.

See the example webpage in `src/public_web_page/thankyou.html`

**Step 2.** Determine if your IdP can handle redirect URLs with a single slash.
Eg. `com.example.Electron1:/implicit-result`

Some can, some can't. 

If you are using an intermediate webpage then a single slash
can be used, since the URL will be sent by the intermediate 
webpage, not by the IdP.

**Step 3.** Depending on the above, decide on your application's redirect URL.
Following [RFC 8252 sec. 7.1](https://tools.ietf.org/html/rfc8252#section-7.1), the redirect URL MUST use a scheme that includes a domain name under your control, expressed in reverse order.

Example: You have control over the DNS name `electron1.example.com` 
where `electron1` is the name of your app. So your private scheme 
should be `com.dshackathon.electron1`

The pathname portion of the redirect URL must have a single part
such as `implicit-result`

If you're using an intermediate page, your Electron app's 
redirect URL will be

`SCHEME_NAME:/IMPLICIT_RETURN_PATH`

or (using example values)

`com.example.electron1:/implicit-result`

If you're not using an intermediate page, then your 
application's URL may need two slashes, depending on your IdP.

If you're using an intermediate page, add this URL to the
intermediate page. 
See the `electronUrl` JavaScript variable setting in the
example intermediate page. Note that a single slash is used
after the colon.

**Step 4.** Create/configure a client_id in your IdP for the application:
* Allow the Implicit grant flow
* If you're using an intermediate page, add the URL of the 
  intermediate webpage to the client_id. (See the prior step.) 

  If your IdP will redirect to the Electron app, then add the 
  app's redirect URL (from the prior step) to the IdP.
* As needed by the IdP, allow the scopes that the application will request.

## .env File

A `.env` file is required for the Implicit grant settings.

Create the file in the root of the project directory.

Contents of the file with example settings:

````
SCHEME_NAME='com.example.Electron1'
SCHEME_SLASH_COUNT='2'
IDP_URL='https://account-d.docusign.com'
IMPLICIT_CLIENT_ID='b2b52xxx-xxxx-xxxx-xxxx-123456789012'
IMPLICIT_RETURN_PATH='implicit-result'
IMPLICIT_SCOPES='signature'
IMPLICIT_REDIRECT_URL='https://Electron1.example.com/thankyou.html'
````

## .env Setting values

### SCHEME_NAME
Used as the *scheme name* (aka the *protocol*) in the url. 
  
Per [RFC 8252 sec. 7.1](https://tools.ietf.org/html/rfc8252#section-7.1), the redirect URL MUST use a scheme that includes a domain name
under your control, expressed in reverse order.
  
Example: You have control over the DNS name `Electron1.example.com` 
where Electron1 is the name of this app. So your private scheme 
should be `com.dshackathon.Electron1`

### SCHEME_SLASH_COUNT
Allowed values: `'1'` and `'2'`

RFC 8252 sec. 7.1 also recommends that a single
slash should be used in the redirect URL since there is no naming authority. But some IdP's don't support a single slash in a redirect URL.

If you're using an intermediate page, set this value
to `'1'` and use a single slash.

Example redirect URL with SCHEME_SLASH_COUNT='2':

`SCHEME_NAME://IMPLICIT_RETURN_PATH`

or (using example values from above)

`com.example.Electron1://implicit-result`

Example redirect URL with SCHEME_SLASH_COUNT='1':

`SCHEME_NAME:/IMPLICIT_RETURN_PATH`

or (using example values from above)

`com.example.Electron1:/implicit-result`

### IDP_URL
The scheme (usually `https:`) and hostname for the IDP. Do not include 
a trailing slash.

Example value: `'https://account-d.docusign.com'`

### IMPLICIT_CLIENT_ID
The OAuth client_id for the application. The client_id must be
configured to enable the Implicit grant flow.

Example value: `'b2b52xxx-xxxx-xxxx-xxxx-123456789012'`

### IMPLICIT_RETURN_PATH
The path used (with the SCHEME_NAME and SCHEME_SLASH_COUNT settings)
to create the url for the Electron application.

Example value: `'implicit-result'`
### IMPLICIT_SCOPES
The scope or scopes that will be sent to the IdP. 
URL encode the value. Eg, for two scopes, include the 
usual space separator as `%20`: `'signature%20manage'`

See your IdP's documentation for its scope separator. 
Some IdP's use commas.

### IMPLICIT_REDIRECT_URL
This setting is optional. If it is ommitted, then the application
will ask the IdP to redirect to the Electron app's URL.
(Calculated from the SCHEME_NAME, SCHEME_SLASH_COUNT,
and IMPLICIT_RETURN_PATH settings.)

If this setting is provided, it is the URL of the 
intermediate thankyou.html webpage (or similar). 
See the example webpage in `src/public_web_page/thankyou.html`

The URL for the intermediate webpage does not need to be
related to the URL for the Electron application itself. 
For example, the URL could be a page in any S3 bucket.
https is preferred but is not required.

## Files updated and added

* A .env file is now required (see below).
* src/App.global.css -- add additional CSS rules for Toast messages and new 
  home page content.
* src/App.tsx -- Updated to a class component. Many new methods added to
  support Implicit grant. The `state` object includes the OAuth information:
  accessToken, user's name, etc.
* src/main.dev.ts -- Updated to register the private URL scheme with the 
  operating system and handle incoming URLs from the OS. Some of this
  code is based on the GitHub Desktop code (MIT License). 
  See the [`main.ts` file](https://github.com/desktop/desktop/blob/development/app/src/main-process/main.ts).
* src/OAuthImplicit.ts -- Renderer functions to support OAuth. This file is 
  used by App.tsx.
* src/parse-app-url.ts -- Main process functions to support OAuth. This file is
  used by main.dev.ts. It is also based on the GitHub Desktop main.ts file.
* src/public_web_page/thankyou.html -- an example of an intermediate
  webpage that opens the Electron application's URL (using
  a private scheme) and asks the user to close the browser tab.
