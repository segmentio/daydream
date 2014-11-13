/**
 * Dependencies.
 */

var each = require('component/each');

/**
 * Initialize a new ActionRecorder.
 */

var actionRecorder = ActionRecorder();

/**
 * ActionRecorder.
 */

function ActionRecorder () {
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

function addClickListeners (link) {
  link.addEventListener('click', function(event) {
    pickAttribute(event.target, 'click');
  });
}

/**
 * Add keydown listeners to input elements.
 *
 * @param {Node} input
 */

function addTypingListeners (input) {
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

function pickAttribute (node, event, val) {
  var attribute1 = node.getAttribute('id');
  var attribute2 = node.getAttribute('class');
  var message = [event];
  attribute1 ? message.push(attribute1) : message.push(attribute2);
  if(val) message.push(val);
  sendMessage(message);
}

/**
 * Send a message to the background script.
 *
 * @param {String} message
 */

function sendMessage (message) {
  chrome.runtime.sendMessage(message);
}
