/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global React, Utils, _ */

'use strict';

/* jshint ignore:start */
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-55081859-3', 'auto');
ga('set', 'checkProtocolTask', function(){}); // Removes failing protocol check. @see: http://stackoverflow.com/a/22152353/1958200
ga('send', 'pageview', '/devtools-panel.html');
/* jshint ignore:end */

var backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-panel'
});

backgroundPageConnection.onMessage.addListener(function(message){
  console.log(message);
});

backgroundPageConnection.postMessage({
  name: 'devtools panel ready',
  tabId: chrome.devtools.inspectedWindow.tabId
});


var RequestInfo = React.createClass({
  render: function() {
    var info = this.props.data,
      uri = Utils.parseUri(info.request.url);
    return (
      <tr className="request-info-item">
        <td>{uri.path}</td>
        <td>{info.response.status + ' ' + info.response.statusText}</td>
      </tr>
    );
  }
});

var RequestList = React.createClass({
  render: function() {
    var requests = this.props.data.map(function (request) {
      return (
        <RequestInfo data={request} key={request.time}>
        </RequestInfo>
      );
    });
    return (
      <tr>
        {requests}
      </tr>
    );
  }
});

var RequestTable = React.createClass({
  getInitialState: function() {
    return {requests: [
    ]};
  },
  render: function() {
    return (
      <table>
        <thead>
          <tr>
            <td>Path</td>
            <td>Status</td>
          </tr>
        </thead>
        <tbody>
          <RequestList data={this.state.requests}/>
        </tbody>
      </table>
    );
  }
});

var reqTable = React.render(
  <RequestTable />,
  document.getElementById('request-table')
);

var requests = [];

chrome.devtools.network.onRequestFinished.addListener(function(request){
  var isXHR = (_.findIndex(request.request.headers, {
    'name': 'X-Amoeba'
  }) !== -1),
    isRedirectedByExt = (
      request.response.statusText === "Internal Redirect" &&
      request.response.redirectURL.slice(0, 5) !== 'data:'
    );
  if (isXHR || isRedirectedByExt) {
    console.log(request);
    requests.push(request);
    reqTable.setState({
      requests: requests
    });
  }
});

chrome.devtools.network.onNavigated.addListener(function(){
  requests = [];
  reqTable.setState({
    requests: requests
  });
});