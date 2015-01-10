'use strict';

var CONFIG = require('./config'),
  _ = require('lodash'),
  jsonFormat = require('json-format'),
  React = require('react/addons'),
  Utils = require('./utils');

CodeMirror.modeURL = 'vendor/codemirror/codemirror/mode/%N/%N.js'; // 好恶心

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


function updateCM(content) {
  var contentType = this.props.req.response.contentType;
  var modeInfo = CodeMirror.findModeByMIME(contentType) || {},
    mode = modeInfo.mode;
  if (content === null) {
    content = '';
  }
  if (modeInfo.name === 'JSON') {
    try {
      content = jsonFormat(JSON.parse(content));
    }
    catch (e) {
      console.log('Invalid JSON:', content);
    }
  }

  this._cm.setOption('mode', mode);
  CodeMirror.autoLoadMode(this._cm, mode);
  this._cm.setValue(content);
}
var CM = React.createClass({
  render: function() {
    return <div className="source-code"></div>
  },
  componentDidMount: function() {
    this._cm = CodeMirror(this.getDOMNode(), {
      tabSize: 2,
      readOnly: true,
      lineNumbers: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
    });
    this.props.req.getContent( _.bind(updateCM ,this));
  },
  shouldComponentUpdate: function(nextProps) {
    nextProps.req.getContent(_.bind(updateCM, this));
    return false;
  }
});
var InfoItem = React.createClass({
  getInitialState: function() {
    return {
      ellipse: true
    };
  },
  render: function() {
    return (
      <div className="info secondary" data-ellipse={this.state.ellipse} onClick={this.toggleEllipse}>
        <span className="name">{this.props.data.name}: </span>
        {this.props.data.value}
      </div>
    );
  },
  toggleEllipse: function() {
    this.setState({
      ellipse: !this.state.ellipse
    });
  }
});
var amoebaHeaderFilter = function(header) {
  return !(/^X-Amoeba/.test(header.name));
};
var itemRenderer = function(item) {
  return <InfoItem data={item} />;
};
var RequestDetails = React.createClass({
  getInitialState: function() {
    return {
      fullScreenCode: false
    };
  },
  render: function() {
    var req = this.props.request;
    if (req) {
      req = req.request;
      var reqParamsList = req.request.queryString.map(function(item) {
          item.value = decodeURIComponent(item.value);
          return item;
        }).map(itemRenderer),
        reqParams = reqParamsList.length ? (
          <div className="info"><span className="name">Params: </span>{reqParamsList}</div>
        ) : undefined,
        reqHeadersList = _(req.request.headers).filter(amoebaHeaderFilter).sortBy('name').value().map(itemRenderer),
        reqHeaders = reqHeadersList.length ? (
          <div className="info"><span className="name">Headers: </span>{reqHeadersList}</div>
        ) : undefined,
        resHeadersList = _(req.response.headers).filter(amoebaHeaderFilter).sortBy('name').value().map(itemRenderer),
        resHeaders = resHeadersList.length ? (
          <div className="info"><span className="name">Headers: </span>{resHeadersList}</div>
        ) : undefined,
        fullScreenBtn = this.state.fullScreenCode ? (
          <span className="octicon octicon-chevron-right"></span>
        ) : (
          <span className="octicon octicon-chevron-left"></span>
        );
      var reqInfoDom = this.getDOMNode().getElementsByClassName('request-info');
      if (reqInfoDom.length) {
        reqInfoDom[0].scrollTop = 0;
      }

      return (
        <div className="request-details" data-full-screen-mode={this.state.fullScreenCode}>
          <span className="octicon octicon-x close-btn" onClick={this.handleClose} title="Clear"></span>
          <div className="request-info">
            <h2>Request</h2>
            <p className="info"><span className="name">URL: </span>{req.request.url}</p>
            <p className="info"><span className="name">Method: </span>{req.request.method}</p>
            {reqParams}
            {reqHeaders}
            <h2>Response</h2>
            <p className="info"><span className="name">Status: </span>{req.response.status} {req.response.statusText}</p>
            {resHeaders}
            <p className="info"><span className="name">Body: </span><span className="octicon octicon-arrow-right"></span></p>
          </div>
          <div className="fullscreen-btn" title="Toggle Full Screen" onClick={this.toggleFullScreen}>
            {fullScreenBtn}
          </div>
          <CM req={req}/>
        </div>
      );
    }
    else {
      return <div></div>;
    }
  },
  toggleFullScreen: function() {
    this.setState({
      fullScreenCode: !this.state.fullScreenCode
    });
  },
  handleClose: function() {
    if (typeof this.props.onClose === 'function') {
      this.props.onClose();
    }
  },
  shouldComponentUpdate: function(nextProps, nextState) {
    if (!(
      nextProps.request
      && this.props.request
      && nextProps.request.key === this.props.request.key
    )) {
      return true;
    }
    return !_.isEqual(nextState, this.state);
  }
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
    //console.log('RequestInfo rendered');
    var info = this.props.request.request,
      uri = Utils.parseUri(info.request.url);
    info.amoeba = info.amoeba || {};
    var statusText = info.response.status + ' ' + info.response.statusText,
      amoebaStatusText = ' ' + (info.amoeba.status ? (info.amoeba.status + ' ' + info.amoeba.message) : '-'),
      path = info.amoeba.matchedApi || uri.path,
      namespace = statusBar && statusBar.state.selectedNamespace,
      amoebaManagementPortal = CONFIG.portal + '/#/apis/' + namespace + '/' + encodeURIComponent(encodeURIComponent(path));
    return (
      <tr className="request-info-item" data-active={this.props.request.active}>
        <td className="method" title={info.request.method}>{info.request.method}</td>
        <td className="path" onClick={this.active} title={uri.path}>{uri.path}</td>
        <td className="status">
          {statusText}
        </td>
        <td className="content-type" title={info.response.contentType}>
          {info.response.contentType}
        </td>
        <td className="amoeba" title={amoebaStatusText}>
          <AmoebaStatusIcon status={info.amoeba.status}/>
          {amoebaStatusText}
          <a className="amoeba-portal" href={amoebaManagementPortal} title="Edit" target="_blank">
            <span className="icon-btn octicon octicon-pencil"></span>
          </a>
        </td>
      </tr>
    );
  },
  active: function() {
    if (typeof this.props.onActive === 'function') {
      this.props.onActive(this.props.index);
    }
  },
  shouldComponentUpdate: function(nextProps) {
    return !(
      nextProps.request._version === this.props.request._version
      && nextProps.request.active === this.props.request.active
    );
  }
});

var RequestList = React.createClass({
  render: function() {
    var requests = this.props.data.map(function (request, index) {
      return (
        <RequestInfo request={request} key={request.key} index={index} onActive={this.itemActiveHandler}>
        </RequestInfo>
      );
    }, this);
    return (
      <tbody>
        {requests}
      </tbody>
    );
  },
  itemActiveHandler: function(index) {
    if (typeof this.props.onItemActive === 'function') {
      this.props.onItemActive(index);
    }
  }
});

var RequestTable = React.createClass({
  getInitialState: function() {
    return {
      requests: [],
      selectedRequest: undefined
    };
  },
  render: function() {
    return (
      <div className="request-table-container">
        <table className="request-table">
          <thead>
            <tr>
              <td className="method" title="Method">Method</td>
              <td className="path" title="Path">Path</td>
              <td className="status" title="Status">Status</td>
              <td className="content-type" title="Type">Type</td>
              <td className="amoeba" title="Amoeba Service">Amoeba Service</td>
            </tr>
          </thead>
          <RequestList data={this.state.requests} onItemActive={this.setDetails}/>
        </table>
        <table className="filler">
          <tbody>
            <tr>
              <td className="method"></td>
              <td className="path"></td>
              <td className="status"></td>
              <td className="content-type"></td>
              <td className="amoeba"></td>
            </tr>
          </tbody>
        </table>
        <RequestDetails request={this.state.selectedRequest} onClose={this.clearDetails}/>
      </div>
    );
  },
  setDetails: function(index) {
    var selectedRequest;
    var requests = this.state.requests;
    var previousActiveRequestIndex = _(requests).findIndex('active');
    var query = {};
    if (previousActiveRequestIndex !== -1) {
      query[previousActiveRequestIndex] = {
        $merge: {
          active: false
        }
      };
    }
    var request = requests[index];
    if (requests[index] !== undefined) {
      query[index] = {
        $merge: {
          active: true
        }
      };
      selectedRequest = request;
    }
    requests = React.addons.update(requests, query);
    this.setState({
      selectedRequest: selectedRequest,
      requests: requests
    });
  },
  clearDetails: function() {
    this.setDetails(-1);
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
        <div className="operation-group">
          <label className="operation">
            <input type="checkbox" checked={this.state.enabled} onChange={this.toggleEnable}/>Enable
          </label>
          <label className="operation">
            <select title="namespace" className="" value={this.state.selectedNamespace} id="namespace" onChange={this.handleNamespaceChange}>
              <optgroup label="Namespace">
              {options}
              </optgroup>
            </select>
          </label>
          </div>
        <div className="operation-group">
          <label className="operation operation-clear" onClick={this.clearRequests} title="Clear">
            <span className="icon octicon octicon-circle-slash"></span>
          </label>
        </div>
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
    // setState 是异步的，clearDetails需要 copy state，所以必须回调f
    reqTable.setState({
      requests: []
    }, reqTable.clearDetails);
  }
});

var NAMESPACES = [
  'playground',
  'pc',
  'mis'
];
var statusBar = React.render(
  <StatusBar namespaces={NAMESPACES}/>,
  document.getElementById('status-bar')
);
statusBar.changeNamespace(localStorage.getItem('selectedNamespace') || NAMESPACES[0]);

chrome.devtools.network.onRequestFinished.addListener(function(request){
  var requests = reqTable.state.requests;

  var isXHR = (_.findIndex(request.request.headers, { 'name': 'X-Amoeba' }) !== -1),
    isRedirectedByExt = (
      request.response.statusText === 'Internal Redirect' &&
      request.response.redirectURL.slice(0, 5) !== 'data:'
    );
  if (isXHR || isRedirectedByExt) {
    var url = request.request.url;
    var contentTypeHeader = _.find(request.response.headers, { 'name': 'Content-Type' });
    var contentType = '';
    if (contentTypeHeader) {
      contentType = contentTypeHeader.value.split(';')[0];
    }
    request.response.contentType = contentType;
    var originalReqIndex = _.findIndex(requests, function(req) {
      return req.request.response.redirectURL === url;
    });
    if (originalReqIndex === -1) {
      requests = requests.concat([{
        request: request,
        key: request.time // React Array key
      }]);
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

      var query = {};
      var originalRequest = requests[originalReqIndex].request;
      if (isAmoebaRequest) {
        _.extend(request, {
          amoeba: amoeba,
          request: originalRequest.request
        });
      }
      else {
        _.extend(request, {
          amoeba: originalRequest.amoeba,
          request: originalRequest.request
        });
      }
      query[originalReqIndex] = {
        $merge: {
          request: request,
          key: requests[originalReqIndex].key
        },
        // 原 request 被修改，增加标志位通知 React 重新渲染
        // 否则会需要深度比较，有性能问题
        _version: {
          $apply: function(_version) {
            return (_version || 0) + 1;
          }
        }
      };
      requests = React.addons.update(requests, query);
    }
    reqTable.setState({
      requests: requests
    });
  }
});

chrome.devtools.network.onNavigated.addListener(function(){
  console.log('page reloaded');
  reqTable.setState({
    requests: []
  }, reqTable.clearDetails);
});
