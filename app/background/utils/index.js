
/**
 * When the URL has changed, execute a callback.
 *
 * @param {Function} cb
 */

exports.onUrlChanged = function (cb) {
  chrome.webNavigation.onCommitted.addListener(function (details) {
    cb(details);
  });
};

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
 * @param {Function} cb
 */

exports.getCurrentTab = function (cb) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    cb(tabs[0]);
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
 * @param {Function} cb
 */

exports.onAddressBarChanged = function (cb) {
  chrome.omnibox.onInputEntered.addListener(function (text) {
    cb(text);
  });
};

/**
 * Execute a callback when the icon is clicked.
 *
 * @param {Function} cb
 */

exports.onIconClicked = function (cb) {
  chrome.browserAction.onClicked.addListener(function () {
    cb();
  });
};

/**
 * When a message is received, execute a callback.
 *
 * @param {Function} cb
 */

exports.onMessage = function (cb) {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var message = request;
    cb(message);
  });
};

/**
 * When the tab is updated and the status is complete, execute a callback
 * with the tabId.
 *
 * @param {Function} cb
 */

exports.onTabUpdated = function (cb) {
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') cb(tabId);
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
