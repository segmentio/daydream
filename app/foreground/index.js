/**
 * Module dependencies.
 */

var fmt = require('yields/fmt');
var each = require('component/each');

/**
 * Initialize a new ActionRecorder.
 */

var actionRecorder = ActionRecorder();

/**
 * ActionRecorder.
 */

function ActionRecorder() {
  if (!(this instanceof ActionRecorder)) return new ActionRecorder();
  recordClicking();
  recordTyping();
}

/**
 * Record clicking.
 */

function recordClicking() {
  var links = [];
  var anchors = document.getElementsByTagName('a');
  var buttons = document.getElementsByTagName('button');
  each(anchors, function(anchor) {
    links.push(anchor);
  });
  each(buttons, function(button) {
    links.push(button);
  });
  each(links, function(link) {
    addClickListeners(link);
  });
}

/**
 * Record typing.
 */

function recordTyping() {
  var inputs = document.getElementsByTagName('input');
  each(inputs, function(input) {
    addTypingListeners(input);
  });
}

/**
 * Add click listeners to a link.
 *
 * @param {Node} link
 */

function addClickListeners(link) {
  link.addEventListener('click', function(event) {
    pickAttribute(event.target, 'click');
  });
}

/**
 * Add keydown listeners to input elements.
 *
 * @param {Node} input
 */

function addTypingListeners(input) {
  input.addEventListener('keydown', function(event) {
    if (event.keyCode === 9) pickAttribute(event.target, 'type', event.target.value);
  });
}

/**
 * Choose the best attribute (i.e. the attribute that best
 * identifies this node, and is most likely to exist on the
 * next refresh)
 *
 * @param {Node} node
 * @param {String} event
 * @param {String} val
 */

function pickAttribute(node, event, val) {
  var path = cssPath(node);
  var message = [event, path];
  if (val) message.push(val);
  sendMessage(message);
}

/**
* Get full CSS path of any element
*
* Returns a jQuery-style CSS path, with IDs, classes and ':nth-child' pseudo-selectors.
*
* Can either build a full CSS path, from 'html' all the way to ':nth-child()', or a
* more optimised short path, stopping at the first parent with a specific ID,
* eg. "#content .top p" instead of "html body #main #content .top p:nth-child(3)"
*/

function cssPath(el) {
  var fullPath = 0, // Set to 1 to build ultra-specific full CSS-path, or 0 for optimised selector
    useNthChild = 0, // Set to 1 to use ":nth-child()" pseudo-selectors to match the given element
    cssPathStr = '',
    testPath = '',
    parents = [],
    parentSelectors = [],
    tagName,
    cssId,
    cssClass,
    tagSelector,
    vagueMatch,
    nth,
    i,
    c;

  // Go up the list of parent nodes and build unique identifier for each:
  while (el) {
    vagueMatch = 0;

    // Get the node's HTML tag name in lowercase:
    tagName = el.nodeName.toLowerCase();

    // Get node's ID attribute, adding a '#':
    cssId = (el.id) ? ('#' + el.id) : false;

    // Get node's CSS classes, replacing spaces with '.':
    cssClass = (el.className) ? ('.' + el.className.replace(/\s+/g, ".")) : '';

    // Build a unique identifier for this parent node:
    if (cssId) {
      // Matched by ID:
      tagSelector = tagName + cssId + cssClass;
    } else if (cssClass) {
      // Matched by class (will be checked for multiples afterwards):
      tagSelector = tagName + cssClass;
    } else {
      // Couldn't match by ID or class, so use ":nth-child()" instead:
      vagueMatch = 1;
      tagSelector = tagName;
    }

    // Add this full tag selector to the parentSelectors array:
    parentSelectors.unshift(tagSelector)

    // If doing short/optimised CSS paths and this element has an ID, stop here:
    if (cssId && !fullPath)
      break;

    // Go up to the next parent node:
    el = el.parentNode !== document ? el.parentNode : false;

  } // endwhile

  // Build the CSS path string from the parent tag selectors:
  for (i = 0; i < parentSelectors.length; i++) {
    cssPathStr += ' ' + parentSelectors[i]; // + ' ' + cssPathStr;

    // If using ":nth-child()" selectors and this selector has no ID / isn't the html or body tag:
    if (useNthChild && !parentSelectors[i].match(/#/) && !parentSelectors[i].match(/^(html|body)$/)) {

      // If there's no CSS class, or if the semi-complete CSS selector path matches multiple elements:
      if (!parentSelectors[i].match(/\./) || $(cssPathStr).length > 1) {

        // Count element's previous siblings for ":nth-child" pseudo-selector:
        for (nth = 1, c = el; c.previousElementSibling; c = c.previousElementSibling, nth++);

        // Append ":nth-child()" to CSS path:
        cssPathStr += ":nth-child(" + nth + ")";
      }
    }

  }

  // Return trimmed full CSS path:
  return cssPathStr.replace(/^[ \t]+|[ \t]+$/, '');
}

/**
 * Send a message to the background script.
 *
 * @param {String} message
 */

function sendMessage(message) {
  chrome.runtime.sendMessage(message);
}
