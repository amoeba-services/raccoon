'use strict';

//chrome.runtime.onInstalled.addListener(function (details) {
//  console.log('previousVersion', details.previousVersion);
//});
//

var panelConnections = {};

function beforeRequestHandler(details) {
  var originalUrl = details.url;
  if (originalUrl.indexOf('_ATS=') !== -1) {
    // 如果出现 _ATS= 则不再跳转
    return;
  }
  var namespace = panelConnections[details.tabId].namespace;
  if (!namespace) {
    console.error('namspace is not set for tab ' + details.tabId);
    return;
  }
  var redirectUrl = 'http://amoeba-api.herokuapp.com/data/' + namespace + '/';
  var amoebaTimeStamp = Math.random().toFixed(6);
  if (originalUrl.indexOf('?') === -1) {
    originalUrl += '?';
  }
  originalUrl += '&_ATS=' + amoebaTimeStamp;
  redirectUrl += encodeURIComponent(originalUrl);
  redirectUrl += '?_ATS=' + amoebaTimeStamp;
  return {
    redirectUrl: redirectUrl
  };
}

// panel.js 中通过 chrome.devtools.network.onRequestFinished 中拿到的 request 信息不包含 request type
// 故这里给所有请求加上标记
function beforeSendHeadersHandler(details) {
  var headers = details.requestHeaders;
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
        chrome.webRequest.onBeforeSendHeaders.addListener(connection.handlers.beforeSendHeadersHandler, {
          'urls': ['*://*/*_ATS=*'],
          'tabId': message.tabId,
          'types': ['other']
        }, ['blocking', 'requestHeaders']);

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
            'urls': ['*://amoeba-api.herokuapp.com/data/*'],
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
