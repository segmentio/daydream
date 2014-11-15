
/**
 * Change tab url
 *
 * @param {String} url
 */

exports.changeUrl = function (url) {
  chrome.tabs.update({ url: url });
};

/**
 * Ask user to copy text to clipboard.
 *
 * @param {String} text
 */

exports.copyToClipboard = function (text) {
  window.prompt("Copy to clipboard: Ctrl+C, Enter", text);
};

/**
 * Get the current tab.
 *
 * @param {Function} fn
 */

exports.getCurrentTab = function (fn) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    fn(tabs[0]);
  });
};

/**
 * Inject a content script.
 *
 * @param {String} name
 * @param {Number} id
 */

exports.inject = function (name, id) {
  if (id) return chrome.tabs.executeScript(id, {file: name});
  chrome.tabs.executeScript(this.getCurrentTab(function (tab) {
    return tab.id;
  }), {file: name});
};

/**
 * On address bar changed, execute a callback
 *
 * @param {Function} fn
 */

exports.onAddressBarChanged = function (fn) {
  chrome.omnibox.onInputEntered.addListener(function (text) {
    fn(text);
  });
};

/**
 * Execute a callback when the icon is clicked.
 *
 * @param {Function} fn
 */

exports.onIconClicked = function (fn) {
  chrome.browserAction.onClicked.addListener(function () {
    fn();
  });
};

/**
 * When a message is received, execute a callback.
 *
 * @param {Function} fn
 */

exports.onMessage = function (fn) {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var message = request;
    fn(message);
  });
};

/**
 * When the tab is updated and the status is complete, execute a callback
 * with the tabId.
 *
 * @param {Function} fn
 */

exports.onTabUpdated = function (fn) {
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') fn(tabId);
  });
};

/**
 * Set the icon.
 *
 * @param {String} path
 */

exports.setIcon = function (path) {
  chrome.browserAction.setIcon({path: path});
};
