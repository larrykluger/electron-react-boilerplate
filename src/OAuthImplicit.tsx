import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';

// The state has several fields
type OAuthImplicitState = {
  oauthState: string | null;
  accessToken: string | null;
  expires: Date | null;
  name: string | null;
  email: string | null;
  accountId: string | null;
  externalAccountId: string | null;
  accountName: string | null;
  baseUri: string | null;
};

type OAuthImplicitProps = {
  // location is from the HOC withRouter via PropTypes.
  // there are no regular props for this component.
  location: Record<'pathname', string>;
};

// The component has no properties, but the current state is of type OAuthImplicitState
// The generic parameters in the Component typing allow to pass props
// and state.
class OAuthImplicit extends Component<OAuthImplicitProps, OAuthImplicitState> {
  // Static properties, methods
  // eslint-disable-next-line react/static-property-placement
  static propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    location: PropTypes.object.isRequired,
  };

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

  // Instance properties, methods, etc
  loginWindow: Window | null = null;

  constructor(props: unknown) {
    super(props);
    this.state = {
      oauthState: null,
      accessToken: null,
      expires: null,
      name: null,
      email: null,
      accountId: null,
      externalAccountId: null,
      accountName: null,
      baseUri: null
    };
  }

  componentDidMount() {
    if (this.authenticatePath()) {
      this.startLogin();
    }
  }

  /**
   * Are we being asked to authenticate?
   * (Or we're processing the implicit grant result.)
   */
  authenticatePath(): boolean {
    const { location } = this.props;
    return location.pathname === '/authenticate';
  }

  clearAuth() {
    this.setState({
      accessToken: null,
      expires: null,
      accountId: null,
      externalAccountId: null,
      accountName: null,
      baseUri: null,
      name: null,
      email: null,
    });
  }

  logout() {
    this.clearAuth();
  }


  /*

  // The tick function sets the current state. TypeScript will let us know
  // which ones we are allowed to set.
  tick() {
    this.setState({
      time: new Date()
    });
  }


 */



  startLogin() {
    this.clearAuth();
    const oauthState = OAuthImplicit.generateId();
    this.setState({ oauthState });
    const url =
      `${process.env.IDP_URL}/oauth/auth?` +
      `response_type=token&` +
      `scope=${process.env.IMPLICIT_SCOPES}&` +
      `client_id=${process.env.IMPLICIT_CLIENT_ID}&` +
      `state=${oauthState}&` +
      `redirect_uri=${process.env.SCHEME_NAME}://${process.env.IMPLICIT_RETURN_PATH}`;

    this.loginWindow = window.open(url, 'oauth_authentication', '');
    if (this.loginWindow) {
      this.loginWindow.focus();
    }
  }

  render() {
    const { location } = this.props;

    return (
      <>
        <h2>Please login via your browser</h2>
        <p>Location: {location.pathname}</p>
      </>
    );
  }
}

export default withRouter(OAuthImplicit);
