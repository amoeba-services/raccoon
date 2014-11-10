'use strict';

var backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-panel'
});

backgroundPageConnection.onMessage.addListener(function(message){
  console.log(message);
});

backgroundPageConnection.postMessage({
  name: 'raccoon panel ready',
  tabId: chrome.devtools.inspectedWindow.tabId
});

chrome.devtools.network.onRequestFinished.addListener(function(request){
  //if (request.request.url.indexOf('http://amoeba-api.herokuapp.com') === 0) {
  console.log(request);
  //}
});


/*jshint ignore:start */
var data = [
  {author: 'Pete Hunt', text: 'This is one comment.'},
  {author: 'Jordan Walke', text: 'This is *another* comment'}
];
var Comment = React.createClass({
  render: function() {
    return (
      <div className="comment">
        <h2 className="commentAuthor">
          {this.props.author}
        </h2>
        {this.props.children}
      </div>
    );
  }
});

var CommentForm = React.createClass({
  render: function() {
    return (
      <div className="commentForm">
      Hello, world! I am a CommentForm.
      </div>
    );
  }
});
var CommentList = React.createClass({
  render: function() {
    var commentNodes = this.props.data.map(function (comment) {
      return (
        <Comment author={comment.author}>
          {comment.text}
        </Comment>
      );
    });
    return (
      <div className="commentList">
        {commentNodes}
      </div>
    );
  }
});
var CommentBox = React.createClass({
  render: function() {
    return (
      <div className="commentBox">
        <h1>Comments</h1>
        <CommentList data={this.props.data} />
      <CommentForm />
      </div>
    );
  }
});

React.render(
<CommentBox data={data} />,
  document.getElementById('content')
);
/*jshint ignore:end */