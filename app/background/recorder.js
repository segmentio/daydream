/**
 * Module dependencies.
 */

var fmt = require('yields/fmt');
var each = require('component/each');
var empty = require('component/empty');
var extension = require('./utils');

/**
 * Expose `Recorder`.
 */

module.exports = Recorder;

/**
 * Recorder.
 */

function Recorder() {
  if (!(this instanceof Recorder)) return new Recorder();
  this.running = false;
  this.recording = [];
  this.startListening();
  return this;
}

/**
 * Handle incoming messages and icon changes.
 */

Recorder.prototype.startListening = function() {
  var self = this;

  extension.onMessage(function(message) {
    self.record(message);
  });

  extension.onIconClicked(function() {
    if (!self.isRunning()) return self.startRecording();
    self.stopRecording();
  });
};

/**
 * Check if the recorder is running.
 */

Recorder.prototype.isRunning = function() {
  var ret = this.running;
  this.running = !this.running;
  if (ret) return true;
  return false;
};

/**
 * Record a message.
 *
 * @param {String} message
 */

Recorder.prototype.record = function(message) {
  var lastElement = this.recording[this.recording.length - 1];
  if (!lastElement) return this.recording.push(message);
  if (lastElement[1] === message[1]) return;
  this.recording.push(message);
};

/**
 * Start recording.
 */

Recorder.prototype.startRecording = function() {
  extension.setIcon('images/icon-green.png');
  this.detectScreenshots();
  this.recordActions();
  return this;
};

/**
 * Record events on the page.
 */

Recorder.prototype.recordActions = function() {
  this.recordUrl();
  extension.inject('foreground.js');
  extension.onTabUpdated(function(tabId) {
    extension.getCurrentTab(function(tab) {
      if (tabId === tab.id) extension.inject('foreground.js', tab.id);
    });
  });
};

/**
 * Record the Url.
 *
 */

Recorder.prototype.recordUrl = function() {
  var self = this;
  extension.onUrlChanged(function(details) {
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

Recorder.prototype.detectScreenshots = function() {
  var self = this;
  chrome.commands.onCommand.addListener(function(command) {
    if (command === "detect-screenshot") {
      self.record(["screenshot", 'index.png']);
    }
  });
};

/**
 * Stop recording.
 */

Recorder.prototype.stopRecording = function() {
  extension.setIcon('images/icon-black.png');
  var result = parse(this.recording);
  chrome.storage.sync.set({'nightmareStr': result});
  chrome.browserAction.setPopup({popup: 'index.html'});
  chrome.browserAction.setBadgeText({text: '1'});
};

/**
 * Parse the recording.
 *
 * @param {Array} recording
 */

function parse(recording) {
  var result = [
    "var Nightmare = require('nightmare');",
    "  new Nightmare()\n"
  ].join('\n');

  each(recording, function(record, i) {
    var type = record[0];
    var content = record[1];
    switch (type) {
      case 'goto':
        result += fmt("    .goto('%s')\n", content);
        break;
      case 'click':
        result += fmt("    .click('%s')\n", content);
        break;
      case 'type':
        var val = record[2];
        result += fmt("    .type('%s', '%s')\n", content, val);
        break;
      case 'screenshot':
        result += fmt("    .screenshot('%s')\n", content);
        break;
      case 'reload':
        result += "    .refresh()\n";
        break;
      default:
        console.log("Not a valid nightmare command");
    }
  });

  result += "    .run();"

  return result;
}
