'use strict';

//chrome.runtime.onInstalled.addListener(function (details) {
//  console.log('previousVersion', details.previousVersion);
//});
//
var CONFIG = require('./config');

var panelConnections = {};
var requestsCookies = {};

function beforeRequestHandler(details) {
  var originalUrl = details.url;
  if (/_AMB(CC|D|R)=/.test(originalUrl)) {
    // 如果出现 _AMBD= _AMBR= _AMBCC= 则不再跳转
    // Amoeba Data/Redirect/CookieCache
    return;
  }

  var namespace = panelConnections[details.tabId].namespace;
  if (!namespace) {
    console.error('namspace is not set for tab ' + details.tabId);
    return;
  }
  var redirectUrl = CONFIG.api + '/data/' + namespace + '/';
  if (originalUrl.indexOf('?') === -1) {
    originalUrl += '?';
  }
  else {
    originalUrl += '&';
  }
  chrome.tabs.executeScript(details.tabId, {
    code: 'var xhr = new XMLHttpRequest();xhr.open(\'HEAD\', \''+originalUrl+'_AMBCC='+details.requestId+'\');xhr.withCredentials = true;xhr.send();'
  });
  originalUrl += '_AMBR=' + details.requestId;
  redirectUrl += encodeURIComponent(originalUrl);
  redirectUrl += '?_AMBD=' + details.requestId;
  return {
    redirectUrl: redirectUrl
  };
}

// panel.js 中通过 chrome.devtools.network.onRequestFinished 中拿到的 request 信息不包含 request type
// 故这里给所有请求加上标记
function beforeSendHeadersHandler(details) {
  var headers = details.requestHeaders;
  var originalRequestId;

  // 如果出现 _AMBCC= 则将其 cookie 缓存下来，并丢弃该请求
  var isAmoebaCookieCacheRequest = details.url.match(/_AMBCC=([^&]*)/);
  if (isAmoebaCookieCacheRequest !== null) {
    originalRequestId = isAmoebaCookieCacheRequest[1];
    if (originalRequestId !== undefined && originalRequestId !== '') {
      for (var i = headers.length - 1; i >= 0; i--) {
        if (headers[i].name === 'Cookie') {
          requestsCookies[originalRequestId] = headers[i].value;
          break;
        }
      }
    }
    console.log(requestsCookies);
    return {
      cancel: true
    };
  }

  // 为二次跳转请求增加 Cookie
  var isAmoebaRedirectRequest = details.url.match(/_AMBR=([^&]*)/);
  if (isAmoebaRedirectRequest !== null) {
    originalRequestId = isAmoebaRedirectRequest[1];
    headers.push({
      name: 'Cookie',
      value: requestsCookies[originalRequestId]
    });
  }

  headers.push({
    name: 'X-Amoeba',
    value: '1'
  });
  return {
    requestHeaders: headers
  };
}
function amoebaReqBeforeSendHeadersHandler(details) {
  var headers = details.requestHeaders;
  headers.push({
    name: 'X-Redirect-On-Error',
    value: '1'
  });
  return {
    requestHeaders: headers
  };
}

function headersReceivedHandler(details) {
  var headers = details.responseHeaders, originIndex;
  for (var i=0, len=headers.length; i < len; i++) {
    if (headers[i].name === 'Access-Control-Allow-Origin') {
      originIndex = i;
      break;
    }
  }
  if (originIndex === undefined) {
    headers.push({
      name: 'Access-Control-Allow-Origin',
      value: '*'
    });
  }
  else {
    headers[originIndex].value = '*';
  }
  return {
    responseHeaders: headers
  };
}

function onCompletedHandler(details) {
  var isAmoebaRequest = details.url.match(/_AMB(?:R|D)=([^&]*)/);
  if (isAmoebaRequest !== null) {
    var originalRequestId = isAmoebaRequest[1];
    delete requestsCookies[originalRequestId];
  }
}

function generateEventsHandlers() {
  return {
    beforeRequestHandler: function(details) {
      return beforeRequestHandler(details);
    },
    beforeSendHeadersHandler: function(details) {
      return beforeSendHeadersHandler(details);
    },
    amoebaReqBeforeSendHeadersHandler: function(details) {
      return amoebaReqBeforeSendHeadersHandler(details);
    },
    headersReceivedHandler: function(details) {
      return headersReceivedHandler(details);
    },
    onCompletedHandler: function(details) {
      return onCompletedHandler(details);
    }
  };
}

chrome.runtime.onConnect.addListener(function (port) {

  console.log('connection established:', port);

  //if (port.name === 'devtools-page') {
  //
  //  var pageMessageListener = function (message) {
  //
  //    console.log(message);
  //
  //    // devtools page 被激活
  //    // The original connection event doesn't include the tab ID of the
  //    // DevTools page, so we need to send it explicitly.
  //    if (message.name === 'devtools page ready' && typeof message.tabId === 'number') {
  //    }
  //
  //  };
  //
  //  // Listen to messages sent from the DevTools page
  //  port.onMessage.addListener(pageMessageListener);
  //
  //
  //
  //  return;
  //}

  // devtools panel 被激活
  if (port.name === 'devtools-panel') {

    var panelMessageListener = function(message){

      console.log(message);

      if (typeof message.tabId !== 'number') {
        return;
      }

      var connection;

      if (message.name === 'devtools panel ready') {
        connection = {
          port: port,
          handlers: generateEventsHandlers()
        };
        panelConnections[message.tabId] = connection;

        // 给所有 xhr 请求加上标记
        chrome.webRequest.onBeforeSendHeaders.addListener(connection.handlers.beforeSendHeadersHandler, {
          'urls': ['<all_urls>'],
          'tabId': message.tabId,
          'types': ['xmlhttprequest']
        }, ['blocking', 'requestHeaders']);
        // 请求结束清理 Cookie 缓存
        chrome.webRequest.onCompleted.addListener(connection.handlers.onCompletedHandler, {
          'urls': ['<all_urls>'],
          'tabId': message.tabId,
          'types': ['xmlhttprequest']
        });

        return;
      }

      connection = panelConnections[message.tabId];

      if (message.name === 'set proxy') {
        if (!message.data) {
          chrome.webRequest.onBeforeRequest.removeListener(connection.handlers.beforeRequestHandler);
          chrome.webRequest.onBeforeSendHeaders.removeListener(connection.handlers.amoebaReqBeforeSendHeadersHandler);
          chrome.webRequest.onHeadersReceived.removeListener(connection.handlers.headersReceivedHandler);
        }
        else {
          chrome.webRequest.onBeforeRequest.addListener(connection.handlers.beforeRequestHandler, {
            'urls': ['<all_urls>'],
            'tabId': message.tabId,
            'types': ['xmlhttprequest']
          }, ['blocking']);

          // 添加 header，让 data api 出错时直接跳转到原地址
          chrome.webRequest.onBeforeSendHeaders.addListener(connection.handlers.amoebaReqBeforeSendHeadersHandler, {
            'urls': [CONFIG.api + '/data/*'],
            'tabId': message.tabId,
            'types': ['xmlhttprequest', 'other']
          }, ['blocking', 'requestHeaders']);

          // add CROS headers
          chrome.webRequest.onHeadersReceived.addListener(connection.handlers.headersReceivedHandler, {
            'urls': ['<all_urls>'],
            'tabId': message.tabId,
            'types': ['xmlhttprequest', 'other']
          }, ['blocking', 'responseHeaders']);
        }
        return;
      }

      if (message.name === 'set namespace' && typeof message.data === 'string') {
        panelConnections[message.tabId].namespace = message.data;
      }

    };

    port.onMessage.addListener(panelMessageListener);

    port.onDisconnect.addListener(function (port) {
      port.onMessage.removeListener(panelMessageListener);

      var tabs = Object.keys(panelConnections);
      for (var i = 0, len = tabs.length; i < len; i++) {
        var connection = panelConnections[tabs[i]];
        if (connection.port === port) {
          chrome.webRequest.onBeforeRequest.removeListener(connection.handlers.beforeRequestHandler);
          chrome.webRequest.onBeforeSendHeaders.removeListener(connection.handlers.beforeSendHeadersHandler);
          chrome.webRequest.onBeforeSendHeaders.removeListener(connection.handlers.amoebaReqBeforeSendHeadersHandler);
          chrome.webRequest.onHeadersReceived.removeListener(connection.handlers.headersReceivedHandler);
          chrome.webRequest.onBeforeSendHeaders.removeListener(connection.handlers.onCompletedHandler);
          delete panelConnections[tabs[i]];
          break;
        }
      }
    });

    return;
  }

});

//// Receive message from content script and relay to the devTools page for the
//// current tab
//chrome.runtime.onMessage.addListener(function(request, sender) {
//  // Messages from content scripts should have sender.tab set
//  if (sender.tab) {
//    var tabId = sender.tab.id;
//    if (tabId in pageConnections) {
//      pageConnections[tabId].postMessage(request);
//    } else {
//      console.log('Tab not found in connection list.');
//    }
//  } else {
//    console.log('sender.tab not defined.');
//  }
//  return true;
//});
