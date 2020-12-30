/* eslint-disable class-methods-use-this */
import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
} from 'react-router-dom';
import { ipcRenderer } from 'electron';
import { ToastContainer, toast } from 'react-toastify';
import icon from '../assets/icon.svg';
import OAuthImplicit from './OAuthImplicit';

// state attributes for authentication results and state
type AppState = {
  accessToken: string | null;
  expires: Date | null;
  name: string | null;
  email: string | null;
  accountId: string | null;
  externalAccountId: string | null;
  accountName: string | null;
  baseUri: string | null;
  showHomePage: boolean;
};

interface OAuthResults {
  accessToken: string | null;
  expires: Date | null;
  name: string | null;
  email: string | null;
  accountId: string | null;
  externalAccountId: string | null;
  accountName: string | null;
  baseUri: string | null;
};

class App extends React.Component<unknown, AppState> {
  oAuthImplicit: OAuthImplicit;

  // constructor for the class
  constructor(props: unknown) {
    super(props);
    this.state = {
      accessToken: null,
      expires: null,
      name: null,
      email: null,
      accountId: null,
      externalAccountId: null,
      accountName: null,
      baseUri: null,
      showHomePage: true,
    };
    this.oAuthImplicit = new OAuthImplicit(this);
    this.logout = this.logout.bind(this);
    this.HomePage = this.HomePage.bind(this);
    this.startAuthentication = this.startAuthentication.bind(this);
    this.cancelAuthentication = this.cancelAuthentication.bind(this);
  }

  componentDidMount() {
    // subscribe to the url-action channel
    // eslint-disable-next-line
    ipcRenderer.on('url-action', this.oAuthImplicit.urlActionListener);
  }

  startAuthentication() {
    this.clearAuth();
    this.setState({showHomePage: false});
    this.oAuthImplicit.startLogin();
  }

  cancelAuthentication() {
    this.setState({showHomePage: true});
    this.clearAuth();
    this.oAuthImplicit.closeWindow();
  }

  /**
   * This method clears this app's authentication information.
   * But there may still be an active login session cookie
   * from the IdP. Your IdP may have an API method for clearing
   * the login session.
   */
  logout() {
    this.clearAuth();
    toast.success('You have logged out.');
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

  /**
   * Process the oauth results.
   * This method is called by the OAuthImplicit class
   * @param results
   */
  oAuthResults(results: OAuthResults) {
    this.setState({accessToken: results.accessToken,
      expires: results.expires,
      name: results.name,
      email: results.email,
      accountId: results.accountId,
      externalAccountId: results.externalAccountId,
      accountName: results.accountName,
      baseUri: results.baseUri,
      showHomePage: true});

    toast.success(`Welcome ${results.name}, you are now logged in`);
    toast.warning(`Is the browser tab still open? Then please close it.`);
  }

  HomePage() {
    return (
      <>
        <ToastContainer />
        {this.state.showHomePage ? this.Hello() : this.Login()}
      </>
    )
  }

  UserInformationBlock() {
    if (this.state.accessToken) {
      return (
        <div className="accountInfo">
          <p>{this.state.name}<span style={{marginLeft: '2em'}} className="a" onClick={this.logout}>logout</span></p>
          <p>{this.state.accountName} ({this.state.externalAccountId})</p>
        </div>
      )
    } else {
      return null;
    }
  }

  Hello() {
    return (
      <div>
        {this.UserInformationBlock()}
        <div className="Hello">
          <img width="200px" alt="icon" src={icon} />
        </div>
        <h1>electron-react-boilerplate with OAuth Implicit Grant</h1>
        <div className="Hello">
          <a
            href="https://electron-react-boilerplate.js.org/"
            target="_blank"
            rel="noreferrer"
          >
            <button type="button">
              <span role="img" aria-label="books">
                📚
              </span>
              Read our docs
            </button>
          </a>
          <a
            href="https://github.com/sponsors/electron-react-boilerplate"
            target="_blank"
            rel="noreferrer"
          >
            <button type="button">
              <span role="img" aria-label="books">
                🙏
              </span>
              Donate
            </button>
          </a>
          {this.state.accessToken ? null :
            <button type="button" onClick={this.startAuthentication}>
              <span role="img" aria-label="login">
              🔆
              </span>
              Login
            </button>
          }
        </div>
      </div>
    );
  }

  Login() {
    return (
      <>
        <ToastContainer />
        <h2>Please login via your browser</h2>
        <p>
          <span className="smallA" onClick={this.cancelAuthentication}>cancel login</span>
        </p>
      </>
    );
  }

  render() {
    // Remember to add other page routes BEFORE the route for /
    return (
      <Router>
        <Switch>
          <Route path="/" component={this.HomePage} />
        </Switch>
      </Router>
    );
  }
}

export default App;
