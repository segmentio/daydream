
/**
 * Module dependencies.
 */

var js = require('segmentio/highlight-javascript');
var Highlight = require('segmentio/highlight');
var Emitter = require('component/emitter');

function showLib(lib) {
  chrome.storage.sync.get(lib, function(res){
    var el = document.querySelector('pre');
    var highlight = Highlight().use(js);
    el.innerText = res[lib];
    highlight.element(el);
  });
}

var restart = document.querySelector('.Restart-Button');
restart.addEventListener('click', function(event) {
  chrome.browserAction.setBadgeText({text: ''});
  chrome.runtime.reload();
  window.close();
});

var libNightmare = document.querySelector('.Lib-Nightmare');
libNightmare.addEventListener('click', function(event) {
  showLib('nightmare');
});

showLib('nightmare');
