
/**
 * Start the content script.
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
  var links = document.getElementsByTagName('a');
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
 * Add keyup listeners to form elements.
 *
 * @param {Node} form
 */

function addTypingListeners (input) {
  input.addEventListener('blur', function(event) {
    pickAttribute(event.target, 'type', event.target.value);
  });
}

/**
 * Choose the best attribute (i.e. the attribute that best
 * identifies this node, and is most likely to exist on the
 * next refresh)
 *
 * @param {Node} node
 * @param {String} event
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

/**
 * Iterate over an array.
 *
 * @param {Object} obj
 * @param {Function} fn
 * @param {Context} ctx
 */

function each(obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj[i], i);
  }
}
