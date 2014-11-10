
/**
 * Start the content script.
 */

(function start () {
  recordClicking(), recordTyping();
})();

/**
 * Record clicking.
 */

function recordClicking () {
  var links = document.getElementsByTagName('a');
  each(links, function(link) {
    addClickListeners(link);
  });
}

/**
 * Record typing.
 */

function recordTyping () {
  //
}

/**
 * Helper function to add click listeners
 * to a link
 *
 * @param {node} link
 */

function addClickListeners (link) {
  link.addEventListener('click', function(event) {
    var node = stringifyElement(event);
    pickAttribute(node);
  });
}

/**
 * Helper function to choose the best attribute (i.e. the
 * attribute that best identifies this node, and is most
 * likely to exist on the next refresh)
 *
 * @param {node} node
 */

function pickAttribute (node) {
  var attribute1 = node.getAttribute('id');
  var attribute2 = node.getAttribute('class');
  if (attribute1) return sendMessage(['click', attribute1]);
  if (attribute2) return sendMessage(['click', attribute2]);
}

/**
 * Helper function to send a message to the
 * background script.
 *
 * @param {String} message
 */

function sendMessage (message) {
  chrome.runtime.sendMessage(message);
}

/**
 * Helper function to turn the element node
 * into a string.
 *
 * @param {Event} event
 */

function stringifyElement(event) {
  var tmp = document.createElement("div");
  tmp.appendChild(event.target);
  var node = tmp.children[0];
  return node;
}

/**
 * Helper function to iterate through an array.
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
