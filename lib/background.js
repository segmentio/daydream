
/**
 * Initialize a new Recorder.
 */

var recorder = Recorder();

/**
 * Recorder.
 */

function Recorder () {
  if (!(this instanceof Recorder)) return new Recorder();
  this.running = false;
  this.recording = [];
  handleMessages();
  handleIcons();
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
  inject('index.js');

  /**
   * Reinject the content script into the current tab when it changes
   */

  var self = this;
  onTabUpdated(function (tabId) {
    getCurrentTab(function (tab) {
       if (tabId === tab.id) inject('index.js', tab.id);
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
 * Handle incoming messages.
 */

function handleMessages () {
  onMessage(function(message) {
    recorder.record(message);
  });
}

/**
 * Handle the icon changes.
 */

function handleIcons() {
  onIconClicked(function () {
    if (!recorder.isRunning()) return recorder.startRecording();
    recorder.stopRecording();
  });
}

/**
 * When a message is received, execute a callback.
 */

function onMessage (fn) {
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    var message = request;
    fn(message);
  });
}

/**
 * Execute a callback when the icon is clicked.
 *
 * @param {Function} fn
 */

function onIconClicked (fn) {
  chrome.browserAction.onClicked.addListener(function () {
    fn();
  });
}

/**
 * When the tab is updated and the status is complete, execute a callback
 * with the tabId.
 */

function onTabUpdated (fn) {
  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == 'complete') {
      fn(tabId);
    }
  });
}

/**
 * Inject the script.
 */

function inject (name, id) {
  if (id) return chrome.tabs.executeScript(id, {file: name});
  chrome.tabs.executeScript(getCurrentTab(function (tab) {
    return tab.id;
  }), {file: name});
}

/**
 * Parse the recording.
 *
 * @param {Array} recording
 */

function parse (recording) {
  var nightmare = "var Nightmare = require('nightmare');\nnew Nightmare()\n";
  recording.each(function(record) {
    var type = record[0];
    var content = record[1];
    switch (type) {
      case 'goto':
        nightmare += "  .goto('" + content + "')\n";
        break;
      case 'click':
        nightmare += "  .click('." + content + "')\n";
        break;
      case 'type':
        var val = record[2];
        nightmare += "  .type('input[class=\"" + content + "\"]\', '" + val + "')\n";
        break;
      default:
        console.log("Not a valid nightmare command");
    }
  }, function () {
    nightmare += "  .run(function (err, nightmare) {\n";
    nightmare += "     if (err) return console.log(err);\n";
    nightmare += "     console.log('Done!');\n ";
    nightmare += "  });";
    copyToClipboard(nightmare);
  });
}

/**
 * Ask user to copy text to clipboard.
 */

function copyToClipboard(text) {
  window.prompt("Copy to clipboard: Ctrl+C, Enter", text);
}

/**
 * Get the current tab. Return early if it's a chrome url.
 *
 * @param {Function} fn
 */

function getCurrentTab (fn) {
  chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    fn(tabs[0]);
  });
}

/**
 * Iterate over an array, and execute a callback
 * when finished.
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
