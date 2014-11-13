
/**
 * Module dependencies.
 */

var fmt = require('yields/fmt');
var each = require('component/each');
var helper = require('./helper')();

/**
 * Expose `Recorder`.
 */

module.exports = Recorder;

/**
 * Recorder.
 */

function Recorder () {
  if (!(this instanceof Recorder)) return new Recorder();
  this.running = false;
  this.recording = [];
  return this;
}

/**
 * Handle incoming messages and icon changes.
 */

Recorder.prototype.startListening = function () {
  var self = this;

  helper.onMessage(function(message) {
    self.record(message);
  });

  helper.onIconClicked(function () {
    if (!self.isRunning()) return self.startRecording();
    self.stopRecording();
  });
};

/**
 * Check if the recorder is running.
 */

Recorder.prototype.isRunning = function () {
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
  helper.setIcon('images/icon-green.png');
  this.recordActions();
  return this;
};

/**
 * Record events on the page.
 */

Recorder.prototype.recordActions = function () {
  this.recordUrl();
  helper.inject('index.js');
  helper.onTabUpdated(function (tabId) {
    helper.getCurrentTab(function (tab) {
       if (tabId === tab.id) helper.inject('index.js', tab.id);
    });
  });
};

/**
 * Record the Url.
 */

Recorder.prototype.recordUrl = function () {
  var self = this;
  helper.onAddressBarChanged(function(text) {
    if (text.substr(0, 4) !== "http" || text.substr(0, 5) !== "https") text = "http://" + text;
    self.record(["goto", text]);
    helper.changeUrl(text);
  });
};

/**
 * Stop recording.
 */

Recorder.prototype.stopRecording = function () {
  helper.setIcon('images/icon-black.png');
  parse(this.recording);
  this.recording = [];
};

/**
 * Parse the recording.
 *
 * @param {Array} recording
 */

function parse (recording) {
  var nightmare = [
    "var Nightmare = require('nightmare');",
    "  new Nightmare()\n"
  ].join('\n');

  each(recording, function(record, i) {
    var type = record[0];
    var content = record[1];
    switch (type) {
      case 'goto':
        nightmare += fmt("  .goto('%s')\n", content);
        break;
      case 'click':
        nightmare += fmt("  .click('.%s')\n", content);
        break;
      case 'type':
        var val = record[2];
        nightmare += fmt("  .type('input[class=\"%s\"]', '%s')\n", content, val);
        break;
      default:
        console.log("Not a valid nightmare command");
    }
  });

  nightmare += [
    "  .run(function (err, nightmare) {",
    "     if (err) return console.log(err);",
    "     console.log('Done!');",
    "  });"
  ].join('\n');
  
  helper.copyToClipboard(nightmare);
}
