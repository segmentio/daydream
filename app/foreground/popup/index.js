
/**
 * Module dependencies.
 */

var popup = require('./popup')();

/**
 * Boot.
 */

popup.boot();

/**
 * Restart.
 */

popup.on('restart', function () {
  chrome.browserAction.setBadgeText({text: ''});
  chrome.runtime.reload();
  window.close();
});
