'use strict';

//var backgroundPageConnection = chrome.runtime.connect({
//  name: 'devtools-page'
//});
//
//backgroundPageConnection.postMessage({
//  name: 'devtools page ready',
//  tabId: chrome.devtools.inspectedWindow.tabId
//});

chrome.devtools.panels.create(
  'Amoeba',
  null,
  'devtools-panel.html',
  null
);
