/**
 * Module dependencies.
 */

var each = require('component/each');
var Highlight = require('segmentio/highlight');
var js = require('segmentio/highlight-javascript');

/**
 * Get the Nightmare script from localStorage and
 * add it to the popup.
 */

chrome.storage.sync.get('nightmareStr', function(data) {
  var highlight = Highlight().use(js);
  var nightmare = data.nightmareStr;
  var el = document.getElementsByTagName('pre')[0];
  el.innerText = nightmare;
  highlight.element(el);
});

/**
 * Restart the extension.
 */

var restart = document.getElementById('Restart');
restart.addEventListener('click', function(event) {
  chrome.runtime.reload();
  window.close();
});
