
/**
 * Module dependencies.
 */

var Emitter   = require('component/emitter');
var js        = require('segmentio/highlight-javascript');
var highlight = require('segmentio/highlight')().use(js);
var store     = require('yields/store');

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

  var el = document.getElementsByTagName('pre')[0];
  el.innerText = store('nightmare');
  highlight.element(el);

  var restart = document.getElementById('Restart');
  restart.addEventListener('click', function(event) {
    self.emit('restart');
  });
};
