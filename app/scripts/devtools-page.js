'use strict';

var backgroundPageConnection = chrome.runtime.connect({
  name: 'panel'
});

backgroundPageConnection.postMessage({
  name: 'devtools page ready',
  tabId: chrome.devtools.inspectedWindow.tabId
});

chrome.devtools.panels.create(
  'Raccoon',
  null,
  'devtools-panel.html',
  function () {
    backgroundPageConnection.postMessage({
      name: 'raccoon panel ready'
    });
  }
);
