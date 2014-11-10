'use strict';

//chrome.runtime.onInstalled.addListener(function (details) {
//  console.log('previousVersion', details.previousVersion);
//});
//

function beforeRequestHandler(details) {
  return {
    redirectUrl: 'http://amoeba-api.herokuapp.com/data/pc/' + encodeURIComponent(details.url)
  };
}

function beforeSendHeadersHandler(details) {
  var headers = details.requestHeaders;
  details.requestHeaders.push({
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
    headersReceivedHandler: function(details) {
      return headersReceivedHandler(details);
    }
  };
}

var pageConnections = {},
  panelConnections = {};

chrome.runtime.onConnect.addListener(function (port) {

  console.log('connection established:', port);

  if (port.name === 'devtools-page') {

    var pageMessageListener = function (message) {

      console.log(message);

      // The original connection event doesn't include the tab ID of the
      // DevTools page, so we need to send it explicitly.
      if (message.name === 'devtools page ready' && typeof message.tabId === 'number') {
        var connection = {
          port: port,
          handlers: generateEventsHandlers()
        };
        pageConnections[message.tabId] = connection;

        chrome.webRequest.onBeforeRequest.addListener(connection.handlers.beforeRequestHandler, {
          'urls': ['<all_urls>'],
          'tabId': message.tabId,
          'types': ['xmlhttprequest']
        }, ['blocking']);

        chrome.webRequest.onBeforeSendHeaders.addListener(connection.handlers.beforeSendHeadersHandler, {
          'urls': ['*://amoeba-api.herokuapp.com/data/*'],
          'tabId': message.tabId,
          'types': ['other']
        }, ['blocking', 'requestHeaders']);

        chrome.webRequest.onHeadersReceived.addListener(connection.handlers.headersReceivedHandler, {
          'urls': ['<all_urls>'],
          'tabId': message.tabId,
          'types': ['other']
        }, ['blocking', 'responseHeaders']);

      }

    };

    // Listen to messages sent from the DevTools page
    port.onMessage.addListener(pageMessageListener);

    port.onDisconnect.addListener(function (port) {
      port.onMessage.removeListener(pageMessageListener);

      var tabs = Object.keys(pageConnections);
      for (var i = 0, len = tabs.length; i < len; i++) {
        var connection = pageConnections[tabs[i]];
        if (connection.port === port) {
          chrome.webRequest.onBeforeRequest.removeListener(connection.handlers.beforeRequestHandler);
          chrome.webRequest.onBeforeSendHeaders.removeListener(connection.handlers.beforeSendHeadersHandler);
          chrome.webRequest.onHeadersReceived.removeListener(connection.handlers.headersReceivedHandler);
          delete pageConnections[tabs[i]];
          break;
        }
      }
    });

    return;
  }

  if (port.name === 'devtools-panel') {

    var panelMessageListener = function(message){

      console.log(message);

      if (message.name === 'devtools panel ready' && typeof message.tabId === 'number') {
        var connection = {
          port: port
        };
        panelConnections[message.tabId] = connection;
      }
    };

    port.onMessage.addListener(panelMessageListener);

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
