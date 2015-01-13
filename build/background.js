(function outer(modules, cache, entries){

  /**
   * Global
   */

  var global = (function(){ return this; })();

  /**
   * Require `name`.
   *
   * @param {String} name
   * @param {Boolean} jumped
   * @api public
   */

  function require(name, jumped){
    if (cache[name]) return cache[name].exports;
    if (modules[name]) return call(name, require);
    throw new Error('cannot find module "' + name + '"');
  }

  /**
   * Call module `id` and cache it.
   *
   * @param {Number} id
   * @param {Function} require
   * @return {Function}
   * @api private
   */

  function call(id, require){
    var m = cache[id] = { exports: {} };
    var mod = modules[id];
    var name = mod[2];
    var fn = mod[0];

    fn.call(m.exports, function(req){
      var dep = modules[id][1][req];
      return require(dep ? dep : req);
    }, m, m.exports, outer, modules, cache, entries);

    // expose as `name`.
    if (name) cache[name] = cache[id];

    return cache[id].exports;
  }

  /**
   * Require all entries exposing them on global if needed.
   */

  for (var id in entries) {
    if (entries[id]) {
      global[entries[id]] = require(id);
    } else {
      require(id);
    }
  }

  /**
   * Duo flag.
   */

  require.duo = true;

  /**
   * Expose cache.
   */

  require.cache = cache;

  /**
   * Expose modules
   */

  require.modules = modules;

  /**
   * Return newest require.
   */

   return require;
})({
1: [function(require, module, exports) {

/**
 * Module dependencies.
 */

var daydream  = require('./daydream')();
var recorder  = require('./recorder')();
var analytics = require('stevenmiller888/analytics')('J0KCCfAPH6oXQJ8Np1IwI0HgAGW5oFOX');
var store     = require('yields/store');

/**
 * Boot.
 */

daydream.boot();

/**
 * Start.
 */

daydream.on('start', function () {
  recorder.startRecording();
  this.setIcon("green");
});

/**
 * Stop.
 */

daydream.on('stop', function () {
  recorder.stopRecording();
  this.setIcon("black");
  var res = this.parse(recorder.recording);
  store({'nightmare': res});
  this.showPopup();
});

}, {"./daydream":2,"./recorder":3,"stevenmiller888/analytics":4,"yields/store":5}],
2: [function(require, module, exports) {

/**
 * Module dependencies.
 */

var each    = require('component/each');
var Emitter = require('component/emitter');
var fmt     = require('yields/fmt');

/**
 * Expose `Daydream`.
 */

module.exports = Daydream;

/**
 * Daydream.
 */

function Daydream () {
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

Daydream.prototype.boot = function () {
  var self = this;

  analytics.identify({
    version: chrome.app.getDetails().version,
    languages: window.navigator.languages
  });

  chrome.browserAction.onClicked.addListener(function () {
    if (!self.isRunning) {
      self.emit('start');

      analytics.track('Clicked icon', {
        start: true,
        stop: false,
        background: true
      });
    } else {
      self.emit('stop');

      analytics.track('Clicked icon', {
        start: false,
        stop: true,
        background: true
      });
    }
    self.isRunning = !self.isRunning;
  });
};

/**
 * Set the icon.
 *
 * @param {String} color
 */

Daydream.prototype.setIcon = function (color) {
  if (color === "green") return chrome.browserAction.setIcon({path: 'images/icon-green.png'});
  if (color === "black") return chrome.browserAction.setIcon({path: 'images/icon-black.png'});
};

/**
 * Show the popup.
 */

Daydream.prototype.showPopup = function () {
  analytics.track('Displayed Popup', {
    background: true
  });
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

  each(recording, function (record, i) {
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

}, {"component/each":6,"component/emitter":7,"yields/fmt":8}],
6: [function(require, module, exports) {

/**
 * Module dependencies.
 */

try {
  var type = require('type');
} catch (err) {
  var type = require('component-type');
}

var toFunction = require('to-function');

/**
 * HOP reference.
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Iterate the given `obj` and invoke `fn(val, i)`
 * in optional context `ctx`.
 *
 * @param {String|Array|Object} obj
 * @param {Function} fn
 * @param {Object} [ctx]
 * @api public
 */

module.exports = function(obj, fn, ctx){
  fn = toFunction(fn);
  ctx = ctx || this;
  switch (type(obj)) {
    case 'array':
      return array(obj, fn, ctx);
    case 'object':
      if ('number' == typeof obj.length) return array(obj, fn, ctx);
      return object(obj, fn, ctx);
    case 'string':
      return string(obj, fn, ctx);
  }
};

/**
 * Iterate string chars.
 *
 * @param {String} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function string(obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj.charAt(i), i);
  }
}

/**
 * Iterate object keys.
 *
 * @param {Object} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function object(obj, fn, ctx) {
  for (var key in obj) {
    if (has.call(obj, key)) {
      fn.call(ctx, key, obj[key]);
    }
  }
}

/**
 * Iterate array-ish.
 *
 * @param {Array|Object} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function array(obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj[i], i);
  }
}

}, {"type":9,"component-type":9,"to-function":10}],
9: [function(require, module, exports) {

/**
 * toString ref.
 */

var toString = Object.prototype.toString;

/**
 * Return the type of `val`.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = function(val){
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Arguments]': return 'arguments';
    case '[object Array]': return 'array';
    case '[object String]': return 'string';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val && val.nodeType === 1) return 'element';
  if (val === Object(val)) return 'object';

  return typeof val;
};

}, {}],
10: [function(require, module, exports) {

/**
 * Module Dependencies
 */

var expr;
try {
  expr = require('props');
} catch(e) {
  expr = require('component-props');
}

/**
 * Expose `toFunction()`.
 */

module.exports = toFunction;

/**
 * Convert `obj` to a `Function`.
 *
 * @param {Mixed} obj
 * @return {Function}
 * @api private
 */

function toFunction(obj) {
  switch ({}.toString.call(obj)) {
    case '[object Object]':
      return objectToFunction(obj);
    case '[object Function]':
      return obj;
    case '[object String]':
      return stringToFunction(obj);
    case '[object RegExp]':
      return regexpToFunction(obj);
    default:
      return defaultToFunction(obj);
  }
}

/**
 * Default to strict equality.
 *
 * @param {Mixed} val
 * @return {Function}
 * @api private
 */

function defaultToFunction(val) {
  return function(obj){
    return val === obj;
  };
}

/**
 * Convert `re` to a function.
 *
 * @param {RegExp} re
 * @return {Function}
 * @api private
 */

function regexpToFunction(re) {
  return function(obj){
    return re.test(obj);
  };
}

/**
 * Convert property `str` to a function.
 *
 * @param {String} str
 * @return {Function}
 * @api private
 */

function stringToFunction(str) {
  // immediate such as "> 20"
  if (/^ *\W+/.test(str)) return new Function('_', 'return _ ' + str);

  // properties such as "name.first" or "age > 18" or "age > 18 && age < 36"
  return new Function('_', 'return ' + get(str));
}

/**
 * Convert `object` to a function.
 *
 * @param {Object} object
 * @return {Function}
 * @api private
 */

function objectToFunction(obj) {
  var match = {};
  for (var key in obj) {
    match[key] = typeof obj[key] === 'string'
      ? defaultToFunction(obj[key])
      : toFunction(obj[key]);
  }
  return function(val){
    if (typeof val !== 'object') return false;
    for (var key in match) {
      if (!(key in val)) return false;
      if (!match[key](val[key])) return false;
    }
    return true;
  };
}

/**
 * Built the getter function. Supports getter style functions
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function get(str) {
  var props = expr(str);
  if (!props.length) return '_.' + str;

  var val, i, prop;
  for (i = 0; i < props.length; i++) {
    prop = props[i];
    val = '_.' + prop;
    val = "('function' == typeof " + val + " ? " + val + "() : " + val + ")";

    // mimic negative lookbehind to avoid problems with nested properties
    str = stripNested(prop, str, val);
  }

  return str;
}

/**
 * Mimic negative lookbehind to avoid problems with nested properties.
 *
 * See: http://blog.stevenlevithan.com/archives/mimic-lookbehind-javascript
 *
 * @param {String} prop
 * @param {String} str
 * @param {String} val
 * @return {String}
 * @api private
 */

function stripNested (prop, str, val) {
  return str.replace(new RegExp('(\\.)?' + prop, 'g'), function($0, $1) {
    return $1 ? $0 : val;
  });
}

}, {"props":11,"component-props":11}],
11: [function(require, module, exports) {
/**
 * Global Names
 */

var globals = /\b(this|Array|Date|Object|Math|JSON)\b/g;

/**
 * Return immediate identifiers parsed from `str`.
 *
 * @param {String} str
 * @param {String|Function} map function or prefix
 * @return {Array}
 * @api public
 */

module.exports = function(str, fn){
  var p = unique(props(str));
  if (fn && 'string' == typeof fn) fn = prefixed(fn);
  if (fn) return map(str, p, fn);
  return p;
};

/**
 * Return immediate identifiers in `str`.
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */

function props(str) {
  return str
    .replace(/\.\w+|\w+ *\(|"[^"]*"|'[^']*'|\/([^/]+)\//g, '')
    .replace(globals, '')
    .match(/[$a-zA-Z_]\w*/g)
    || [];
}

/**
 * Return `str` with `props` mapped with `fn`.
 *
 * @param {String} str
 * @param {Array} props
 * @param {Function} fn
 * @return {String}
 * @api private
 */

function map(str, props, fn) {
  var re = /\.\w+|\w+ *\(|"[^"]*"|'[^']*'|\/([^/]+)\/|[a-zA-Z_]\w*/g;
  return str.replace(re, function(_){
    if ('(' == _[_.length - 1]) return fn(_);
    if (!~props.indexOf(_)) return _;
    return fn(_);
  });
}

/**
 * Return unique array.
 *
 * @param {Array} arr
 * @return {Array}
 * @api private
 */

function unique(arr) {
  var ret = [];

  for (var i = 0; i < arr.length; i++) {
    if (~ret.indexOf(arr[i])) continue;
    ret.push(arr[i]);
  }

  return ret;
}

/**
 * Map with prefix `str`.
 */

function prefixed(str) {
  return function(_){
    return str + _;
  };
}

}, {}],
7: [function(require, module, exports) {

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

}, {}],
8: [function(require, module, exports) {

/**
 * toString.
 */

var toString = window.JSON
  ? JSON.stringify
  : function(_){ return String(_); };

/**
 * Export `fmt`
 */

module.exports = fmt;

/**
 * Formatters
 */

fmt.o = toString;
fmt.s = String;
fmt.d = parseInt;

/**
 * Format the given `str`.
 *
 * @param {String} str
 * @param {...} args
 * @return {String}
 * @api public
 */

function fmt(str){
  var args = [].slice.call(arguments, 1);
  var j = 0;

  return str.replace(/%([a-z])/gi, function(_, f){
    return fmt[f]
      ? fmt[f](args[j++])
      : _ + f;
  });
}

}, {}],
3: [function(require, module, exports) {

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
  analytics.track('Started recording', {
    background: true
  });
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
        analytics.track('Changed Url', {
          type: 'reload',
          background: true
        });
        if (!self.recording.length) return self.record(["goto", details.url]);
        self.record(['reload']);
        break;
      case 'typed':
        analytics.track('Changed Url', {
          type: 'type',
          background: true
        });
        if (!from.length) return self.record(["goto", details.url]);
        if (from[0] === "from_address_bar") return self.record(["goto", details.url]);
        if (from[0] === "server_redirect" && from[1] === "from_address_bar") return self.record(["goto", details.url]);
        break;
      case 'auto_bookmark':
        analytics.track('Changed Url', {
          type: 'bookmark',
          background: true
        });
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
      analytics.track('Took Screenshot', {
        background: true
      });
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

}, {"component/each":6,"component/empty":12}],
12: [function(require, module, exports) {

var isArray = require('isarray');

function empty(x) {
  // Arrays
  if (isArray(x)) {
    x.length = 0;
  } 

  // HTML Elements
  else if (x instanceof HTMLElement) {
    while (x.firstChild) {
      x.removeChild(x.firstChild);
    }
  }

  // Array-like objects
  else if ((typeof x.length) == 'number') {
    Array.prototype.splice.call(x, 0, x.length);
  }
}

module.exports = empty;

}, {"isarray":13}],
13: [function(require, module, exports) {
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

}, {}],
4: [function(require, module, exports) {

/**
 * Expose `Analytics`.
 */

module.exports = Analytics;

/**
 * Analytics.
 *
 * @param {String} apiKey
 */

function Analytics (apiKey) {
  if (!(this instanceof Analytics)) return new Analytics(apiKey);

  // Create a queue, but don't obliterate an existing one!
  var analytics = window.analytics = window.analytics || [];

  // If the snippet was invoked already show an error.
  if (analytics.invoked) {
    if (window.console && console.error) {
      console.error('Segment snippet included twice.');
    }
    return;
  }

  // Invoked flag, to make sure the snippet
  // is never invoked twice.
  analytics.invoked = true;

  // A list of the methods in Analytics.js to stub.
  analytics.methods = [
  'trackSubmit',
  'trackClick',
  'trackLink',
  'trackForm',
  'pageview',
  'identify',
  'group',
  'track',
  'ready',
  'alias',
  'page',
  'once',
  'off',
  'on'
  ];

  // Define a factory to create stubs. These are placeholders
  // for methods in Analytics.js so that you never have to wait
  // for it to load to actually record data. The `method` is
  // stored as the first argument, so we can replay the data.
  analytics.factory = function(method){
    return function(){
      var args = Array.prototype.slice.call(arguments);
      args.unshift(method);
      analytics.push(args);
      return analytics;
    };
  };

  // For each of our methods, generate a queueing stub.
  for (var i = 0; i < analytics.methods.length; i++) {
    var key = analytics.methods[i];
    analytics[key] = analytics.factory(key);
  }

  // Define a method to load Analytics.js from our CDN,
  // and that will be sure to only ever load it once.
  analytics.load = function(key){
    // Create an async script element based on your key.
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://cdn.segment.com/analytics.js/v1/'
    + key + '/analytics.min.js';

    // Insert our script next to the first script element.
    var first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(script, first);
  };

  // Add a version to keep track of what's in the wild.
  analytics.SNIPPET_VERSION = '3.0.0';

  // Load Analytics.js with your key, which will automatically
  // load the tools you've enabled for your account. Boosh!
  analytics.load(apiKey);

  // Make the first page call to load the integrations. If
  // you'd like to manually name or tag the page, edit or
  // move this call however you'd like.
  analytics.page();
}

}, {}],
5: [function(require, module, exports) {

/**
 * dependencies.
 */

var unserialize = require('unserialize');
var each = require('each');
var storage;

/**
 * Safari throws when a user
 * blocks access to cookies / localstorage.
 */

try {
  storage = window.localStorage;
} catch (e) {
  storage = null;
}

/**
 * Expose `store`
 */

module.exports = store;

/**
 * Store the given `key`, `val`.
 *
 * @param {String|Object} key
 * @param {Mixed} value
 * @return {Mixed}
 * @api public
 */

function store(key, value){
  var length = arguments.length;
  if (0 == length) return all();
  if (2 <= length) return set(key, value);
  if (1 != length) return;
  if (null == key) return storage.clear();
  if ('string' == typeof key) return get(key);
  if ('object' == typeof key) return each(key, set);
}

/**
 * supported flag.
 */

store.supported = !! storage;

/**
 * Set `key` to `val`.
 *
 * @param {String} key
 * @param {Mixed} val
 */

function set(key, val){
  return null == val
    ? storage.removeItem(key)
    : storage.setItem(key, JSON.stringify(val));
}

/**
 * Get `key`.
 *
 * @param {String} key
 * @return {Mixed}
 */

function get(key){
  return unserialize(storage.getItem(key));
}

/**
 * Get all.
 *
 * @return {Object}
 */

function all(){
  var len = storage.length;
  var ret = {};
  var key;

  while (0 <= --len) {
    key = storage.key(len);
    ret[key] = get(key);
  }

  return ret;
}

}, {"unserialize":14,"each":6}],
14: [function(require, module, exports) {

/**
 * Unserialize the given "stringified" javascript.
 * 
 * @param {String} val
 * @return {Mixed}
 */

module.exports = function(val){
  try {
    return JSON.parse(val);
  } catch (e) {
    return val || undefined;
  }
};

}, {}]}, {}, {"1":""})
