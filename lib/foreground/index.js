
/**
* Module dependencies.
*/

var each = require('component/each');
var fmt  = require('yields/fmt');

/**
 * Events and elements.
 */

detect('click');
detect('keydown');
detect('copy');

/**
 * Detect.
 *
 * @param {String} listener
 */

function detect(listener){
  if (listener === 'copy') return copyText();

  var els = document.querySelectorAll('body');
  each(els, function(el){
    el.addEventListener(listener, function(event) {
      if (listener === 'click') handle('click', event.target);
      if (listener === 'keydown' && event.keyCode === 9) handle('type', event.target);
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
 * Get the index of the specified element in the same stratum and the same element name.
 *
 * @param {Element} element
 * @param {String} name
 * @return {Number} The 1..N index value.
 */
function getSiblingElementsIndex(element, name) {
  var index = 1;
  var sibling = element;
  while((sibling = sibling.previousElementSibling)) {
    if (sibling.nodeName.toLowerCase() === name) {
      index++;
    }
  }
  return index;
}

/**
 * Get the selector which represents the specified element.
 * If the argument value is not Element, this returns an empty array.
 *
 * @param {Node} node
 * @return {Array} The array which has each selector name.
 */
function cssPath(node) {
  var names = [];
  if (!(node instanceof Element)) {
    return names;
  }

  while(node.nodeType === Node.ELEMENT_NODE) {
    var name = node.nodeName.toLowerCase();
    if (node.id) {
      name += '#' + node.id;
      names.unshift(name);
      break;
    }
    var index = getSiblingElementsIndex(node, name);
    if (1 < index) {
      name += ':nth-of-type(' + index + ')';
    }
    names.unshift(name);
    node = node.parentNode;
  }

  return names;
};

/**
 * Handle.
 *
 * @param {String} event
 * @param {Node} node
 */

function handle(event, node) {
  if (chrome && chrome.runtime) {
    var path = cssPath(node).join(' > ');
    var message = [event, path];
    message.push(node.value);
    chrome.runtime.sendMessage(message);
  }
};
