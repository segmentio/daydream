
/**
 * Expose `Helper`
 */

module.exports = Helper;

/**
 * Helper.
 */

function Helper () {
  if (!(this instanceof Helper)) return new Helper();
  return this;
}

/**
 * When a message is received, execute a callback.
 *
 * @param {Function} fn
 */

Helper.prototype.onMessage = function (fn) {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var message = request;
    fn(message);
  });
};

/**
 * Get the current tab.
 *
 * @param {Function} fn
 */

Helper.prototype.getCurrentTab = function (fn) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    fn(tabs[0]);
  });
};

/**
 * Ask user to copy text to clipboard.
 *
 * @param {String} text
 */

Helper.prototype.copyToClipboard = function (text) {
  window.prompt("Copy to clipboard: Ctrl+C, Enter", text);
};

/**
 * Inject a content script.
 *
 * @param {String} name
 * @param {Number} id
 */

Helper.prototype.inject = function (name, id) {
  if (id) return chrome.tabs.executeScript(id, {file: name});
  chrome.tabs.executeScript(this.getCurrentTab(function (tab) {
    return tab.id;
  }), {file: name});
};

/**
 * Execute a callback when the icon is clicked.
 *
 * @param {Function} fn
 */

Helper.prototype.onIconClicked = function (fn) {
  chrome.browserAction.onClicked.addListener(function () {
    fn();
  });
};

/**
 * When the tab is updated and the status is complete, execute a callback
 * with the tabId.
 *
 * @param {Function} fn
 */

Helper.prototype.onTabUpdated = function (fn) {
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') fn(tabId);
  });
};

/**
 * Set the icon.
 *
 * @param {String} path
 */

Helper.prototype.setIcon = function (path) {
  chrome.browserAction.setIcon({path: path});
};

/**
 * On address bar changed, execute a callback
 *
 * @param {Function} fn
 */

Helper.prototype.onAddressBarChanged = function (fn) {
  chrome.omnibox.onInputEntered.addListener(function (text) {
    fn(text);
  });
};

/**
 * Change tab url
 *
 * @param {String} url
 */

Helper.prototype.changeUrl = function (url) {
  chrome.tabs.update({ url: url });
};
