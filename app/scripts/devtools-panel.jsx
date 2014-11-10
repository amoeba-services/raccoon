/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global React, Utils, _ */

'use strict';

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