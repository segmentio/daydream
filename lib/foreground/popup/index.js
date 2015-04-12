
/**
 * Module dependencies.
 */

var js = require('segmentio/highlight-javascript');
var Highlight = require('segmentio/highlight');
var Emitter = require('component/emitter');

var el = document.querySelector('pre');
chrome.storage.sync.get('nightmare', function(res){
  var highlight = Highlight().use(js);
  el.innerText = res.nightmare;
  highlight.element(el);
});

var restart = document.querySelector('.Restart-Button');
restart.addEventListener('click', function(event) {
  chrome.browserAction.setBadgeText({text: ''});
  chrome.runtime.reload();
  window.close();
});
