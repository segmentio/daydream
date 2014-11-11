
/**
 * Initialize a new Recorder.
 */

var recorder = Recorder();

/**
 * When the icon is clicked, either start recording or
 * stop recording.
 */

chrome.browserAction.onClicked.addListener(function () {
  if (!recorder.isRunning()) return recorder.startRecording();
  recorder.stopRecording();
});

/**
 * Listen for messages.
 */

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  var message = request;
  recorder.record(message);
});

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
 * Check if the recorder is running.
 */

Recorder.prototype.isRunning = function () {
  var ret = this.running;
  this.running = !this.running;
  if (ret) return true;
  return false;
};

/**
 * Record.
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
  chrome.browserAction.setIcon({path: 'images/icon-green.png'});
  this.recordUrl();
  this.recordActions();
  return this;
};

/**
 * Record the url.
 */

Recorder.prototype.recordUrl = function () {
  var self = this;
  getCurrentTab(function (tab) {
    self.record(["goto", tab.url]);
  });
};

/**
 * Record events on the page.
 */

Recorder.prototype.recordActions = function () {
  chrome.tabs.executeScript(getCurrentTab(function (tab) {
    return tab.id;
  }), {file: 'index.js'});

  /**
   * Reinject the content script when a tab changes
   */

  var self = this;
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
      if (tabId === tabs[0].id) {
        chrome.tabs.executeScript(tabs[0].id, {file: 'index.js'});
      }
      self.recordUrl();
    });
  });
};

/**
 * Stop recording.
 */

Recorder.prototype.stopRecording = function () {
  chrome.browserAction.setIcon({path: 'images/icon-black.png'});
  parse(this.recording);
  this.recording = [];
};

/**
 * Helper function to parse the recording.
 *
 * @param {Array} recording
 */

function parse (recording) {
  var nightmare = "var Nightmare = require('nightmare');\nnew Nightmare()\n";
  recording.each(function(record) {
    var type = record[0];
    switch (type) {
      case 'goto':
        var url = record[1];
        nightmare += "  .goto('" + url + "')\n";
        break;
      case 'click':
        var el = record[1];
        nightmare += "  .click('." + el + "')\n";
        break;
      case 'type':
        var thing = record[1];
        nightmare += "  .type('." + thing + "')\n";
        break;
      default:
        console.log("Not a valid nightmare command");
    }
  }, function () {
    display(nightmare);
  });
}

/**
 * Helper function to display nightmare.
 *
 * @param {String} nightmare
 */

function display(nightmare) {
  var time = /(..)(:..)/.exec(new Date());
  var hour = time[1] % 12 || 12;
  var period = time[1] < 12 ? 'a.m.' : 'p.m.';
  new Notification(hour + time[2] + ' ' + period, {
    icon: 'images/icon-notification.jpg',
    body: nightmare
  });
  console.log(nightmare);
}

/**
 * Helper function get the current tab.
 *
 * @param {Function} fn
 */

function getCurrentTab (fn) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    fn(tabs[0]);
  });
}

/**
 * Helper function to iterate over an array,
 * and pass a callback when it's finished.
 *
 * @param {Function} fn
 */

Array.prototype.each = function(fn, cb) {
  var self = this;
  for (var i = 0; i < self.length; i++) {
    fn(self[i]);
    if (i === self.length - 1) {
      return cb();
    }
  }
};
