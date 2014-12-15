
/**
* Module dependencies.
*/

var fmt     = require('yields/fmt');
var each    = require('component/each');
var cssPath = require('stevenmiller888/cssPath');

/**
 * Expose `Detective`.
 */

module.exports = Detective;

/**
 * Detective.
 */

function Detective () {
  if (!(this instanceof Detective)) return new Detective();
  return this;
}

/**
 * Boot.
 */

Detective.prototype.boot = function () {
  this.detect(['a', 'button'], 'click');
  this.detect(['input'], 'keydown');
  this.detect([], 'copy');
};

/**
 * Detect.
 *
 * @param {Array} tagArr
 * @param {String} listener
 */

Detective.prototype.detect = function (tagArr, listener) {
  var self = this;
  if (!tagArr.length) return self.copyText();

  each(tagArr, function (tag) {
    var els = document.getElementsByTagName(tag);
    each(els, function (el) {
      el.addEventListener(listener, function (event) {
        if (listener === 'click') self.handle('click', event.target);
        if (listener === 'keydown' && event.keyCode === 9) self.handle('type', event.target);
      });
    });
  });
};

/**
* Copy text.
*/

Detective.prototype.copyText = function () {
  var self = this;
  window.onkeydown = function (event) {
    if (event.keyCode === 67 && event.ctrlKey) {
      var selObj = window.getSelection();
      self.handle('evaluate', selObj.focusNode);
    }
  };
};

/**
 * Handle.
 *
 * @param {String} event
 * @param {Node} node
 */

Detective.prototype.handle = function (event, node) {
  var path = cssPath(node);
  var message = [event, path];
  if (node.value) message.push(node.value);
  chrome.runtime.sendMessage(message);
};
