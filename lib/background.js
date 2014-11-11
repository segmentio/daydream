
/**
 * Initialize a new Recorder.
 */

var recorder = Recorder();

/**
 * When the icon is clicked, start recording and set
 * the start icon.
 *
 * When the icon is clicked again, stop recording and set
 * the stop icon.
 */

var running = true;
chrome.browserAction.onClicked.addListener(function () {
  if (running === true) recorder.startRecording(), setStartIcon();
  if (running === false) recorder.stopRecording(), setStopIcon();
  running = !running;
});

/**
 * Listen for messages.
 */

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  console.log(request);
  console.log(sender);
  console.log(sendResponse);
  var type = request[0];
  var message = handle(type, request);
  // console.log(message); // click, attr; type, attr, txt
  recorder.recording.push(message);
});

/**
 * Recorder.
 *
 */

function Recorder () {
  if (!(this instanceof Recorder)) return new Recorder();
  this.recording = [];
  return this;
}

/**
 * Record.
 *
 * @param {String} message
 */

Recorder.prototype.record = function (message) {
  this.recording.push(message);
};

/**
 * Start recording.
 */

Recorder.prototype.startRecording = function () {
  this.recordUrl(), this.recordActions();
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
      if (self.recording[self.recording.length - 1][1] != tabs[0].url) {
        self.record(["goto", tabs[0].url]);
      }
    });
  });
};

/**
 * Stop recording.
 */

Recorder.prototype.stopRecording = function () {
  var nightmare = parse(this.recording);
  this.recording = [];
};

/**
 * Helper function to handle incoming messages.
 *
 * @param {String} type
 * @param {String} message
 * @param {Function} sendResponse
 */

function handle (type, message, sendResponse) {
  if (type === 'click') return message;
}

/**
 * Helper function to parse the recording.
 *
 * @param {Array} recording
 */

function parse (recording) {
  var nightmare = "var Nightmare = require('nightmare');\nnew Nightmare()\n";
  var counter = 0;
  each(recording, function (record) {
    var type = record[0];
    switch (type) {
      case 'goto':
        var url = record[1];
        counter += 1;
        nightmare += ".goto('" + url + "')\n";
        if (counter === recording.length) {
          console.log(nightmare);
        }
        break;
      case 'click':
        var el = record[1];
        counter += 1;
        nightmare += ".click(.'" + el + "')\n";
        if (counter === recording.length) {
          console.log(nightmare);
        }
        break;
      default:
        counter += 1;
        console.log("Not a valid nightmare command");
    }
  });
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
 * Helper function to iterate through an array.
 *
 * @param {Object} obj
 * @param {Function} fn
 * @param {Context} ctx
 */

function each (obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj[i], i);
  }
}

/**
 * Helper function to set the extension's icon to the green icon.
 */

function setStartIcon () {
  chrome.browserAction.setIcon({path: 'images/icon-green.png'});
}

/**
 * Helper function to set the extension's icon to the black icon.
 */

function setStopIcon () {
  chrome.browserAction.setIcon({path: 'images/icon-black.png'});
}
