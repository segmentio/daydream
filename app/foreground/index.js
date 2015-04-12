
/**
* Module dependencies.
*/

var cssPath = require('stevenmiller888/cssPath');
var each = require('component/each');
var fmt  = require('yields/fmt');

/**
 * Events and elements.
 */

detect(['a', 'button'], 'click');
detect(['input'], 'keydown');
detect([], 'copy');

/**
 * Detect.
 *
 * @param {Array} tagArr
 * @param {String} listener
 */

function detect(tagArr, listener){
  if (!tagArr.length) return copyText();

  each(tagArr, function(tag){
    var els = document.getElementsByTagName(tag);
    each(els, function(el){
      el.addEventListener(listener, function(event){
        if (listener === 'click') handle('click', event.target);
        if (listener === 'keydown' && event.keyCode === 9) handle('type', event.target);
      });
    });
  });
};

/**
* Copy text.
*/

function copyText(){
  window.onkeydown = function(event){
    if (event.keyCode === 67 && event.ctrlKey) {
      var selObj = window.getSelection();
      handle('evaluate', selObj.focusNode);
    }
  };
};

/**
 * Handle.
 *
 * @param {String} event
 * @param {Node} node
 */

function handle(event, node){
  var path = cssPath(node);
  var message = [event, path];
  if (node.value) message.push(node.value);
  chrome.runtime.sendMessage(message);
};
