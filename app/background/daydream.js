
/**
 * Module dependencies.
 */

var each    = require('component/each');
var fmt     = require('yields/fmt');
var Emitter = require('component/emitter');

/**
 * Expose `Daydream`.
 */

module.exports = Daydream;

/**
 * Daydream.
 */

function Daydream() {
  if (!(this instanceof Daydream)) return new Daydream();
  this.isRunning = false;
  return this;
}

/**
 * Mixin.
 */

Emitter(Daydream.prototype);

/**
 * Boot.
 */

Daydream.prototype.boot = function() {
  var self = this;
  chrome.browserAction.onClicked.addListener(function() {
    if (!self.isRunning) {
      self.emit('start');
    } else {
      self.emit('stop');
    }
    self.isRunning = !self.isRunning;
  });
};

/**
 * Set the icon.
 *
 * @param {String} color
 */

Daydream.prototype.setIcon = function(color) {
  if (color === "green") return chrome.browserAction.setIcon({path: 'images/icon-green.png'});
  if (color === "black") return chrome.browserAction.setIcon({path: 'images/icon-black.png'});
};

/**
 * Store the item.
 *
 * @param {String} item
 */

Daydream.prototype.store = function(item) {
  chrome.storage.sync.set({'nightmareStr': item});
};

/**
 * Show the popup.
 */

Daydream.prototype.showPopup = function () {
  chrome.browserAction.setPopup({popup: 'index.html'});
  chrome.browserAction.setBadgeText({text: '1'});
};

/**
 * Parse the recording.
 *
 * @param {Array} recording
 */

Daydream.prototype.parse = function (recording) {
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
      case 'evaluate':
        var textEl = fmt("      return document.querySelector('%s').innerText;", content);

        result += [
          '    .evaluate(function () {',
          textEl,
          '    }, function (text) {',
          '      console.log(text);',
          '    })\n'
        ].join('\n');

        break;
      default:
        console.log("Not a valid nightmare command");
    }
  });

  result += "    .run();"

  return result;
};
