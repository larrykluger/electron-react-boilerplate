/**
 * Parse the URL that was delivered to this app to determine the
 * action that should be taken by the app.
 *
 * Based on file GitHub Desktop src file main.ts
 * See https://github.com/desktop/desktop/blob/development/app/src/main-process/main.ts
 */

import log from 'electron-log'; // https://www.npmjs.com/package/electron-log
import URL from 'url';

export interface IOAuthAction {
  readonly name: string;
  readonly accessToken: string;
  readonly state: string;
  readonly expiresIn: number;
}

export interface IUnknownAction {
  readonly name: 'unknown';
  readonly url: string;
}

export type URLActionType = IOAuthAction | IUnknownAction;

export function parseAppURL(url: string): URLActionType {
  const parsedURL = URL.parse(url);
  let actionName: string | null = null;

  // For future versions of Node, the WHATG version of URL is
  // recommended. But it's not ready for v12.20. Sigh.
  //
  // We also have the issue that a single slash should be used
  // for the URL (as recommended by RFC 8252 sec 7.1)
  // See https://tools.ietf.org/html/rfc8252#section-7.1)
  //
  // But a parsed single slash URL does not use the hostname, only the pathname,
  // whereas a parsed double slash uses the hostname attribute.
  const { pathname, hostname } = parsedURL;
  const unknown: IUnknownAction = { name: 'unknown', url };
  if (!pathname && !hostname) {
    return unknown; // EARLY RETURN
  }

  // determine actionName
  // This version: only expecting the IMPLICIT_RETURN_PATH action.
  // Need to check the hostname and pathname due to single/double
  // slash issues.
  // N.B. Once we start using WHATG URL, only need to check the pathname
  //
  // InfoSec: these checks are not so secure since additional strings
  // could be added before or after the target string.
  // But checking the state value (done by the listener) provides the
  // necessary security against CSRF and other attacks
  if (
    pathname &&
    process.env.IMPLICIT_RETURN_PATH &&
    pathname.toLowerCase().includes(process.env.IMPLICIT_RETURN_PATH)
  ) {
    actionName = process.env.IMPLICIT_RETURN_PATH;
  } else if (
    hostname &&
    process.env.IMPLICIT_RETURN_PATH &&
    hostname.toLowerCase().includes(process.env.IMPLICIT_RETURN_PATH)
  ) {
    actionName = process.env.IMPLICIT_RETURN_PATH;
  }

  if (!actionName) {
    return unknown; // EARLY RETURN
  }

  // Looking good. Compute the remaining IOAuthAction attributes
  let accessToken: string;
  let expiresIn: number;
  let state: string;

  // Start of actionName === process.env.IMPLICIT_RETURN_PATH section
  const { hash } = parsedURL;
  const accessTokenFound = hash && hash.substring(0, 14) === '#access_token=';
  if (!accessTokenFound) {
    return unknown; // EARLY RETURN
  }
  // Avoiding an injection attack: check that the hash only includes expected characters
  // An example: #access_token=eyJ0eXAiOiJNVCIsIxxxxxxxxxxx...LqF6A&expires_in=28800&token_type=bearer&state=e3f287fbe932b904a660282242bfc58bd6a67fe2
  // No characters other than #.-&=_ a-z A-Z 0-9 (no spaces)
  const hashRegex = /[^#.\-&=_a-zA-Z0-9]/;
  if (hash && hash.search(hashRegex) !== -1) {
    log.error(`Potential XSS attack via fragment (#) value: ${hash}`);
    return unknown;
  }

  const regex = /(#access_token=)(.*)(&expires_in=)(.*)(&token_type=)(.*)(&state=)(.*)/;
  const results = hash && regex.exec(hash);
  if (results === null) {
    return unknown; // EARLY RETURN
  }

  /* eslint-disable prefer-destructuring, prefer-const */
  accessToken = results[2];
  state = results[8];
  expiresIn = parseInt(results[4], 10);
  /* eslint-enable prefer-destructuring, prefer-const */
  // End of actionName === process.env.IMPLICIT_RETURN_PATH section

  return { name: actionName, accessToken, state, expiresIn };
}
