
/**
 * Module dependencies.
 */

var each  = require('component/each');
var empty = require('component/empty');

/**
 * Expose `Recorder`.
 */

module.exports = Recorder;

/**
 * Recorder.
 */

function Recorder () {
  if (!(this instanceof Recorder)) return new Recorder();
  this.recording = [];
  return this;
}

/**
 * Record a message.
 *
 * @param {String} message
 */

Recorder.prototype.record = function (message) {
  var lastElement = this.recording[this.recording.length - 1];
  if (!lastElement) return this.recording.push(message);
  if (lastElement[1] === message[1]) return;
  this.recording.push(message);
};

/**
 * Start recording.
 */

Recorder.prototype.startRecording = function () {
  var self = this;
  self.detect();
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var message = request;
    self.record(message);
  });
};

/**
 * Detect.
 */

Recorder.prototype.detect = function () {
  this.detectScreenshots();
  this.detectUrl();
  this.detectEvents();
};

/**
 * Record events on the page.
 */

Recorder.prototype.detectEvents = function () {
  chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
    inject('foreground.js', tabs[0].id);
  });
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
      chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
        if (tabId === tabs[0].id) inject('foreground.js', tabs[0].id);
      });
    }
  });
};

/**
 * Detect the Url.
 *
 */

Recorder.prototype.detectUrl = function () {
  var self = this;
  chrome.webNavigation.onCommitted.addListener(function (details) {
    var type = details.transitionType;
    var from = details.transitionQualifiers;
    switch (type) {
      case 'reload':
        if (!self.recording.length) return self.record(["goto", details.url]);
        self.record(['reload']);
        break;
      case 'typed':
        if (!from.length) return self.record(["goto", details.url]);
        if (from[0] === "from_address_bar") return self.record(["goto", details.url]);
        if (from[0] === "server_redirect" && from[1] === "from_address_bar") return self.record(["goto", details.url]);
        break;
      case 'auto_bookmark':
        self.record(["goto", details.url]);
        break;
    }
  });
};

/**
 * Detect screenshots.
 */

Recorder.prototype.detectScreenshots = function () {
  var self = this;
  chrome.commands.onCommand.addListener(function (command) {
    if (command === "detect-screenshot") {
      self.record(['screenshot', 'index.png']);
    }
  });
};

/**
 * Stop recording.
 */

Recorder.prototype.stopRecording = function () {
  chrome.commands.onCommand.removeListener();
  chrome.webNavigation.onCommitted.removeListener();
  chrome.runtime.onMessage.removeListener();
  chrome.tabs.onUpdated.removeListener();
};

/**
 * Helper function to inject a content script.
 *
 * @param {String} name
 * @param {Number} id
 */

function inject (name, id) {
  chrome.tabs.executeScript(id, {file: name});
};
