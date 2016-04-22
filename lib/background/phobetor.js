
/**
 * Module dependencies.
 */

var Emitter = require('component/emitter');
var uid  = require('matthewmueller/uid');
var recorder = require('./recorder')();
var each = require('component/each');
var os = require('component/os');
var fmt = require('yields/fmt');

/**
 * Expose `Phobetor`.
 */

module.exports = Phobetor;

/**
 * Phobetor.
 */

function Phobetor(){
  if (!(this instanceof Phobetor)) return new Phobetor();
  this.isRunning = false;
}

/**
 * Boot.
 */

Phobetor.prototype.boot = function(){
  var self = this;
  chrome.browserAction.onClicked.addListener(function(tab) {
    if (!self.isRunning) {
      recorder.startRecording();
      chrome.browserAction.setIcon({ path: 'images/icon-green.png', tabId: tab.id });
    } else {
      recorder.stopRecording();
      chrome.browserAction.setIcon({ path: 'images/icon-black.png', tabId: tab.id });
      var nightmare = self.parse(recorder.recording, 'nightmare');
      chrome.storage.sync.set({ 'nightmare': nightmare });
      chrome.browserAction.setPopup({ popup: 'index.html' });
      chrome.browserAction.setBadgeText({ text: '1' });
    }

    self.isRunning = !self.isRunning;
  });
};

/**
 * Parse the recording.
 *
 * @param {Array} recording
 * @param {String} lib
 */

Phobetor.prototype.parse = function(recording, lib) {
  var newLine = '\n';
  if (os == 'windows') newLine = '\r\n';

  var result;

  if (lib === 'nightmare') {
    result = [
      "var Nightmare = require('nightmare');",
      fmt("  yield Nightmare()%s", newLine)
    ].join(newLine);
  }

  each(recording, function (record, i) {
    var type = record[0];
    var content = record[1];
    switch (type) {
      case 'goto':
        if (lib === 'nightmare') {
          result += fmt("    .goto('%s')%s", content, newLine);
        }
        break;
      case 'click':
        result += fmt("    .click('%s')%s", content, newLine);
        break;
      case 'type':
        var val = record[2];
        result += fmt("    .type('%s', '%s')%s", content, val, newLine);
        break;
      case 'screenshot':
        result += fmt("    .screenshot('%s')%s", content, newLine);
        break;
      case 'reload':
        if (lib === 'nightmare') {
          result += fmt("    .refresh()%s", newLine);
        }
        break;
      case 'evaluate':
        var textEl = fmt("      return document.querySelector('%s').innerText;", content);

        result += [
          '    .evaluate(function () {',
          textEl,
          '    }, function (text) {',
          '      console.log(text);',
          fmt('    })%s', newLine)
        ].join(newLine);

        break;
      default:
        console.log("Not a valid nightmare command");
    }
  });

  return result;
};
