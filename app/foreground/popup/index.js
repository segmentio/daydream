
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
  chrome.runtime.reload();
  window.close();
});
