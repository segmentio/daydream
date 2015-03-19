
/**
 * Module dependencies.
 */

var js = require('segmentio/highlight-javascript');
var Highlight = require('segmentio/highlight');
var Emitter = require('component/emitter');

/**
 * Expose `Popup`.
 */

module.exports = Popup;

/**
 * Popup.
 */

function Popup () {
  if (!(this instanceof Popup)) return new Popup();
  return this;
}

/**
 * Mixin.
 */

Emitter(Popup.prototype);

/**
 * Boot.
 */

Popup.prototype.boot = function () {
  var self = this;
  var highlight = Highlight().use(js);

  var el = document.getElementsByTagName('pre')[0];
  chrome.storage.sync.get('nightmare', function(res){
    el.innerText = res.nightmare;
    highlight.element(el);
  });

  var restart = document.getElementById('Restart');
  restart.addEventListener('click', function(event) {
    self.emit('restart');
  });
};
