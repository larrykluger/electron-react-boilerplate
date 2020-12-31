/**
 * This file's functions are used for OAuthImplicit grant and
 * related authentication operations.
 */
/* eslint-disable react/destructuring-assignment */
import log from 'electron-log';
import { IpcRendererEvent } from 'electron/renderer';
import { toast } from 'react-toastify';
import { URLActionType, IOAuthAction } from './parse-app-url';
// eslint-disable-next-line import/no-cycle
import App from './App';

const expirationBuffer = 10 * 60; // 10 minute buffer
const sdkString = 'electron1';

class OAuthImplicit {
  //
  // Static methods
  //
  /**
   * Generate a psuedo random string
   * See https://stackoverflow.com/a/27747377/64904
   * @param {integer} len  length of the returned string
   */
  static generateId(len = 40): string {
    // dec2hex :: Integer -> String
    // i.e. 0-255 -> '00'-'ff'
    const arr = new Uint8Array((len || 40) / 2);

    function dec2hex(dec: number) {
      return `0${dec.toString(16)}`.substr(-2);
    }

    window.crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
  }

  /**
   * A relatively common OAuth API endpoint for obtaining information
   * on the user associated with the accessToken
   * @param accessToken string
   */
  static async fetchUserInfo(accessToken: string) {
    return fetch(`${process.env.IDP_URL}/oauth/userinfo`, {
      headers: new Headers({
        Authorization: `Bearer ${accessToken}`,
        Accept: `application/json`,
        'X-DocuSign-SDK': sdkString,
      }),
    });
  }

  //
  // Instance properties
  //
  app: App;

  loginWindow: Window | null = null;

  oauthState: string | null = null;

  //
  // constructor for the class
  //
  constructor(app: App) {
    this.app = app;
    this.urlActionListener = this.urlActionListener.bind(this);
  }

  //
  // Instance methods
  //

  /**
   * Listener for url-action messages
   */
  async urlActionListener(_event: IpcRendererEvent, action: URLActionType) {
    if (action.name !== process.env.IMPLICIT_RETURN_PATH) {
      return; // IGNORE this message
    }
    this.closeWindow();
    const oauthAction = action as IOAuthAction; // assertion
    if (this.oauthState !== oauthAction.state) {
      log.error('OAuth Implicit grant state mismatch!');
      toast.error(
        'The OAuth response failed the security check.\nPlease retry.',
        { autoClose: 10000 }
      );
      return;
    }
    const toastId = toast.success('Completing the login process...', {
      autoClose: 7000,
    });
    const { accessToken } = oauthAction;

    // calculate expires to be expirationBuffer sooner
    const expires = new Date();
    expires.setTime(
      expires.getTime() + (oauthAction.expiresIn - expirationBuffer) * 1000
    );

    // call /oauth/userinfo for general user info
    // This API method is common for many IdP systems.
    // But the exact format of the response tends to vary.
    // The following works for the DocuSign IdP.
    let userInfoResponse;
    try {
      userInfoResponse = await OAuthImplicit.fetchUserInfo(accessToken);
    } catch (e) {
      const msg = `Problem while completing login.\nPlease retry.\nError: ${e.toString()}`;
      log.error(msg);
      toast.error(msg, { autoClose: 10000 });
      return;
    }
    if (!userInfoResponse || !userInfoResponse.ok) {
      const msg = `Problem while completing login.\nPlease retry.\nError: ${userInfoResponse.statusText}`;
      log.error(msg);
      toast.error(msg, { autoClose: 10000 });
      return;
    }
    const userInfo = await userInfoResponse.json();
    type Account = {
      account_id: string;
      account_name: string;
      base_uri: string;
      is_default: boolean;
    };
    const defaultAccount: Account = userInfo.accounts.filter(
      (acc: Account) => acc.is_default
    )[0];
    const externalAccountId: string = defaultAccount.account_id.slice(-10);

    toast.dismiss(toastId);
    this.app.oAuthResults({
      accessToken,
      expires,
      name: userInfo.name,
      email: userInfo.email,
      accountId: defaultAccount.account_id,
      externalAccountId,
      accountName: defaultAccount.account_name,
      baseUri: defaultAccount.base_uri,
    });
  }

  /**
   * Start the login flow by computing the Implicit grant URL
   * and opening a regular browser window with that URL for the
   * user.
   * Per RFC 8252 Sec 4, a regular browser should be used.
   * No type of embedded browser should be used.
   * See https://tools.ietf.org/html/rfc8252#section-4
   */
  startLogin() {
    const oauthState = OAuthImplicit.generateId();
    this.oauthState = oauthState;
    // One slash (no authority) is recommended by RFC
    // But some IdP's don't support it.
    const slashes = process.env.SCHEME_SLASH_COUNT === '1' ? '/' : '//';
    // Our app's redirect url:
    const directRedirectUrl = `${process.env.SCHEME_NAME}:${slashes}${process.env.IMPLICIT_RETURN_PATH}`;
    // Possibly use an intermediate redirect page:
    const redirectUrl = `redirect_uri=${
      process.env.IMPLICIT_REDIRECT_URL && process.env.IMPLICIT_REDIRECT_URL.length > 2
        ? process.env.IMPLICIT_REDIRECT_URL
        : directRedirectUrl}`;
    const url =
      `${process.env.IDP_URL}/oauth/auth?` +
      `response_type=token&` +
      `scope=${process.env.IMPLICIT_SCOPES}&` +
      `client_id=${process.env.IMPLICIT_CLIENT_ID}&` +
      `state=${oauthState}&${redirectUrl}`;

    this.loginWindow = window.open(url, 'oauth_authentication', '');
    if (this.loginWindow) {
      this.loginWindow.focus();
    }
  }

  /**
   * (Attempt) to close the browser window used for the OAuth authentication
   * Works with Chrome and most browsers since we opened the window.
   */
  closeWindow() {
    if (this.loginWindow) {
      this.loginWindow.close();
      this.loginWindow = null;
    }
  }
}

export default OAuthImplicit;
