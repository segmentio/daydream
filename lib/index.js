
/**
 * Start the content script.
 */

(function start () {
  recordClicking();
  recordTyping();
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
  var forms = document.getElementsByTagName('form');
  each(forms, function(form) {
    addTypeListeners(form);
  });
}

/**
 * Helper function to add click listeners
 * to a link
 *
 * @param {node} link
 */

function addClickListeners (link) {
  link.addEventListener('click', function(event) {
    pickAttribute(event.target, 'click');
  });
}

/**
 * Helper function to add keyup listeners to form elements
 *
 * @param {node} form
 */

function addTypeListeners (form) {
  form.addEventListener('submit', function(event) {
    pickAttribute(event.target, 'type');
  });
}

/**
 * Helper function to choose the best attribute (i.e. the
 * attribute that best identifies this node, and is most
 * likely to exist on the next refresh)
 *
 * @param {node} node
 * @param {string} event
 */

function pickAttribute (node, event) {
  var attribute1 = node.getAttribute('id');
  var attribute2 = node.getAttribute('class');
  var message = [event];
  attribute1 ? message.push(attribute1) : message.push(attribute2);
  sendMessage(message);
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
