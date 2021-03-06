import React, { PureComponent } from 'react';
import { WebView } from 'react-native-webview';
import adService from './ADService';
import { RequestType } from './Constants';

export default class LoginView extends PureComponent {
  constructor(props) {
    super();
    this._setUri = this._setUri.bind(this);
    this.onNavigationStateChangeAsync = this.onNavigationStateChangeAsync.bind(
      this,
    );
    this.onShouldStartLoadWithRequest = this.onShouldStartLoadWithRequest.bind(
      this,
    );
    this._handleFlowResultAsync = this._handleFlowResultAsync.bind(this);

    this.webView = null;
    adService.init(props);
    this.state = {
      uri: adService.getLoginURI(),
      loaded: false,
    };
  }

  async componentDidMount() {
    const isAuthentic = await adService.isAuthenticAsync();
    if (isAuthentic) {
      this.props.onSuccess();
    } else {
      this.setState({ loaded: true });
    }
  }

  async onNavigationStateChangeAsync(navState) {
    const { url } = navState;
    const { uri: stateUri } = this.state;
    const result = adService.getLoginFlowResult(url);

    if (url.toLowerCase() !== stateUri.toLowerCase()) {
      await this._handleFlowResultAsync(result, stateUri);
    }
  }

  onShouldStartLoadWithRequest(navState) {
    sleep(500); //Without this, logins fail on iOS
    const result = adService.getLoginFlowResult(navState.url);
    if (
      result.requestType === RequestType.Ignore ||
      result.requestType === RequestType.Code ||
      result.requestType === RequestType.PasswordReset ||
      result.requestType === RequestType.Cancelled
    ) {
      this.webView.stopLoading();
      return false;
    }

    return true;
  }

  _setUri(uri) {
    this.setState({ uri });
  }

  _isNewRequest = (currentUri, uri) =>
    currentUri.toLowerCase() !== uri.toLowerCase();

  async _handleFlowResultAsync(result, currentUri) {
    if (result.requestType === RequestType.PasswordReset) {
      const uri = adService.getPasswordResetURI();
      if (this._isNewRequest(currentUri, uri)) {
        this._setUri(uri);
      }
    }

    if (result.requestType === RequestType.Cancelled) {
      const uri = adService.getLoginURI();
      if (this._isNewRequest(currentUri, uri)) {
        this._setUri(uri);
      } else {
        this._setUri(`${uri}&reloadedAt=${Date.now()}`);
      }
    }

    if (result.requestType === RequestType.Code) {
      const policy = currentUri.indexOf(adService.passwordResetPolicy) > -1 ?
        adService.passwordResetPolicy : adService.loginPolicy;
      const reqResult = await adService.fetchAndSetTokenAsync(result.data, policy);
      if (reqResult.isValid) {
        this.props.onSuccess();
      } else {
        this.props.onFail(reqResult.data);
      }
    }
  }

  render() {
    const { uri, loaded } = this.state;
    const { renderLoading, ...rest } = this.props;
    
    return (
      <WebView
        {...rest}
        originWhitelist={['*']} // refer: https://github.com/facebook/react-native/issues/20917
        source={{ uri }}
        onNavigationStateChange={this.onNavigationStateChangeAsync}
        onShouldStartLoadWithRequest={this.onShouldStartLoadWithRequest}
        onLoadStart={renderLoading(true)}
        onLoad={renderLoading(false)}
        ref={c => {
          this.webView = c;
        }}
      />
    );
  }
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}
