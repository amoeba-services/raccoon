/*jshint quotmark:false */
/*jshint white:false */
/*jshint trailing:false */
/*jshint newcap:false */
/*global Utils */

'use strict';

var _ = require('lodash'),
  React = require('React');

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

var requests = [];

var RequestDetails = React.createClass({
  getInitialState: function() {
    return {
      request: undefined
    };
  },
  render: function() {
    if (this.state.request) {
      return (
        <div className="request-details">
        {this.state.request.time}
        </div>
      );
    }
    else {
      return (<div></div>);
    }
  }
});

var reqDetails = React.render(
  <RequestDetails />,
  document.getElementById('request-details')
);

reqDetails.setState({
  request: {}
});

var AmoebaStatusIcon = React.createClass({
  render: function(){
    return (
      <span className="amoeba-status-icon octicon octicon-primitive-dot" data-status={this.props.status}></span>
    );
  }
});

var RequestInfo = React.createClass({
  render: function() {
    var info = this.props.data,
      uri = Utils.parseUri(info.request.url);
    info.amoeba = info.amoeba || {};
    return (
      <tr className="request-info-item">
        <td>{info.request.method}</td>
        <td onClick={this.showDetails}>{uri.path}</td>
        <td>
          {info.response.status + ' ' + info.response.statusText}</td>
        <td>
          <AmoebaStatusIcon status={info.amoeba.status}/>
          {info.amoeba.status ? (info.amoeba.status + ' ' + info.amoeba.message) : '-'}
        </td>
      </tr>
    );
  },
  showDetails: function() {
    reqDetails.setState({
      request: this.props.data
    });
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
      <tbody>
        {requests}
      </tbody>
    );
  }
});

var RequestTable = React.createClass({
  getInitialState: function() {
    return {
      requests: [],
      requestDetails: undefined
    };
  },
  render: function() {
    return (
      <table>
        <thead>
          <tr>
            <td>Method</td>
            <td>Path</td>
            <td>Response</td>
            <td>Amoeba Service</td>
          </tr>
        </thead>
        <RequestList data={this.state.requests}/>
      </table>
    );
  }
});

var reqTable = React.render(
  <RequestTable />,
  document.getElementById('requests-table')
);

var StatusBar = React.createClass({
  getInitialState: function() {
    return {
      enabled: false,
      selectedNamespace: undefined
    };
  },
  render: function() {
    var options = this.props.namespaces.map(function(namespace) {
      return (
        <option value={namespace}>{namespace}</option>
      );
    });
    return (
      <div className="status-bar">
        <label>
          <input type="checkbox" checked={this.state.enabled} onChange={this.toggleEnable}/> Enable
        </label>
        <span className="octicon octicon-circle-slash" onClick={this.clearRequests}></span>
        <label htmlFor="namespace">Namespace:</label>
        <select value={this.state.selectedNamespace} id="namespace" onChange={this.handleNamespaceChange}>
        {options}
        </select>
      </div>
    );
  },
  toggleEnable: function() {
    backgroundPageConnection.postMessage({
      name: 'set proxy',
      tabId: chrome.devtools.inspectedWindow.tabId,
      data: !this.state.enabled
    });
    // setState is ansyc
    this.setState({
      enabled: !this.state.enabled
    });
  },
  handleNamespaceChange: function(event) {
    var namespace = event.target.value;
    this.changeNamespace(namespace);
  },
  changeNamespace: function(namespace) {
    backgroundPageConnection.postMessage({
      name: 'set namespace',
      tabId: chrome.devtools.inspectedWindow.tabId,
      data: namespace
    });
    this.setState({
      selectedNamespace: namespace
    });
    localStorage.setItem('selectedNamespace', namespace);
  },
  clearRequests: function() {
    requests = [];
    reqTable.setState({
      requests: requests
    });
  }
});

var NAMESPACES = [
  'playground',
  'pc',
  'mis'
];
React.render(
  <StatusBar namespaces={NAMESPACES}/>,
  document.getElementById('status-bar')
).changeNamespace(localStorage.getItem('selectedNamespace') || NAMESPACES[0]);

chrome.devtools.network.onRequestFinished.addListener(function(request){
  var isXHR = (_.findIndex(request.request.headers, { 'name': 'X-Amoeba' }) !== -1),
    isRedirectedByExt = (
      request.response.statusText === "Internal Redirect" &&
      request.response.redirectURL.slice(0, 5) !== 'data:'
    );
  if (isXHR || isRedirectedByExt) {
    //console.log(request);
    var url = request.request.url;
    var originalReqIndex = _.findIndex(requests, function(req) {
      return req.response.redirectURL === url;
    });
    if (originalReqIndex === -1) {
      requests.push(request);
    }
    else {
      var amoeba = {}, isAmoebaRequest = false;
      _.forEach(request.response.headers, function(header) {
        switch (header.name) {
          case 'X-Amoeba-Status':
            amoeba.status = header.value;
            // Amoeba api 请求的 header 中一定有 X-Amoeba-Status
            isAmoebaRequest = true;
            break;
          case 'X-Amoeba-Message':
            amoeba.message = header.value;
            break;
          case 'X-Amoeba-Namespace':
            amoeba.namespace = header.value;
            break;
          case 'X-Amoeba-Matched-Api':
            amoeba.matchedApi = header.value;
            break;
        }
      });
      if (isAmoebaRequest) {
        _.extend(requests[originalReqIndex], {
          amoeba: amoeba
        });
        if (amoeba.status === '2000') {
          requests[originalReqIndex].response = request.response;
        }
        requests[originalReqIndex].response.redirectURL = request.response.redirectURL;
      }
      else {
        requests[originalReqIndex].response = request.response;
      }
    }
    reqTable.setState({
      requests: requests
    });
  }
});

chrome.devtools.network.onNavigated.addListener(function(){
  console.log('page reloaded');
  requests = [];
  reqTable.setState({
    requests: requests
  });
});