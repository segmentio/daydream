! function(e) {
    if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
    else if ("function" == typeof define && define.amd) define([], e);
    else {
        var f;
        "undefined" != typeof window ? f = window : "undefined" != typeof global ? f = global : "undefined" != typeof self && (f = self), f.Analytics = e()
    }
}(function() {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {
                    exports: {}
                };
                t[o][0].call(l.exports, function(e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }
        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [
            function(require, module, exports) {
                (function(process, global) {
                    var assert = require('assert');
                    var clone = require('clone');
                    var debug = require('debug')('analytics-node');
                    var noop = function() {};
                    var request = require('superagent');
                    // require('superagent-proxy')(request);
                    require('superagent-retry')(request);
                    var type = require('component-type');
                    var join = require('join-component');
                    var uid = require('uid');
                    var version = require('../package.json').version;
                    var extend = require('lodash').extend;

                    global.setImmediate = global.setImmediate || process.nextTick.bind(process);

                    /**
                     * Expose an `Analytics` client.
                     */

                    module.exports = Analytics;

                    /**
                     * Initialize a new `Analytics` with your Segment project's `writeKey` and an
                     * optional dictionary of `options`.
                     *
                     * @param {String} writeKey
                     * @param {Object} options (optional)
                     *   @property {Number} flushAt (default: 20)
                     *   @property {Number} flushAfter (default: 10000)
                     *   @property {String} host (default: 'https://api.segment.io')
                     *   @property {String|Object} proxy (default: null)
                     */

                    function Analytics(writeKey, options) {
                        if (!(this instanceof Analytics)) return new Analytics(writeKey, options);
                        assert(writeKey, 'You must pass your Segment project\'s write key.');
                        options = options || {};
                        this.queue = [];
                        this.writeKey = writeKey;
                        this.host = options.host || 'https://api.segment.io';
                        this.flushAt = Math.max(options.flushAt, 1) || 20;
                        this.flushAfter = options.flushAfter || 10000;
                        this.proxy = options.proxy || null;
                    }

                    /**
                     * Send an identify `message`.
                     *
                     * @param {Object} message
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.identify = function(message, fn) {
                        validate(message);
                        assert(message.anonymousId || message.userId, 'You must pass either an "anonymousId" or a "userId".');
                        this.enqueue('identify', message, fn);
                        return this;
                    };

                    /**
                     * Send a group `message`.
                     *
                     * @param {Object} message
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.group = function(message, fn) {
                        validate(message);
                        assert(message.anonymousId || message.userId, 'You must pass either an "anonymousId" or a "userId".');
                        assert(message.groupId, 'You must pass a "groupId".');
                        this.enqueue('group', message, fn);
                        return this;
                    };

                    /**
                     * Send a track `message`.
                     *
                     * @param {Object} message
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.track = function(message, fn) {
                        validate(message);
                        assert(message.anonymousId || message.userId, 'You must pass either an "anonymousId" or a "userId".');
                        assert(message.event, 'You must pass an "event".');
                        this.enqueue('track', message, fn);
                        return this;
                    };

                    /**
                     * Send a page `message`.
                     *
                     * @param {Object} message
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.page = function(message, fn) {
                        validate(message);
                        assert(message.anonymousId || message.userId, 'You must pass either an "anonymousId" or a "userId".');
                        this.enqueue('page', message, fn);
                        return this;
                    };

                    /**
                     * Send an alias `message`.
                     *
                     * @param {Object} message
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.alias = function(message, fn) {
                        validate(message);
                        assert(message.userId, 'You must pass a "userId".');
                        assert(message.previousId, 'You must pass a "previousId".');
                        this.enqueue('alias', message, fn);
                        return this;
                    };

                    /**
                     * Flush the current queue and callback `fn(err, batch)`.
                     *
                     * @param {Function} fn (optional)
                     * @return {Analytics}
                     */

                    Analytics.prototype.flush = function(fn) {
                        fn = fn || noop;
                        if (!this.queue.length) return setImmediate(fn);

                        var items = this.queue.splice(0, this.flushAt);
                        var fns = items.map(function(_) {
                            return _.callback;
                        });
                        var batch = items.map(function(_) {
                            return _.message;
                        });

                        var data = {
                            batch: batch,
                            timestamp: new Date(),
                            sentAt: new Date(),
                            messageId: uid(8)
                        };

                        debug('flush: %o', data);

                        var req = request
                            .post(this.host + '/v1/batch');

                        if (this.proxy) {
                            req = req.proxy(this.proxy);
                        }

                        req
                            .auth(this.writeKey, '')
                            .send(data)
                            .end(function(err, res) {
                                err = err || error(res);
                                fns.push(fn);
                                fns.forEach(function(fn) {
                                    fn(err, data);
                                });
                                debug('flushed: %o', data);
                            });
                    };

                    /**
                     * Add a `message` of type `type` to the queue and check whether it should be
                     * flushed.
                     *
                     * @param {String} type
                     * @param {Object} message
                     * @param {Functino} fn (optional)
                     * @api private
                     */

                    Analytics.prototype.enqueue = function(type, message, fn) {
                        fn = fn || noop;
                        message = clone(message);
                        message.type = type;
                        message.context = extend(message.context || {}, {
                            library: {
                                name: 'analytics-node',
                                version: version
                            }
                        });
                        if (!message.timestamp) message.timestamp = new Date();

                        debug('%s: %o', type, message);
                        this.queue.push({
                            message: message,
                            callback: fn
                        });

                        if (this.queue.length >= this.flushAt) this.flush();
                        if (this.timer) clearTimeout(this.timer);
                        if (this.flushAfter) this.timer = setTimeout(this.flush.bind(this), this.flushAfter);
                    };

                    /**
                     * Validation rules.
                     */

                    var rules = {
                        anonymousId: ['string', 'number'],
                        category: 'string',
                        context: 'object',
                        event: 'string',
                        groupId: ['string', 'number'],
                        integrations: 'object',
                        name: 'string',
                        previousId: ['string', 'number'],
                        timestamp: 'date',
                        userId: ['string', 'number']
                    };

                    /**
                     * Validate an options `obj`.
                     *
                     * @param {Object} obj
                     */

                    function validate(obj) {
                        assert('object' == type(obj), 'You must pass a message object.');
                        for (var key in rules) {
                            var val = obj[key];
                            if (!val) continue;
                            var exp = rules[key];
                            exp = ('array' === type(exp) ? exp : [exp]);
                            var a = 'object' == exp ? 'an' : 'a';
                            assert(exp.some(function(e) {
                                return type(val) === e;
                            }), '"' + key + '" must be ' + a + ' ' + join(exp, 'or') + '.');
                        }
                    };

                    /**
                     * Get an error from a `res`.
                     *
                     * @param {Object} res
                     * @return {String}
                     */

                    function error(res) {
                        if (!res.error) return;
                        var body = res.body;
                        var msg = body.error && body.error.message || res.status + ' ' + res.text;
                        return new Error(msg);
                    }

                }).call(this, require('_process'), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
            }, {
                "../package.json": 24,
                "_process": 8,
                "assert": 2,
                "clone": 11,
                "component-type": 12,
                "debug": 13,
                "join-component": 16,
                "lodash": 17,
                "superagent": 20,
                "superagent-retry": 18,
                "uid": 23
            }
        ],
        2: [
            function(require, module, exports) {
                // http://wiki.commonjs.org/wiki/Unit_Testing/1.0
                //
                // THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
                //
                // Originally from narwhal.js (http://narwhaljs.org)
                // Copyright (c) 2009 Thomas Robinson <280north.com>
                //
                // Permission is hereby granted, free of charge, to any person obtaining a copy
                // of this software and associated documentation files (the 'Software'), to
                // deal in the Software without restriction, including without limitation the
                // rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
                // sell copies of the Software, and to permit persons to whom the Software is
                // furnished to do so, subject to the following conditions:
                //
                // The above copyright notice and this permission notice shall be included in
                // all copies or substantial portions of the Software.
                //
                // THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                // AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
                // ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
                // WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

                // when used in node, this will actually load the util module we depend on
                // versus loading the builtin util module as happens otherwise
                // this is a bug in node module loading as far as I am concerned
                var util = require('util/');

                var pSlice = Array.prototype.slice;
                var hasOwn = Object.prototype.hasOwnProperty;

                // 1. The assert module provides functions that throw
                // AssertionError's when particular conditions are not met. The
                // assert module must conform to the following interface.

                var assert = module.exports = ok;

                // 2. The AssertionError is defined in assert.
                // new assert.AssertionError({ message: message,
                //                             actual: actual,
                //                             expected: expected })

                assert.AssertionError = function AssertionError(options) {
                    this.name = 'AssertionError';
                    this.actual = options.actual;
                    this.expected = options.expected;
                    this.operator = options.operator;
                    if (options.message) {
                        this.message = options.message;
                        this.generatedMessage = false;
                    } else {
                        this.message = getMessage(this);
                        this.generatedMessage = true;
                    }
                    var stackStartFunction = options.stackStartFunction || fail;

                    if (Error.captureStackTrace) {
                        Error.captureStackTrace(this, stackStartFunction);
                    } else {
                        // non v8 browsers so we can have a stacktrace
                        var err = new Error();
                        if (err.stack) {
                            var out = err.stack;

                            // try to strip useless frames
                            var fn_name = stackStartFunction.name;
                            var idx = out.indexOf('\n' + fn_name);
                            if (idx >= 0) {
                                // once we have located the function frame
                                // we need to strip out everything before it (and its line)
                                var next_line = out.indexOf('\n', idx + 1);
                                out = out.substring(next_line + 1);
                            }

                            this.stack = out;
                        }
                    }
                };

                // assert.AssertionError instanceof Error
                util.inherits(assert.AssertionError, Error);

                function replacer(key, value) {
                    if (util.isUndefined(value)) {
                        return '' + value;
                    }
                    if (util.isNumber(value) && !isFinite(value)) {
                        return value.toString();
                    }
                    if (util.isFunction(value) || util.isRegExp(value)) {
                        return value.toString();
                    }
                    return value;
                }

                function truncate(s, n) {
                    if (util.isString(s)) {
                        return s.length < n ? s : s.slice(0, n);
                    } else {
                        return s;
                    }
                }

                function getMessage(self) {
                    return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
                        self.operator + ' ' +
                        truncate(JSON.stringify(self.expected, replacer), 128);
                }

                // At present only the three keys mentioned above are used and
                // understood by the spec. Implementations or sub modules can pass
                // other keys to the AssertionError's constructor - they will be
                // ignored.

                // 3. All of the following functions must throw an AssertionError
                // when a corresponding condition is not met, with a message that
                // may be undefined if not provided.  All assertion methods provide
                // both the actual and expected values to the assertion error for
                // display purposes.

                function fail(actual, expected, message, operator, stackStartFunction) {
                    throw new assert.AssertionError({
                        message: message,
                        actual: actual,
                        expected: expected,
                        operator: operator,
                        stackStartFunction: stackStartFunction
                    });
                }

                // EXTENSION! allows for well behaved errors defined elsewhere.
                assert.fail = fail;

                // 4. Pure assertion tests whether a value is truthy, as determined
                // by !!guard.
                // assert.ok(guard, message_opt);
                // This statement is equivalent to assert.equal(true, !!guard,
                // message_opt);. To test strictly for the value true, use
                // assert.strictEqual(true, guard, message_opt);.

                function ok(value, message) {
                    if (!value) fail(value, true, message, '==', assert.ok);
                }
                assert.ok = ok;

                // 5. The equality assertion tests shallow, coercive equality with
                // ==.
                // assert.equal(actual, expected, message_opt);

                assert.equal = function equal(actual, expected, message) {
                    if (actual != expected) fail(actual, expected, message, '==', assert.equal);
                };

                // 6. The non-equality assertion tests for whether two objects are not equal
                // with != assert.notEqual(actual, expected, message_opt);

                assert.notEqual = function notEqual(actual, expected, message) {
                    if (actual == expected) {
                        fail(actual, expected, message, '!=', assert.notEqual);
                    }
                };

                // 7. The equivalence assertion tests a deep equality relation.
                // assert.deepEqual(actual, expected, message_opt);

                assert.deepEqual = function deepEqual(actual, expected, message) {
                    if (!_deepEqual(actual, expected)) {
                        fail(actual, expected, message, 'deepEqual', assert.deepEqual);
                    }
                };

                function _deepEqual(actual, expected) {
                    // 7.1. All identical values are equivalent, as determined by ===.
                    if (actual === expected) {
                        return true;

                    } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
                        if (actual.length != expected.length) return false;

                        for (var i = 0; i < actual.length; i++) {
                            if (actual[i] !== expected[i]) return false;
                        }

                        return true;

                        // 7.2. If the expected value is a Date object, the actual value is
                        // equivalent if it is also a Date object that refers to the same time.
                    } else if (util.isDate(actual) && util.isDate(expected)) {
                        return actual.getTime() === expected.getTime();

                        // 7.3 If the expected value is a RegExp object, the actual value is
                        // equivalent if it is also a RegExp object with the same source and
                        // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
                    } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
                        return actual.source === expected.source &&
                            actual.global === expected.global &&
                            actual.multiline === expected.multiline &&
                            actual.lastIndex === expected.lastIndex &&
                            actual.ignoreCase === expected.ignoreCase;

                        // 7.4. Other pairs that do not both pass typeof value == 'object',
                        // equivalence is determined by ==.
                    } else if (!util.isObject(actual) && !util.isObject(expected)) {
                        return actual == expected;

                        // 7.5 For all other Object pairs, including Array objects, equivalence is
                        // determined by having the same number of owned properties (as verified
                        // with Object.prototype.hasOwnProperty.call), the same set of keys
                        // (although not necessarily the same order), equivalent values for every
                        // corresponding key, and an identical 'prototype' property. Note: this
                        // accounts for both named and indexed properties on Arrays.
                    } else {
                        return objEquiv(actual, expected);
                    }
                }

                function isArguments(object) {
                    return Object.prototype.toString.call(object) == '[object Arguments]';
                }

                function objEquiv(a, b) {
                    if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
                        return false;
                    // an identical 'prototype' property.
                    if (a.prototype !== b.prototype) return false;
                    // if one is a primitive, the other must be same
                    if (util.isPrimitive(a) || util.isPrimitive(b)) {
                        return a === b;
                    }
                    var aIsArgs = isArguments(a),
                        bIsArgs = isArguments(b);
                    if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
                        return false;
                    if (aIsArgs) {
                        a = pSlice.call(a);
                        b = pSlice.call(b);
                        return _deepEqual(a, b);
                    }
                    var ka = objectKeys(a),
                        kb = objectKeys(b),
                        key, i;
                    // having the same number of owned properties (keys incorporates
                    // hasOwnProperty)
                    if (ka.length != kb.length)
                        return false;
                    //the same set of keys (although not necessarily the same order),
                    ka.sort();
                    kb.sort();
                    //~~~cheap key test
                    for (i = ka.length - 1; i >= 0; i--) {
                        if (ka[i] != kb[i])
                            return false;
                    }
                    //equivalent values for every corresponding key, and
                    //~~~possibly expensive deep test
                    for (i = ka.length - 1; i >= 0; i--) {
                        key = ka[i];
                        if (!_deepEqual(a[key], b[key])) return false;
                    }
                    return true;
                }

                // 8. The non-equivalence assertion tests for any deep inequality.
                // assert.notDeepEqual(actual, expected, message_opt);

                assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
                    if (_deepEqual(actual, expected)) {
                        fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
                    }
                };

                // 9. The strict equality assertion tests strict equality, as determined by ===.
                // assert.strictEqual(actual, expected, message_opt);

                assert.strictEqual = function strictEqual(actual, expected, message) {
                    if (actual !== expected) {
                        fail(actual, expected, message, '===', assert.strictEqual);
                    }
                };

                // 10. The strict non-equality assertion tests for strict inequality, as
                // determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

                assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
                    if (actual === expected) {
                        fail(actual, expected, message, '!==', assert.notStrictEqual);
                    }
                };

                function expectedException(actual, expected) {
                    if (!actual || !expected) {
                        return false;
                    }

                    if (Object.prototype.toString.call(expected) == '[object RegExp]') {
                        return expected.test(actual);
                    } else if (actual instanceof expected) {
                        return true;
                    } else if (expected.call({}, actual) === true) {
                        return true;
                    }

                    return false;
                }

                function _throws(shouldThrow, block, expected, message) {
                    var actual;

                    if (util.isString(expected)) {
                        message = expected;
                        expected = null;
                    }

                    try {
                        block();
                    } catch (e) {
                        actual = e;
                    }

                    message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
                        (message ? ' ' + message : '.');

                    if (shouldThrow && !actual) {
                        fail(actual, expected, 'Missing expected exception' + message);
                    }

                    if (!shouldThrow && expectedException(actual, expected)) {
                        fail(actual, expected, 'Got unwanted exception' + message);
                    }

                    if ((shouldThrow && actual && expected && !expectedException(actual, expected)) || (!shouldThrow && actual)) {
                        throw actual;
                    }
                }

                // 11. Expected to throw an error:
                // assert.throws(block, Error_opt, message_opt);

                assert.throws = function(block, /*optional*/ error, /*optional*/ message) {
                    _throws.apply(this, [true].concat(pSlice.call(arguments)));
                };

                // EXTENSION! This is annoying to write outside this module.
                assert.doesNotThrow = function(block, /*optional*/ message) {
                    _throws.apply(this, [false].concat(pSlice.call(arguments)));
                };

                assert.ifError = function(err) {
                    if (err) {
                        throw err;
                    }
                };

                var objectKeys = Object.keys || function(obj) {
                        var keys = [];
                        for (var key in obj) {
                            if (hasOwn.call(obj, key)) keys.push(key);
                        }
                        return keys;
                    };

            }, {
                "util/": 10
            }
        ],
        3: [
            function(require, module, exports) {
                /*!
                 * The buffer module from node.js, for the browser.
                 *
                 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
                 * @license  MIT
                 */

                var base64 = require('base64-js')
                var ieee754 = require('ieee754')
                var isArray = require('is-array')

                exports.Buffer = Buffer
                exports.SlowBuffer = SlowBuffer
                exports.INSPECT_MAX_BYTES = 50
                Buffer.poolSize = 8192 // not used by this implementation

                var kMaxLength = 0x3fffffff
                var rootParent = {}

                /**
                 * If `Buffer.TYPED_ARRAY_SUPPORT`:
                 *   === true    Use Uint8Array implementation (fastest)
                 *   === false   Use Object implementation (most compatible, even IE6)
                 *
                 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
                 * Opera 11.6+, iOS 4.2+.
                 *
                 * Note:
                 *
                 * - Implementation must support adding new properties to `Uint8Array` instances.
                 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
                 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
                 *
                 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
                 *
                 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
                 *    incorrect length in some situations.
                 *
                 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
                 * get the Object implementation, which is slower but will work correctly.
                 */
                Buffer.TYPED_ARRAY_SUPPORT = (function() {
                    try {
                        var buf = new ArrayBuffer(0)
                        var arr = new Uint8Array(buf)
                        arr.foo = function() {
                            return 42
                        }
                        return arr.foo() === 42 && // typed array instances can be augmented
                        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
                        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
                    } catch (e) {
                        return false
                    }
                })()

                /**
                 * Class: Buffer
                 * =============
                 *
                 * The Buffer constructor returns instances of `Uint8Array` that are augmented
                 * with function properties for all the node `Buffer` API functions. We use
                 * `Uint8Array` so that square bracket notation works as expected -- it returns
                 * a single octet.
                 *
                 * By augmenting the instances, we can avoid modifying the `Uint8Array`
                 * prototype.
                 */

                    function Buffer(subject, encoding, noZero) {
                        if (!(this instanceof Buffer))
                            return new Buffer(subject, encoding, noZero)

                        var type = typeof subject

                        // Find the length
                        var length
                        if (type === 'number')
                            length = +subject
                        else if (type === 'string') {
                            length = Buffer.byteLength(subject, encoding)
                        } else if (type === 'object' && subject !== null) { // assume object is array-like
                            if (subject.type === 'Buffer' && isArray(subject.data))
                                subject = subject.data
                            length = +subject.length
                        } else {
                            throw new TypeError('must start with number, buffer, array or string')
                        }

                        if (length > kMaxLength)
                            throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                                'size: 0x' + kMaxLength.toString(16) + ' bytes')

                        if (length < 0)
                            length = 0
                        else
                            length >>>= 0 // Coerce to uint32.

                            var self = this
                        if (Buffer.TYPED_ARRAY_SUPPORT) {
                            // Preferred: Return an augmented `Uint8Array` instance for best performance
                            /*eslint-disable consistent-this */
                            self = Buffer._augment(new Uint8Array(length))
                            /*eslint-enable consistent-this */
                        } else {
                            // Fallback: Return THIS instance of Buffer (created by `new`)
                            self.length = length
                            self._isBuffer = true
                        }

                        var i
                        if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
                            // Speed optimization -- use set if we're copying from a typed array
                            self._set(subject)
                        } else if (isArrayish(subject)) {
                            // Treat array-ish objects as a byte array
                            if (Buffer.isBuffer(subject)) {
                                for (i = 0; i < length; i++)
                                    self[i] = subject.readUInt8(i)
                            } else {
                                for (i = 0; i < length; i++)
                                    self[i] = ((subject[i] % 256) + 256) % 256
                            }
                        } else if (type === 'string') {
                            self.write(subject, 0, encoding)
                        } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
                            for (i = 0; i < length; i++) {
                                self[i] = 0
                            }
                        }

                        if (length > 0 && length <= Buffer.poolSize)
                            self.parent = rootParent

                        return self
                    }

                    function SlowBuffer(subject, encoding, noZero) {
                        if (!(this instanceof SlowBuffer))
                            return new SlowBuffer(subject, encoding, noZero)

                        var buf = new Buffer(subject, encoding, noZero)
                        delete buf.parent
                        return buf
                    }

                Buffer.isBuffer = function(b) {
                    return !!(b != null && b._isBuffer)
                }

                Buffer.compare = function(a, b) {
                    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
                        throw new TypeError('Arguments must be Buffers')

                    if (a === b) return 0

                    var x = a.length
                    var y = b.length
                    for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
                    if (i !== len) {
                        x = a[i]
                        y = b[i]
                    }
                    if (x < y) return -1
                    if (y < x) return 1
                    return 0
                }

                Buffer.isEncoding = function(encoding) {
                    switch (String(encoding).toLowerCase()) {
                        case 'hex':
                        case 'utf8':
                        case 'utf-8':
                        case 'ascii':
                        case 'binary':
                        case 'base64':
                        case 'raw':
                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return true
                        default:
                            return false
                    }
                }

                Buffer.concat = function(list, totalLength) {
                    if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

                    if (list.length === 0) {
                        return new Buffer(0)
                    } else if (list.length === 1) {
                        return list[0]
                    }

                    var i
                    if (totalLength === undefined) {
                        totalLength = 0
                        for (i = 0; i < list.length; i++) {
                            totalLength += list[i].length
                        }
                    }

                    var buf = new Buffer(totalLength)
                    var pos = 0
                    for (i = 0; i < list.length; i++) {
                        var item = list[i]
                        item.copy(buf, pos)
                        pos += item.length
                    }
                    return buf
                }

                Buffer.byteLength = function(str, encoding) {
                    var ret
                    str = str + ''
                    switch (encoding || 'utf8') {
                        case 'ascii':
                        case 'binary':
                        case 'raw':
                            ret = str.length
                            break
                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            ret = str.length * 2
                            break
                        case 'hex':
                            ret = str.length >>> 1
                            break
                        case 'utf8':
                        case 'utf-8':
                            ret = utf8ToBytes(str).length
                            break
                        case 'base64':
                            ret = base64ToBytes(str).length
                            break
                        default:
                            ret = str.length
                    }
                    return ret
                }

                // pre-set for values that may exist in the future
                Buffer.prototype.length = undefined
                Buffer.prototype.parent = undefined

                // toString(encoding, start=0, end=buffer.length)
                Buffer.prototype.toString = function(encoding, start, end) {
                    var loweredCase = false

                    start = start >>> 0
                    end = end === undefined || end === Infinity ? this.length : end >>> 0

                    if (!encoding) encoding = 'utf8'
                    if (start < 0) start = 0
                    if (end > this.length) end = this.length
                    if (end <= start) return ''

                    while (true) {
                        switch (encoding) {
                            case 'hex':
                                return hexSlice(this, start, end)

                            case 'utf8':
                            case 'utf-8':
                                return utf8Slice(this, start, end)

                            case 'ascii':
                                return asciiSlice(this, start, end)

                            case 'binary':
                                return binarySlice(this, start, end)

                            case 'base64':
                                return base64Slice(this, start, end)

                            case 'ucs2':
                            case 'ucs-2':
                            case 'utf16le':
                            case 'utf-16le':
                                return utf16leSlice(this, start, end)

                            default:
                                if (loweredCase)
                                    throw new TypeError('Unknown encoding: ' + encoding)
                                encoding = (encoding + '').toLowerCase()
                                loweredCase = true
                        }
                    }
                }

                Buffer.prototype.equals = function(b) {
                    if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
                    if (this === b) return true
                    return Buffer.compare(this, b) === 0
                }

                Buffer.prototype.inspect = function() {
                    var str = ''
                    var max = exports.INSPECT_MAX_BYTES
                    if (this.length > 0) {
                        str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
                        if (this.length > max)
                            str += ' ... '
                    }
                    return '<Buffer ' + str + '>'
                }

                Buffer.prototype.compare = function(b) {
                    if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
                    if (this === b) return 0
                    return Buffer.compare(this, b)
                }

                // `get` will be removed in Node 0.13+
                Buffer.prototype.get = function(offset) {
                    console.log('.get() is deprecated. Access using array indexes instead.')
                    return this.readUInt8(offset)
                }

                // `set` will be removed in Node 0.13+
                Buffer.prototype.set = function(v, offset) {
                    console.log('.set() is deprecated. Access using array indexes instead.')
                    return this.writeUInt8(v, offset)
                }

                function hexWrite(buf, string, offset, length) {
                    offset = Number(offset) || 0
                    var remaining = buf.length - offset
                    if (!length) {
                        length = remaining
                    } else {
                        length = Number(length)
                        if (length > remaining) {
                            length = remaining
                        }
                    }

                    // must be an even number of digits
                    var strLen = string.length
                    if (strLen % 2 !== 0) throw new Error('Invalid hex string')

                    if (length > strLen / 2) {
                        length = strLen / 2
                    }
                    for (var i = 0; i < length; i++) {
                        var byte = parseInt(string.substr(i * 2, 2), 16)
                        if (isNaN(byte)) throw new Error('Invalid hex string')
                        buf[offset + i] = byte
                    }
                    return i
                }

                function utf8Write(buf, string, offset, length) {
                    var charsWritten = blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
                    return charsWritten
                }

                function asciiWrite(buf, string, offset, length) {
                    var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
                    return charsWritten
                }

                function binaryWrite(buf, string, offset, length) {
                    return asciiWrite(buf, string, offset, length)
                }

                function base64Write(buf, string, offset, length) {
                    var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
                    return charsWritten
                }

                function utf16leWrite(buf, string, offset, length) {
                    var charsWritten = blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length, 2)
                    return charsWritten
                }

                Buffer.prototype.write = function(string, offset, length, encoding) {
                    // Support both (string, offset, length, encoding)
                    // and the legacy (string, encoding, offset, length)
                    if (isFinite(offset)) {
                        if (!isFinite(length)) {
                            encoding = length
                            length = undefined
                        }
                    } else { // legacy
                        var swap = encoding
                        encoding = offset
                        offset = length
                        length = swap
                    }

                    offset = Number(offset) || 0

                    if (length < 0 || offset < 0 || offset > this.length)
                        throw new RangeError('attempt to write outside buffer bounds')

                    var remaining = this.length - offset
                    if (!length) {
                        length = remaining
                    } else {
                        length = Number(length)
                        if (length > remaining) {
                            length = remaining
                        }
                    }
                    encoding = String(encoding || 'utf8').toLowerCase()

                    var ret
                    switch (encoding) {
                        case 'hex':
                            ret = hexWrite(this, string, offset, length)
                            break
                        case 'utf8':
                        case 'utf-8':
                            ret = utf8Write(this, string, offset, length)
                            break
                        case 'ascii':
                            ret = asciiWrite(this, string, offset, length)
                            break
                        case 'binary':
                            ret = binaryWrite(this, string, offset, length)
                            break
                        case 'base64':
                            ret = base64Write(this, string, offset, length)
                            break
                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            ret = utf16leWrite(this, string, offset, length)
                            break
                        default:
                            throw new TypeError('Unknown encoding: ' + encoding)
                    }
                    return ret
                }

                Buffer.prototype.toJSON = function() {
                    return {
                        type: 'Buffer',
                        data: Array.prototype.slice.call(this._arr || this, 0)
                    }
                }

                function base64Slice(buf, start, end) {
                    if (start === 0 && end === buf.length) {
                        return base64.fromByteArray(buf)
                    } else {
                        return base64.fromByteArray(buf.slice(start, end))
                    }
                }

                function utf8Slice(buf, start, end) {
                    var res = ''
                    var tmp = ''
                    end = Math.min(buf.length, end)

                    for (var i = start; i < end; i++) {
                        if (buf[i] <= 0x7F) {
                            res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
                            tmp = ''
                        } else {
                            tmp += '%' + buf[i].toString(16)
                        }
                    }

                    return res + decodeUtf8Char(tmp)
                }

                function asciiSlice(buf, start, end) {
                    var ret = ''
                    end = Math.min(buf.length, end)

                    for (var i = start; i < end; i++) {
                        ret += String.fromCharCode(buf[i] & 0x7F)
                    }
                    return ret
                }

                function binarySlice(buf, start, end) {
                    var ret = ''
                    end = Math.min(buf.length, end)

                    for (var i = start; i < end; i++) {
                        ret += String.fromCharCode(buf[i])
                    }
                    return ret
                }

                function hexSlice(buf, start, end) {
                    var len = buf.length

                    if (!start || start < 0) start = 0
                    if (!end || end < 0 || end > len) end = len

                    var out = ''
                    for (var i = start; i < end; i++) {
                        out += toHex(buf[i])
                    }
                    return out
                }

                function utf16leSlice(buf, start, end) {
                    var bytes = buf.slice(start, end)
                    var res = ''
                    for (var i = 0; i < bytes.length; i += 2) {
                        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
                    }
                    return res
                }

                Buffer.prototype.slice = function(start, end) {
                    var len = this.length
                    start = ~~start
                    end = end === undefined ? len : ~~end

                    if (start < 0) {
                        start += len
                        if (start < 0)
                            start = 0
                    } else if (start > len) {
                        start = len
                    }

                    if (end < 0) {
                        end += len
                        if (end < 0)
                            end = 0
                    } else if (end > len) {
                        end = len
                    }

                    if (end < start)
                        end = start

                    var newBuf
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        newBuf = Buffer._augment(this.subarray(start, end))
                    } else {
                        var sliceLen = end - start
                        newBuf = new Buffer(sliceLen, undefined, true)
                        for (var i = 0; i < sliceLen; i++) {
                            newBuf[i] = this[i + start]
                        }
                    }

                    if (newBuf.length)
                        newBuf.parent = this.parent || this

                    return newBuf
                }

                /*
                 * Need to make sure that buffer isn't trying to write out of bounds.
                 */

                function checkOffset(offset, ext, length) {
                    if ((offset % 1) !== 0 || offset < 0)
                        throw new RangeError('offset is not uint')
                    if (offset + ext > length)
                        throw new RangeError('Trying to access beyond buffer length')
                }

                Buffer.prototype.readUIntLE = function(offset, byteLength, noAssert) {
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkOffset(offset, byteLength, this.length)

                    var val = this[offset]
                    var mul = 1
                    var i = 0
                    while (++i < byteLength && (mul *= 0x100))
                        val += this[offset + i] * mul

                    return val
                }

                Buffer.prototype.readUIntBE = function(offset, byteLength, noAssert) {
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkOffset(offset, byteLength, this.length)

                    var val = this[offset + --byteLength]
                    var mul = 1
                    while (byteLength > 0 && (mul *= 0x100))
                        val += this[offset + --byteLength] * mul

                    return val
                }

                Buffer.prototype.readUInt8 = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 1, this.length)
                    return this[offset]
                }

                Buffer.prototype.readUInt16LE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 2, this.length)
                    return this[offset] | (this[offset + 1] << 8)
                }

                Buffer.prototype.readUInt16BE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 2, this.length)
                    return (this[offset] << 8) | this[offset + 1]
                }

                Buffer.prototype.readUInt32LE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)

                    return ((this[offset]) |
                        (this[offset + 1] << 8) |
                        (this[offset + 2] << 16)) +
                        (this[offset + 3] * 0x1000000)
                }

                Buffer.prototype.readUInt32BE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)

                    return (this[offset] * 0x1000000) +
                        ((this[offset + 1] << 16) |
                        (this[offset + 2] << 8) |
                        this[offset + 3])
                }

                Buffer.prototype.readIntLE = function(offset, byteLength, noAssert) {
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkOffset(offset, byteLength, this.length)

                    var val = this[offset]
                    var mul = 1
                    var i = 0
                    while (++i < byteLength && (mul *= 0x100))
                        val += this[offset + i] * mul
                    mul *= 0x80

                    if (val >= mul)
                        val -= Math.pow(2, 8 * byteLength)

                    return val
                }

                Buffer.prototype.readIntBE = function(offset, byteLength, noAssert) {
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkOffset(offset, byteLength, this.length)

                    var i = byteLength
                    var mul = 1
                    var val = this[offset + --i]
                    while (i > 0 && (mul *= 0x100))
                        val += this[offset + --i] * mul
                    mul *= 0x80

                    if (val >= mul)
                        val -= Math.pow(2, 8 * byteLength)

                    return val
                }

                Buffer.prototype.readInt8 = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 1, this.length)
                    if (!(this[offset] & 0x80))
                        return (this[offset])
                    return ((0xff - this[offset] + 1) * -1)
                }

                Buffer.prototype.readInt16LE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 2, this.length)
                    var val = this[offset] | (this[offset + 1] << 8)
                    return (val & 0x8000) ? val | 0xFFFF0000 : val
                }

                Buffer.prototype.readInt16BE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 2, this.length)
                    var val = this[offset + 1] | (this[offset] << 8)
                    return (val & 0x8000) ? val | 0xFFFF0000 : val
                }

                Buffer.prototype.readInt32LE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)

                    return (this[offset]) |
                        (this[offset + 1] << 8) |
                        (this[offset + 2] << 16) |
                        (this[offset + 3] << 24)
                }

                Buffer.prototype.readInt32BE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)

                    return (this[offset] << 24) |
                        (this[offset + 1] << 16) |
                        (this[offset + 2] << 8) |
                        (this[offset + 3])
                }

                Buffer.prototype.readFloatLE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)
                    return ieee754.read(this, offset, true, 23, 4)
                }

                Buffer.prototype.readFloatBE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 4, this.length)
                    return ieee754.read(this, offset, false, 23, 4)
                }

                Buffer.prototype.readDoubleLE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 8, this.length)
                    return ieee754.read(this, offset, true, 52, 8)
                }

                Buffer.prototype.readDoubleBE = function(offset, noAssert) {
                    if (!noAssert)
                        checkOffset(offset, 8, this.length)
                    return ieee754.read(this, offset, false, 52, 8)
                }

                function checkInt(buf, value, offset, ext, max, min) {
                    if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
                    if (value > max || value < min) throw new RangeError('value is out of bounds')
                    if (offset + ext > buf.length) throw new RangeError('index out of range')
                }

                Buffer.prototype.writeUIntLE = function(value, offset, byteLength, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

                    var mul = 1
                    var i = 0
                    this[offset] = value & 0xFF
                    while (++i < byteLength && (mul *= 0x100))
                        this[offset + i] = (value / mul) >>> 0 & 0xFF

                    return offset + byteLength
                }

                Buffer.prototype.writeUIntBE = function(value, offset, byteLength, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    byteLength = byteLength >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

                    var i = byteLength - 1
                    var mul = 1
                    this[offset + i] = value & 0xFF
                    while (--i >= 0 && (mul *= 0x100))
                        this[offset + i] = (value / mul) >>> 0 & 0xFF

                    return offset + byteLength
                }

                Buffer.prototype.writeUInt8 = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 1, 0xff, 0)
                    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                    this[offset] = value
                    return offset + 1
                }

                function objectWriteUInt16(buf, value, offset, littleEndian) {
                    if (value < 0) value = 0xffff + value + 1
                    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
                        buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                            (littleEndian ? i : 1 - i) * 8
                    }
                }

                Buffer.prototype.writeUInt16LE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 2, 0xffff, 0)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = value
                        this[offset + 1] = (value >>> 8)
                    } else objectWriteUInt16(this, value, offset, true)
                    return offset + 2
                }

                Buffer.prototype.writeUInt16BE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 2, 0xffff, 0)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = (value >>> 8)
                        this[offset + 1] = value
                    } else objectWriteUInt16(this, value, offset, false)
                    return offset + 2
                }

                function objectWriteUInt32(buf, value, offset, littleEndian) {
                    if (value < 0) value = 0xffffffff + value + 1
                    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
                        buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
                    }
                }

                Buffer.prototype.writeUInt32LE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 4, 0xffffffff, 0)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset + 3] = (value >>> 24)
                        this[offset + 2] = (value >>> 16)
                        this[offset + 1] = (value >>> 8)
                        this[offset] = value
                    } else objectWriteUInt32(this, value, offset, true)
                    return offset + 4
                }

                Buffer.prototype.writeUInt32BE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 4, 0xffffffff, 0)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = (value >>> 24)
                        this[offset + 1] = (value >>> 16)
                        this[offset + 2] = (value >>> 8)
                        this[offset + 3] = value
                    } else objectWriteUInt32(this, value, offset, false)
                    return offset + 4
                }

                Buffer.prototype.writeIntLE = function(value, offset, byteLength, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert) {
                        checkInt(this,
                            value,
                            offset,
                            byteLength,
                            Math.pow(2, 8 * byteLength - 1) - 1, -Math.pow(2, 8 * byteLength - 1))
                    }

                    var i = 0
                    var mul = 1
                    var sub = value < 0 ? 1 : 0
                    this[offset] = value & 0xFF
                    while (++i < byteLength && (mul *= 0x100))
                        this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

                    return offset + byteLength
                }

                Buffer.prototype.writeIntBE = function(value, offset, byteLength, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert) {
                        checkInt(this,
                            value,
                            offset,
                            byteLength,
                            Math.pow(2, 8 * byteLength - 1) - 1, -Math.pow(2, 8 * byteLength - 1))
                    }

                    var i = byteLength - 1
                    var mul = 1
                    var sub = value < 0 ? 1 : 0
                    this[offset + i] = value & 0xFF
                    while (--i >= 0 && (mul *= 0x100))
                        this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

                    return offset + byteLength
                }

                Buffer.prototype.writeInt8 = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 1, 0x7f, -0x80)
                    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                    if (value < 0) value = 0xff + value + 1
                    this[offset] = value
                    return offset + 1
                }

                Buffer.prototype.writeInt16LE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = value
                        this[offset + 1] = (value >>> 8)
                    } else objectWriteUInt16(this, value, offset, true)
                    return offset + 2
                }

                Buffer.prototype.writeInt16BE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = (value >>> 8)
                        this[offset + 1] = value
                    } else objectWriteUInt16(this, value, offset, false)
                    return offset + 2
                }

                Buffer.prototype.writeInt32LE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = value
                        this[offset + 1] = (value >>> 8)
                        this[offset + 2] = (value >>> 16)
                        this[offset + 3] = (value >>> 24)
                    } else objectWriteUInt32(this, value, offset, true)
                    return offset + 4
                }

                Buffer.prototype.writeInt32BE = function(value, offset, noAssert) {
                    value = +value
                    offset = offset >>> 0
                    if (!noAssert)
                        checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                    if (value < 0) value = 0xffffffff + value + 1
                    if (Buffer.TYPED_ARRAY_SUPPORT) {
                        this[offset] = (value >>> 24)
                        this[offset + 1] = (value >>> 16)
                        this[offset + 2] = (value >>> 8)
                        this[offset + 3] = value
                    } else objectWriteUInt32(this, value, offset, false)
                    return offset + 4
                }

                function checkIEEE754(buf, value, offset, ext, max, min) {
                    if (value > max || value < min) throw new RangeError('value is out of bounds')
                    if (offset + ext > buf.length) throw new RangeError('index out of range')
                    if (offset < 0) throw new RangeError('index out of range')
                }

                function writeFloat(buf, value, offset, littleEndian, noAssert) {
                    if (!noAssert)
                        checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
                    ieee754.write(buf, value, offset, littleEndian, 23, 4)
                    return offset + 4
                }

                Buffer.prototype.writeFloatLE = function(value, offset, noAssert) {
                    return writeFloat(this, value, offset, true, noAssert)
                }

                Buffer.prototype.writeFloatBE = function(value, offset, noAssert) {
                    return writeFloat(this, value, offset, false, noAssert)
                }

                function writeDouble(buf, value, offset, littleEndian, noAssert) {
                    if (!noAssert)
                        checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
                    ieee754.write(buf, value, offset, littleEndian, 52, 8)
                    return offset + 8
                }

                Buffer.prototype.writeDoubleLE = function(value, offset, noAssert) {
                    return writeDouble(this, value, offset, true, noAssert)
                }

                Buffer.prototype.writeDoubleBE = function(value, offset, noAssert) {
                    return writeDouble(this, value, offset, false, noAssert)
                }

                // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
                Buffer.prototype.copy = function(target, target_start, start, end) {
                    var self = this // source

                    if (!start) start = 0
                    if (!end && end !== 0) end = this.length
                    if (target_start >= target.length) target_start = target.length
                    if (!target_start) target_start = 0
                    if (end > 0 && end < start) end = start

                    // Copy 0 bytes; we're done
                    if (end === start) return 0
                    if (target.length === 0 || self.length === 0) return 0

                    // Fatal error conditions
                    if (target_start < 0)
                        throw new RangeError('targetStart out of bounds')
                    if (start < 0 || start >= self.length) throw new RangeError('sourceStart out of bounds')
                    if (end < 0) throw new RangeError('sourceEnd out of bounds')

                    // Are we oob?
                    if (end > this.length)
                        end = this.length
                    if (target.length - target_start < end - start)
                        end = target.length - target_start + start

                    var len = end - start

                    if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                        for (var i = 0; i < len; i++) {
                            target[i + target_start] = this[i + start]
                        }
                    } else {
                        target._set(this.subarray(start, start + len), target_start)
                    }

                    return len
                }

                // fill(value, start=0, end=buffer.length)
                Buffer.prototype.fill = function(value, start, end) {
                    if (!value) value = 0
                    if (!start) start = 0
                    if (!end) end = this.length

                    if (end < start) throw new RangeError('end < start')

                    // Fill 0 bytes; we're done
                    if (end === start) return
                    if (this.length === 0) return

                    if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
                    if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

                    var i
                    if (typeof value === 'number') {
                        for (i = start; i < end; i++) {
                            this[i] = value
                        }
                    } else {
                        var bytes = utf8ToBytes(value.toString())
                        var len = bytes.length
                        for (i = start; i < end; i++) {
                            this[i] = bytes[i % len]
                        }
                    }

                    return this
                }

                /**
                 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
                 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
                 */
                Buffer.prototype.toArrayBuffer = function() {
                    if (typeof Uint8Array !== 'undefined') {
                        if (Buffer.TYPED_ARRAY_SUPPORT) {
                            return (new Buffer(this)).buffer
                        } else {
                            var buf = new Uint8Array(this.length)
                            for (var i = 0, len = buf.length; i < len; i += 1) {
                                buf[i] = this[i]
                            }
                            return buf.buffer
                        }
                    } else {
                        throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
                    }
                }

                // HELPER FUNCTIONS
                // ================

                var BP = Buffer.prototype

                /**
                 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
                 */
                Buffer._augment = function(arr) {
                    arr.constructor = Buffer
                    arr._isBuffer = true

                    // save reference to original Uint8Array get/set methods before overwriting
                    arr._get = arr.get
                    arr._set = arr.set

                    // deprecated, will be removed in node 0.13+
                    arr.get = BP.get
                    arr.set = BP.set

                    arr.write = BP.write
                    arr.toString = BP.toString
                    arr.toLocaleString = BP.toString
                    arr.toJSON = BP.toJSON
                    arr.equals = BP.equals
                    arr.compare = BP.compare
                    arr.copy = BP.copy
                    arr.slice = BP.slice
                    arr.readUIntLE = BP.readUIntLE
                    arr.readUIntBE = BP.readUIntBE
                    arr.readUInt8 = BP.readUInt8
                    arr.readUInt16LE = BP.readUInt16LE
                    arr.readUInt16BE = BP.readUInt16BE
                    arr.readUInt32LE = BP.readUInt32LE
                    arr.readUInt32BE = BP.readUInt32BE
                    arr.readIntLE = BP.readIntLE
                    arr.readIntBE = BP.readIntBE
                    arr.readInt8 = BP.readInt8
                    arr.readInt16LE = BP.readInt16LE
                    arr.readInt16BE = BP.readInt16BE
                    arr.readInt32LE = BP.readInt32LE
                    arr.readInt32BE = BP.readInt32BE
                    arr.readFloatLE = BP.readFloatLE
                    arr.readFloatBE = BP.readFloatBE
                    arr.readDoubleLE = BP.readDoubleLE
                    arr.readDoubleBE = BP.readDoubleBE
                    arr.writeUInt8 = BP.writeUInt8
                    arr.writeUIntLE = BP.writeUIntLE
                    arr.writeUIntBE = BP.writeUIntBE
                    arr.writeUInt16LE = BP.writeUInt16LE
                    arr.writeUInt16BE = BP.writeUInt16BE
                    arr.writeUInt32LE = BP.writeUInt32LE
                    arr.writeUInt32BE = BP.writeUInt32BE
                    arr.writeIntLE = BP.writeIntLE
                    arr.writeIntBE = BP.writeIntBE
                    arr.writeInt8 = BP.writeInt8
                    arr.writeInt16LE = BP.writeInt16LE
                    arr.writeInt16BE = BP.writeInt16BE
                    arr.writeInt32LE = BP.writeInt32LE
                    arr.writeInt32BE = BP.writeInt32BE
                    arr.writeFloatLE = BP.writeFloatLE
                    arr.writeFloatBE = BP.writeFloatBE
                    arr.writeDoubleLE = BP.writeDoubleLE
                    arr.writeDoubleBE = BP.writeDoubleBE
                    arr.fill = BP.fill
                    arr.inspect = BP.inspect
                    arr.toArrayBuffer = BP.toArrayBuffer

                    return arr
                }

                var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

                    function base64clean(str) {
                        // Node strips out invalid characters like \n and \t from the string, base64-js does not
                        str = stringtrim(str).replace(INVALID_BASE64_RE, '')
                        // Node converts strings with length < 2 to ''
                        if (str.length < 2) return ''
                        // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
                        while (str.length % 4 !== 0) {
                            str = str + '='
                        }
                        return str
                    }

                    function stringtrim(str) {
                        if (str.trim) return str.trim()
                        return str.replace(/^\s+|\s+$/g, '')
                    }

                    function isArrayish(subject) {
                        return isArray(subject) || Buffer.isBuffer(subject) ||
                            subject && typeof subject === 'object' &&
                            typeof subject.length === 'number'
                    }

                    function toHex(n) {
                        if (n < 16) return '0' + n.toString(16)
                        return n.toString(16)
                    }

                    function utf8ToBytes(string, units) {
                        units = units || Infinity
                        var codePoint
                        var length = string.length
                        var leadSurrogate = null
                        var bytes = []
                        var i = 0

                        for (; i < length; i++) {
                            codePoint = string.charCodeAt(i)

                            // is surrogate component
                            if (codePoint > 0xD7FF && codePoint < 0xE000) {
                                // last char was a lead
                                if (leadSurrogate) {
                                    // 2 leads in a row
                                    if (codePoint < 0xDC00) {
                                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                        leadSurrogate = codePoint
                                        continue
                                    } else {
                                        // valid surrogate pair
                                        codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
                                        leadSurrogate = null
                                    }
                                } else {
                                    // no lead yet

                                    if (codePoint > 0xDBFF) {
                                        // unexpected trail
                                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                        continue
                                    } else if (i + 1 === length) {
                                        // unpaired lead
                                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                        continue
                                    } else {
                                        // valid lead
                                        leadSurrogate = codePoint
                                        continue
                                    }
                                }
                            } else if (leadSurrogate) {
                                // valid bmp char, but last char was a lead
                                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                leadSurrogate = null
                            }

                            // encode utf8
                            if (codePoint < 0x80) {
                                if ((units -= 1) < 0) break
                                bytes.push(codePoint)
                            } else if (codePoint < 0x800) {
                                if ((units -= 2) < 0) break
                                bytes.push(
                                    codePoint >> 0x6 | 0xC0,
                                    codePoint & 0x3F | 0x80
                                )
                            } else if (codePoint < 0x10000) {
                                if ((units -= 3) < 0) break
                                bytes.push(
                                    codePoint >> 0xC | 0xE0,
                                    codePoint >> 0x6 & 0x3F | 0x80,
                                    codePoint & 0x3F | 0x80
                                )
                            } else if (codePoint < 0x200000) {
                                if ((units -= 4) < 0) break
                                bytes.push(
                                    codePoint >> 0x12 | 0xF0,
                                    codePoint >> 0xC & 0x3F | 0x80,
                                    codePoint >> 0x6 & 0x3F | 0x80,
                                    codePoint & 0x3F | 0x80
                                )
                            } else {
                                throw new Error('Invalid code point')
                            }
                        }

                        return bytes
                    }

                    function asciiToBytes(str) {
                        var byteArray = []
                        for (var i = 0; i < str.length; i++) {
                            // Node's code seems to be doing this and not & 0x7F..
                            byteArray.push(str.charCodeAt(i) & 0xFF)
                        }
                        return byteArray
                    }

                    function utf16leToBytes(str, units) {
                        var c, hi, lo
                        var byteArray = []
                        for (var i = 0; i < str.length; i++) {
                            if ((units -= 2) < 0) break

                            c = str.charCodeAt(i)
                            hi = c >> 8
                            lo = c % 256
                            byteArray.push(lo)
                            byteArray.push(hi)
                        }

                        return byteArray
                    }

                    function base64ToBytes(str) {
                        return base64.toByteArray(base64clean(str))
                    }

                    function blitBuffer(src, dst, offset, length, unitSize) {
                        if (unitSize) length -= length % unitSize
                        for (var i = 0; i < length; i++) {
                            if ((i + offset >= dst.length) || (i >= src.length))
                                break
                            dst[i + offset] = src[i]
                        }
                        return i
                    }

                    function decodeUtf8Char(str) {
                        try {
                            return decodeURIComponent(str)
                        } catch (err) {
                            return String.fromCharCode(0xFFFD) // UTF 8 invalid char
                        }
                    }

            }, {
                "base64-js": 4,
                "ieee754": 5,
                "is-array": 6
            }
        ],
        4: [
            function(require, module, exports) {
                var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

                ;
                (function(exports) {
                    'use strict';

                    var Arr = (typeof Uint8Array !== 'undefined') ? Uint8Array : Array

                    var PLUS = '+'.charCodeAt(0)
                    var SLASH = '/'.charCodeAt(0)
                    var NUMBER = '0'.charCodeAt(0)
                    var LOWER = 'a'.charCodeAt(0)
                    var UPPER = 'A'.charCodeAt(0)
                    var PLUS_URL_SAFE = '-'.charCodeAt(0)
                    var SLASH_URL_SAFE = '_'.charCodeAt(0)

                        function decode(elt) {
                            var code = elt.charCodeAt(0)
                            if (code === PLUS ||
                                code === PLUS_URL_SAFE)
                                return 62 // '+'
                            if (code === SLASH ||
                                code === SLASH_URL_SAFE)
                                return 63 // '/'
                            if (code < NUMBER)
                                return -1 //no match
                            if (code < NUMBER + 10)
                                return code - NUMBER + 26 + 26
                            if (code < UPPER + 26)
                                return code - UPPER
                            if (code < LOWER + 26)
                                return code - LOWER + 26
                        }

                        function b64ToByteArray(b64) {
                            var i, j, l, tmp, placeHolders, arr

                            if (b64.length % 4 > 0) {
                                throw new Error('Invalid string. Length must be a multiple of 4')
                            }

                            // the number of equal signs (place holders)
                            // if there are two placeholders, than the two characters before it
                            // represent one byte
                            // if there is only one, then the three characters before it represent 2 bytes
                            // this is just a cheap hack to not do indexOf twice
                            var len = b64.length
                            placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

                            // base64 is 4/3 + up to two characters of the original data
                            arr = new Arr(b64.length * 3 / 4 - placeHolders)

                            // if there are placeholders, only get up to the last complete 4 chars
                            l = placeHolders > 0 ? b64.length - 4 : b64.length

                            var L = 0

                                function push(v) {
                                    arr[L++] = v
                                }

                            for (i = 0, j = 0; i < l; i += 4, j += 3) {
                                tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
                                push((tmp & 0xFF0000) >> 16)
                                push((tmp & 0xFF00) >> 8)
                                push(tmp & 0xFF)
                            }

                            if (placeHolders === 2) {
                                tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
                                push(tmp & 0xFF)
                            } else if (placeHolders === 1) {
                                tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
                                push((tmp >> 8) & 0xFF)
                                push(tmp & 0xFF)
                            }

                            return arr
                        }

                        function uint8ToBase64(uint8) {
                            var i,
                                extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
                                output = "",
                                temp, length

                                function encode(num) {
                                    return lookup.charAt(num)
                                }

                                function tripletToBase64(num) {
                                    return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
                                }

                                // go through the array every three bytes, we'll deal with trailing stuff later
                            for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
                                temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
                                output += tripletToBase64(temp)
                            }

                            // pad the end with zeros, but make sure to not forget the extra bytes
                            switch (extraBytes) {
                                case 1:
                                    temp = uint8[uint8.length - 1]
                                    output += encode(temp >> 2)
                                    output += encode((temp << 4) & 0x3F)
                                    output += '=='
                                    break
                                case 2:
                                    temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
                                    output += encode(temp >> 10)
                                    output += encode((temp >> 4) & 0x3F)
                                    output += encode((temp << 2) & 0x3F)
                                    output += '='
                                    break
                            }

                            return output
                        }

                    exports.toByteArray = b64ToByteArray
                    exports.fromByteArray = uint8ToBase64
                }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

            }, {}
        ],
        5: [
            function(require, module, exports) {
                exports.read = function(buffer, offset, isLE, mLen, nBytes) {
                    var e, m,
                        eLen = nBytes * 8 - mLen - 1,
                        eMax = (1 << eLen) - 1,
                        eBias = eMax >> 1,
                        nBits = -7,
                        i = isLE ? (nBytes - 1) : 0,
                        d = isLE ? -1 : 1,
                        s = buffer[offset + i];

                    i += d;

                    e = s & ((1 << (-nBits)) - 1);
                    s >>= (-nBits);
                    nBits += eLen;
                    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

                    m = e & ((1 << (-nBits)) - 1);
                    e >>= (-nBits);
                    nBits += mLen;
                    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

                    if (e === 0) {
                        e = 1 - eBias;
                    } else if (e === eMax) {
                        return m ? NaN : ((s ? -1 : 1) * Infinity);
                    } else {
                        m = m + Math.pow(2, mLen);
                        e = e - eBias;
                    }
                    return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
                };

                exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
                    var e, m, c,
                        eLen = nBytes * 8 - mLen - 1,
                        eMax = (1 << eLen) - 1,
                        eBias = eMax >> 1,
                        rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
                        i = isLE ? 0 : (nBytes - 1),
                        d = isLE ? 1 : -1,
                        s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

                    value = Math.abs(value);

                    if (isNaN(value) || value === Infinity) {
                        m = isNaN(value) ? 1 : 0;
                        e = eMax;
                    } else {
                        e = Math.floor(Math.log(value) / Math.LN2);
                        if (value * (c = Math.pow(2, -e)) < 1) {
                            e--;
                            c *= 2;
                        }
                        if (e + eBias >= 1) {
                            value += rt / c;
                        } else {
                            value += rt * Math.pow(2, 1 - eBias);
                        }
                        if (value * c >= 2) {
                            e++;
                            c /= 2;
                        }

                        if (e + eBias >= eMax) {
                            m = 0;
                            e = eMax;
                        } else if (e + eBias >= 1) {
                            m = (value * c - 1) * Math.pow(2, mLen);
                            e = e + eBias;
                        } else {
                            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                            e = 0;
                        }
                    }

                    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

                    e = (e << mLen) | m;
                    eLen += mLen;
                    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

                    buffer[offset + i - d] |= s * 128;
                };

            }, {}
        ],
        6: [
            function(require, module, exports) {

                /**
                 * isArray
                 */

                var isArray = Array.isArray;

                /**
                 * toString
                 */

                var str = Object.prototype.toString;

                /**
                 * Whether or not the given `val`
                 * is an array.
                 *
                 * example:
                 *
                 *        isArray([]);
                 *        // > true
                 *        isArray(arguments);
                 *        // > false
                 *        isArray('');
                 *        // > false
                 *
                 * @param {mixed} val
                 * @return {bool}
                 */

                module.exports = isArray || function(val) {
                    return !!val && '[object Array]' == str.call(val);
                };

            }, {}
        ],
        7: [
            function(require, module, exports) {
                if (typeof Object.create === 'function') {
                    // implementation from standard node.js 'util' module
                    module.exports = function inherits(ctor, superCtor) {
                        ctor.super_ = superCtor
                        ctor.prototype = Object.create(superCtor.prototype, {
                            constructor: {
                                value: ctor,
                                enumerable: false,
                                writable: true,
                                configurable: true
                            }
                        });
                    };
                } else {
                    // old school shim for old browsers
                    module.exports = function inherits(ctor, superCtor) {
                        ctor.super_ = superCtor
                        var TempCtor = function() {}
                        TempCtor.prototype = superCtor.prototype
                        ctor.prototype = new TempCtor()
                        ctor.prototype.constructor = ctor
                    }
                }

            }, {}
        ],
        8: [
            function(require, module, exports) {
                // shim for using process in browser

                var process = module.exports = {};
                var queue = [];
                var draining = false;

                function drainQueue() {
                    if (draining) {
                        return;
                    }
                    draining = true;
                    var currentQueue;
                    var len = queue.length;
                    while (len) {
                        currentQueue = queue;
                        queue = [];
                        var i = -1;
                        while (++i < len) {
                            currentQueue[i]();
                        }
                        len = queue.length;
                    }
                    draining = false;
                }
                process.nextTick = function(fun) {
                    queue.push(fun);
                    if (!draining) {
                        setTimeout(drainQueue, 0);
                    }
                };

                process.title = 'browser';
                process.browser = true;
                process.env = {};
                process.argv = [];
                process.version = ''; // empty string to avoid regexp issues

                function noop() {}

                process.on = noop;
                process.addListener = noop;
                process.once = noop;
                process.off = noop;
                process.removeListener = noop;
                process.removeAllListeners = noop;
                process.emit = noop;

                process.binding = function(name) {
                    throw new Error('process.binding is not supported');
                };

                // TODO(shtylman)
                process.cwd = function() {
                    return '/'
                };
                process.chdir = function(dir) {
                    throw new Error('process.chdir is not supported');
                };
                process.umask = function() {
                    return 0;
                };

            }, {}
        ],
        9: [
            function(require, module, exports) {
                module.exports = function isBuffer(arg) {
                    return arg && typeof arg === 'object' && typeof arg.copy === 'function' && typeof arg.fill === 'function' && typeof arg.readUInt8 === 'function';
                }
            }, {}
        ],
        10: [
            function(require, module, exports) {
                (function(process, global) {
                    // Copyright Joyent, Inc. and other Node contributors.
                    //
                    // Permission is hereby granted, free of charge, to any person obtaining a
                    // copy of this software and associated documentation files (the
                    // "Software"), to deal in the Software without restriction, including
                    // without limitation the rights to use, copy, modify, merge, publish,
                    // distribute, sublicense, and/or sell copies of the Software, and to permit
                    // persons to whom the Software is furnished to do so, subject to the
                    // following conditions:
                    //
                    // The above copyright notice and this permission notice shall be included
                    // in all copies or substantial portions of the Software.
                    //
                    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
                    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
                    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
                    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
                    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
                    // USE OR OTHER DEALINGS IN THE SOFTWARE.

                    var formatRegExp = /%[sdj%]/g;
                    exports.format = function(f) {
                        if (!isString(f)) {
                            var objects = [];
                            for (var i = 0; i < arguments.length; i++) {
                                objects.push(inspect(arguments[i]));
                            }
                            return objects.join(' ');
                        }

                        var i = 1;
                        var args = arguments;
                        var len = args.length;
                        var str = String(f).replace(formatRegExp, function(x) {
                            if (x === '%%') return '%';
                            if (i >= len) return x;
                            switch (x) {
                                case '%s':
                                    return String(args[i++]);
                                case '%d':
                                    return Number(args[i++]);
                                case '%j':
                                    try {
                                        return JSON.stringify(args[i++]);
                                    } catch (_) {
                                        return '[Circular]';
                                    }
                                default:
                                    return x;
                            }
                        });
                        for (var x = args[i]; i < len; x = args[++i]) {
                            if (isNull(x) || !isObject(x)) {
                                str += ' ' + x;
                            } else {
                                str += ' ' + inspect(x);
                            }
                        }
                        return str;
                    };


                    // Mark that a method should not be used.
                    // Returns a modified function which warns once by default.
                    // If --no-deprecation is set, then it is a no-op.
                    exports.deprecate = function(fn, msg) {
                        // Allow for deprecating things in the process of starting up.
                        if (isUndefined(global.process)) {
                            return function() {
                                return exports.deprecate(fn, msg).apply(this, arguments);
                            };
                        }

                        if (process.noDeprecation === true) {
                            return fn;
                        }

                        var warned = false;

                        function deprecated() {
                            if (!warned) {
                                if (process.throwDeprecation) {
                                    throw new Error(msg);
                                } else if (process.traceDeprecation) {
                                    console.trace(msg);
                                } else {
                                    console.error(msg);
                                }
                                warned = true;
                            }
                            return fn.apply(this, arguments);
                        }

                        return deprecated;
                    };


                    var debugs = {};
                    var debugEnviron;
                    exports.debuglog = function(set) {
                        if (isUndefined(debugEnviron))
                            debugEnviron = process.env.NODE_DEBUG || '';
                        set = set.toUpperCase();
                        if (!debugs[set]) {
                            if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
                                var pid = process.pid;
                                debugs[set] = function() {
                                    var msg = exports.format.apply(exports, arguments);
                                    console.error('%s %d: %s', set, pid, msg);
                                };
                            } else {
                                debugs[set] = function() {};
                            }
                        }
                        return debugs[set];
                    };


                    /**
                     * Echos the value of a value. Trys to print the value out
                     * in the best way possible given the different types.
                     *
                     * @param {Object} obj The object to print out.
                     * @param {Object} opts Optional options object that alters the output.
                     */
                    /* legacy: obj, showHidden, depth, colors*/

                    function inspect(obj, opts) {
                        // default options
                        var ctx = {
                            seen: [],
                            stylize: stylizeNoColor
                        };
                        // legacy...
                        if (arguments.length >= 3) ctx.depth = arguments[2];
                        if (arguments.length >= 4) ctx.colors = arguments[3];
                        if (isBoolean(opts)) {
                            // legacy...
                            ctx.showHidden = opts;
                        } else if (opts) {
                            // got an "options" object
                            exports._extend(ctx, opts);
                        }
                        // set default options
                        if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
                        if (isUndefined(ctx.depth)) ctx.depth = 2;
                        if (isUndefined(ctx.colors)) ctx.colors = false;
                        if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
                        if (ctx.colors) ctx.stylize = stylizeWithColor;
                        return formatValue(ctx, obj, ctx.depth);
                    }
                    exports.inspect = inspect;


                    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
                    inspect.colors = {
                        'bold': [1, 22],
                        'italic': [3, 23],
                        'underline': [4, 24],
                        'inverse': [7, 27],
                        'white': [37, 39],
                        'grey': [90, 39],
                        'black': [30, 39],
                        'blue': [34, 39],
                        'cyan': [36, 39],
                        'green': [32, 39],
                        'magenta': [35, 39],
                        'red': [31, 39],
                        'yellow': [33, 39]
                    };

                    // Don't use 'blue' not visible on cmd.exe
                    inspect.styles = {
                        'special': 'cyan',
                        'number': 'yellow',
                        'boolean': 'yellow',
                        'undefined': 'grey',
                        'null': 'bold',
                        'string': 'green',
                        'date': 'magenta',
                        // "name": intentionally not styling
                        'regexp': 'red'
                    };


                    function stylizeWithColor(str, styleType) {
                        var style = inspect.styles[styleType];

                        if (style) {
                            return '\u001b[' + inspect.colors[style][0] + 'm' + str +
                                '\u001b[' + inspect.colors[style][1] + 'm';
                        } else {
                            return str;
                        }
                    }


                    function stylizeNoColor(str, styleType) {
                        return str;
                    }


                    function arrayToHash(array) {
                        var hash = {};

                        array.forEach(function(val, idx) {
                            hash[val] = true;
                        });

                        return hash;
                    }


                    function formatValue(ctx, value, recurseTimes) {
                        // Provide a hook for user-specified inspect functions.
                        // Check that value is an object with an inspect function on it
                        if (ctx.customInspect &&
                            value &&
                            isFunction(value.inspect) &&
                            // Filter out the util module, it's inspect function is special
                            value.inspect !== exports.inspect &&
                            // Also filter out any prototype objects using the circular check.
                            !(value.constructor && value.constructor.prototype === value)) {
                            var ret = value.inspect(recurseTimes, ctx);
                            if (!isString(ret)) {
                                ret = formatValue(ctx, ret, recurseTimes);
                            }
                            return ret;
                        }

                        // Primitive types cannot have properties
                        var primitive = formatPrimitive(ctx, value);
                        if (primitive) {
                            return primitive;
                        }

                        // Look up the keys of the object.
                        var keys = Object.keys(value);
                        var visibleKeys = arrayToHash(keys);

                        if (ctx.showHidden) {
                            keys = Object.getOwnPropertyNames(value);
                        }

                        // IE doesn't make error fields non-enumerable
                        // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
                        if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
                            return formatError(value);
                        }

                        // Some type of object without properties can be shortcutted.
                        if (keys.length === 0) {
                            if (isFunction(value)) {
                                var name = value.name ? ': ' + value.name : '';
                                return ctx.stylize('[Function' + name + ']', 'special');
                            }
                            if (isRegExp(value)) {
                                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                            }
                            if (isDate(value)) {
                                return ctx.stylize(Date.prototype.toString.call(value), 'date');
                            }
                            if (isError(value)) {
                                return formatError(value);
                            }
                        }

                        var base = '',
                            array = false,
                            braces = ['{', '}'];

                        // Make Array say that they are Array
                        if (isArray(value)) {
                            array = true;
                            braces = ['[', ']'];
                        }

                        // Make functions say that they are functions
                        if (isFunction(value)) {
                            var n = value.name ? ': ' + value.name : '';
                            base = ' [Function' + n + ']';
                        }

                        // Make RegExps say that they are RegExps
                        if (isRegExp(value)) {
                            base = ' ' + RegExp.prototype.toString.call(value);
                        }

                        // Make dates with properties first say the date
                        if (isDate(value)) {
                            base = ' ' + Date.prototype.toUTCString.call(value);
                        }

                        // Make error with message first say the error
                        if (isError(value)) {
                            base = ' ' + formatError(value);
                        }

                        if (keys.length === 0 && (!array || value.length == 0)) {
                            return braces[0] + base + braces[1];
                        }

                        if (recurseTimes < 0) {
                            if (isRegExp(value)) {
                                return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                            } else {
                                return ctx.stylize('[Object]', 'special');
                            }
                        }

                        ctx.seen.push(value);

                        var output;
                        if (array) {
                            output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
                        } else {
                            output = keys.map(function(key) {
                                return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
                            });
                        }

                        ctx.seen.pop();

                        return reduceToSingleString(output, base, braces);
                    }


                    function formatPrimitive(ctx, value) {
                        if (isUndefined(value))
                            return ctx.stylize('undefined', 'undefined');
                        if (isString(value)) {
                            var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                .replace(/'/g, "\\'")
                                .replace(/\\"/g, '"') + '\'';
                            return ctx.stylize(simple, 'string');
                        }
                        if (isNumber(value))
                            return ctx.stylize('' + value, 'number');
                        if (isBoolean(value))
                            return ctx.stylize('' + value, 'boolean');
                        // For some reason typeof null is "object", so special case here.
                        if (isNull(value))
                            return ctx.stylize('null', 'null');
                    }


                    function formatError(value) {
                        return '[' + Error.prototype.toString.call(value) + ']';
                    }


                    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
                        var output = [];
                        for (var i = 0, l = value.length; i < l; ++i) {
                            if (hasOwnProperty(value, String(i))) {
                                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                                    String(i), true));
                            } else {
                                output.push('');
                            }
                        }
                        keys.forEach(function(key) {
                            if (!key.match(/^\d+$/)) {
                                output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
                                    key, true));
                            }
                        });
                        return output;
                    }


                    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
                        var name, str, desc;
                        desc = Object.getOwnPropertyDescriptor(value, key) || {
                            value: value[key]
                        };
                        if (desc.get) {
                            if (desc.set) {
                                str = ctx.stylize('[Getter/Setter]', 'special');
                            } else {
                                str = ctx.stylize('[Getter]', 'special');
                            }
                        } else {
                            if (desc.set) {
                                str = ctx.stylize('[Setter]', 'special');
                            }
                        }
                        if (!hasOwnProperty(visibleKeys, key)) {
                            name = '[' + key + ']';
                        }
                        if (!str) {
                            if (ctx.seen.indexOf(desc.value) < 0) {
                                if (isNull(recurseTimes)) {
                                    str = formatValue(ctx, desc.value, null);
                                } else {
                                    str = formatValue(ctx, desc.value, recurseTimes - 1);
                                }
                                if (str.indexOf('\n') > -1) {
                                    if (array) {
                                        str = str.split('\n').map(function(line) {
                                            return '  ' + line;
                                        }).join('\n').substr(2);
                                    } else {
                                        str = '\n' + str.split('\n').map(function(line) {
                                            return '   ' + line;
                                        }).join('\n');
                                    }
                                }
                            } else {
                                str = ctx.stylize('[Circular]', 'special');
                            }
                        }
                        if (isUndefined(name)) {
                            if (array && key.match(/^\d+$/)) {
                                return str;
                            }
                            name = JSON.stringify('' + key);
                            if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                                name = name.substr(1, name.length - 2);
                                name = ctx.stylize(name, 'name');
                            } else {
                                name = name.replace(/'/g, "\\'")
                                    .replace(/\\"/g, '"')
                                    .replace(/(^"|"$)/g, "'");
                                name = ctx.stylize(name, 'string');
                            }
                        }

                        return name + ': ' + str;
                    }


                    function reduceToSingleString(output, base, braces) {
                        var numLinesEst = 0;
                        var length = output.reduce(function(prev, cur) {
                            numLinesEst++;
                            if (cur.indexOf('\n') >= 0) numLinesEst++;
                            return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
                        }, 0);

                        if (length > 60) {
                            return braces[0] +
                                (base === '' ? '' : base + '\n ') +
                                ' ' +
                                output.join(',\n  ') +
                                ' ' +
                                braces[1];
                        }

                        return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
                    }


                    // NOTE: These type checking functions intentionally don't use `instanceof`
                    // because it is fragile and can be easily faked with `Object.create()`.

                    function isArray(ar) {
                        return Array.isArray(ar);
                    }
                    exports.isArray = isArray;

                    function isBoolean(arg) {
                        return typeof arg === 'boolean';
                    }
                    exports.isBoolean = isBoolean;

                    function isNull(arg) {
                        return arg === null;
                    }
                    exports.isNull = isNull;

                    function isNullOrUndefined(arg) {
                        return arg == null;
                    }
                    exports.isNullOrUndefined = isNullOrUndefined;

                    function isNumber(arg) {
                        return typeof arg === 'number';
                    }
                    exports.isNumber = isNumber;

                    function isString(arg) {
                        return typeof arg === 'string';
                    }
                    exports.isString = isString;

                    function isSymbol(arg) {
                        return typeof arg === 'symbol';
                    }
                    exports.isSymbol = isSymbol;

                    function isUndefined(arg) {
                        return arg === void 0;
                    }
                    exports.isUndefined = isUndefined;

                    function isRegExp(re) {
                        return isObject(re) && objectToString(re) === '[object RegExp]';
                    }
                    exports.isRegExp = isRegExp;

                    function isObject(arg) {
                        return typeof arg === 'object' && arg !== null;
                    }
                    exports.isObject = isObject;

                    function isDate(d) {
                        return isObject(d) && objectToString(d) === '[object Date]';
                    }
                    exports.isDate = isDate;

                    function isError(e) {
                        return isObject(e) &&
                            (objectToString(e) === '[object Error]' || e instanceof Error);
                    }
                    exports.isError = isError;

                    function isFunction(arg) {
                        return typeof arg === 'function';
                    }
                    exports.isFunction = isFunction;

                    function isPrimitive(arg) {
                        return arg === null ||
                            typeof arg === 'boolean' ||
                            typeof arg === 'number' ||
                            typeof arg === 'string' ||
                            typeof arg === 'symbol' || // ES6 symbol
                        typeof arg === 'undefined';
                    }
                    exports.isPrimitive = isPrimitive;

                    exports.isBuffer = require('./support/isBuffer');

                    function objectToString(o) {
                        return Object.prototype.toString.call(o);
                    }


                    function pad(n) {
                        return n < 10 ? '0' + n.toString(10) : n.toString(10);
                    }


                    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                        'Oct', 'Nov', 'Dec'
                    ];

                    // 26 Feb 16:19:34

                    function timestamp() {
                        var d = new Date();
                        var time = [pad(d.getHours()),
                            pad(d.getMinutes()),
                            pad(d.getSeconds())
                        ].join(':');
                        return [d.getDate(), months[d.getMonth()], time].join(' ');
                    }


                    // log is just a thin wrapper to console.log that prepends a timestamp
                    exports.log = function() {
                        console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
                    };


                    /**
                     * Inherit the prototype methods from one constructor into another.
                     *
                     * The Function.prototype.inherits from lang.js rewritten as a standalone
                     * function (not on Function.prototype). NOTE: If this file is to be loaded
                     * during bootstrapping this function needs to be rewritten using some native
                     * functions as prototype setup using normal JavaScript does not work as
                     * expected during bootstrapping (see mirror.js in r114903).
                     *
                     * @param {function} ctor Constructor function which needs to inherit the
                     *     prototype.
                     * @param {function} superCtor Constructor function to inherit prototype from.
                     */
                    exports.inherits = require('inherits');

                    exports._extend = function(origin, add) {
                        // Don't do anything if add isn't an object
                        if (!add || !isObject(add)) return origin;

                        var keys = Object.keys(add);
                        var i = keys.length;
                        while (i--) {
                            origin[keys[i]] = add[keys[i]];
                        }
                        return origin;
                    };

                    function hasOwnProperty(obj, prop) {
                        return Object.prototype.hasOwnProperty.call(obj, prop);
                    }

                }).call(this, require('_process'), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
            }, {
                "./support/isBuffer": 9,
                "_process": 8,
                "inherits": 7
            }
        ],
        11: [
            function(require, module, exports) {
                (function(Buffer) {
                    'use strict';

                    function objectToString(o) {
                        return Object.prototype.toString.call(o);
                    }

                    // shim for Node's 'util' package
                    // DO NOT REMOVE THIS! It is required for compatibility with EnderJS (http://enderjs.com/).
                    var util = {
                        isArray: function(ar) {
                            return Array.isArray(ar) || (typeof ar === 'object' && objectToString(ar) === '[object Array]');
                        },
                        isDate: function(d) {
                            return typeof d === 'object' && objectToString(d) === '[object Date]';
                        },
                        isRegExp: function(re) {
                            return typeof re === 'object' && objectToString(re) === '[object RegExp]';
                        },
                        getRegExpFlags: function(re) {
                            var flags = '';
                            re.global && (flags += 'g');
                            re.ignoreCase && (flags += 'i');
                            re.multiline && (flags += 'm');
                            return flags;
                        }
                    };


                    if (typeof module === 'object')
                        module.exports = clone;

                    /**
                     * Clones (copies) an Object using deep copying.
                     *
                     * This function supports circular references by default, but if you are certain
                     * there are no circular references in your object, you can save some CPU time
                     * by calling clone(obj, false).
                     *
                     * Caution: if `circular` is false and `parent` contains circular references,
                     * your program may enter an infinite loop and crash.
                     *
                     * @param `parent` - the object to be cloned
                     * @param `circular` - set to true if the object to be cloned may contain
                     *    circular references. (optional - true by default)
                     * @param `depth` - set to a number if the object is only to be cloned to
                     *    a particular depth. (optional - defaults to Infinity)
                     * @param `prototype` - sets the prototype to be used when cloning an object.
                     *    (optional - defaults to parent prototype).
                     */

                    function clone(parent, circular, depth, prototype) {
                        // maintain two arrays for circular references, where corresponding parents
                        // and children have the same index
                        var allParents = [];
                        var allChildren = [];

                        var useBuffer = typeof Buffer != 'undefined';

                        if (typeof circular == 'undefined')
                            circular = true;

                        if (typeof depth == 'undefined')
                            depth = Infinity;

                        // recurse this function so we don't reset allParents and allChildren

                        function _clone(parent, depth) {
                            // cloning null always returns null
                            if (parent === null)
                                return null;

                            if (depth == 0)
                                return parent;

                            var child;
                            if (typeof parent != 'object') {
                                return parent;
                            }

                            if (util.isArray(parent)) {
                                child = [];
                            } else if (util.isRegExp(parent)) {
                                child = new RegExp(parent.source, util.getRegExpFlags(parent));
                                if (parent.lastIndex) child.lastIndex = parent.lastIndex;
                            } else if (util.isDate(parent)) {
                                child = new Date(parent.getTime());
                            } else if (useBuffer && Buffer.isBuffer(parent)) {
                                child = new Buffer(parent.length);
                                parent.copy(child);
                                return child;
                            } else {
                                if (typeof prototype == 'undefined') child = Object.create(Object.getPrototypeOf(parent));
                                else child = Object.create(prototype);
                            }

                            if (circular) {
                                var index = allParents.indexOf(parent);

                                if (index != -1) {
                                    return allChildren[index];
                                }
                                allParents.push(parent);
                                allChildren.push(child);
                            }

                            for (var i in parent) {
                                child[i] = _clone(parent[i], depth - 1);
                            }

                            return child;
                        }

                        return _clone(parent, depth);
                    }

                    /**
                     * Simple flat clone using prototype, accepts only objects, usefull for property
                     * override on FLAT configuration object (no nested props).
                     *
                     * USE WITH CAUTION! This may not behave as you wish if you do not know how this
                     * works.
                     */
                    clone.clonePrototype = function(parent) {
                        if (parent === null)
                            return null;

                        var c = function() {};
                        c.prototype = parent;
                        return new c();
                    };

                }).call(this, require("buffer").Buffer)
            }, {
                "buffer": 3
            }
        ],
        12: [
            function(require, module, exports) {

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

                module.exports = function(val) {
                    switch (toString.call(val)) {
                        case '[object Function]':
                            return 'function';
                        case '[object Date]':
                            return 'date';
                        case '[object RegExp]':
                            return 'regexp';
                        case '[object Arguments]':
                            return 'arguments';
                        case '[object Array]':
                            return 'array';
                        case '[object String]':
                            return 'string';
                    }

                    if (val === null) return 'null';
                    if (val === undefined) return 'undefined';
                    if (val && val.nodeType === 1) return 'element';
                    if (val === Object(val)) return 'object';

                    return typeof val;
                };

            }, {}
        ],
        13: [
            function(require, module, exports) {

                /**
                 * This is the web browser implementation of `debug()`.
                 *
                 * Expose `debug()` as the module.
                 */

                exports = module.exports = require('./debug');
                exports.log = log;
                exports.formatArgs = formatArgs;
                exports.save = save;
                exports.load = load;
                exports.useColors = useColors;

                /**
                 * Colors.
                 */

                exports.colors = [
                    'lightseagreen',
                    'forestgreen',
                    'goldenrod',
                    'dodgerblue',
                    'darkorchid',
                    'crimson'
                ];

                /**
                 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
                 * and the Firebug extension (any Firefox version) are known
                 * to support "%c" CSS customizations.
                 *
                 * TODO: add a `localStorage` variable to explicitly enable/disable colors
                 */

                function useColors() {
                    // is webkit? http://stackoverflow.com/a/16459606/376773
                    return ('WebkitAppearance' in document.documentElement.style) ||
                    // is firebug? http://stackoverflow.com/a/398120/376773
                    (window.console && (console.firebug || (console.exception && console.table))) ||
                    // is firefox >= v31?
                    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
                    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
                }

                /**
                 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
                 */

                exports.formatters.j = function(v) {
                    return JSON.stringify(v);
                };


                /**
                 * Colorize log arguments if enabled.
                 *
                 * @api public
                 */

                function formatArgs() {
                    var args = arguments;
                    var useColors = this.useColors;

                    args[0] = (useColors ? '%c' : '') + this.namespace + (useColors ? ' %c' : ' ') + args[0] + (useColors ? '%c ' : ' ') + '+' + exports.humanize(this.diff);

                    if (!useColors) return args;

                    var c = 'color: ' + this.color;
                    args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

                    // the final "%c" is somewhat tricky, because there could be other
                    // arguments passed either before or after the %c, so we need to
                    // figure out the correct index to insert the CSS into
                    var index = 0;
                    var lastC = 0;
                    args[0].replace(/%[a-z%]/g, function(match) {
                        if ('%%' === match) return;
                        index++;
                        if ('%c' === match) {
                            // we only are interested in the *last* %c
                            // (the user may have provided their own)
                            lastC = index;
                        }
                    });

                    args.splice(lastC, 0, c);
                    return args;
                }

                /**
                 * Invokes `console.log()` when available.
                 * No-op when `console.log` is not a "function".
                 *
                 * @api public
                 */

                function log() {
                    // This hackery is required for IE8,
                    // where the `console.log` function doesn't have 'apply'
                    return 'object' == typeof console && 'function' == typeof console.log && Function.prototype.apply.call(console.log, console, arguments);
                }

                /**
                 * Save `namespaces`.
                 *
                 * @param {String} namespaces
                 * @api private
                 */

                function save(namespaces) {
                    try {
                        if (null == namespaces) {
                            localStorage.removeItem('debug');
                        } else {
                            localStorage.debug = namespaces;
                        }
                    } catch (e) {}
                }

                /**
                 * Load `namespaces`.
                 *
                 * @return {String} returns the previously persisted debug modes
                 * @api private
                 */

                function load() {
                    var r;
                    try {
                        r = localStorage.debug;
                    } catch (e) {}
                    return r;
                }

                /**
                 * Enable namespaces listed in `localStorage.debug` initially.
                 */

                exports.enable(load());

            }, {
                "./debug": 14
            }
        ],
        14: [
            function(require, module, exports) {

                /**
                 * This is the common logic for both the Node.js and web browser
                 * implementations of `debug()`.
                 *
                 * Expose `debug()` as the module.
                 */

                exports = module.exports = debug;
                exports.coerce = coerce;
                exports.disable = disable;
                exports.enable = enable;
                exports.enabled = enabled;
                exports.humanize = require('ms');

                /**
                 * The currently active debug mode names, and names to skip.
                 */

                exports.names = [];
                exports.skips = [];

                /**
                 * Map of special "%n" handling functions, for the debug "format" argument.
                 *
                 * Valid key names are a single, lowercased letter, i.e. "n".
                 */

                exports.formatters = {};

                /**
                 * Previously assigned color.
                 */

                var prevColor = 0;

                /**
                 * Previous log timestamp.
                 */

                var prevTime;

                /**
                 * Select a color.
                 *
                 * @return {Number}
                 * @api private
                 */

                function selectColor() {
                    return exports.colors[prevColor++ % exports.colors.length];
                }

                /**
                 * Create a debugger with the given `namespace`.
                 *
                 * @param {String} namespace
                 * @return {Function}
                 * @api public
                 */

                function debug(namespace) {

                    // define the `disabled` version
                    function disabled() {}
                    disabled.enabled = false;

                    // define the `enabled` version

                    function enabled() {

                        var self = enabled;

                        // set `diff` timestamp
                        var curr = +new Date();
                        var ms = curr - (prevTime || curr);
                        self.diff = ms;
                        self.prev = prevTime;
                        self.curr = curr;
                        prevTime = curr;

                        // add the `color` if not set
                        if (null == self.useColors) self.useColors = exports.useColors();
                        if (null == self.color && self.useColors) self.color = selectColor();

                        var args = Array.prototype.slice.call(arguments);

                        args[0] = exports.coerce(args[0]);

                        if ('string' !== typeof args[0]) {
                            // anything else let's inspect with %o
                            args = ['%o'].concat(args);
                        }

                        // apply any `formatters` transformations
                        var index = 0;
                        args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
                            // if we encounter an escaped % then don't increase the array index
                            if (match === '%%') return match;
                            index++;
                            var formatter = exports.formatters[format];
                            if ('function' === typeof formatter) {
                                var val = args[index];
                                match = formatter.call(self, val);

                                // now we need to remove `args[index]` since it's inlined in the `format`
                                args.splice(index, 1);
                                index--;
                            }
                            return match;
                        });

                        if ('function' === typeof exports.formatArgs) {
                            args = exports.formatArgs.apply(self, args);
                        }
                        var logFn = enabled.log || exports.log || console.log.bind(console);
                        logFn.apply(self, args);
                    }
                    enabled.enabled = true;

                    var fn = exports.enabled(namespace) ? enabled : disabled;

                    fn.namespace = namespace;

                    return fn;
                }

                /**
                 * Enables a debug mode by namespaces. This can include modes
                 * separated by a colon and wildcards.
                 *
                 * @param {String} namespaces
                 * @api public
                 */

                function enable(namespaces) {
                    exports.save(namespaces);

                    var split = (namespaces || '').split(/[\s,]+/);
                    var len = split.length;

                    for (var i = 0; i < len; i++) {
                        if (!split[i]) continue; // ignore empty strings
                        namespaces = split[i].replace(/\*/g, '.*?');
                        if (namespaces[0] === '-') {
                            exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
                        } else {
                            exports.names.push(new RegExp('^' + namespaces + '$'));
                        }
                    }
                }

                /**
                 * Disable debug output.
                 *
                 * @api public
                 */

                function disable() {
                    exports.enable('');
                }

                /**
                 * Returns true if the given mode name is enabled, false otherwise.
                 *
                 * @param {String} name
                 * @return {Boolean}
                 * @api public
                 */

                function enabled(name) {
                    var i, len;
                    for (i = 0, len = exports.skips.length; i < len; i++) {
                        if (exports.skips[i].test(name)) {
                            return false;
                        }
                    }
                    for (i = 0, len = exports.names.length; i < len; i++) {
                        if (exports.names[i].test(name)) {
                            return true;
                        }
                    }
                    return false;
                }

                /**
                 * Coerce `val`.
                 *
                 * @param {Mixed} val
                 * @return {Mixed}
                 * @api private
                 */

                function coerce(val) {
                    if (val instanceof Error) return val.stack || val.message;
                    return val;
                }

            }, {
                "ms": 15
            }
        ],
        15: [
            function(require, module, exports) {
                /**
                 * Helpers.
                 */

                var s = 1000;
                var m = s * 60;
                var h = m * 60;
                var d = h * 24;
                var y = d * 365.25;

                /**
                 * Parse or format the given `val`.
                 *
                 * Options:
                 *
                 *  - `long` verbose formatting [false]
                 *
                 * @param {String|Number} val
                 * @param {Object} options
                 * @return {String|Number}
                 * @api public
                 */

                module.exports = function(val, options) {
                    options = options || {};
                    if ('string' == typeof val) return parse(val);
                    return options.long ? long(val) : short(val);
                };

                /**
                 * Parse the given `str` and return milliseconds.
                 *
                 * @param {String} str
                 * @return {Number}
                 * @api private
                 */

                function parse(str) {
                    var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
                    if (!match) return;
                    var n = parseFloat(match[1]);
                    var type = (match[2] || 'ms').toLowerCase();
                    switch (type) {
                        case 'years':
                        case 'year':
                        case 'y':
                            return n * y;
                        case 'days':
                        case 'day':
                        case 'd':
                            return n * d;
                        case 'hours':
                        case 'hour':
                        case 'h':
                            return n * h;
                        case 'minutes':
                        case 'minute':
                        case 'm':
                            return n * m;
                        case 'seconds':
                        case 'second':
                        case 's':
                            return n * s;
                        case 'ms':
                            return n;
                    }
                }

                /**
                 * Short format for `ms`.
                 *
                 * @param {Number} ms
                 * @return {String}
                 * @api private
                 */

                function short(ms) {
                    if (ms >= d) return Math.round(ms / d) + 'd';
                    if (ms >= h) return Math.round(ms / h) + 'h';
                    if (ms >= m) return Math.round(ms / m) + 'm';
                    if (ms >= s) return Math.round(ms / s) + 's';
                    return ms + 'ms';
                }

                /**
                 * Long format for `ms`.
                 *
                 * @param {Number} ms
                 * @return {String}
                 * @api private
                 */

                function long(ms) {
                    return plural(ms, d, 'day') || plural(ms, h, 'hour') || plural(ms, m, 'minute') || plural(ms, s, 'second') || ms + ' ms';
                }

                /**
                 * Pluralization helper.
                 */

                function plural(ms, n, name) {
                    if (ms < n) return;
                    if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
                    return Math.ceil(ms / n) + ' ' + name + 's';
                }

            }, {}
        ],
        16: [
            function(require, module, exports) {

                /**
                 * Join `arr` with the trailing `str` defaulting to "and",
                 * and `sep` string defaulting to ", ".
                 *
                 * @param {Array} arr
                 * @param {String} str
                 * @param {String} sep
                 * @return {String}
                 * @api public
                 */

                module.exports = function(arr, str, sep) {
                    str = str || 'and';
                    sep = sep || ', ';
                    str = ' ' + str + ' ';
                    if (arr.length < 2) return arr[0] || '';
                    return arr.slice(0, -1).join(sep) + str + arr[arr.length - 1];
                };

            }, {}
        ],
        17: [
            function(require, module, exports) {
                (function(global) {
                    /**
                     * @license
                     * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
                     * Build: `lodash modern -o ./dist/lodash.js`
                     * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
                     * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
                     * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
                     * Available under MIT license <http://lodash.com/license>
                     */
                    ;
                    (function() {

                        /** Used as a safe reference for `undefined` in pre ES5 environments */
                        var undefined;

                        /** Used to pool arrays and objects used internally */
                        var arrayPool = [],
                            objectPool = [];

                        /** Used to generate unique IDs */
                        var idCounter = 0;

                        /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
                        var keyPrefix = +new Date + '';

                        /** Used as the size when optimizations are enabled for large arrays */
                        var largeArraySize = 75;

                        /** Used as the max size of the `arrayPool` and `objectPool` */
                        var maxPoolSize = 40;

                        /** Used to detect and test whitespace */
                        var whitespace = (
                            // whitespace
                            ' \t\x0B\f\xA0\ufeff' +

                            // line terminators
                            '\n\r\u2028\u2029' +

                            // unicode category "Zs" space separators
                            '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
                        );

                        /** Used to match empty string literals in compiled template source */
                        var reEmptyStringLeading = /\b__p \+= '';/g,
                            reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
                            reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

                        /**
                         * Used to match ES6 template delimiters
                         * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
                         */
                        var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

                        /** Used to match regexp flags from their coerced string values */
                        var reFlags = /\w*$/;

                        /** Used to detected named functions */
                        var reFuncName = /^\s*function[ \n\r\t]+\w/;

                        /** Used to match "interpolate" template delimiters */
                        var reInterpolate = /<%=([\s\S]+?)%>/g;

                        /** Used to match leading whitespace and zeros to be removed */
                        var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

                        /** Used to ensure capturing order of template delimiters */
                        var reNoMatch = /($^)/;

                        /** Used to detect functions containing a `this` reference */
                        var reThis = /\bthis\b/;

                        /** Used to match unescaped characters in compiled string literals */
                        var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

                        /** Used to assign default `context` object properties */
                        var contextProps = [
                            'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
                            'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
                            'parseInt', 'setTimeout'
                        ];

                        /** Used to make template sourceURLs easier to identify */
                        var templateCounter = 0;

                        /** `Object#toString` result shortcuts */
                        var argsClass = '[object Arguments]',
                            arrayClass = '[object Array]',
                            boolClass = '[object Boolean]',
                            dateClass = '[object Date]',
                            funcClass = '[object Function]',
                            numberClass = '[object Number]',
                            objectClass = '[object Object]',
                            regexpClass = '[object RegExp]',
                            stringClass = '[object String]';

                        /** Used to identify object classifications that `_.clone` supports */
                        var cloneableClasses = {};
                        cloneableClasses[funcClass] = false;
                        cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
                            cloneableClasses[boolClass] = cloneableClasses[dateClass] =
                            cloneableClasses[numberClass] = cloneableClasses[objectClass] =
                            cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

                        /** Used as an internal `_.debounce` options object */
                        var debounceOptions = {
                            'leading': false,
                            'maxWait': 0,
                            'trailing': false
                        };

                        /** Used as the property descriptor for `__bindData__` */
                        var descriptor = {
                            'configurable': false,
                            'enumerable': false,
                            'value': null,
                            'writable': false
                        };

                        /** Used to determine if values are of the language type Object */
                        var objectTypes = {
                            'boolean': false,
                            'function': true,
                            'object': true,
                            'number': false,
                            'string': false,
                            'undefined': false
                        };

                        /** Used to escape characters for inclusion in compiled string literals */
                        var stringEscapes = {
                            '\\': '\\',
                            "'": "'",
                            '\n': 'n',
                            '\r': 'r',
                            '\t': 't',
                            '\u2028': 'u2028',
                            '\u2029': 'u2029'
                        };

                        /** Used as a reference to the global object */
                        var root = (objectTypes[typeof window] && window) || this;

                        /** Detect free variable `exports` */
                        var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

                        /** Detect free variable `module` */
                        var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

                        /** Detect the popular CommonJS extension `module.exports` */
                        var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

                        /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
                        var freeGlobal = objectTypes[typeof global] && global;
                        if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
                            root = freeGlobal;
                        }

                        /*--------------------------------------------------------------------------*/

                        /**
                         * The base implementation of `_.indexOf` without support for binary searches
                         * or `fromIndex` constraints.
                         *
                         * @private
                         * @param {Array} array The array to search.
                         * @param {*} value The value to search for.
                         * @param {number} [fromIndex=0] The index to search from.
                         * @returns {number} Returns the index of the matched value or `-1`.
                         */

                        function baseIndexOf(array, value, fromIndex) {
                            var index = (fromIndex || 0) - 1,
                                length = array ? array.length : 0;

                            while (++index < length) {
                                if (array[index] === value) {
                                    return index;
                                }
                            }
                            return -1;
                        }

                        /**
                         * An implementation of `_.contains` for cache objects that mimics the return
                         * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
                         *
                         * @private
                         * @param {Object} cache The cache object to inspect.
                         * @param {*} value The value to search for.
                         * @returns {number} Returns `0` if `value` is found, else `-1`.
                         */

                        function cacheIndexOf(cache, value) {
                            var type = typeof value;
                            cache = cache.cache;

                            if (type == 'boolean' || value == null) {
                                return cache[value] ? 0 : -1;
                            }
                            if (type != 'number' && type != 'string') {
                                type = 'object';
                            }
                            var key = type == 'number' ? value : keyPrefix + value;
                            cache = (cache = cache[type]) && cache[key];

                            return type == 'object' ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1) : (cache ? 0 : -1);
                        }

                        /**
                         * Adds a given value to the corresponding cache object.
                         *
                         * @private
                         * @param {*} value The value to add to the cache.
                         */

                        function cachePush(value) {
                            var cache = this.cache,
                                type = typeof value;

                            if (type == 'boolean' || value == null) {
                                cache[value] = true;
                            } else {
                                if (type != 'number' && type != 'string') {
                                    type = 'object';
                                }
                                var key = type == 'number' ? value : keyPrefix + value,
                                    typeCache = cache[type] || (cache[type] = {});

                                if (type == 'object') {
                                    (typeCache[key] || (typeCache[key] = [])).push(value);
                                } else {
                                    typeCache[key] = true;
                                }
                            }
                        }

                        /**
                         * Used by `_.max` and `_.min` as the default callback when a given
                         * collection is a string value.
                         *
                         * @private
                         * @param {string} value The character to inspect.
                         * @returns {number} Returns the code unit of given character.
                         */

                        function charAtCallback(value) {
                            return value.charCodeAt(0);
                        }

                        /**
                         * Used by `sortBy` to compare transformed `collection` elements, stable sorting
                         * them in ascending order.
                         *
                         * @private
                         * @param {Object} a The object to compare to `b`.
                         * @param {Object} b The object to compare to `a`.
                         * @returns {number} Returns the sort order indicator of `1` or `-1`.
                         */

                        function compareAscending(a, b) {
                            var ac = a.criteria,
                                bc = b.criteria,
                                index = -1,
                                length = ac.length;

                            while (++index < length) {
                                var value = ac[index],
                                    other = bc[index];

                                if (value !== other) {
                                    if (value > other || typeof value == 'undefined') {
                                        return 1;
                                    }
                                    if (value < other || typeof other == 'undefined') {
                                        return -1;
                                    }
                                }
                            }
                            // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
                            // that causes it, under certain circumstances, to return the same value for
                            // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
                            //
                            // This also ensures a stable sort in V8 and other engines.
                            // See http://code.google.com/p/v8/issues/detail?id=90
                            return a.index - b.index;
                        }

                        /**
                         * Creates a cache object to optimize linear searches of large arrays.
                         *
                         * @private
                         * @param {Array} [array=[]] The array to search.
                         * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
                         */

                        function createCache(array) {
                            var index = -1,
                                length = array.length,
                                first = array[0],
                                mid = array[(length / 2) | 0],
                                last = array[length - 1];

                            if (first && typeof first == 'object' &&
                                mid && typeof mid == 'object' && last && typeof last == 'object') {
                                return false;
                            }
                            var cache = getObject();
                            cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

                            var result = getObject();
                            result.array = array;
                            result.cache = cache;
                            result.push = cachePush;

                            while (++index < length) {
                                result.push(array[index]);
                            }
                            return result;
                        }

                        /**
                         * Used by `template` to escape characters for inclusion in compiled
                         * string literals.
                         *
                         * @private
                         * @param {string} match The matched character to escape.
                         * @returns {string} Returns the escaped character.
                         */

                        function escapeStringChar(match) {
                            return '\\' + stringEscapes[match];
                        }

                        /**
                         * Gets an array from the array pool or creates a new one if the pool is empty.
                         *
                         * @private
                         * @returns {Array} The array from the pool.
                         */

                        function getArray() {
                            return arrayPool.pop() || [];
                        }

                        /**
                         * Gets an object from the object pool or creates a new one if the pool is empty.
                         *
                         * @private
                         * @returns {Object} The object from the pool.
                         */

                        function getObject() {
                            return objectPool.pop() || {
                                'array': null,
                                'cache': null,
                                'criteria': null,
                                'false': false,
                                'index': 0,
                                'null': false,
                                'number': null,
                                'object': null,
                                'push': null,
                                'string': null,
                                'true': false,
                                'undefined': false,
                                'value': null
                            };
                        }

                        /**
                         * Releases the given array back to the array pool.
                         *
                         * @private
                         * @param {Array} [array] The array to release.
                         */

                        function releaseArray(array) {
                            array.length = 0;
                            if (arrayPool.length < maxPoolSize) {
                                arrayPool.push(array);
                            }
                        }

                        /**
                         * Releases the given object back to the object pool.
                         *
                         * @private
                         * @param {Object} [object] The object to release.
                         */

                        function releaseObject(object) {
                            var cache = object.cache;
                            if (cache) {
                                releaseObject(cache);
                            }
                            object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
                            if (objectPool.length < maxPoolSize) {
                                objectPool.push(object);
                            }
                        }

                        /**
                         * Slices the `collection` from the `start` index up to, but not including,
                         * the `end` index.
                         *
                         * Note: This function is used instead of `Array#slice` to support node lists
                         * in IE < 9 and to ensure dense arrays are returned.
                         *
                         * @private
                         * @param {Array|Object|string} collection The collection to slice.
                         * @param {number} start The start index.
                         * @param {number} end The end index.
                         * @returns {Array} Returns the new array.
                         */

                        function slice(array, start, end) {
                            start || (start = 0);
                            if (typeof end == 'undefined') {
                                end = array ? array.length : 0;
                            }
                            var index = -1,
                                length = end - start || 0,
                                result = Array(length < 0 ? 0 : length);

                            while (++index < length) {
                                result[index] = array[start + index];
                            }
                            return result;
                        }

                        /*--------------------------------------------------------------------------*/

                        /**
                         * Create a new `lodash` function using the given context object.
                         *
                         * @static
                         * @memberOf _
                         * @category Utilities
                         * @param {Object} [context=root] The context object.
                         * @returns {Function} Returns the `lodash` function.
                         */

                        function runInContext(context) {
                            // Avoid issues with some ES3 environments that attempt to use values, named
                            // after built-in constructors like `Object`, for the creation of literals.
                            // ES5 clears this up by stating that literals must use built-in constructors.
                            // See http://es5.github.io/#x11.1.5.
                            context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

                            /** Native constructor references */
                            var Array = context.Array,
                                Boolean = context.Boolean,
                                Date = context.Date,
                                Function = context.Function,
                                Math = context.Math,
                                Number = context.Number,
                                Object = context.Object,
                                RegExp = context.RegExp,
                                String = context.String,
                                TypeError = context.TypeError;

                            /**
                             * Used for `Array` method references.
                             *
                             * Normally `Array.prototype` would suffice, however, using an array literal
                             * avoids issues in Narwhal.
                             */
                            var arrayRef = [];

                            /** Used for native method references */
                            var objectProto = Object.prototype;

                            /** Used to restore the original `_` reference in `noConflict` */
                            var oldDash = context._;

                            /** Used to resolve the internal [[Class]] of values */
                            var toString = objectProto.toString;

                            /** Used to detect if a method is native */
                            var reNative = RegExp('^' +
                                String(toString)
                                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                                .replace(/toString| for [^\]]+/g, '.*?') + '$'
                            );

                            /** Native method shortcuts */
                            var ceil = Math.ceil,
                                clearTimeout = context.clearTimeout,
                                floor = Math.floor,
                                fnToString = Function.prototype.toString,
                                getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
                                hasOwnProperty = objectProto.hasOwnProperty,
                                push = arrayRef.push,
                                setTimeout = context.setTimeout,
                                splice = arrayRef.splice,
                                unshift = arrayRef.unshift;

                            /** Used to set meta data on functions */
                            var defineProperty = (function() {
                                // IE 8 only accepts DOM elements
                                try {
                                    var o = {},
                                        func = isNative(func = Object.defineProperty) && func,
                                        result = func(o, o, o) && func;
                                } catch (e) {}
                                return result;
                            }());

                            /* Native method shortcuts for methods with the same name as other `lodash` methods */
                            var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
                                nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
                                nativeIsFinite = context.isFinite,
                                nativeIsNaN = context.isNaN,
                                nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
                                nativeMax = Math.max,
                                nativeMin = Math.min,
                                nativeParseInt = context.parseInt,
                                nativeRandom = Math.random;

                            /** Used to lookup a built-in constructor by [[Class]] */
                            var ctorByClass = {};
                            ctorByClass[arrayClass] = Array;
                            ctorByClass[boolClass] = Boolean;
                            ctorByClass[dateClass] = Date;
                            ctorByClass[funcClass] = Function;
                            ctorByClass[objectClass] = Object;
                            ctorByClass[numberClass] = Number;
                            ctorByClass[regexpClass] = RegExp;
                            ctorByClass[stringClass] = String;

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates a `lodash` object which wraps the given value to enable intuitive
                             * method chaining.
                             *
                             * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
                             * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
                             * and `unshift`
                             *
                             * Chaining is supported in custom builds as long as the `value` method is
                             * implicitly or explicitly included in the build.
                             *
                             * The chainable wrapper functions are:
                             * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
                             * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
                             * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
                             * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
                             * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
                             * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
                             * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
                             * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
                             * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
                             * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
                             * and `zip`
                             *
                             * The non-chainable wrapper functions are:
                             * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
                             * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
                             * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
                             * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
                             * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
                             * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
                             * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
                             * `template`, `unescape`, `uniqueId`, and `value`
                             *
                             * The wrapper functions `first` and `last` return wrapped values when `n` is
                             * provided, otherwise they return unwrapped values.
                             *
                             * Explicit chaining can be enabled by using the `_.chain` method.
                             *
                             * @name _
                             * @constructor
                             * @category Chaining
                             * @param {*} value The value to wrap in a `lodash` instance.
                             * @returns {Object} Returns a `lodash` instance.
                             * @example
                             *
                             * var wrapped = _([1, 2, 3]);
                             *
                             * // returns an unwrapped value
                             * wrapped.reduce(function(sum, num) {
                             *   return sum + num;
                             * });
                             * // => 6
                             *
                             * // returns a wrapped value
                             * var squares = wrapped.map(function(num) {
                             *   return num * num;
                             * });
                             *
                             * _.isArray(squares);
                             * // => false
                             *
                             * _.isArray(squares.value());
                             * // => true
                             */

                            function lodash(value) {
                                // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
                                return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__')) ? value : new lodashWrapper(value);
                            }

                            /**
                             * A fast path for creating `lodash` wrapper objects.
                             *
                             * @private
                             * @param {*} value The value to wrap in a `lodash` instance.
                             * @param {boolean} chainAll A flag to enable chaining for all methods
                             * @returns {Object} Returns a `lodash` instance.
                             */

                            function lodashWrapper(value, chainAll) {
                                this.__chain__ = !! chainAll;
                                this.__wrapped__ = value;
                            }
                            // ensure `new lodashWrapper` is an instance of `lodash`
                            lodashWrapper.prototype = lodash.prototype;

                            /**
                             * An object used to flag environments features.
                             *
                             * @static
                             * @memberOf _
                             * @type Object
                             */
                            var support = lodash.support = {};

                            /**
                             * Detect if functions can be decompiled by `Function#toString`
                             * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
                             *
                             * @memberOf _.support
                             * @type boolean
                             */
                            support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

                            /**
                             * Detect if `Function#name` is supported (all but IE).
                             *
                             * @memberOf _.support
                             * @type boolean
                             */
                            support.funcNames = typeof Function.name == 'string';

                            /**
                             * By default, the template delimiters used by Lo-Dash are similar to those in
                             * embedded Ruby (ERB). Change the following template settings to use alternative
                             * delimiters.
                             *
                             * @static
                             * @memberOf _
                             * @type Object
                             */
                            lodash.templateSettings = {

                                /**
                                 * Used to detect `data` property values to be HTML-escaped.
                                 *
                                 * @memberOf _.templateSettings
                                 * @type RegExp
                                 */
                                'escape': /<%-([\s\S]+?)%>/g,

                                /**
                                 * Used to detect code to be evaluated.
                                 *
                                 * @memberOf _.templateSettings
                                 * @type RegExp
                                 */
                                'evaluate': /<%([\s\S]+?)%>/g,

                                /**
                                 * Used to detect `data` property values to inject.
                                 *
                                 * @memberOf _.templateSettings
                                 * @type RegExp
                                 */
                                'interpolate': reInterpolate,

                                /**
                                 * Used to reference the data object in the template text.
                                 *
                                 * @memberOf _.templateSettings
                                 * @type string
                                 */
                                'variable': '',

                                /**
                                 * Used to import variables into the compiled template.
                                 *
                                 * @memberOf _.templateSettings
                                 * @type Object
                                 */
                                'imports': {

                                    /**
                                     * A reference to the `lodash` function.
                                     *
                                     * @memberOf _.templateSettings.imports
                                     * @type Function
                                     */
                                    '_': lodash
                                }
                            };

                            /*--------------------------------------------------------------------------*/

                            /**
                             * The base implementation of `_.bind` that creates the bound function and
                             * sets its meta data.
                             *
                             * @private
                             * @param {Array} bindData The bind data array.
                             * @returns {Function} Returns the new bound function.
                             */

                            function baseBind(bindData) {
                                var func = bindData[0],
                                    partialArgs = bindData[2],
                                    thisArg = bindData[4];

                                function bound() {
                                    // `Function#bind` spec
                                    // http://es5.github.io/#x15.3.4.5
                                    if (partialArgs) {
                                        // avoid `arguments` object deoptimizations by using `slice` instead
                                        // of `Array.prototype.slice.call` and not assigning `arguments` to a
                                        // variable as a ternary expression
                                        var args = slice(partialArgs);
                                        push.apply(args, arguments);
                                    }
                                    // mimic the constructor's `return` behavior
                                    // http://es5.github.io/#x13.2.2
                                    if (this instanceof bound) {
                                        // ensure `new bound` is an instance of `func`
                                        var thisBinding = baseCreate(func.prototype),
                                            result = func.apply(thisBinding, args || arguments);
                                        return isObject(result) ? result : thisBinding;
                                    }
                                    return func.apply(thisArg, args || arguments);
                                }
                                setBindData(bound, bindData);
                                return bound;
                            }

                            /**
                             * The base implementation of `_.clone` without argument juggling or support
                             * for `thisArg` binding.
                             *
                             * @private
                             * @param {*} value The value to clone.
                             * @param {boolean} [isDeep=false] Specify a deep clone.
                             * @param {Function} [callback] The function to customize cloning values.
                             * @param {Array} [stackA=[]] Tracks traversed source objects.
                             * @param {Array} [stackB=[]] Associates clones with source counterparts.
                             * @returns {*} Returns the cloned value.
                             */

                            function baseClone(value, isDeep, callback, stackA, stackB) {
                                if (callback) {
                                    var result = callback(value);
                                    if (typeof result != 'undefined') {
                                        return result;
                                    }
                                }
                                // inspect [[Class]]
                                var isObj = isObject(value);
                                if (isObj) {
                                    var className = toString.call(value);
                                    if (!cloneableClasses[className]) {
                                        return value;
                                    }
                                    var ctor = ctorByClass[className];
                                    switch (className) {
                                        case boolClass:
                                        case dateClass:
                                            return new ctor(+value);

                                        case numberClass:
                                        case stringClass:
                                            return new ctor(value);

                                        case regexpClass:
                                            result = ctor(value.source, reFlags.exec(value));
                                            result.lastIndex = value.lastIndex;
                                            return result;
                                    }
                                } else {
                                    return value;
                                }
                                var isArr = isArray(value);
                                if (isDeep) {
                                    // check for circular references and return corresponding clone
                                    var initedStack = !stackA;
                                    stackA || (stackA = getArray());
                                    stackB || (stackB = getArray());

                                    var length = stackA.length;
                                    while (length--) {
                                        if (stackA[length] == value) {
                                            return stackB[length];
                                        }
                                    }
                                    result = isArr ? ctor(value.length) : {};
                                } else {
                                    result = isArr ? slice(value) : assign({}, value);
                                }
                                // add array properties assigned by `RegExp#exec`
                                if (isArr) {
                                    if (hasOwnProperty.call(value, 'index')) {
                                        result.index = value.index;
                                    }
                                    if (hasOwnProperty.call(value, 'input')) {
                                        result.input = value.input;
                                    }
                                }
                                // exit for shallow clone
                                if (!isDeep) {
                                    return result;
                                }
                                // add the source value to the stack of traversed objects
                                // and associate it with its clone
                                stackA.push(value);
                                stackB.push(result);

                                // recursively populate clone (susceptible to call stack limits)
                                (isArr ? forEach : forOwn)(value, function(objValue, key) {
                                    result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
                                });

                                if (initedStack) {
                                    releaseArray(stackA);
                                    releaseArray(stackB);
                                }
                                return result;
                            }

                            /**
                             * The base implementation of `_.create` without support for assigning
                             * properties to the created object.
                             *
                             * @private
                             * @param {Object} prototype The object to inherit from.
                             * @returns {Object} Returns the new object.
                             */

                            function baseCreate(prototype, properties) {
                                return isObject(prototype) ? nativeCreate(prototype) : {};
                            }
                            // fallback for browsers without `Object.create`
                            if (!nativeCreate) {
                                baseCreate = (function() {
                                    function Object() {}
                                    return function(prototype) {
                                        if (isObject(prototype)) {
                                            Object.prototype = prototype;
                                            var result = new Object;
                                            Object.prototype = null;
                                        }
                                        return result || context.Object();
                                    };
                                }());
                            }

                            /**
                             * The base implementation of `_.createCallback` without support for creating
                             * "_.pluck" or "_.where" style callbacks.
                             *
                             * @private
                             * @param {*} [func=identity] The value to convert to a callback.
                             * @param {*} [thisArg] The `this` binding of the created callback.
                             * @param {number} [argCount] The number of arguments the callback accepts.
                             * @returns {Function} Returns a callback function.
                             */

                            function baseCreateCallback(func, thisArg, argCount) {
                                if (typeof func != 'function') {
                                    return identity;
                                }
                                // exit early for no `thisArg` or already bound by `Function#bind`
                                if (typeof thisArg == 'undefined' || !('prototype' in func)) {
                                    return func;
                                }
                                var bindData = func.__bindData__;
                                if (typeof bindData == 'undefined') {
                                    if (support.funcNames) {
                                        bindData = !func.name;
                                    }
                                    bindData = bindData || !support.funcDecomp;
                                    if (!bindData) {
                                        var source = fnToString.call(func);
                                        if (!support.funcNames) {
                                            bindData = !reFuncName.test(source);
                                        }
                                        if (!bindData) {
                                            // checks if `func` references the `this` keyword and stores the result
                                            bindData = reThis.test(source);
                                            setBindData(func, bindData);
                                        }
                                    }
                                }
                                // exit early if there are no `this` references or `func` is bound
                                if (bindData === false || (bindData !== true && bindData[1] & 1)) {
                                    return func;
                                }
                                switch (argCount) {
                                    case 1:
                                        return function(value) {
                                            return func.call(thisArg, value);
                                        };
                                    case 2:
                                        return function(a, b) {
                                            return func.call(thisArg, a, b);
                                        };
                                    case 3:
                                        return function(value, index, collection) {
                                            return func.call(thisArg, value, index, collection);
                                        };
                                    case 4:
                                        return function(accumulator, value, index, collection) {
                                            return func.call(thisArg, accumulator, value, index, collection);
                                        };
                                }
                                return bind(func, thisArg);
                            }

                            /**
                             * The base implementation of `createWrapper` that creates the wrapper and
                             * sets its meta data.
                             *
                             * @private
                             * @param {Array} bindData The bind data array.
                             * @returns {Function} Returns the new function.
                             */

                            function baseCreateWrapper(bindData) {
                                var func = bindData[0],
                                    bitmask = bindData[1],
                                    partialArgs = bindData[2],
                                    partialRightArgs = bindData[3],
                                    thisArg = bindData[4],
                                    arity = bindData[5];

                                var isBind = bitmask & 1,
                                    isBindKey = bitmask & 2,
                                    isCurry = bitmask & 4,
                                    isCurryBound = bitmask & 8,
                                    key = func;

                                function bound() {
                                    var thisBinding = isBind ? thisArg : this;
                                    if (partialArgs) {
                                        var args = slice(partialArgs);
                                        push.apply(args, arguments);
                                    }
                                    if (partialRightArgs || isCurry) {
                                        args || (args = slice(arguments));
                                        if (partialRightArgs) {
                                            push.apply(args, partialRightArgs);
                                        }
                                        if (isCurry && args.length < arity) {
                                            bitmask |= 16 & ~32;
                                            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
                                        }
                                    }
                                    args || (args = arguments);
                                    if (isBindKey) {
                                        func = thisBinding[key];
                                    }
                                    if (this instanceof bound) {
                                        thisBinding = baseCreate(func.prototype);
                                        var result = func.apply(thisBinding, args);
                                        return isObject(result) ? result : thisBinding;
                                    }
                                    return func.apply(thisBinding, args);
                                }
                                setBindData(bound, bindData);
                                return bound;
                            }

                            /**
                             * The base implementation of `_.difference` that accepts a single array
                             * of values to exclude.
                             *
                             * @private
                             * @param {Array} array The array to process.
                             * @param {Array} [values] The array of values to exclude.
                             * @returns {Array} Returns a new array of filtered values.
                             */

                            function baseDifference(array, values) {
                                var index = -1,
                                    indexOf = getIndexOf(),
                                    length = array ? array.length : 0,
                                    isLarge = length >= largeArraySize && indexOf === baseIndexOf,
                                    result = [];

                                if (isLarge) {
                                    var cache = createCache(values);
                                    if (cache) {
                                        indexOf = cacheIndexOf;
                                        values = cache;
                                    } else {
                                        isLarge = false;
                                    }
                                }
                                while (++index < length) {
                                    var value = array[index];
                                    if (indexOf(values, value) < 0) {
                                        result.push(value);
                                    }
                                }
                                if (isLarge) {
                                    releaseObject(values);
                                }
                                return result;
                            }

                            /**
                             * The base implementation of `_.flatten` without support for callback
                             * shorthands or `thisArg` binding.
                             *
                             * @private
                             * @param {Array} array The array to flatten.
                             * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
                             * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
                             * @param {number} [fromIndex=0] The index to start from.
                             * @returns {Array} Returns a new flattened array.
                             */

                            function baseFlatten(array, isShallow, isStrict, fromIndex) {
                                var index = (fromIndex || 0) - 1,
                                    length = array ? array.length : 0,
                                    result = [];

                                while (++index < length) {
                                    var value = array[index];

                                    if (value && typeof value == 'object' && typeof value.length == 'number' && (isArray(value) || isArguments(value))) {
                                        // recursively flatten arrays (susceptible to call stack limits)
                                        if (!isShallow) {
                                            value = baseFlatten(value, isShallow, isStrict);
                                        }
                                        var valIndex = -1,
                                            valLength = value.length,
                                            resIndex = result.length;

                                        result.length += valLength;
                                        while (++valIndex < valLength) {
                                            result[resIndex++] = value[valIndex];
                                        }
                                    } else if (!isStrict) {
                                        result.push(value);
                                    }
                                }
                                return result;
                            }

                            /**
                             * The base implementation of `_.isEqual`, without support for `thisArg` binding,
                             * that allows partial "_.where" style comparisons.
                             *
                             * @private
                             * @param {*} a The value to compare.
                             * @param {*} b The other value to compare.
                             * @param {Function} [callback] The function to customize comparing values.
                             * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
                             * @param {Array} [stackA=[]] Tracks traversed `a` objects.
                             * @param {Array} [stackB=[]] Tracks traversed `b` objects.
                             * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
                             */

                            function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
                                // used to indicate that when comparing objects, `a` has at least the properties of `b`
                                if (callback) {
                                    var result = callback(a, b);
                                    if (typeof result != 'undefined') {
                                        return !!result;
                                    }
                                }
                                // exit early for identical values
                                if (a === b) {
                                    // treat `+0` vs. `-0` as not equal
                                    return a !== 0 || (1 / a == 1 / b);
                                }
                                var type = typeof a,
                                    otherType = typeof b;

                                // exit early for unlike primitive values
                                if (a === a && !(a && objectTypes[type]) && !(b && objectTypes[otherType])) {
                                    return false;
                                }
                                // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
                                // http://es5.github.io/#x15.3.4.4
                                if (a == null || b == null) {
                                    return a === b;
                                }
                                // compare [[Class]] names
                                var className = toString.call(a),
                                    otherClass = toString.call(b);

                                if (className == argsClass) {
                                    className = objectClass;
                                }
                                if (otherClass == argsClass) {
                                    otherClass = objectClass;
                                }
                                if (className != otherClass) {
                                    return false;
                                }
                                switch (className) {
                                    case boolClass:
                                    case dateClass:
                                        // coerce dates and booleans to numbers, dates to milliseconds and booleans
                                        // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
                                        return +a == +b;

                                    case numberClass:
                                        // treat `NaN` vs. `NaN` as equal
                                        return (a != +a) ? b != +b
                                        // but treat `+0` vs. `-0` as not equal
                                        : (a == 0 ? (1 / a == 1 / b) : a == +b);

                                    case regexpClass:
                                    case stringClass:
                                        // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
                                        // treat string primitives and their corresponding object instances as equal
                                        return a == String(b);
                                }
                                var isArr = className == arrayClass;
                                if (!isArr) {
                                    // unwrap any `lodash` wrapped values
                                    var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
                                        bWrapped = hasOwnProperty.call(b, '__wrapped__');

                                    if (aWrapped || bWrapped) {
                                        return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
                                    }
                                    // exit for functions and DOM nodes
                                    if (className != objectClass) {
                                        return false;
                                    }
                                    // in older versions of Opera, `arguments` objects have `Array` constructors
                                    var ctorA = a.constructor,
                                        ctorB = b.constructor;

                                    // non `Object` object instances with different constructors are not equal
                                    if (ctorA != ctorB && !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
                                        ('constructor' in a && 'constructor' in b)
                                    ) {
                                        return false;
                                    }
                                }
                                // assume cyclic structures are equal
                                // the algorithm for detecting cyclic structures is adapted from ES 5.1
                                // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
                                var initedStack = !stackA;
                                stackA || (stackA = getArray());
                                stackB || (stackB = getArray());

                                var length = stackA.length;
                                while (length--) {
                                    if (stackA[length] == a) {
                                        return stackB[length] == b;
                                    }
                                }
                                var size = 0;
                                result = true;

                                // add `a` and `b` to the stack of traversed objects
                                stackA.push(a);
                                stackB.push(b);

                                // recursively compare objects and arrays (susceptible to call stack limits)
                                if (isArr) {
                                    // compare lengths to determine if a deep comparison is necessary
                                    length = a.length;
                                    size = b.length;
                                    result = size == length;

                                    if (result || isWhere) {
                                        // deep compare the contents, ignoring non-numeric properties
                                        while (size--) {
                                            var index = length,
                                                value = b[size];

                                            if (isWhere) {
                                                while (index--) {
                                                    if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                                                        break;
                                                    }
                                                }
                                            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
                                    // which, in this case, is more costly
                                    forIn(b, function(value, key, b) {
                                        if (hasOwnProperty.call(b, key)) {
                                            // count the number of properties.
                                            size++;
                                            // deep compare each property value.
                                            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
                                        }
                                    });

                                    if (result && !isWhere) {
                                        // ensure both objects have the same number of properties
                                        forIn(a, function(value, key, a) {
                                            if (hasOwnProperty.call(a, key)) {
                                                // `size` will be `-1` if `a` has more properties than `b`
                                                return (result = --size > -1);
                                            }
                                        });
                                    }
                                }
                                stackA.pop();
                                stackB.pop();

                                if (initedStack) {
                                    releaseArray(stackA);
                                    releaseArray(stackB);
                                }
                                return result;
                            }

                            /**
                             * The base implementation of `_.merge` without argument juggling or support
                             * for `thisArg` binding.
                             *
                             * @private
                             * @param {Object} object The destination object.
                             * @param {Object} source The source object.
                             * @param {Function} [callback] The function to customize merging properties.
                             * @param {Array} [stackA=[]] Tracks traversed source objects.
                             * @param {Array} [stackB=[]] Associates values with source counterparts.
                             */

                            function baseMerge(object, source, callback, stackA, stackB) {
                                (isArray(source) ? forEach : forOwn)(source, function(source, key) {
                                    var found,
                                        isArr,
                                        result = source,
                                        value = object[key];

                                    if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
                                        // avoid merging previously merged cyclic sources
                                        var stackLength = stackA.length;
                                        while (stackLength--) {
                                            if ((found = stackA[stackLength] == source)) {
                                                value = stackB[stackLength];
                                                break;
                                            }
                                        }
                                        if (!found) {
                                            var isShallow;
                                            if (callback) {
                                                result = callback(value, source);
                                                if ((isShallow = typeof result != 'undefined')) {
                                                    value = result;
                                                }
                                            }
                                            if (!isShallow) {
                                                value = isArr ? (isArray(value) ? value : []) : (isPlainObject(value) ? value : {});
                                            }
                                            // add `source` and associated `value` to the stack of traversed objects
                                            stackA.push(source);
                                            stackB.push(value);

                                            // recursively merge objects and arrays (susceptible to call stack limits)
                                            if (!isShallow) {
                                                baseMerge(value, source, callback, stackA, stackB);
                                            }
                                        }
                                    } else {
                                        if (callback) {
                                            result = callback(value, source);
                                            if (typeof result == 'undefined') {
                                                result = source;
                                            }
                                        }
                                        if (typeof result != 'undefined') {
                                            value = result;
                                        }
                                    }
                                    object[key] = value;
                                });
                            }

                            /**
                             * The base implementation of `_.random` without argument juggling or support
                             * for returning floating-point numbers.
                             *
                             * @private
                             * @param {number} min The minimum possible value.
                             * @param {number} max The maximum possible value.
                             * @returns {number} Returns a random number.
                             */

                            function baseRandom(min, max) {
                                return min + floor(nativeRandom() * (max - min + 1));
                            }

                            /**
                             * The base implementation of `_.uniq` without support for callback shorthands
                             * or `thisArg` binding.
                             *
                             * @private
                             * @param {Array} array The array to process.
                             * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
                             * @param {Function} [callback] The function called per iteration.
                             * @returns {Array} Returns a duplicate-value-free array.
                             */

                            function baseUniq(array, isSorted, callback) {
                                var index = -1,
                                    indexOf = getIndexOf(),
                                    length = array ? array.length : 0,
                                    result = [];

                                var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
                                    seen = (callback || isLarge) ? getArray() : result;

                                if (isLarge) {
                                    var cache = createCache(seen);
                                    indexOf = cacheIndexOf;
                                    seen = cache;
                                }
                                while (++index < length) {
                                    var value = array[index],
                                        computed = callback ? callback(value, index, array) : value;

                                    if (isSorted ? !index || seen[seen.length - 1] !== computed : indexOf(seen, computed) < 0) {
                                        if (callback || isLarge) {
                                            seen.push(computed);
                                        }
                                        result.push(value);
                                    }
                                }
                                if (isLarge) {
                                    releaseArray(seen.array);
                                    releaseObject(seen);
                                } else if (callback) {
                                    releaseArray(seen);
                                }
                                return result;
                            }

                            /**
                             * Creates a function that aggregates a collection, creating an object composed
                             * of keys generated from the results of running each element of the collection
                             * through a callback. The given `setter` function sets the keys and values
                             * of the composed object.
                             *
                             * @private
                             * @param {Function} setter The setter function.
                             * @returns {Function} Returns the new aggregator function.
                             */

                            function createAggregator(setter) {
                                return function(collection, callback, thisArg) {
                                    var result = {};
                                    callback = lodash.createCallback(callback, thisArg, 3);

                                    var index = -1,
                                        length = collection ? collection.length : 0;

                                    if (typeof length == 'number') {
                                        while (++index < length) {
                                            var value = collection[index];
                                            setter(result, value, callback(value, index, collection), collection);
                                        }
                                    } else {
                                        forOwn(collection, function(value, key, collection) {
                                            setter(result, value, callback(value, key, collection), collection);
                                        });
                                    }
                                    return result;
                                };
                            }

                            /**
                             * Creates a function that, when called, either curries or invokes `func`
                             * with an optional `this` binding and partially applied arguments.
                             *
                             * @private
                             * @param {Function|string} func The function or method name to reference.
                             * @param {number} bitmask The bitmask of method flags to compose.
                             *  The bitmask may be composed of the following flags:
                             *  1 - `_.bind`
                             *  2 - `_.bindKey`
                             *  4 - `_.curry`
                             *  8 - `_.curry` (bound)
                             *  16 - `_.partial`
                             *  32 - `_.partialRight`
                             * @param {Array} [partialArgs] An array of arguments to prepend to those
                             *  provided to the new function.
                             * @param {Array} [partialRightArgs] An array of arguments to append to those
                             *  provided to the new function.
                             * @param {*} [thisArg] The `this` binding of `func`.
                             * @param {number} [arity] The arity of `func`.
                             * @returns {Function} Returns the new function.
                             */

                            function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
                                var isBind = bitmask & 1,
                                    isBindKey = bitmask & 2,
                                    isCurry = bitmask & 4,
                                    isCurryBound = bitmask & 8,
                                    isPartial = bitmask & 16,
                                    isPartialRight = bitmask & 32;

                                if (!isBindKey && !isFunction(func)) {
                                    throw new TypeError;
                                }
                                if (isPartial && !partialArgs.length) {
                                    bitmask &= ~16;
                                    isPartial = partialArgs = false;
                                }
                                if (isPartialRight && !partialRightArgs.length) {
                                    bitmask &= ~32;
                                    isPartialRight = partialRightArgs = false;
                                }
                                var bindData = func && func.__bindData__;
                                if (bindData && bindData !== true) {
                                    // clone `bindData`
                                    bindData = slice(bindData);
                                    if (bindData[2]) {
                                        bindData[2] = slice(bindData[2]);
                                    }
                                    if (bindData[3]) {
                                        bindData[3] = slice(bindData[3]);
                                    }
                                    // set `thisBinding` is not previously bound
                                    if (isBind && !(bindData[1] & 1)) {
                                        bindData[4] = thisArg;
                                    }
                                    // set if previously bound but not currently (subsequent curried functions)
                                    if (!isBind && bindData[1] & 1) {
                                        bitmask |= 8;
                                    }
                                    // set curried arity if not yet set
                                    if (isCurry && !(bindData[1] & 4)) {
                                        bindData[5] = arity;
                                    }
                                    // append partial left arguments
                                    if (isPartial) {
                                        push.apply(bindData[2] || (bindData[2] = []), partialArgs);
                                    }
                                    // append partial right arguments
                                    if (isPartialRight) {
                                        unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
                                    }
                                    // merge flags
                                    bindData[1] |= bitmask;
                                    return createWrapper.apply(null, bindData);
                                }
                                // fast path for `_.bind`
                                var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
                                return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
                            }

                            /**
                             * Used by `escape` to convert characters to HTML entities.
                             *
                             * @private
                             * @param {string} match The matched character to escape.
                             * @returns {string} Returns the escaped character.
                             */

                            function escapeHtmlChar(match) {
                                return htmlEscapes[match];
                            }

                            /**
                             * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
                             * customized, this method returns the custom method, otherwise it returns
                             * the `baseIndexOf` function.
                             *
                             * @private
                             * @returns {Function} Returns the "indexOf" function.
                             */

                            function getIndexOf() {
                                var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
                                return result;
                            }

                            /**
                             * Checks if `value` is a native function.
                             *
                             * @private
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
                             */

                            function isNative(value) {
                                return typeof value == 'function' && reNative.test(value);
                            }

                            /**
                             * Sets `this` binding data on a given function.
                             *
                             * @private
                             * @param {Function} func The function to set data on.
                             * @param {Array} value The data array to set.
                             */
                            var setBindData = !defineProperty ? noop : function(func, value) {
                                    descriptor.value = value;
                                    defineProperty(func, '__bindData__', descriptor);
                                };

                            /**
                             * A fallback implementation of `isPlainObject` which checks if a given value
                             * is an object created by the `Object` constructor, assuming objects created
                             * by the `Object` constructor have no inherited enumerable properties and that
                             * there are no `Object.prototype` extensions.
                             *
                             * @private
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
                             */

                            function shimIsPlainObject(value) {
                                var ctor,
                                    result;

                                // avoid non Object objects, `arguments` objects, and DOM elements
                                if (!(value && toString.call(value) == objectClass) ||
                                    (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
                                    return false;
                                }
                                // In most environments an object's own properties are iterated before
                                // its inherited properties. If the last iterated property is an object's
                                // own property then there are no inherited enumerable properties.
                                forIn(value, function(value, key) {
                                    result = key;
                                });
                                return typeof result == 'undefined' || hasOwnProperty.call(value, result);
                            }

                            /**
                             * Used by `unescape` to convert HTML entities to characters.
                             *
                             * @private
                             * @param {string} match The matched character to unescape.
                             * @returns {string} Returns the unescaped character.
                             */

                            function unescapeHtmlChar(match) {
                                return htmlUnescapes[match];
                            }

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Checks if `value` is an `arguments` object.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
                             * @example
                             *
                             * (function() { return _.isArguments(arguments); })(1, 2, 3);
                             * // => true
                             *
                             * _.isArguments([1, 2, 3]);
                             * // => false
                             */

                            function isArguments(value) {
                                return value && typeof value == 'object' && typeof value.length == 'number' &&
                                    toString.call(value) == argsClass || false;
                            }

                            /**
                             * Checks if `value` is an array.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
                             * @example
                             *
                             * (function() { return _.isArray(arguments); })();
                             * // => false
                             *
                             * _.isArray([1, 2, 3]);
                             * // => true
                             */
                            var isArray = nativeIsArray || function(value) {
                                    return value && typeof value == 'object' && typeof value.length == 'number' &&
                                        toString.call(value) == arrayClass || false;
                                };

                            /**
                             * A fallback implementation of `Object.keys` which produces an array of the
                             * given object's own enumerable property names.
                             *
                             * @private
                             * @type Function
                             * @param {Object} object The object to inspect.
                             * @returns {Array} Returns an array of property names.
                             */
                            var shimKeys = function(object) {
                                var index, iterable = object,
                                    result = [];
                                if (!iterable) return result;
                                if (!(objectTypes[typeof object])) return result;
                                for (index in iterable) {
                                    if (hasOwnProperty.call(iterable, index)) {
                                        result.push(index);
                                    }
                                }
                                return result
                            };

                            /**
                             * Creates an array composed of the own enumerable property names of an object.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to inspect.
                             * @returns {Array} Returns an array of property names.
                             * @example
                             *
                             * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
                             * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
                             */
                            var keys = !nativeKeys ? shimKeys : function(object) {
                                    if (!isObject(object)) {
                                        return [];
                                    }
                                    return nativeKeys(object);
                                };

                            /**
                             * Used to convert characters to HTML entities:
                             *
                             * Though the `>` character is escaped for symmetry, characters like `>` and `/`
                             * don't require escaping in HTML and have no special meaning unless they're part
                             * of a tag or an unquoted attribute value.
                             * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
                             */
                            var htmlEscapes = {
                                '&': '&amp;',
                                '<': '&lt;',
                                '>': '&gt;',
                                '"': '&quot;',
                                "'": '&#39;'
                            };

                            /** Used to convert HTML entities to characters */
                            var htmlUnescapes = invert(htmlEscapes);

                            /** Used to match HTML entities and HTML characters */
                            var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
                                reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Assigns own enumerable properties of source object(s) to the destination
                             * object. Subsequent sources will overwrite property assignments of previous
                             * sources. If a callback is provided it will be executed to produce the
                             * assigned values. The callback is bound to `thisArg` and invoked with two
                             * arguments; (objectValue, sourceValue).
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @alias extend
                             * @category Objects
                             * @param {Object} object The destination object.
                             * @param {...Object} [source] The source objects.
                             * @param {Function} [callback] The function to customize assigning values.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns the destination object.
                             * @example
                             *
                             * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
                             * // => { 'name': 'fred', 'employer': 'slate' }
                             *
                             * var defaults = _.partialRight(_.assign, function(a, b) {
                             *   return typeof a == 'undefined' ? b : a;
                             * });
                             *
                             * var object = { 'name': 'barney' };
                             * defaults(object, { 'name': 'fred', 'employer': 'slate' });
                             * // => { 'name': 'barney', 'employer': 'slate' }
                             */
                            var assign = function(object, source, guard) {
                                var index, iterable = object,
                                    result = iterable;
                                if (!iterable) return result;
                                var args = arguments,
                                    argsIndex = 0,
                                    argsLength = typeof guard == 'number' ? 2 : args.length;
                                if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
                                    var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
                                } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
                                    callback = args[--argsLength];
                                }
                                while (++argsIndex < argsLength) {
                                    iterable = args[argsIndex];
                                    if (iterable && objectTypes[typeof iterable]) {
                                        var ownIndex = -1,
                                            ownProps = objectTypes[typeof iterable] && keys(iterable),
                                            length = ownProps ? ownProps.length : 0;

                                        while (++ownIndex < length) {
                                            index = ownProps[ownIndex];
                                            result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
                                        }
                                    }
                                }
                                return result
                            };

                            /**
                             * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
                             * be cloned, otherwise they will be assigned by reference. If a callback
                             * is provided it will be executed to produce the cloned values. If the
                             * callback returns `undefined` cloning will be handled by the method instead.
                             * The callback is bound to `thisArg` and invoked with one argument; (value).
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to clone.
                             * @param {boolean} [isDeep=false] Specify a deep clone.
                             * @param {Function} [callback] The function to customize cloning values.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the cloned value.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * var shallow = _.clone(characters);
                             * shallow[0] === characters[0];
                             * // => true
                             *
                             * var deep = _.clone(characters, true);
                             * deep[0] === characters[0];
                             * // => false
                             *
                             * _.mixin({
                             *   'clone': _.partialRight(_.clone, function(value) {
                             *     return _.isElement(value) ? value.cloneNode(false) : undefined;
                             *   })
                             * });
                             *
                             * var clone = _.clone(document.body);
                             * clone.childNodes.length;
                             * // => 0
                             */

                            function clone(value, isDeep, callback, thisArg) {
                                // allows working with "Collections" methods without using their `index`
                                // and `collection` arguments for `isDeep` and `callback`
                                if (typeof isDeep != 'boolean' && isDeep != null) {
                                    thisArg = callback;
                                    callback = isDeep;
                                    isDeep = false;
                                }
                                return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
                            }

                            /**
                             * Creates a deep clone of `value`. If a callback is provided it will be
                             * executed to produce the cloned values. If the callback returns `undefined`
                             * cloning will be handled by the method instead. The callback is bound to
                             * `thisArg` and invoked with one argument; (value).
                             *
                             * Note: This method is loosely based on the structured clone algorithm. Functions
                             * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
                             * objects created by constructors other than `Object` are cloned to plain `Object` objects.
                             * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to deep clone.
                             * @param {Function} [callback] The function to customize cloning values.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the deep cloned value.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * var deep = _.cloneDeep(characters);
                             * deep[0] === characters[0];
                             * // => false
                             *
                             * var view = {
                             *   'label': 'docs',
                             *   'node': element
                             * };
                             *
                             * var clone = _.cloneDeep(view, function(value) {
                             *   return _.isElement(value) ? value.cloneNode(true) : undefined;
                             * });
                             *
                             * clone.node == view.node;
                             * // => false
                             */

                            function cloneDeep(value, callback, thisArg) {
                                return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
                            }

                            /**
                             * Creates an object that inherits from the given `prototype` object. If a
                             * `properties` object is provided its own enumerable properties are assigned
                             * to the created object.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} prototype The object to inherit from.
                             * @param {Object} [properties] The properties to assign to the object.
                             * @returns {Object} Returns the new object.
                             * @example
                             *
                             * function Shape() {
                             *   this.x = 0;
                             *   this.y = 0;
                             * }
                             *
                             * function Circle() {
                             *   Shape.call(this);
                             * }
                             *
                             * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
                             *
                             * var circle = new Circle;
                             * circle instanceof Circle;
                             * // => true
                             *
                             * circle instanceof Shape;
                             * // => true
                             */

                            function create(prototype, properties) {
                                var result = baseCreate(prototype);
                                return properties ? assign(result, properties) : result;
                            }

                            /**
                             * Assigns own enumerable properties of source object(s) to the destination
                             * object for all destination properties that resolve to `undefined`. Once a
                             * property is set, additional defaults of the same property will be ignored.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Objects
                             * @param {Object} object The destination object.
                             * @param {...Object} [source] The source objects.
                             * @param- {Object} [guard] Allows working with `_.reduce` without using its
                             *  `key` and `object` arguments as sources.
                             * @returns {Object} Returns the destination object.
                             * @example
                             *
                             * var object = { 'name': 'barney' };
                             * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
                             * // => { 'name': 'barney', 'employer': 'slate' }
                             */
                            var defaults = function(object, source, guard) {
                                var index, iterable = object,
                                    result = iterable;
                                if (!iterable) return result;
                                var args = arguments,
                                    argsIndex = 0,
                                    argsLength = typeof guard == 'number' ? 2 : args.length;
                                while (++argsIndex < argsLength) {
                                    iterable = args[argsIndex];
                                    if (iterable && objectTypes[typeof iterable]) {
                                        var ownIndex = -1,
                                            ownProps = objectTypes[typeof iterable] && keys(iterable),
                                            length = ownProps ? ownProps.length : 0;

                                        while (++ownIndex < length) {
                                            index = ownProps[ownIndex];
                                            if (typeof result[index] == 'undefined') result[index] = iterable[index];
                                        }
                                    }
                                }
                                return result
                            };

                            /**
                             * This method is like `_.findIndex` except that it returns the key of the
                             * first element that passes the callback check, instead of the element itself.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to search.
                             * @param {Function|Object|string} [callback=identity] The function called per
                             *  iteration. If a property name or object is provided it will be used to
                             *  create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {string|undefined} Returns the key of the found element, else `undefined`.
                             * @example
                             *
                             * var characters = {
                             *   'barney': {  'age': 36, 'blocked': false },
                             *   'fred': {    'age': 40, 'blocked': true },
                             *   'pebbles': { 'age': 1,  'blocked': false }
                             * };
                             *
                             * _.findKey(characters, function(chr) {
                             *   return chr.age < 40;
                             * });
                             * // => 'barney' (property order is not guaranteed across environments)
                             *
                             * // using "_.where" callback shorthand
                             * _.findKey(characters, { 'age': 1 });
                             * // => 'pebbles'
                             *
                             * // using "_.pluck" callback shorthand
                             * _.findKey(characters, 'blocked');
                             * // => 'fred'
                             */

                            function findKey(object, callback, thisArg) {
                                var result;
                                callback = lodash.createCallback(callback, thisArg, 3);
                                forOwn(object, function(value, key, object) {
                                    if (callback(value, key, object)) {
                                        result = key;
                                        return false;
                                    }
                                });
                                return result;
                            }

                            /**
                             * This method is like `_.findKey` except that it iterates over elements
                             * of a `collection` in the opposite order.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to search.
                             * @param {Function|Object|string} [callback=identity] The function called per
                             *  iteration. If a property name or object is provided it will be used to
                             *  create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {string|undefined} Returns the key of the found element, else `undefined`.
                             * @example
                             *
                             * var characters = {
                             *   'barney': {  'age': 36, 'blocked': true },
                             *   'fred': {    'age': 40, 'blocked': false },
                             *   'pebbles': { 'age': 1,  'blocked': true }
                             * };
                             *
                             * _.findLastKey(characters, function(chr) {
                             *   return chr.age < 40;
                             * });
                             * // => returns `pebbles`, assuming `_.findKey` returns `barney`
                             *
                             * // using "_.where" callback shorthand
                             * _.findLastKey(characters, { 'age': 40 });
                             * // => 'fred'
                             *
                             * // using "_.pluck" callback shorthand
                             * _.findLastKey(characters, 'blocked');
                             * // => 'pebbles'
                             */

                            function findLastKey(object, callback, thisArg) {
                                var result;
                                callback = lodash.createCallback(callback, thisArg, 3);
                                forOwnRight(object, function(value, key, object) {
                                    if (callback(value, key, object)) {
                                        result = key;
                                        return false;
                                    }
                                });
                                return result;
                            }

                            /**
                             * Iterates over own and inherited enumerable properties of an object,
                             * executing the callback for each property. The callback is bound to `thisArg`
                             * and invoked with three arguments; (value, key, object). Callbacks may exit
                             * iteration early by explicitly returning `false`.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Objects
                             * @param {Object} object The object to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns `object`.
                             * @example
                             *
                             * function Shape() {
                             *   this.x = 0;
                             *   this.y = 0;
                             * }
                             *
                             * Shape.prototype.move = function(x, y) {
                             *   this.x += x;
                             *   this.y += y;
                             * };
                             *
                             * _.forIn(new Shape, function(value, key) {
                             *   console.log(key);
                             * });
                             * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
                             */
                            var forIn = function(collection, callback, thisArg) {
                                var index, iterable = collection,
                                    result = iterable;
                                if (!iterable) return result;
                                if (!objectTypes[typeof iterable]) return result;
                                callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
                                for (index in iterable) {
                                    if (callback(iterable[index], index, collection) === false) return result;
                                }
                                return result
                            };

                            /**
                             * This method is like `_.forIn` except that it iterates over elements
                             * of a `collection` in the opposite order.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns `object`.
                             * @example
                             *
                             * function Shape() {
                             *   this.x = 0;
                             *   this.y = 0;
                             * }
                             *
                             * Shape.prototype.move = function(x, y) {
                             *   this.x += x;
                             *   this.y += y;
                             * };
                             *
                             * _.forInRight(new Shape, function(value, key) {
                             *   console.log(key);
                             * });
                             * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
                             */

                            function forInRight(object, callback, thisArg) {
                                var pairs = [];

                                forIn(object, function(value, key) {
                                    pairs.push(key, value);
                                });

                                var length = pairs.length;
                                callback = baseCreateCallback(callback, thisArg, 3);
                                while (length--) {
                                    if (callback(pairs[length--], pairs[length], object) === false) {
                                        break;
                                    }
                                }
                                return object;
                            }

                            /**
                             * Iterates over own enumerable properties of an object, executing the callback
                             * for each property. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, key, object). Callbacks may exit iteration early by
                             * explicitly returning `false`.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Objects
                             * @param {Object} object The object to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns `object`.
                             * @example
                             *
                             * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
                             *   console.log(key);
                             * });
                             * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
                             */
                            var forOwn = function(collection, callback, thisArg) {
                                var index, iterable = collection,
                                    result = iterable;
                                if (!iterable) return result;
                                if (!objectTypes[typeof iterable]) return result;
                                callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
                                var ownIndex = -1,
                                    ownProps = objectTypes[typeof iterable] && keys(iterable),
                                    length = ownProps ? ownProps.length : 0;

                                while (++ownIndex < length) {
                                    index = ownProps[ownIndex];
                                    if (callback(iterable[index], index, collection) === false) return result;
                                }
                                return result
                            };

                            /**
                             * This method is like `_.forOwn` except that it iterates over elements
                             * of a `collection` in the opposite order.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns `object`.
                             * @example
                             *
                             * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
                             *   console.log(key);
                             * });
                             * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
                             */

                            function forOwnRight(object, callback, thisArg) {
                                var props = keys(object),
                                    length = props.length;

                                callback = baseCreateCallback(callback, thisArg, 3);
                                while (length--) {
                                    var key = props[length];
                                    if (callback(object[key], key, object) === false) {
                                        break;
                                    }
                                }
                                return object;
                            }

                            /**
                             * Creates a sorted array of property names of all enumerable properties,
                             * own and inherited, of `object` that have function values.
                             *
                             * @static
                             * @memberOf _
                             * @alias methods
                             * @category Objects
                             * @param {Object} object The object to inspect.
                             * @returns {Array} Returns an array of property names that have function values.
                             * @example
                             *
                             * _.functions(_);
                             * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
                             */

                            function functions(object) {
                                var result = [];
                                forIn(object, function(value, key) {
                                    if (isFunction(value)) {
                                        result.push(key);
                                    }
                                });
                                return result.sort();
                            }

                            /**
                             * Checks if the specified property name exists as a direct property of `object`,
                             * instead of an inherited property.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to inspect.
                             * @param {string} key The name of the property to check.
                             * @returns {boolean} Returns `true` if key is a direct property, else `false`.
                             * @example
                             *
                             * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
                             * // => true
                             */

                            function has(object, key) {
                                return object ? hasOwnProperty.call(object, key) : false;
                            }

                            /**
                             * Creates an object composed of the inverted keys and values of the given object.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to invert.
                             * @returns {Object} Returns the created inverted object.
                             * @example
                             *
                             * _.invert({ 'first': 'fred', 'second': 'barney' });
                             * // => { 'fred': 'first', 'barney': 'second' }
                             */

                            function invert(object) {
                                var index = -1,
                                    props = keys(object),
                                    length = props.length,
                                    result = {};

                                while (++index < length) {
                                    var key = props[index];
                                    result[object[key]] = key;
                                }
                                return result;
                            }

                            /**
                             * Checks if `value` is a boolean value.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
                             * @example
                             *
                             * _.isBoolean(null);
                             * // => false
                             */

                            function isBoolean(value) {
                                return value === true || value === false ||
                                    value && typeof value == 'object' && toString.call(value) == boolClass || false;
                            }

                            /**
                             * Checks if `value` is a date.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
                             * @example
                             *
                             * _.isDate(new Date);
                             * // => true
                             */

                            function isDate(value) {
                                return value && typeof value == 'object' && toString.call(value) == dateClass || false;
                            }

                            /**
                             * Checks if `value` is a DOM element.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
                             * @example
                             *
                             * _.isElement(document.body);
                             * // => true
                             */

                            function isElement(value) {
                                return value && value.nodeType === 1 || false;
                            }

                            /**
                             * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
                             * length of `0` and objects with no own enumerable properties are considered
                             * "empty".
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Array|Object|string} value The value to inspect.
                             * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
                             * @example
                             *
                             * _.isEmpty([1, 2, 3]);
                             * // => false
                             *
                             * _.isEmpty({});
                             * // => true
                             *
                             * _.isEmpty('');
                             * // => true
                             */

                            function isEmpty(value) {
                                var result = true;
                                if (!value) {
                                    return result;
                                }
                                var className = toString.call(value),
                                    length = value.length;

                                if ((className == arrayClass || className == stringClass || className == argsClass) ||
                                    (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
                                    return !length;
                                }
                                forOwn(value, function() {
                                    return (result = false);
                                });
                                return result;
                            }

                            /**
                             * Performs a deep comparison between two values to determine if they are
                             * equivalent to each other. If a callback is provided it will be executed
                             * to compare values. If the callback returns `undefined` comparisons will
                             * be handled by the method instead. The callback is bound to `thisArg` and
                             * invoked with two arguments; (a, b).
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} a The value to compare.
                             * @param {*} b The other value to compare.
                             * @param {Function} [callback] The function to customize comparing values.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
                             * @example
                             *
                             * var object = { 'name': 'fred' };
                             * var copy = { 'name': 'fred' };
                             *
                             * object == copy;
                             * // => false
                             *
                             * _.isEqual(object, copy);
                             * // => true
                             *
                             * var words = ['hello', 'goodbye'];
                             * var otherWords = ['hi', 'goodbye'];
                             *
                             * _.isEqual(words, otherWords, function(a, b) {
                             *   var reGreet = /^(?:hello|hi)$/i,
                             *       aGreet = _.isString(a) && reGreet.test(a),
                             *       bGreet = _.isString(b) && reGreet.test(b);
                             *
                             *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
                             * });
                             * // => true
                             */

                            function isEqual(a, b, callback, thisArg) {
                                return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
                            }

                            /**
                             * Checks if `value` is, or can be coerced to, a finite number.
                             *
                             * Note: This is not the same as native `isFinite` which will return true for
                             * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
                             * @example
                             *
                             * _.isFinite(-101);
                             * // => true
                             *
                             * _.isFinite('10');
                             * // => true
                             *
                             * _.isFinite(true);
                             * // => false
                             *
                             * _.isFinite('');
                             * // => false
                             *
                             * _.isFinite(Infinity);
                             * // => false
                             */

                            function isFinite(value) {
                                return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
                            }

                            /**
                             * Checks if `value` is a function.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
                             * @example
                             *
                             * _.isFunction(_);
                             * // => true
                             */

                            function isFunction(value) {
                                return typeof value == 'function';
                            }

                            /**
                             * Checks if `value` is the language type of Object.
                             * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
                             * @example
                             *
                             * _.isObject({});
                             * // => true
                             *
                             * _.isObject([1, 2, 3]);
                             * // => true
                             *
                             * _.isObject(1);
                             * // => false
                             */

                            function isObject(value) {
                                // check if the value is the ECMAScript language type of Object
                                // http://es5.github.io/#x8
                                // and avoid a V8 bug
                                // http://code.google.com/p/v8/issues/detail?id=2291
                                return !!(value && objectTypes[typeof value]);
                            }

                            /**
                             * Checks if `value` is `NaN`.
                             *
                             * Note: This is not the same as native `isNaN` which will return `true` for
                             * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
                             * @example
                             *
                             * _.isNaN(NaN);
                             * // => true
                             *
                             * _.isNaN(new Number(NaN));
                             * // => true
                             *
                             * isNaN(undefined);
                             * // => true
                             *
                             * _.isNaN(undefined);
                             * // => false
                             */

                            function isNaN(value) {
                                // `NaN` as a primitive is the only value that is not equal to itself
                                // (perform the [[Class]] check first to avoid errors with some host objects in IE)
                                return isNumber(value) && value != +value;
                            }

                            /**
                             * Checks if `value` is `null`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
                             * @example
                             *
                             * _.isNull(null);
                             * // => true
                             *
                             * _.isNull(undefined);
                             * // => false
                             */

                            function isNull(value) {
                                return value === null;
                            }

                            /**
                             * Checks if `value` is a number.
                             *
                             * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
                             * @example
                             *
                             * _.isNumber(8.4 * 5);
                             * // => true
                             */

                            function isNumber(value) {
                                return typeof value == 'number' ||
                                    value && typeof value == 'object' && toString.call(value) == numberClass || false;
                            }

                            /**
                             * Checks if `value` is an object created by the `Object` constructor.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
                             * @example
                             *
                             * function Shape() {
                             *   this.x = 0;
                             *   this.y = 0;
                             * }
                             *
                             * _.isPlainObject(new Shape);
                             * // => false
                             *
                             * _.isPlainObject([1, 2, 3]);
                             * // => false
                             *
                             * _.isPlainObject({ 'x': 0, 'y': 0 });
                             * // => true
                             */
                            var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
                                    if (!(value && toString.call(value) == objectClass)) {
                                        return false;
                                    }
                                    var valueOf = value.valueOf,
                                        objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

                                    return objProto ? (value == objProto || getPrototypeOf(value) == objProto) : shimIsPlainObject(value);
                                };

                            /**
                             * Checks if `value` is a regular expression.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
                             * @example
                             *
                             * _.isRegExp(/fred/);
                             * // => true
                             */

                            function isRegExp(value) {
                                return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
                            }

                            /**
                             * Checks if `value` is a string.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
                             * @example
                             *
                             * _.isString('fred');
                             * // => true
                             */

                            function isString(value) {
                                return typeof value == 'string' ||
                                    value && typeof value == 'object' && toString.call(value) == stringClass || false;
                            }

                            /**
                             * Checks if `value` is `undefined`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {*} value The value to check.
                             * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
                             * @example
                             *
                             * _.isUndefined(void 0);
                             * // => true
                             */

                            function isUndefined(value) {
                                return typeof value == 'undefined';
                            }

                            /**
                             * Creates an object with the same keys as `object` and values generated by
                             * running each own enumerable property of `object` through the callback.
                             * The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, key, object).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new object with values of the results of each `callback` execution.
                             * @example
                             *
                             * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
                             * // => { 'a': 3, 'b': 6, 'c': 9 }
                             *
                             * var characters = {
                             *   'fred': { 'name': 'fred', 'age': 40 },
                             *   'pebbles': { 'name': 'pebbles', 'age': 1 }
                             * };
                             *
                             * // using "_.pluck" callback shorthand
                             * _.mapValues(characters, 'age');
                             * // => { 'fred': 40, 'pebbles': 1 }
                             */

                            function mapValues(object, callback, thisArg) {
                                var result = {};
                                callback = lodash.createCallback(callback, thisArg, 3);

                                forOwn(object, function(value, key, object) {
                                    result[key] = callback(value, key, object);
                                });
                                return result;
                            }

                            /**
                             * Recursively merges own enumerable properties of the source object(s), that
                             * don't resolve to `undefined` into the destination object. Subsequent sources
                             * will overwrite property assignments of previous sources. If a callback is
                             * provided it will be executed to produce the merged values of the destination
                             * and source properties. If the callback returns `undefined` merging will
                             * be handled by the method instead. The callback is bound to `thisArg` and
                             * invoked with two arguments; (objectValue, sourceValue).
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The destination object.
                             * @param {...Object} [source] The source objects.
                             * @param {Function} [callback] The function to customize merging properties.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns the destination object.
                             * @example
                             *
                             * var names = {
                             *   'characters': [
                             *     { 'name': 'barney' },
                             *     { 'name': 'fred' }
                             *   ]
                             * };
                             *
                             * var ages = {
                             *   'characters': [
                             *     { 'age': 36 },
                             *     { 'age': 40 }
                             *   ]
                             * };
                             *
                             * _.merge(names, ages);
                             * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
                             *
                             * var food = {
                             *   'fruits': ['apple'],
                             *   'vegetables': ['beet']
                             * };
                             *
                             * var otherFood = {
                             *   'fruits': ['banana'],
                             *   'vegetables': ['carrot']
                             * };
                             *
                             * _.merge(food, otherFood, function(a, b) {
                             *   return _.isArray(a) ? a.concat(b) : undefined;
                             * });
                             * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
                             */

                            function merge(object) {
                                var args = arguments,
                                    length = 2;

                                if (!isObject(object)) {
                                    return object;
                                }
                                // allows working with `_.reduce` and `_.reduceRight` without using
                                // their `index` and `collection` arguments
                                if (typeof args[2] != 'number') {
                                    length = args.length;
                                }
                                if (length > 3 && typeof args[length - 2] == 'function') {
                                    var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
                                } else if (length > 2 && typeof args[length - 1] == 'function') {
                                    callback = args[--length];
                                }
                                var sources = slice(arguments, 1, length),
                                    index = -1,
                                    stackA = getArray(),
                                    stackB = getArray();

                                while (++index < length) {
                                    baseMerge(object, sources[index], callback, stackA, stackB);
                                }
                                releaseArray(stackA);
                                releaseArray(stackB);
                                return object;
                            }

                            /**
                             * Creates a shallow clone of `object` excluding the specified properties.
                             * Property names may be specified as individual arguments or as arrays of
                             * property names. If a callback is provided it will be executed for each
                             * property of `object` omitting the properties the callback returns truey
                             * for. The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, key, object).
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The source object.
                             * @param {Function|...string|string[]} [callback] The properties to omit or the
                             *  function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns an object without the omitted properties.
                             * @example
                             *
                             * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
                             * // => { 'name': 'fred' }
                             *
                             * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
                             *   return typeof value == 'number';
                             * });
                             * // => { 'name': 'fred' }
                             */

                            function omit(object, callback, thisArg) {
                                var result = {};
                                if (typeof callback != 'function') {
                                    var props = [];
                                    forIn(object, function(value, key) {
                                        props.push(key);
                                    });
                                    props = baseDifference(props, baseFlatten(arguments, true, false, 1));

                                    var index = -1,
                                        length = props.length;

                                    while (++index < length) {
                                        var key = props[index];
                                        result[key] = object[key];
                                    }
                                } else {
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    forIn(object, function(value, key, object) {
                                        if (!callback(value, key, object)) {
                                            result[key] = value;
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * Creates a two dimensional array of an object's key-value pairs,
                             * i.e. `[[key1, value1], [key2, value2]]`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to inspect.
                             * @returns {Array} Returns new array of key-value pairs.
                             * @example
                             *
                             * _.pairs({ 'barney': 36, 'fred': 40 });
                             * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
                             */

                            function pairs(object) {
                                var index = -1,
                                    props = keys(object),
                                    length = props.length,
                                    result = Array(length);

                                while (++index < length) {
                                    var key = props[index];
                                    result[index] = [key, object[key]];
                                }
                                return result;
                            }

                            /**
                             * Creates a shallow clone of `object` composed of the specified properties.
                             * Property names may be specified as individual arguments or as arrays of
                             * property names. If a callback is provided it will be executed for each
                             * property of `object` picking the properties the callback returns truey
                             * for. The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, key, object).
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The source object.
                             * @param {Function|...string|string[]} [callback] The function called per
                             *  iteration or property names to pick, specified as individual property
                             *  names or arrays of property names.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns an object composed of the picked properties.
                             * @example
                             *
                             * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
                             * // => { 'name': 'fred' }
                             *
                             * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
                             *   return key.charAt(0) != '_';
                             * });
                             * // => { 'name': 'fred' }
                             */

                            function pick(object, callback, thisArg) {
                                var result = {};
                                if (typeof callback != 'function') {
                                    var index = -1,
                                        props = baseFlatten(arguments, true, false, 1),
                                        length = isObject(object) ? props.length : 0;

                                    while (++index < length) {
                                        var key = props[index];
                                        if (key in object) {
                                            result[key] = object[key];
                                        }
                                    }
                                } else {
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    forIn(object, function(value, key, object) {
                                        if (callback(value, key, object)) {
                                            result[key] = value;
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * An alternative to `_.reduce` this method transforms `object` to a new
                             * `accumulator` object which is the result of running each of its own
                             * enumerable properties through a callback, with each callback execution
                             * potentially mutating the `accumulator` object. The callback is bound to
                             * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
                             * Callbacks may exit iteration early by explicitly returning `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Array|Object} object The object to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [accumulator] The custom accumulator value.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the accumulated value.
                             * @example
                             *
                             * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
                             *   num *= num;
                             *   if (num % 2) {
                             *     return result.push(num) < 3;
                             *   }
                             * });
                             * // => [1, 9, 25]
                             *
                             * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
                             *   result[key] = num * 3;
                             * });
                             * // => { 'a': 3, 'b': 6, 'c': 9 }
                             */

                            function transform(object, callback, accumulator, thisArg) {
                                var isArr = isArray(object);
                                if (accumulator == null) {
                                    if (isArr) {
                                        accumulator = [];
                                    } else {
                                        var ctor = object && object.constructor,
                                            proto = ctor && ctor.prototype;

                                        accumulator = baseCreate(proto);
                                    }
                                }
                                if (callback) {
                                    callback = lodash.createCallback(callback, thisArg, 4);
                                    (isArr ? forEach : forOwn)(object, function(value, index, object) {
                                        return callback(accumulator, value, index, object);
                                    });
                                }
                                return accumulator;
                            }

                            /**
                             * Creates an array composed of the own enumerable property values of `object`.
                             *
                             * @static
                             * @memberOf _
                             * @category Objects
                             * @param {Object} object The object to inspect.
                             * @returns {Array} Returns an array of property values.
                             * @example
                             *
                             * _.values({ 'one': 1, 'two': 2, 'three': 3 });
                             * // => [1, 2, 3] (property order is not guaranteed across environments)
                             */

                            function values(object) {
                                var index = -1,
                                    props = keys(object),
                                    length = props.length,
                                    result = Array(length);

                                while (++index < length) {
                                    result[index] = object[props[index]];
                                }
                                return result;
                            }

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates an array of elements from the specified indexes, or keys, of the
                             * `collection`. Indexes may be specified as individual arguments or as arrays
                             * of indexes.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
                             *   to retrieve, specified as individual indexes or arrays of indexes.
                             * @returns {Array} Returns a new array of elements corresponding to the
                             *  provided indexes.
                             * @example
                             *
                             * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
                             * // => ['a', 'c', 'e']
                             *
                             * _.at(['fred', 'barney', 'pebbles'], 0, 2);
                             * // => ['fred', 'pebbles']
                             */

                            function at(collection) {
                                var args = arguments,
                                    index = -1,
                                    props = baseFlatten(args, true, false, 1),
                                    length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
                                    result = Array(length);

                                while (++index < length) {
                                    result[index] = collection[props[index]];
                                }
                                return result;
                            }

                            /**
                             * Checks if a given value is present in a collection using strict equality
                             * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
                             * offset from the end of the collection.
                             *
                             * @static
                             * @memberOf _
                             * @alias include
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {*} target The value to check for.
                             * @param {number} [fromIndex=0] The index to search from.
                             * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
                             * @example
                             *
                             * _.contains([1, 2, 3], 1);
                             * // => true
                             *
                             * _.contains([1, 2, 3], 1, 2);
                             * // => false
                             *
                             * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
                             * // => true
                             *
                             * _.contains('pebbles', 'eb');
                             * // => true
                             */

                            function contains(collection, target, fromIndex) {
                                var index = -1,
                                    indexOf = getIndexOf(),
                                    length = collection ? collection.length : 0,
                                    result = false;

                                fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
                                if (isArray(collection)) {
                                    result = indexOf(collection, target, fromIndex) > -1;
                                } else if (typeof length == 'number') {
                                    result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
                                } else {
                                    forOwn(collection, function(value) {
                                        if (++index >= fromIndex) {
                                            return !(result = value === target);
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * Creates an object composed of keys generated from the results of running
                             * each element of `collection` through the callback. The corresponding value
                             * of each key is the number of times the key was returned by the callback.
                             * The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns the composed aggregate object.
                             * @example
                             *
                             * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
                             * // => { '4': 1, '6': 2 }
                             *
                             * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
                             * // => { '4': 1, '6': 2 }
                             *
                             * _.countBy(['one', 'two', 'three'], 'length');
                             * // => { '3': 2, '5': 1 }
                             */
                            var countBy = createAggregator(function(result, value, key) {
                                (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
                            });

                            /**
                             * Checks if the given callback returns truey value for **all** elements of
                             * a collection. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias all
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {boolean} Returns `true` if all elements passed the callback check,
                             *  else `false`.
                             * @example
                             *
                             * _.every([true, 1, null, 'yes']);
                             * // => false
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.every(characters, 'age');
                             * // => true
                             *
                             * // using "_.where" callback shorthand
                             * _.every(characters, { 'age': 36 });
                             * // => false
                             */

                            function every(collection, callback, thisArg) {
                                var result = true;
                                callback = lodash.createCallback(callback, thisArg, 3);

                                var index = -1,
                                    length = collection ? collection.length : 0;

                                if (typeof length == 'number') {
                                    while (++index < length) {
                                        if (!(result = !! callback(collection[index], index, collection))) {
                                            break;
                                        }
                                    }
                                } else {
                                    forOwn(collection, function(value, index, collection) {
                                        return (result = !! callback(value, index, collection));
                                    });
                                }
                                return result;
                            }

                            /**
                             * Iterates over elements of a collection, returning an array of all elements
                             * the callback returns truey for. The callback is bound to `thisArg` and
                             * invoked with three arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias select
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new array of elements that passed the callback check.
                             * @example
                             *
                             * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
                             * // => [2, 4, 6]
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36, 'blocked': false },
                             *   { 'name': 'fred',   'age': 40, 'blocked': true }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.filter(characters, 'blocked');
                             * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
                             *
                             * // using "_.where" callback shorthand
                             * _.filter(characters, { 'age': 36 });
                             * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
                             */

                            function filter(collection, callback, thisArg) {
                                var result = [];
                                callback = lodash.createCallback(callback, thisArg, 3);

                                var index = -1,
                                    length = collection ? collection.length : 0;

                                if (typeof length == 'number') {
                                    while (++index < length) {
                                        var value = collection[index];
                                        if (callback(value, index, collection)) {
                                            result.push(value);
                                        }
                                    }
                                } else {
                                    forOwn(collection, function(value, index, collection) {
                                        if (callback(value, index, collection)) {
                                            result.push(value);
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * Iterates over elements of a collection, returning the first element that
                             * the callback returns truey for. The callback is bound to `thisArg` and
                             * invoked with three arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias detect, findWhere
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the found element, else `undefined`.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'age': 36, 'blocked': false },
                             *   { 'name': 'fred',    'age': 40, 'blocked': true },
                             *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
                             * ];
                             *
                             * _.find(characters, function(chr) {
                             *   return chr.age < 40;
                             * });
                             * // => { 'name': 'barney', 'age': 36, 'blocked': false }
                             *
                             * // using "_.where" callback shorthand
                             * _.find(characters, { 'age': 1 });
                             * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
                             *
                             * // using "_.pluck" callback shorthand
                             * _.find(characters, 'blocked');
                             * // => { 'name': 'fred', 'age': 40, 'blocked': true }
                             */

                            function find(collection, callback, thisArg) {
                                callback = lodash.createCallback(callback, thisArg, 3);

                                var index = -1,
                                    length = collection ? collection.length : 0;

                                if (typeof length == 'number') {
                                    while (++index < length) {
                                        var value = collection[index];
                                        if (callback(value, index, collection)) {
                                            return value;
                                        }
                                    }
                                } else {
                                    var result;
                                    forOwn(collection, function(value, index, collection) {
                                        if (callback(value, index, collection)) {
                                            result = value;
                                            return false;
                                        }
                                    });
                                    return result;
                                }
                            }

                            /**
                             * This method is like `_.find` except that it iterates over elements
                             * of a `collection` from right to left.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the found element, else `undefined`.
                             * @example
                             *
                             * _.findLast([1, 2, 3, 4], function(num) {
                             *   return num % 2 == 1;
                             * });
                             * // => 3
                             */

                            function findLast(collection, callback, thisArg) {
                                var result;
                                callback = lodash.createCallback(callback, thisArg, 3);
                                forEachRight(collection, function(value, index, collection) {
                                    if (callback(value, index, collection)) {
                                        result = value;
                                        return false;
                                    }
                                });
                                return result;
                            }

                            /**
                             * Iterates over elements of a collection, executing the callback for each
                             * element. The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, index|key, collection). Callbacks may exit iteration early by
                             * explicitly returning `false`.
                             *
                             * Note: As with other "Collections" methods, objects with a `length` property
                             * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
                             * may be used for object iteration.
                             *
                             * @static
                             * @memberOf _
                             * @alias each
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array|Object|string} Returns `collection`.
                             * @example
                             *
                             * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
                             * // => logs each number and returns '1,2,3'
                             *
                             * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
                             * // => logs each number and returns the object (property order is not guaranteed across environments)
                             */

                            function forEach(collection, callback, thisArg) {
                                var index = -1,
                                    length = collection ? collection.length : 0;

                                callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
                                if (typeof length == 'number') {
                                    while (++index < length) {
                                        if (callback(collection[index], index, collection) === false) {
                                            break;
                                        }
                                    }
                                } else {
                                    forOwn(collection, callback);
                                }
                                return collection;
                            }

                            /**
                             * This method is like `_.forEach` except that it iterates over elements
                             * of a `collection` from right to left.
                             *
                             * @static
                             * @memberOf _
                             * @alias eachRight
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array|Object|string} Returns `collection`.
                             * @example
                             *
                             * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
                             * // => logs each number from right to left and returns '3,2,1'
                             */

                            function forEachRight(collection, callback, thisArg) {
                                var length = collection ? collection.length : 0;
                                callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
                                if (typeof length == 'number') {
                                    while (length--) {
                                        if (callback(collection[length], length, collection) === false) {
                                            break;
                                        }
                                    }
                                } else {
                                    var props = keys(collection);
                                    length = props.length;
                                    forOwn(collection, function(value, key, collection) {
                                        key = props ? props[--length] : --length;
                                        return callback(collection[key], key, collection);
                                    });
                                }
                                return collection;
                            }

                            /**
                             * Creates an object composed of keys generated from the results of running
                             * each element of a collection through the callback. The corresponding value
                             * of each key is an array of the elements responsible for generating the key.
                             * The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns the composed aggregate object.
                             * @example
                             *
                             * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
                             * // => { '4': [4.2], '6': [6.1, 6.4] }
                             *
                             * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
                             * // => { '4': [4.2], '6': [6.1, 6.4] }
                             *
                             * // using "_.pluck" callback shorthand
                             * _.groupBy(['one', 'two', 'three'], 'length');
                             * // => { '3': ['one', 'two'], '5': ['three'] }
                             */
                            var groupBy = createAggregator(function(result, value, key) {
                                (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
                            });

                            /**
                             * Creates an object composed of keys generated from the results of running
                             * each element of the collection through the given callback. The corresponding
                             * value of each key is the last element responsible for generating the key.
                             * The callback is bound to `thisArg` and invoked with three arguments;
                             * (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Object} Returns the composed aggregate object.
                             * @example
                             *
                             * var keys = [
                             *   { 'dir': 'left', 'code': 97 },
                             *   { 'dir': 'right', 'code': 100 }
                             * ];
                             *
                             * _.indexBy(keys, 'dir');
                             * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
                             *
                             * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
                             * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
                             *
                             * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
                             * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
                             */
                            var indexBy = createAggregator(function(result, value, key) {
                                result[key] = value;
                            });

                            /**
                             * Invokes the method named by `methodName` on each element in the `collection`
                             * returning an array of the results of each invoked method. Additional arguments
                             * will be provided to each invoked method. If `methodName` is a function it
                             * will be invoked for, and `this` bound to, each element in the `collection`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|string} methodName The name of the method to invoke or
                             *  the function invoked per iteration.
                             * @param {...*} [arg] Arguments to invoke the method with.
                             * @returns {Array} Returns a new array of the results of each invoked method.
                             * @example
                             *
                             * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
                             * // => [[1, 5, 7], [1, 2, 3]]
                             *
                             * _.invoke([123, 456], String.prototype.split, '');
                             * // => [['1', '2', '3'], ['4', '5', '6']]
                             */

                            function invoke(collection, methodName) {
                                var args = slice(arguments, 2),
                                    index = -1,
                                    isFunc = typeof methodName == 'function',
                                    length = collection ? collection.length : 0,
                                    result = Array(typeof length == 'number' ? length : 0);

                                forEach(collection, function(value) {
                                    result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
                                });
                                return result;
                            }

                            /**
                             * Creates an array of values by running each element in the collection
                             * through the callback. The callback is bound to `thisArg` and invoked with
                             * three arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias collect
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new array of the results of each `callback` execution.
                             * @example
                             *
                             * _.map([1, 2, 3], function(num) { return num * 3; });
                             * // => [3, 6, 9]
                             *
                             * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
                             * // => [3, 6, 9] (property order is not guaranteed across environments)
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.map(characters, 'name');
                             * // => ['barney', 'fred']
                             */

                            function map(collection, callback, thisArg) {
                                var index = -1,
                                    length = collection ? collection.length : 0;

                                callback = lodash.createCallback(callback, thisArg, 3);
                                if (typeof length == 'number') {
                                    var result = Array(length);
                                    while (++index < length) {
                                        result[index] = callback(collection[index], index, collection);
                                    }
                                } else {
                                    result = [];
                                    forOwn(collection, function(value, key, collection) {
                                        result[++index] = callback(value, key, collection);
                                    });
                                }
                                return result;
                            }

                            /**
                             * Retrieves the maximum value of a collection. If the collection is empty or
                             * falsey `-Infinity` is returned. If a callback is provided it will be executed
                             * for each value in the collection to generate the criterion by which the value
                             * is ranked. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, index, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the maximum value.
                             * @example
                             *
                             * _.max([4, 2, 8, 6]);
                             * // => 8
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * _.max(characters, function(chr) { return chr.age; });
                             * // => { 'name': 'fred', 'age': 40 };
                             *
                             * // using "_.pluck" callback shorthand
                             * _.max(characters, 'age');
                             * // => { 'name': 'fred', 'age': 40 };
                             */

                            function max(collection, callback, thisArg) {
                                var computed = -Infinity,
                                    result = computed;

                                // allows working with functions like `_.map` without using
                                // their `index` argument as a callback
                                if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
                                    callback = null;
                                }
                                if (callback == null && isArray(collection)) {
                                    var index = -1,
                                        length = collection.length;

                                    while (++index < length) {
                                        var value = collection[index];
                                        if (value > result) {
                                            result = value;
                                        }
                                    }
                                } else {
                                    callback = (callback == null && isString(collection)) ? charAtCallback : lodash.createCallback(callback, thisArg, 3);

                                    forEach(collection, function(value, index, collection) {
                                        var current = callback(value, index, collection);
                                        if (current > computed) {
                                            computed = current;
                                            result = value;
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * Retrieves the minimum value of a collection. If the collection is empty or
                             * falsey `Infinity` is returned. If a callback is provided it will be executed
                             * for each value in the collection to generate the criterion by which the value
                             * is ranked. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, index, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the minimum value.
                             * @example
                             *
                             * _.min([4, 2, 8, 6]);
                             * // => 2
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * _.min(characters, function(chr) { return chr.age; });
                             * // => { 'name': 'barney', 'age': 36 };
                             *
                             * // using "_.pluck" callback shorthand
                             * _.min(characters, 'age');
                             * // => { 'name': 'barney', 'age': 36 };
                             */

                            function min(collection, callback, thisArg) {
                                var computed = Infinity,
                                    result = computed;

                                // allows working with functions like `_.map` without using
                                // their `index` argument as a callback
                                if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
                                    callback = null;
                                }
                                if (callback == null && isArray(collection)) {
                                    var index = -1,
                                        length = collection.length;

                                    while (++index < length) {
                                        var value = collection[index];
                                        if (value < result) {
                                            result = value;
                                        }
                                    }
                                } else {
                                    callback = (callback == null && isString(collection)) ? charAtCallback : lodash.createCallback(callback, thisArg, 3);

                                    forEach(collection, function(value, index, collection) {
                                        var current = callback(value, index, collection);
                                        if (current < computed) {
                                            computed = current;
                                            result = value;
                                        }
                                    });
                                }
                                return result;
                            }

                            /**
                             * Retrieves the value of a specified property from all elements in the collection.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {string} property The name of the property to pluck.
                             * @returns {Array} Returns a new array of property values.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * _.pluck(characters, 'name');
                             * // => ['barney', 'fred']
                             */
                            var pluck = map;

                            /**
                             * Reduces a collection to a value which is the accumulated result of running
                             * each element in the collection through the callback, where each successive
                             * callback execution consumes the return value of the previous execution. If
                             * `accumulator` is not provided the first element of the collection will be
                             * used as the initial `accumulator` value. The callback is bound to `thisArg`
                             * and invoked with four arguments; (accumulator, value, index|key, collection).
                             *
                             * @static
                             * @memberOf _
                             * @alias foldl, inject
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [accumulator] Initial value of the accumulator.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the accumulated value.
                             * @example
                             *
                             * var sum = _.reduce([1, 2, 3], function(sum, num) {
                             *   return sum + num;
                             * });
                             * // => 6
                             *
                             * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
                             *   result[key] = num * 3;
                             *   return result;
                             * }, {});
                             * // => { 'a': 3, 'b': 6, 'c': 9 }
                             */

                            function reduce(collection, callback, accumulator, thisArg) {
                                if (!collection) return accumulator;
                                var noaccum = arguments.length < 3;
                                callback = lodash.createCallback(callback, thisArg, 4);

                                var index = -1,
                                    length = collection.length;

                                if (typeof length == 'number') {
                                    if (noaccum) {
                                        accumulator = collection[++index];
                                    }
                                    while (++index < length) {
                                        accumulator = callback(accumulator, collection[index], index, collection);
                                    }
                                } else {
                                    forOwn(collection, function(value, index, collection) {
                                        accumulator = noaccum ? (noaccum = false, value) : callback(accumulator, value, index, collection)
                                    });
                                }
                                return accumulator;
                            }

                            /**
                             * This method is like `_.reduce` except that it iterates over elements
                             * of a `collection` from right to left.
                             *
                             * @static
                             * @memberOf _
                             * @alias foldr
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function} [callback=identity] The function called per iteration.
                             * @param {*} [accumulator] Initial value of the accumulator.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the accumulated value.
                             * @example
                             *
                             * var list = [[0, 1], [2, 3], [4, 5]];
                             * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
                             * // => [4, 5, 2, 3, 0, 1]
                             */

                            function reduceRight(collection, callback, accumulator, thisArg) {
                                var noaccum = arguments.length < 3;
                                callback = lodash.createCallback(callback, thisArg, 4);
                                forEachRight(collection, function(value, index, collection) {
                                    accumulator = noaccum ? (noaccum = false, value) : callback(accumulator, value, index, collection);
                                });
                                return accumulator;
                            }

                            /**
                             * The opposite of `_.filter` this method returns the elements of a
                             * collection that the callback does **not** return truey for.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new array of elements that failed the callback check.
                             * @example
                             *
                             * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
                             * // => [1, 3, 5]
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36, 'blocked': false },
                             *   { 'name': 'fred',   'age': 40, 'blocked': true }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.reject(characters, 'blocked');
                             * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
                             *
                             * // using "_.where" callback shorthand
                             * _.reject(characters, { 'age': 36 });
                             * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
                             */

                            function reject(collection, callback, thisArg) {
                                callback = lodash.createCallback(callback, thisArg, 3);
                                return filter(collection, function(value, index, collection) {
                                    return !callback(value, index, collection);
                                });
                            }

                            /**
                             * Retrieves a random element or `n` random elements from a collection.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to sample.
                             * @param {number} [n] The number of elements to sample.
                             * @param- {Object} [guard] Allows working with functions like `_.map`
                             *  without using their `index` arguments as `n`.
                             * @returns {Array} Returns the random sample(s) of `collection`.
                             * @example
                             *
                             * _.sample([1, 2, 3, 4]);
                             * // => 2
                             *
                             * _.sample([1, 2, 3, 4], 2);
                             * // => [3, 1]
                             */

                            function sample(collection, n, guard) {
                                if (collection && typeof collection.length != 'number') {
                                    collection = values(collection);
                                }
                                if (n == null || guard) {
                                    return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
                                }
                                var result = shuffle(collection);
                                result.length = nativeMin(nativeMax(0, n), result.length);
                                return result;
                            }

                            /**
                             * Creates an array of shuffled values, using a version of the Fisher-Yates
                             * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to shuffle.
                             * @returns {Array} Returns a new shuffled collection.
                             * @example
                             *
                             * _.shuffle([1, 2, 3, 4, 5, 6]);
                             * // => [4, 1, 6, 3, 5, 2]
                             */

                            function shuffle(collection) {
                                var index = -1,
                                    length = collection ? collection.length : 0,
                                    result = Array(typeof length == 'number' ? length : 0);

                                forEach(collection, function(value) {
                                    var rand = baseRandom(0, ++index);
                                    result[index] = result[rand];
                                    result[rand] = value;
                                });
                                return result;
                            }

                            /**
                             * Gets the size of the `collection` by returning `collection.length` for arrays
                             * and array-like objects or the number of own enumerable properties for objects.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to inspect.
                             * @returns {number} Returns `collection.length` or number of own enumerable properties.
                             * @example
                             *
                             * _.size([1, 2]);
                             * // => 2
                             *
                             * _.size({ 'one': 1, 'two': 2, 'three': 3 });
                             * // => 3
                             *
                             * _.size('pebbles');
                             * // => 7
                             */

                            function size(collection) {
                                var length = collection ? collection.length : 0;
                                return typeof length == 'number' ? length : keys(collection).length;
                            }

                            /**
                             * Checks if the callback returns a truey value for **any** element of a
                             * collection. The function returns as soon as it finds a passing value and
                             * does not iterate over the entire collection. The callback is bound to
                             * `thisArg` and invoked with three arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias any
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {boolean} Returns `true` if any element passed the callback check,
                             *  else `false`.
                             * @example
                             *
                             * _.some([null, 0, 'yes', false], Boolean);
                             * // => true
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36, 'blocked': false },
                             *   { 'name': 'fred',   'age': 40, 'blocked': true }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.some(characters, 'blocked');
                             * // => true
                             *
                             * // using "_.where" callback shorthand
                             * _.some(characters, { 'age': 1 });
                             * // => false
                             */

                            function some(collection, callback, thisArg) {
                                var result;
                                callback = lodash.createCallback(callback, thisArg, 3);

                                var index = -1,
                                    length = collection ? collection.length : 0;

                                if (typeof length == 'number') {
                                    while (++index < length) {
                                        if ((result = callback(collection[index], index, collection))) {
                                            break;
                                        }
                                    }
                                } else {
                                    forOwn(collection, function(value, index, collection) {
                                        return !(result = callback(value, index, collection));
                                    });
                                }
                                return !!result;
                            }

                            /**
                             * Creates an array of elements, sorted in ascending order by the results of
                             * running each element in a collection through the callback. This method
                             * performs a stable sort, that is, it will preserve the original sort order
                             * of equal elements. The callback is bound to `thisArg` and invoked with
                             * three arguments; (value, index|key, collection).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an array of property names is provided for `callback` the collection
                             * will be sorted by each property value.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Array|Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new array of sorted elements.
                             * @example
                             *
                             * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
                             * // => [3, 1, 2]
                             *
                             * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
                             * // => [3, 1, 2]
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'age': 36 },
                             *   { 'name': 'fred',    'age': 40 },
                             *   { 'name': 'barney',  'age': 26 },
                             *   { 'name': 'fred',    'age': 30 }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.map(_.sortBy(characters, 'age'), _.values);
                             * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
                             *
                             * // sorting by multiple properties
                             * _.map(_.sortBy(characters, ['name', 'age']), _.values);
                             * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
                             */

                            function sortBy(collection, callback, thisArg) {
                                var index = -1,
                                    isArr = isArray(callback),
                                    length = collection ? collection.length : 0,
                                    result = Array(typeof length == 'number' ? length : 0);

                                if (!isArr) {
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                }
                                forEach(collection, function(value, key, collection) {
                                    var object = result[++index] = getObject();
                                    if (isArr) {
                                        object.criteria = map(callback, function(key) {
                                            return value[key];
                                        });
                                    } else {
                                        (object.criteria = getArray())[0] = callback(value, key, collection);
                                    }
                                    object.index = index;
                                    object.value = value;
                                });

                                length = result.length;
                                result.sort(compareAscending);
                                while (length--) {
                                    var object = result[length];
                                    result[length] = object.value;
                                    if (!isArr) {
                                        releaseArray(object.criteria);
                                    }
                                    releaseObject(object);
                                }
                                return result;
                            }

                            /**
                             * Converts the `collection` to an array.
                             *
                             * @static
                             * @memberOf _
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to convert.
                             * @returns {Array} Returns the new converted array.
                             * @example
                             *
                             * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
                             * // => [2, 3, 4]
                             */

                            function toArray(collection) {
                                if (collection && typeof collection.length == 'number') {
                                    return slice(collection);
                                }
                                return values(collection);
                            }

                            /**
                             * Performs a deep comparison of each element in a `collection` to the given
                             * `properties` object, returning an array of all elements that have equivalent
                             * property values.
                             *
                             * @static
                             * @memberOf _
                             * @type Function
                             * @category Collections
                             * @param {Array|Object|string} collection The collection to iterate over.
                             * @param {Object} props The object of property values to filter by.
                             * @returns {Array} Returns a new array of elements that have the given properties.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
                             *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
                             * ];
                             *
                             * _.where(characters, { 'age': 36 });
                             * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
                             *
                             * _.where(characters, { 'pets': ['dino'] });
                             * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
                             */
                            var where = filter;

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates an array with all falsey values removed. The values `false`, `null`,
                             * `0`, `""`, `undefined`, and `NaN` are all falsey.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to compact.
                             * @returns {Array} Returns a new array of filtered values.
                             * @example
                             *
                             * _.compact([0, 1, false, 2, '', 3]);
                             * // => [1, 2, 3]
                             */

                            function compact(array) {
                                var index = -1,
                                    length = array ? array.length : 0,
                                    result = [];

                                while (++index < length) {
                                    var value = array[index];
                                    if (value) {
                                        result.push(value);
                                    }
                                }
                                return result;
                            }

                            /**
                             * Creates an array excluding all values of the provided arrays using strict
                             * equality for comparisons, i.e. `===`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to process.
                             * @param {...Array} [values] The arrays of values to exclude.
                             * @returns {Array} Returns a new array of filtered values.
                             * @example
                             *
                             * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
                             * // => [1, 3, 4]
                             */

                            function difference(array) {
                                return baseDifference(array, baseFlatten(arguments, true, true, 1));
                            }

                            /**
                             * This method is like `_.find` except that it returns the index of the first
                             * element that passes the callback check, instead of the element itself.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to search.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {number} Returns the index of the found element, else `-1`.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'age': 36, 'blocked': false },
                             *   { 'name': 'fred',    'age': 40, 'blocked': true },
                             *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
                             * ];
                             *
                             * _.findIndex(characters, function(chr) {
                             *   return chr.age < 20;
                             * });
                             * // => 2
                             *
                             * // using "_.where" callback shorthand
                             * _.findIndex(characters, { 'age': 36 });
                             * // => 0
                             *
                             * // using "_.pluck" callback shorthand
                             * _.findIndex(characters, 'blocked');
                             * // => 1
                             */

                            function findIndex(array, callback, thisArg) {
                                var index = -1,
                                    length = array ? array.length : 0;

                                callback = lodash.createCallback(callback, thisArg, 3);
                                while (++index < length) {
                                    if (callback(array[index], index, array)) {
                                        return index;
                                    }
                                }
                                return -1;
                            }

                            /**
                             * This method is like `_.findIndex` except that it iterates over elements
                             * of a `collection` from right to left.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to search.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {number} Returns the index of the found element, else `-1`.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'age': 36, 'blocked': true },
                             *   { 'name': 'fred',    'age': 40, 'blocked': false },
                             *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
                             * ];
                             *
                             * _.findLastIndex(characters, function(chr) {
                             *   return chr.age > 30;
                             * });
                             * // => 1
                             *
                             * // using "_.where" callback shorthand
                             * _.findLastIndex(characters, { 'age': 36 });
                             * // => 0
                             *
                             * // using "_.pluck" callback shorthand
                             * _.findLastIndex(characters, 'blocked');
                             * // => 2
                             */

                            function findLastIndex(array, callback, thisArg) {
                                var length = array ? array.length : 0;
                                callback = lodash.createCallback(callback, thisArg, 3);
                                while (length--) {
                                    if (callback(array[length], length, array)) {
                                        return length;
                                    }
                                }
                                return -1;
                            }

                            /**
                             * Gets the first element or first `n` elements of an array. If a callback
                             * is provided elements at the beginning of the array are returned as long
                             * as the callback returns truey. The callback is bound to `thisArg` and
                             * invoked with three arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias head, take
                             * @category Arrays
                             * @param {Array} array The array to query.
                             * @param {Function|Object|number|string} [callback] The function called
                             *  per element or the number of elements to return. If a property name or
                             *  object is provided it will be used to create a "_.pluck" or "_.where"
                             *  style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the first element(s) of `array`.
                             * @example
                             *
                             * _.first([1, 2, 3]);
                             * // => 1
                             *
                             * _.first([1, 2, 3], 2);
                             * // => [1, 2]
                             *
                             * _.first([1, 2, 3], function(num) {
                             *   return num < 3;
                             * });
                             * // => [1, 2]
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
                             *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
                             *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.first(characters, 'blocked');
                             * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
                             *
                             * // using "_.where" callback shorthand
                             * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
                             * // => ['barney', 'fred']
                             */

                            function first(array, callback, thisArg) {
                                var n = 0,
                                    length = array ? array.length : 0;

                                if (typeof callback != 'number' && callback != null) {
                                    var index = -1;
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    while (++index < length && callback(array[index], index, array)) {
                                        n++;
                                    }
                                } else {
                                    n = callback;
                                    if (n == null || thisArg) {
                                        return array ? array[0] : undefined;
                                    }
                                }
                                return slice(array, 0, nativeMin(nativeMax(0, n), length));
                            }

                            /**
                             * Flattens a nested array (the nesting can be to any depth). If `isShallow`
                             * is truey, the array will only be flattened a single level. If a callback
                             * is provided each element of the array is passed through the callback before
                             * flattening. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to flatten.
                             * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new flattened array.
                             * @example
                             *
                             * _.flatten([1, [2], [3, [[4]]]]);
                             * // => [1, 2, 3, 4];
                             *
                             * _.flatten([1, [2], [3, [[4]]]], true);
                             * // => [1, 2, 3, [[4]]];
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
                             *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.flatten(characters, 'pets');
                             * // => ['hoppy', 'baby puss', 'dino']
                             */

                            function flatten(array, isShallow, callback, thisArg) {
                                // juggle arguments
                                if (typeof isShallow != 'boolean' && isShallow != null) {
                                    thisArg = callback;
                                    callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
                                    isShallow = false;
                                }
                                if (callback != null) {
                                    array = map(array, callback, thisArg);
                                }
                                return baseFlatten(array, isShallow);
                            }

                            /**
                             * Gets the index at which the first occurrence of `value` is found using
                             * strict equality for comparisons, i.e. `===`. If the array is already sorted
                             * providing `true` for `fromIndex` will run a faster binary search.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to search.
                             * @param {*} value The value to search for.
                             * @param {boolean|number} [fromIndex=0] The index to search from or `true`
                             *  to perform a binary search on a sorted array.
                             * @returns {number} Returns the index of the matched value or `-1`.
                             * @example
                             *
                             * _.indexOf([1, 2, 3, 1, 2, 3], 2);
                             * // => 1
                             *
                             * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
                             * // => 4
                             *
                             * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
                             * // => 2
                             */

                            function indexOf(array, value, fromIndex) {
                                if (typeof fromIndex == 'number') {
                                    var length = array ? array.length : 0;
                                    fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
                                } else if (fromIndex) {
                                    var index = sortedIndex(array, value);
                                    return array[index] === value ? index : -1;
                                }
                                return baseIndexOf(array, value, fromIndex);
                            }

                            /**
                             * Gets all but the last element or last `n` elements of an array. If a
                             * callback is provided elements at the end of the array are excluded from
                             * the result as long as the callback returns truey. The callback is bound
                             * to `thisArg` and invoked with three arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to query.
                             * @param {Function|Object|number|string} [callback=1] The function called
                             *  per element or the number of elements to exclude. If a property name or
                             *  object is provided it will be used to create a "_.pluck" or "_.where"
                             *  style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a slice of `array`.
                             * @example
                             *
                             * _.initial([1, 2, 3]);
                             * // => [1, 2]
                             *
                             * _.initial([1, 2, 3], 2);
                             * // => [1]
                             *
                             * _.initial([1, 2, 3], function(num) {
                             *   return num > 1;
                             * });
                             * // => [1]
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
                             *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
                             *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.initial(characters, 'blocked');
                             * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
                             *
                             * // using "_.where" callback shorthand
                             * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
                             * // => ['barney', 'fred']
                             */

                            function initial(array, callback, thisArg) {
                                var n = 0,
                                    length = array ? array.length : 0;

                                if (typeof callback != 'number' && callback != null) {
                                    var index = length;
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    while (index-- && callback(array[index], index, array)) {
                                        n++;
                                    }
                                } else {
                                    n = (callback == null || thisArg) ? 1 : callback || n;
                                }
                                return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
                            }

                            /**
                             * Creates an array of unique values present in all provided arrays using
                             * strict equality for comparisons, i.e. `===`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {...Array} [array] The arrays to inspect.
                             * @returns {Array} Returns an array of shared values.
                             * @example
                             *
                             * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
                             * // => [1, 2]
                             */

                            function intersection() {
                                var args = [],
                                    argsIndex = -1,
                                    argsLength = arguments.length,
                                    caches = getArray(),
                                    indexOf = getIndexOf(),
                                    trustIndexOf = indexOf === baseIndexOf,
                                    seen = getArray();

                                while (++argsIndex < argsLength) {
                                    var value = arguments[argsIndex];
                                    if (isArray(value) || isArguments(value)) {
                                        args.push(value);
                                        caches.push(trustIndexOf && value.length >= largeArraySize &&
                                            createCache(argsIndex ? args[argsIndex] : seen));
                                    }
                                }
                                var array = args[0],
                                    index = -1,
                                    length = array ? array.length : 0,
                                    result = [];

                                outer: while (++index < length) {
                                    var cache = caches[0];
                                    value = array[index];

                                    if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
                                        argsIndex = argsLength;
                                        (cache || seen).push(value);
                                        while (--argsIndex) {
                                            cache = caches[argsIndex];
                                            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
                                                continue outer;
                                            }
                                        }
                                        result.push(value);
                                    }
                                }
                                while (argsLength--) {
                                    cache = caches[argsLength];
                                    if (cache) {
                                        releaseObject(cache);
                                    }
                                }
                                releaseArray(caches);
                                releaseArray(seen);
                                return result;
                            }

                            /**
                             * Gets the last element or last `n` elements of an array. If a callback is
                             * provided elements at the end of the array are returned as long as the
                             * callback returns truey. The callback is bound to `thisArg` and invoked
                             * with three arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to query.
                             * @param {Function|Object|number|string} [callback] The function called
                             *  per element or the number of elements to return. If a property name or
                             *  object is provided it will be used to create a "_.pluck" or "_.where"
                             *  style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {*} Returns the last element(s) of `array`.
                             * @example
                             *
                             * _.last([1, 2, 3]);
                             * // => 3
                             *
                             * _.last([1, 2, 3], 2);
                             * // => [2, 3]
                             *
                             * _.last([1, 2, 3], function(num) {
                             *   return num > 1;
                             * });
                             * // => [2, 3]
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
                             *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
                             *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.pluck(_.last(characters, 'blocked'), 'name');
                             * // => ['fred', 'pebbles']
                             *
                             * // using "_.where" callback shorthand
                             * _.last(characters, { 'employer': 'na' });
                             * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
                             */

                            function last(array, callback, thisArg) {
                                var n = 0,
                                    length = array ? array.length : 0;

                                if (typeof callback != 'number' && callback != null) {
                                    var index = length;
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    while (index-- && callback(array[index], index, array)) {
                                        n++;
                                    }
                                } else {
                                    n = callback;
                                    if (n == null || thisArg) {
                                        return array ? array[length - 1] : undefined;
                                    }
                                }
                                return slice(array, nativeMax(0, length - n));
                            }

                            /**
                             * Gets the index at which the last occurrence of `value` is found using strict
                             * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
                             * as the offset from the end of the collection.
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to search.
                             * @param {*} value The value to search for.
                             * @param {number} [fromIndex=array.length-1] The index to search from.
                             * @returns {number} Returns the index of the matched value or `-1`.
                             * @example
                             *
                             * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
                             * // => 4
                             *
                             * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
                             * // => 1
                             */

                            function lastIndexOf(array, value, fromIndex) {
                                var index = array ? array.length : 0;
                                if (typeof fromIndex == 'number') {
                                    index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
                                }
                                while (index--) {
                                    if (array[index] === value) {
                                        return index;
                                    }
                                }
                                return -1;
                            }

                            /**
                             * Removes all provided values from the given array using strict equality for
                             * comparisons, i.e. `===`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to modify.
                             * @param {...*} [value] The values to remove.
                             * @returns {Array} Returns `array`.
                             * @example
                             *
                             * var array = [1, 2, 3, 1, 2, 3];
                             * _.pull(array, 2, 3);
                             * console.log(array);
                             * // => [1, 1]
                             */

                            function pull(array) {
                                var args = arguments,
                                    argsIndex = 0,
                                    argsLength = args.length,
                                    length = array ? array.length : 0;

                                while (++argsIndex < argsLength) {
                                    var index = -1,
                                        value = args[argsIndex];
                                    while (++index < length) {
                                        if (array[index] === value) {
                                            splice.call(array, index--, 1);
                                            length--;
                                        }
                                    }
                                }
                                return array;
                            }

                            /**
                             * Creates an array of numbers (positive and/or negative) progressing from
                             * `start` up to but not including `end`. If `start` is less than `stop` a
                             * zero-length range is created unless a negative `step` is specified.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {number} [start=0] The start of the range.
                             * @param {number} end The end of the range.
                             * @param {number} [step=1] The value to increment or decrement by.
                             * @returns {Array} Returns a new range array.
                             * @example
                             *
                             * _.range(4);
                             * // => [0, 1, 2, 3]
                             *
                             * _.range(1, 5);
                             * // => [1, 2, 3, 4]
                             *
                             * _.range(0, 20, 5);
                             * // => [0, 5, 10, 15]
                             *
                             * _.range(0, -4, -1);
                             * // => [0, -1, -2, -3]
                             *
                             * _.range(1, 4, 0);
                             * // => [1, 1, 1]
                             *
                             * _.range(0);
                             * // => []
                             */

                            function range(start, end, step) {
                                start = +start || 0;
                                step = typeof step == 'number' ? step : (+step || 1);

                                if (end == null) {
                                    end = start;
                                    start = 0;
                                }
                                // use `Array(length)` so engines like Chakra and V8 avoid slower modes
                                // http://youtu.be/XAqIpGU8ZZk#t=17m25s
                                var index = -1,
                                    length = nativeMax(0, ceil((end - start) / (step || 1))),
                                    result = Array(length);

                                while (++index < length) {
                                    result[index] = start;
                                    start += step;
                                }
                                return result;
                            }

                            /**
                             * Removes all elements from an array that the callback returns truey for
                             * and returns an array of removed elements. The callback is bound to `thisArg`
                             * and invoked with three arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to modify.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a new array of removed elements.
                             * @example
                             *
                             * var array = [1, 2, 3, 4, 5, 6];
                             * var evens = _.remove(array, function(num) { return num % 2 == 0; });
                             *
                             * console.log(array);
                             * // => [1, 3, 5]
                             *
                             * console.log(evens);
                             * // => [2, 4, 6]
                             */

                            function remove(array, callback, thisArg) {
                                var index = -1,
                                    length = array ? array.length : 0,
                                    result = [];

                                callback = lodash.createCallback(callback, thisArg, 3);
                                while (++index < length) {
                                    var value = array[index];
                                    if (callback(value, index, array)) {
                                        result.push(value);
                                        splice.call(array, index--, 1);
                                        length--;
                                    }
                                }
                                return result;
                            }

                            /**
                             * The opposite of `_.initial` this method gets all but the first element or
                             * first `n` elements of an array. If a callback function is provided elements
                             * at the beginning of the array are excluded from the result as long as the
                             * callback returns truey. The callback is bound to `thisArg` and invoked
                             * with three arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias drop, tail
                             * @category Arrays
                             * @param {Array} array The array to query.
                             * @param {Function|Object|number|string} [callback=1] The function called
                             *  per element or the number of elements to exclude. If a property name or
                             *  object is provided it will be used to create a "_.pluck" or "_.where"
                             *  style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a slice of `array`.
                             * @example
                             *
                             * _.rest([1, 2, 3]);
                             * // => [2, 3]
                             *
                             * _.rest([1, 2, 3], 2);
                             * // => [3]
                             *
                             * _.rest([1, 2, 3], function(num) {
                             *   return num < 3;
                             * });
                             * // => [3]
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
                             *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
                             *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
                             * ];
                             *
                             * // using "_.pluck" callback shorthand
                             * _.pluck(_.rest(characters, 'blocked'), 'name');
                             * // => ['fred', 'pebbles']
                             *
                             * // using "_.where" callback shorthand
                             * _.rest(characters, { 'employer': 'slate' });
                             * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
                             */

                            function rest(array, callback, thisArg) {
                                if (typeof callback != 'number' && callback != null) {
                                    var n = 0,
                                        index = -1,
                                        length = array ? array.length : 0;

                                    callback = lodash.createCallback(callback, thisArg, 3);
                                    while (++index < length && callback(array[index], index, array)) {
                                        n++;
                                    }
                                } else {
                                    n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
                                }
                                return slice(array, n);
                            }

                            /**
                             * Uses a binary search to determine the smallest index at which a value
                             * should be inserted into a given sorted array in order to maintain the sort
                             * order of the array. If a callback is provided it will be executed for
                             * `value` and each element of `array` to compute their sort ranking. The
                             * callback is bound to `thisArg` and invoked with one argument; (value).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to inspect.
                             * @param {*} value The value to evaluate.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {number} Returns the index at which `value` should be inserted
                             *  into `array`.
                             * @example
                             *
                             * _.sortedIndex([20, 30, 50], 40);
                             * // => 2
                             *
                             * // using "_.pluck" callback shorthand
                             * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
                             * // => 2
                             *
                             * var dict = {
                             *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
                             * };
                             *
                             * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
                             *   return dict.wordToNumber[word];
                             * });
                             * // => 2
                             *
                             * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
                             *   return this.wordToNumber[word];
                             * }, dict);
                             * // => 2
                             */

                            function sortedIndex(array, value, callback, thisArg) {
                                var low = 0,
                                    high = array ? array.length : low;

                                // explicitly reference `identity` for better inlining in Firefox
                                callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
                                value = callback(value);

                                while (low < high) {
                                    var mid = (low + high) >>> 1;
                                    (callback(array[mid]) < value) ? low = mid + 1 : high = mid;
                                }
                                return low;
                            }

                            /**
                             * Creates an array of unique values, in order, of the provided arrays using
                             * strict equality for comparisons, i.e. `===`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {...Array} [array] The arrays to inspect.
                             * @returns {Array} Returns an array of combined values.
                             * @example
                             *
                             * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
                             * // => [1, 2, 3, 5, 4]
                             */

                            function union() {
                                return baseUniq(baseFlatten(arguments, true, true));
                            }

                            /**
                             * Creates a duplicate-value-free version of an array using strict equality
                             * for comparisons, i.e. `===`. If the array is sorted, providing
                             * `true` for `isSorted` will use a faster algorithm. If a callback is provided
                             * each element of `array` is passed through the callback before uniqueness
                             * is computed. The callback is bound to `thisArg` and invoked with three
                             * arguments; (value, index, array).
                             *
                             * If a property name is provided for `callback` the created "_.pluck" style
                             * callback will return the property value of the given element.
                             *
                             * If an object is provided for `callback` the created "_.where" style callback
                             * will return `true` for elements that have the properties of the given object,
                             * else `false`.
                             *
                             * @static
                             * @memberOf _
                             * @alias unique
                             * @category Arrays
                             * @param {Array} array The array to process.
                             * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
                             * @param {Function|Object|string} [callback=identity] The function called
                             *  per iteration. If a property name or object is provided it will be used
                             *  to create a "_.pluck" or "_.where" style callback, respectively.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns a duplicate-value-free array.
                             * @example
                             *
                             * _.uniq([1, 2, 1, 3, 1]);
                             * // => [1, 2, 3]
                             *
                             * _.uniq([1, 1, 2, 2, 3], true);
                             * // => [1, 2, 3]
                             *
                             * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
                             * // => ['A', 'b', 'C']
                             *
                             * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
                             * // => [1, 2.5, 3]
                             *
                             * // using "_.pluck" callback shorthand
                             * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
                             * // => [{ 'x': 1 }, { 'x': 2 }]
                             */

                            function uniq(array, isSorted, callback, thisArg) {
                                // juggle arguments
                                if (typeof isSorted != 'boolean' && isSorted != null) {
                                    thisArg = callback;
                                    callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
                                    isSorted = false;
                                }
                                if (callback != null) {
                                    callback = lodash.createCallback(callback, thisArg, 3);
                                }
                                return baseUniq(array, isSorted, callback);
                            }

                            /**
                             * Creates an array excluding all provided values using strict equality for
                             * comparisons, i.e. `===`.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {Array} array The array to filter.
                             * @param {...*} [value] The values to exclude.
                             * @returns {Array} Returns a new array of filtered values.
                             * @example
                             *
                             * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
                             * // => [2, 3, 4]
                             */

                            function without(array) {
                                return baseDifference(array, slice(arguments, 1));
                            }

                            /**
                             * Creates an array that is the symmetric difference of the provided arrays.
                             * See http://en.wikipedia.org/wiki/Symmetric_difference.
                             *
                             * @static
                             * @memberOf _
                             * @category Arrays
                             * @param {...Array} [array] The arrays to inspect.
                             * @returns {Array} Returns an array of values.
                             * @example
                             *
                             * _.xor([1, 2, 3], [5, 2, 1, 4]);
                             * // => [3, 5, 4]
                             *
                             * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
                             * // => [1, 4, 5]
                             */

                            function xor() {
                                var index = -1,
                                    length = arguments.length;

                                while (++index < length) {
                                    var array = arguments[index];
                                    if (isArray(array) || isArguments(array)) {
                                        var result = result ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result))) : array;
                                    }
                                }
                                return result || [];
                            }

                            /**
                             * Creates an array of grouped elements, the first of which contains the first
                             * elements of the given arrays, the second of which contains the second
                             * elements of the given arrays, and so on.
                             *
                             * @static
                             * @memberOf _
                             * @alias unzip
                             * @category Arrays
                             * @param {...Array} [array] Arrays to process.
                             * @returns {Array} Returns a new array of grouped elements.
                             * @example
                             *
                             * _.zip(['fred', 'barney'], [30, 40], [true, false]);
                             * // => [['fred', 30, true], ['barney', 40, false]]
                             */

                            function zip() {
                                var array = arguments.length > 1 ? arguments : arguments[0],
                                    index = -1,
                                    length = array ? max(pluck(array, 'length')) : 0,
                                    result = Array(length < 0 ? 0 : length);

                                while (++index < length) {
                                    result[index] = pluck(array, index);
                                }
                                return result;
                            }

                            /**
                             * Creates an object composed from arrays of `keys` and `values`. Provide
                             * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
                             * or two arrays, one of `keys` and one of corresponding `values`.
                             *
                             * @static
                             * @memberOf _
                             * @alias object
                             * @category Arrays
                             * @param {Array} keys The array of keys.
                             * @param {Array} [values=[]] The array of values.
                             * @returns {Object} Returns an object composed of the given keys and
                             *  corresponding values.
                             * @example
                             *
                             * _.zipObject(['fred', 'barney'], [30, 40]);
                             * // => { 'fred': 30, 'barney': 40 }
                             */

                            function zipObject(keys, values) {
                                var index = -1,
                                    length = keys ? keys.length : 0,
                                    result = {};

                                if (!values && length && !isArray(keys[0])) {
                                    values = [];
                                }
                                while (++index < length) {
                                    var key = keys[index];
                                    if (values) {
                                        result[key] = values[index];
                                    } else if (key) {
                                        result[key[0]] = key[1];
                                    }
                                }
                                return result;
                            }

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates a function that executes `func`, with  the `this` binding and
                             * arguments of the created function, only after being called `n` times.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {number} n The number of times the function must be called before
                             *  `func` is executed.
                             * @param {Function} func The function to restrict.
                             * @returns {Function} Returns the new restricted function.
                             * @example
                             *
                             * var saves = ['profile', 'settings'];
                             *
                             * var done = _.after(saves.length, function() {
                             *   console.log('Done saving!');
                             * });
                             *
                             * _.forEach(saves, function(type) {
                             *   asyncSave({ 'type': type, 'complete': done });
                             * });
                             * // => logs 'Done saving!', after all saves have completed
                             */

                            function after(n, func) {
                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                return function() {
                                    if (--n < 1) {
                                        return func.apply(this, arguments);
                                    }
                                };
                            }

                            /**
                             * Creates a function that, when called, invokes `func` with the `this`
                             * binding of `thisArg` and prepends any additional `bind` arguments to those
                             * provided to the bound function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to bind.
                             * @param {*} [thisArg] The `this` binding of `func`.
                             * @param {...*} [arg] Arguments to be partially applied.
                             * @returns {Function} Returns the new bound function.
                             * @example
                             *
                             * var func = function(greeting) {
                             *   return greeting + ' ' + this.name;
                             * };
                             *
                             * func = _.bind(func, { 'name': 'fred' }, 'hi');
                             * func();
                             * // => 'hi fred'
                             */

                            function bind(func, thisArg) {
                                return arguments.length > 2 ? createWrapper(func, 17, slice(arguments, 2), null, thisArg) : createWrapper(func, 1, null, null, thisArg);
                            }

                            /**
                             * Binds methods of an object to the object itself, overwriting the existing
                             * method. Method names may be specified as individual arguments or as arrays
                             * of method names. If no method names are provided all the function properties
                             * of `object` will be bound.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Object} object The object to bind and assign the bound methods to.
                             * @param {...string} [methodName] The object method names to
                             *  bind, specified as individual method names or arrays of method names.
                             * @returns {Object} Returns `object`.
                             * @example
                             *
                             * var view = {
                             *   'label': 'docs',
                             *   'onClick': function() { console.log('clicked ' + this.label); }
                             * };
                             *
                             * _.bindAll(view);
                             * jQuery('#docs').on('click', view.onClick);
                             * // => logs 'clicked docs', when the button is clicked
                             */

                            function bindAll(object) {
                                var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
                                    index = -1,
                                    length = funcs.length;

                                while (++index < length) {
                                    var key = funcs[index];
                                    object[key] = createWrapper(object[key], 1, null, null, object);
                                }
                                return object;
                            }

                            /**
                             * Creates a function that, when called, invokes the method at `object[key]`
                             * and prepends any additional `bindKey` arguments to those provided to the bound
                             * function. This method differs from `_.bind` by allowing bound functions to
                             * reference methods that will be redefined or don't yet exist.
                             * See http://michaux.ca/articles/lazy-function-definition-pattern.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Object} object The object the method belongs to.
                             * @param {string} key The key of the method.
                             * @param {...*} [arg] Arguments to be partially applied.
                             * @returns {Function} Returns the new bound function.
                             * @example
                             *
                             * var object = {
                             *   'name': 'fred',
                             *   'greet': function(greeting) {
                             *     return greeting + ' ' + this.name;
                             *   }
                             * };
                             *
                             * var func = _.bindKey(object, 'greet', 'hi');
                             * func();
                             * // => 'hi fred'
                             *
                             * object.greet = function(greeting) {
                             *   return greeting + 'ya ' + this.name + '!';
                             * };
                             *
                             * func();
                             * // => 'hiya fred!'
                             */

                            function bindKey(object, key) {
                                return arguments.length > 2 ? createWrapper(key, 19, slice(arguments, 2), null, object) : createWrapper(key, 3, null, null, object);
                            }

                            /**
                             * Creates a function that is the composition of the provided functions,
                             * where each function consumes the return value of the function that follows.
                             * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
                             * Each function is executed with the `this` binding of the composed function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {...Function} [func] Functions to compose.
                             * @returns {Function} Returns the new composed function.
                             * @example
                             *
                             * var realNameMap = {
                             *   'pebbles': 'penelope'
                             * };
                             *
                             * var format = function(name) {
                             *   name = realNameMap[name.toLowerCase()] || name;
                             *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                             * };
                             *
                             * var greet = function(formatted) {
                             *   return 'Hiya ' + formatted + '!';
                             * };
                             *
                             * var welcome = _.compose(greet, format);
                             * welcome('pebbles');
                             * // => 'Hiya Penelope!'
                             */

                            function compose() {
                                var funcs = arguments,
                                    length = funcs.length;

                                while (length--) {
                                    if (!isFunction(funcs[length])) {
                                        throw new TypeError;
                                    }
                                }
                                return function() {
                                    var args = arguments,
                                        length = funcs.length;

                                    while (length--) {
                                        args = [funcs[length].apply(this, args)];
                                    }
                                    return args[0];
                                };
                            }

                            /**
                             * Creates a function which accepts one or more arguments of `func` that when
                             * invoked either executes `func` returning its result, if all `func` arguments
                             * have been provided, or returns a function that accepts one or more of the
                             * remaining `func` arguments, and so on. The arity of `func` can be specified
                             * if `func.length` is not sufficient.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to curry.
                             * @param {number} [arity=func.length] The arity of `func`.
                             * @returns {Function} Returns the new curried function.
                             * @example
                             *
                             * var curried = _.curry(function(a, b, c) {
                             *   console.log(a + b + c);
                             * });
                             *
                             * curried(1)(2)(3);
                             * // => 6
                             *
                             * curried(1, 2)(3);
                             * // => 6
                             *
                             * curried(1, 2, 3);
                             * // => 6
                             */

                            function curry(func, arity) {
                                arity = typeof arity == 'number' ? arity : (+arity || func.length);
                                return createWrapper(func, 4, null, null, null, arity);
                            }

                            /**
                             * Creates a function that will delay the execution of `func` until after
                             * `wait` milliseconds have elapsed since the last time it was invoked.
                             * Provide an options object to indicate that `func` should be invoked on
                             * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
                             * to the debounced function will return the result of the last `func` call.
                             *
                             * Note: If `leading` and `trailing` options are `true` `func` will be called
                             * on the trailing edge of the timeout only if the the debounced function is
                             * invoked more than once during the `wait` timeout.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to debounce.
                             * @param {number} wait The number of milliseconds to delay.
                             * @param {Object} [options] The options object.
                             * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
                             * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
                             * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
                             * @returns {Function} Returns the new debounced function.
                             * @example
                             *
                             * // avoid costly calculations while the window size is in flux
                             * var lazyLayout = _.debounce(calculateLayout, 150);
                             * jQuery(window).on('resize', lazyLayout);
                             *
                             * // execute `sendMail` when the click event is fired, debouncing subsequent calls
                             * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
                             *   'leading': true,
                             *   'trailing': false
                             * });
                             *
                             * // ensure `batchLog` is executed once after 1 second of debounced calls
                             * var source = new EventSource('/stream');
                             * source.addEventListener('message', _.debounce(batchLog, 250, {
                             *   'maxWait': 1000
                             * }, false);
                             */

                            function debounce(func, wait, options) {
                                var args,
                                    maxTimeoutId,
                                    result,
                                    stamp,
                                    thisArg,
                                    timeoutId,
                                    trailingCall,
                                    lastCalled = 0,
                                    maxWait = false,
                                    trailing = true;

                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                wait = nativeMax(0, wait) || 0;
                                if (options === true) {
                                    var leading = true;
                                    trailing = false;
                                } else if (isObject(options)) {
                                    leading = options.leading;
                                    maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
                                    trailing = 'trailing' in options ? options.trailing : trailing;
                                }
                                var delayed = function() {
                                    var remaining = wait - (now() - stamp);
                                    if (remaining <= 0) {
                                        if (maxTimeoutId) {
                                            clearTimeout(maxTimeoutId);
                                        }
                                        var isCalled = trailingCall;
                                        maxTimeoutId = timeoutId = trailingCall = undefined;
                                        if (isCalled) {
                                            lastCalled = now();
                                            result = func.apply(thisArg, args);
                                            if (!timeoutId && !maxTimeoutId) {
                                                args = thisArg = null;
                                            }
                                        }
                                    } else {
                                        timeoutId = setTimeout(delayed, remaining);
                                    }
                                };

                                var maxDelayed = function() {
                                    if (timeoutId) {
                                        clearTimeout(timeoutId);
                                    }
                                    maxTimeoutId = timeoutId = trailingCall = undefined;
                                    if (trailing || (maxWait !== wait)) {
                                        lastCalled = now();
                                        result = func.apply(thisArg, args);
                                        if (!timeoutId && !maxTimeoutId) {
                                            args = thisArg = null;
                                        }
                                    }
                                };

                                return function() {
                                    args = arguments;
                                    stamp = now();
                                    thisArg = this;
                                    trailingCall = trailing && (timeoutId || !leading);

                                    if (maxWait === false) {
                                        var leadingCall = leading && !timeoutId;
                                    } else {
                                        if (!maxTimeoutId && !leading) {
                                            lastCalled = stamp;
                                        }
                                        var remaining = maxWait - (stamp - lastCalled),
                                            isCalled = remaining <= 0;

                                        if (isCalled) {
                                            if (maxTimeoutId) {
                                                maxTimeoutId = clearTimeout(maxTimeoutId);
                                            }
                                            lastCalled = stamp;
                                            result = func.apply(thisArg, args);
                                        } else if (!maxTimeoutId) {
                                            maxTimeoutId = setTimeout(maxDelayed, remaining);
                                        }
                                    }
                                    if (isCalled && timeoutId) {
                                        timeoutId = clearTimeout(timeoutId);
                                    } else if (!timeoutId && wait !== maxWait) {
                                        timeoutId = setTimeout(delayed, wait);
                                    }
                                    if (leadingCall) {
                                        isCalled = true;
                                        result = func.apply(thisArg, args);
                                    }
                                    if (isCalled && !timeoutId && !maxTimeoutId) {
                                        args = thisArg = null;
                                    }
                                    return result;
                                };
                            }

                            /**
                             * Defers executing the `func` function until the current call stack has cleared.
                             * Additional arguments will be provided to `func` when it is invoked.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to defer.
                             * @param {...*} [arg] Arguments to invoke the function with.
                             * @returns {number} Returns the timer id.
                             * @example
                             *
                             * _.defer(function(text) { console.log(text); }, 'deferred');
                             * // logs 'deferred' after one or more milliseconds
                             */

                            function defer(func) {
                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                var args = slice(arguments, 1);
                                return setTimeout(function() {
                                    func.apply(undefined, args);
                                }, 1);
                            }

                            /**
                             * Executes the `func` function after `wait` milliseconds. Additional arguments
                             * will be provided to `func` when it is invoked.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to delay.
                             * @param {number} wait The number of milliseconds to delay execution.
                             * @param {...*} [arg] Arguments to invoke the function with.
                             * @returns {number} Returns the timer id.
                             * @example
                             *
                             * _.delay(function(text) { console.log(text); }, 1000, 'later');
                             * // => logs 'later' after one second
                             */

                            function delay(func, wait) {
                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                var args = slice(arguments, 2);
                                return setTimeout(function() {
                                    func.apply(undefined, args);
                                }, wait);
                            }

                            /**
                             * Creates a function that memoizes the result of `func`. If `resolver` is
                             * provided it will be used to determine the cache key for storing the result
                             * based on the arguments provided to the memoized function. By default, the
                             * first argument provided to the memoized function is used as the cache key.
                             * The `func` is executed with the `this` binding of the memoized function.
                             * The result cache is exposed as the `cache` property on the memoized function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to have its output memoized.
                             * @param {Function} [resolver] A function used to resolve the cache key.
                             * @returns {Function} Returns the new memoizing function.
                             * @example
                             *
                             * var fibonacci = _.memoize(function(n) {
                             *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
                             * });
                             *
                             * fibonacci(9)
                             * // => 34
                             *
                             * var data = {
                             *   'fred': { 'name': 'fred', 'age': 40 },
                             *   'pebbles': { 'name': 'pebbles', 'age': 1 }
                             * };
                             *
                             * // modifying the result cache
                             * var get = _.memoize(function(name) { return data[name]; }, _.identity);
                             * get('pebbles');
                             * // => { 'name': 'pebbles', 'age': 1 }
                             *
                             * get.cache.pebbles.name = 'penelope';
                             * get('pebbles');
                             * // => { 'name': 'penelope', 'age': 1 }
                             */

                            function memoize(func, resolver) {
                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                var memoized = function() {
                                    var cache = memoized.cache,
                                        key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

                                    return hasOwnProperty.call(cache, key) ? cache[key] : (cache[key] = func.apply(this, arguments));
                                }
                                memoized.cache = {};
                                return memoized;
                            }

                            /**
                             * Creates a function that is restricted to execute `func` once. Repeat calls to
                             * the function will return the value of the first call. The `func` is executed
                             * with the `this` binding of the created function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to restrict.
                             * @returns {Function} Returns the new restricted function.
                             * @example
                             *
                             * var initialize = _.once(createApplication);
                             * initialize();
                             * initialize();
                             * // `initialize` executes `createApplication` once
                             */

                            function once(func) {
                                var ran,
                                    result;

                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                return function() {
                                    if (ran) {
                                        return result;
                                    }
                                    ran = true;
                                    result = func.apply(this, arguments);

                                    // clear the `func` variable so the function may be garbage collected
                                    func = null;
                                    return result;
                                };
                            }

                            /**
                             * Creates a function that, when called, invokes `func` with any additional
                             * `partial` arguments prepended to those provided to the new function. This
                             * method is similar to `_.bind` except it does **not** alter the `this` binding.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to partially apply arguments to.
                             * @param {...*} [arg] Arguments to be partially applied.
                             * @returns {Function} Returns the new partially applied function.
                             * @example
                             *
                             * var greet = function(greeting, name) { return greeting + ' ' + name; };
                             * var hi = _.partial(greet, 'hi');
                             * hi('fred');
                             * // => 'hi fred'
                             */

                            function partial(func) {
                                return createWrapper(func, 16, slice(arguments, 1));
                            }

                            /**
                             * This method is like `_.partial` except that `partial` arguments are
                             * appended to those provided to the new function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to partially apply arguments to.
                             * @param {...*} [arg] Arguments to be partially applied.
                             * @returns {Function} Returns the new partially applied function.
                             * @example
                             *
                             * var defaultsDeep = _.partialRight(_.merge, _.defaults);
                             *
                             * var options = {
                             *   'variable': 'data',
                             *   'imports': { 'jq': $ }
                             * };
                             *
                             * defaultsDeep(options, _.templateSettings);
                             *
                             * options.variable
                             * // => 'data'
                             *
                             * options.imports
                             * // => { '_': _, 'jq': $ }
                             */

                            function partialRight(func) {
                                return createWrapper(func, 32, null, slice(arguments, 1));
                            }

                            /**
                             * Creates a function that, when executed, will only call the `func` function
                             * at most once per every `wait` milliseconds. Provide an options object to
                             * indicate that `func` should be invoked on the leading and/or trailing edge
                             * of the `wait` timeout. Subsequent calls to the throttled function will
                             * return the result of the last `func` call.
                             *
                             * Note: If `leading` and `trailing` options are `true` `func` will be called
                             * on the trailing edge of the timeout only if the the throttled function is
                             * invoked more than once during the `wait` timeout.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {Function} func The function to throttle.
                             * @param {number} wait The number of milliseconds to throttle executions to.
                             * @param {Object} [options] The options object.
                             * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
                             * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
                             * @returns {Function} Returns the new throttled function.
                             * @example
                             *
                             * // avoid excessively updating the position while scrolling
                             * var throttled = _.throttle(updatePosition, 100);
                             * jQuery(window).on('scroll', throttled);
                             *
                             * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
                             * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
                             *   'trailing': false
                             * }));
                             */

                            function throttle(func, wait, options) {
                                var leading = true,
                                    trailing = true;

                                if (!isFunction(func)) {
                                    throw new TypeError;
                                }
                                if (options === false) {
                                    leading = false;
                                } else if (isObject(options)) {
                                    leading = 'leading' in options ? options.leading : leading;
                                    trailing = 'trailing' in options ? options.trailing : trailing;
                                }
                                debounceOptions.leading = leading;
                                debounceOptions.maxWait = wait;
                                debounceOptions.trailing = trailing;

                                return debounce(func, wait, debounceOptions);
                            }

                            /**
                             * Creates a function that provides `value` to the wrapper function as its
                             * first argument. Additional arguments provided to the function are appended
                             * to those provided to the wrapper function. The wrapper is executed with
                             * the `this` binding of the created function.
                             *
                             * @static
                             * @memberOf _
                             * @category Functions
                             * @param {*} value The value to wrap.
                             * @param {Function} wrapper The wrapper function.
                             * @returns {Function} Returns the new function.
                             * @example
                             *
                             * var p = _.wrap(_.escape, function(func, text) {
                             *   return '<p>' + func(text) + '</p>';
                             * });
                             *
                             * p('Fred, Wilma, & Pebbles');
                             * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
                             */

                            function wrap(value, wrapper) {
                                return createWrapper(wrapper, 16, [value]);
                            }

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates a function that returns `value`.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {*} value The value to return from the new function.
                             * @returns {Function} Returns the new function.
                             * @example
                             *
                             * var object = { 'name': 'fred' };
                             * var getter = _.constant(object);
                             * getter() === object;
                             * // => true
                             */

                            function constant(value) {
                                return function() {
                                    return value;
                                };
                            }

                            /**
                             * Produces a callback bound to an optional `thisArg`. If `func` is a property
                             * name the created callback will return the property value for a given element.
                             * If `func` is an object the created callback will return `true` for elements
                             * that contain the equivalent object properties, otherwise it will return `false`.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {*} [func=identity] The value to convert to a callback.
                             * @param {*} [thisArg] The `this` binding of the created callback.
                             * @param {number} [argCount] The number of arguments the callback accepts.
                             * @returns {Function} Returns a callback function.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * // wrap to create custom callback shorthands
                             * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
                             *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
                             *   return !match ? func(callback, thisArg) : function(object) {
                             *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
                             *   };
                             * });
                             *
                             * _.filter(characters, 'age__gt38');
                             * // => [{ 'name': 'fred', 'age': 40 }]
                             */

                            function createCallback(func, thisArg, argCount) {
                                var type = typeof func;
                                if (func == null || type == 'function') {
                                    return baseCreateCallback(func, thisArg, argCount);
                                }
                                // handle "_.pluck" style callback shorthands
                                if (type != 'object') {
                                    return property(func);
                                }
                                var props = keys(func),
                                    key = props[0],
                                    a = func[key];

                                // handle "_.where" style callback shorthands
                                if (props.length == 1 && a === a && !isObject(a)) {
                                    // fast path the common case of providing an object with a single
                                    // property containing a primitive value
                                    return function(object) {
                                        var b = object[key];
                                        return a === b && (a !== 0 || (1 / a == 1 / b));
                                    };
                                }
                                return function(object) {
                                    var length = props.length,
                                        result = false;

                                    while (length--) {
                                        if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
                                            break;
                                        }
                                    }
                                    return result;
                                };
                            }

                            /**
                             * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
                             * corresponding HTML entities.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} string The string to escape.
                             * @returns {string} Returns the escaped string.
                             * @example
                             *
                             * _.escape('Fred, Wilma, & Pebbles');
                             * // => 'Fred, Wilma, &amp; Pebbles'
                             */

                            function escape(string) {
                                return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
                            }

                            /**
                             * This method returns the first argument provided to it.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {*} value Any value.
                             * @returns {*} Returns `value`.
                             * @example
                             *
                             * var object = { 'name': 'fred' };
                             * _.identity(object) === object;
                             * // => true
                             */

                            function identity(value) {
                                return value;
                            }

                            /**
                             * Adds function properties of a source object to the destination object.
                             * If `object` is a function methods will be added to its prototype as well.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {Function|Object} [object=lodash] object The destination object.
                             * @param {Object} source The object of functions to add.
                             * @param {Object} [options] The options object.
                             * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
                             * @example
                             *
                             * function capitalize(string) {
                             *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
                             * }
                             *
                             * _.mixin({ 'capitalize': capitalize });
                             * _.capitalize('fred');
                             * // => 'Fred'
                             *
                             * _('fred').capitalize().value();
                             * // => 'Fred'
                             *
                             * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
                             * _('fred').capitalize();
                             * // => 'Fred'
                             */

                            function mixin(object, source, options) {
                                var chain = true,
                                    methodNames = source && functions(source);

                                if (!source || (!options && !methodNames.length)) {
                                    if (options == null) {
                                        options = source;
                                    }
                                    ctor = lodashWrapper;
                                    source = object;
                                    object = lodash;
                                    methodNames = functions(source);
                                }
                                if (options === false) {
                                    chain = false;
                                } else if (isObject(options) && 'chain' in options) {
                                    chain = options.chain;
                                }
                                var ctor = object,
                                    isFunc = isFunction(ctor);

                                forEach(methodNames, function(methodName) {
                                    var func = object[methodName] = source[methodName];
                                    if (isFunc) {
                                        ctor.prototype[methodName] = function() {
                                            var chainAll = this.__chain__,
                                                value = this.__wrapped__,
                                                args = [value];

                                            push.apply(args, arguments);
                                            var result = func.apply(object, args);
                                            if (chain || chainAll) {
                                                if (value === result && isObject(result)) {
                                                    return this;
                                                }
                                                result = new ctor(result);
                                                result.__chain__ = chainAll;
                                            }
                                            return result;
                                        };
                                    }
                                });
                            }

                            /**
                             * Reverts the '_' variable to its previous value and returns a reference to
                             * the `lodash` function.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @returns {Function} Returns the `lodash` function.
                             * @example
                             *
                             * var lodash = _.noConflict();
                             */

                            function noConflict() {
                                context._ = oldDash;
                                return this;
                            }

                            /**
                             * A no-operation function.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @example
                             *
                             * var object = { 'name': 'fred' };
                             * _.noop(object) === undefined;
                             * // => true
                             */

                            function noop() {
                                // no operation performed
                            }

                            /**
                             * Gets the number of milliseconds that have elapsed since the Unix epoch
                             * (1 January 1970 00:00:00 UTC).
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @example
                             *
                             * var stamp = _.now();
                             * _.defer(function() { console.log(_.now() - stamp); });
                             * // => logs the number of milliseconds it took for the deferred function to be called
                             */
                            var now = isNative(now = Date.now) && now || function() {
                                    return new Date().getTime();
                                };

                            /**
                             * Converts the given value into an integer of the specified radix.
                             * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
                             * `value` is a hexadecimal, in which case a `radix` of `16` is used.
                             *
                             * Note: This method avoids differences in native ES3 and ES5 `parseInt`
                             * implementations. See http://es5.github.io/#E.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} value The value to parse.
                             * @param {number} [radix] The radix used to interpret the value to parse.
                             * @returns {number} Returns the new integer value.
                             * @example
                             *
                             * _.parseInt('08');
                             * // => 8
                             */
                            var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
                                    // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
                                    return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
                                };

                            /**
                             * Creates a "_.pluck" style function, which returns the `key` value of a
                             * given object.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} key The name of the property to retrieve.
                             * @returns {Function} Returns the new function.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'fred',   'age': 40 },
                             *   { 'name': 'barney', 'age': 36 }
                             * ];
                             *
                             * var getName = _.property('name');
                             *
                             * _.map(characters, getName);
                             * // => ['barney', 'fred']
                             *
                             * _.sortBy(characters, getName);
                             * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
                             */

                            function property(key) {
                                return function(object) {
                                    return object[key];
                                };
                            }

                            /**
                             * Produces a random number between `min` and `max` (inclusive). If only one
                             * argument is provided a number between `0` and the given number will be
                             * returned. If `floating` is truey or either `min` or `max` are floats a
                             * floating-point number will be returned instead of an integer.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {number} [min=0] The minimum possible value.
                             * @param {number} [max=1] The maximum possible value.
                             * @param {boolean} [floating=false] Specify returning a floating-point number.
                             * @returns {number} Returns a random number.
                             * @example
                             *
                             * _.random(0, 5);
                             * // => an integer between 0 and 5
                             *
                             * _.random(5);
                             * // => also an integer between 0 and 5
                             *
                             * _.random(5, true);
                             * // => a floating-point number between 0 and 5
                             *
                             * _.random(1.2, 5.2);
                             * // => a floating-point number between 1.2 and 5.2
                             */

                            function random(min, max, floating) {
                                var noMin = min == null,
                                    noMax = max == null;

                                if (floating == null) {
                                    if (typeof min == 'boolean' && noMax) {
                                        floating = min;
                                        min = 1;
                                    } else if (!noMax && typeof max == 'boolean') {
                                        floating = max;
                                        noMax = true;
                                    }
                                }
                                if (noMin && noMax) {
                                    max = 1;
                                }
                                min = +min || 0;
                                if (noMax) {
                                    max = min;
                                    min = 0;
                                } else {
                                    max = +max || 0;
                                }
                                if (floating || min % 1 || max % 1) {
                                    var rand = nativeRandom();
                                    return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand + '').length - 1)))), max);
                                }
                                return baseRandom(min, max);
                            }

                            /**
                             * Resolves the value of property `key` on `object`. If `key` is a function
                             * it will be invoked with the `this` binding of `object` and its result returned,
                             * else the property value is returned. If `object` is falsey then `undefined`
                             * is returned.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {Object} object The object to inspect.
                             * @param {string} key The name of the property to resolve.
                             * @returns {*} Returns the resolved value.
                             * @example
                             *
                             * var object = {
                             *   'cheese': 'crumpets',
                             *   'stuff': function() {
                             *     return 'nonsense';
                             *   }
                             * };
                             *
                             * _.result(object, 'cheese');
                             * // => 'crumpets'
                             *
                             * _.result(object, 'stuff');
                             * // => 'nonsense'
                             */

                            function result(object, key) {
                                if (object) {
                                    var value = object[key];
                                    return isFunction(value) ? object[key]() : value;
                                }
                            }

                            /**
                             * A micro-templating method that handles arbitrary delimiters, preserves
                             * whitespace, and correctly escapes quotes within interpolated code.
                             *
                             * Note: In the development build, `_.template` utilizes sourceURLs for easier
                             * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
                             *
                             * For more information on precompiling templates see:
                             * http://lodash.com/custom-builds
                             *
                             * For more information on Chrome extension sandboxes see:
                             * http://developer.chrome.com/stable/extensions/sandboxingEval.html
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} text The template text.
                             * @param {Object} data The data object used to populate the text.
                             * @param {Object} [options] The options object.
                             * @param {RegExp} [options.escape] The "escape" delimiter.
                             * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
                             * @param {Object} [options.imports] An object to import into the template as local variables.
                             * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
                             * @param {string} [sourceURL] The sourceURL of the template's compiled source.
                             * @param {string} [variable] The data object variable name.
                             * @returns {Function|string} Returns a compiled function when no `data` object
                             *  is given, else it returns the interpolated text.
                             * @example
                             *
                             * // using the "interpolate" delimiter to create a compiled template
                             * var compiled = _.template('hello <%= name %>');
                             * compiled({ 'name': 'fred' });
                             * // => 'hello fred'
                             *
                             * // using the "escape" delimiter to escape HTML in data property values
                             * _.template('<b><%- value %></b>', { 'value': '<script>' });
                             * // => '<b>&lt;script&gt;</b>'
                             *
                             * // using the "evaluate" delimiter to generate HTML
                             * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
                             * _.template(list, { 'people': ['fred', 'barney'] });
                             * // => '<li>fred</li><li>barney</li>'
                             *
                             * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
                             * _.template('hello ${ name }', { 'name': 'pebbles' });
                             * // => 'hello pebbles'
                             *
                             * // using the internal `print` function in "evaluate" delimiters
                             * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
                             * // => 'hello barney!'
                             *
                             * // using a custom template delimiters
                             * _.templateSettings = {
                             *   'interpolate': /{{([\s\S]+?)}}/g
                             * };
                             *
                             * _.template('hello {{ name }}!', { 'name': 'mustache' });
                             * // => 'hello mustache!'
                             *
                             * // using the `imports` option to import jQuery
                             * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
                             * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
                             * // => '<li>fred</li><li>barney</li>'
                             *
                             * // using the `sourceURL` option to specify a custom sourceURL for the template
                             * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
                             * compiled(data);
                             * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
                             *
                             * // using the `variable` option to ensure a with-statement isn't used in the compiled template
                             * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
                             * compiled.source;
                             * // => function(data) {
                             *   var __t, __p = '', __e = _.escape;
                             *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
                             *   return __p;
                             * }
                             *
                             * // using the `source` property to inline compiled templates for meaningful
                             * // line numbers in error messages and a stack trace
                             * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
                             *   var JST = {\
                             *     "main": ' + _.template(mainText).source + '\
                             *   };\
                             * ');
                             */

                            function template(text, data, options) {
                                // based on John Resig's `tmpl` implementation
                                // http://ejohn.org/blog/javascript-micro-templating/
                                // and Laura Doktorova's doT.js
                                // https://github.com/olado/doT
                                var settings = lodash.templateSettings;
                                text = String(text || '');

                                // avoid missing dependencies when `iteratorTemplate` is not defined
                                options = defaults({}, options, settings);

                                var imports = defaults({}, options.imports, settings.imports),
                                    importsKeys = keys(imports),
                                    importsValues = values(imports);

                                var isEvaluating,
                                    index = 0,
                                    interpolate = options.interpolate || reNoMatch,
                                    source = "__p += '";

                                // compile the regexp to match each delimiter
                                var reDelimiters = RegExp(
                                    (options.escape || reNoMatch).source + '|' +
                                    interpolate.source + '|' +
                                    (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
                                    (options.evaluate || reNoMatch).source + '|$', 'g');

                                text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
                                    interpolateValue || (interpolateValue = esTemplateValue);

                                    // escape characters that cannot be included in string literals
                                    source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

                                    // replace delimiters with snippets
                                    if (escapeValue) {
                                        source += "' +\n__e(" + escapeValue + ") +\n'";
                                    }
                                    if (evaluateValue) {
                                        isEvaluating = true;
                                        source += "';\n" + evaluateValue + ";\n__p += '";
                                    }
                                    if (interpolateValue) {
                                        source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
                                    }
                                    index = offset + match.length;

                                    // the JS engine embedded in Adobe products requires returning the `match`
                                    // string in order to produce the correct `offset` value
                                    return match;
                                });

                                source += "';\n";

                                // if `variable` is not specified, wrap a with-statement around the generated
                                // code to add the data object to the top of the scope chain
                                var variable = options.variable,
                                    hasVariable = variable;

                                if (!hasVariable) {
                                    variable = 'obj';
                                    source = 'with (' + variable + ') {\n' + source + '\n}\n';
                                }
                                // cleanup code by stripping empty strings
                                source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
                                    .replace(reEmptyStringMiddle, '$1')
                                    .replace(reEmptyStringTrailing, '$1;');

                                // frame code as the function body
                                source = 'function(' + variable + ') {\n' +
                                    (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
                                    "var __t, __p = '', __e = _.escape" +
                                    (isEvaluating ? ', __j = Array.prototype.join;\n' +
                                    "function print() { __p += __j.call(arguments, '') }\n" : ';\n'
                                ) +
                                    source +
                                    'return __p\n}';

                                // Use a sourceURL for easier debugging.
                                // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
                                var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

                                try {
                                    var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
                                } catch (e) {
                                    e.source = source;
                                    throw e;
                                }
                                if (data) {
                                    return result(data);
                                }
                                // provide the compiled function's source by its `toString` method, in
                                // supported environments, or the `source` property as a convenience for
                                // inlining compiled templates during the build process
                                result.source = source;
                                return result;
                            }

                            /**
                             * Executes the callback `n` times, returning an array of the results
                             * of each callback execution. The callback is bound to `thisArg` and invoked
                             * with one argument; (index).
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {number} n The number of times to execute the callback.
                             * @param {Function} callback The function called per iteration.
                             * @param {*} [thisArg] The `this` binding of `callback`.
                             * @returns {Array} Returns an array of the results of each `callback` execution.
                             * @example
                             *
                             * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
                             * // => [3, 6, 4]
                             *
                             * _.times(3, function(n) { mage.castSpell(n); });
                             * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
                             *
                             * _.times(3, function(n) { this.cast(n); }, mage);
                             * // => also calls `mage.castSpell(n)` three times
                             */

                            function times(n, callback, thisArg) {
                                n = (n = +n) > -1 ? n : 0;
                                var index = -1,
                                    result = Array(n);

                                callback = baseCreateCallback(callback, thisArg, 1);
                                while (++index < n) {
                                    result[index] = callback(index);
                                }
                                return result;
                            }

                            /**
                             * The inverse of `_.escape` this method converts the HTML entities
                             * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
                             * corresponding characters.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} string The string to unescape.
                             * @returns {string} Returns the unescaped string.
                             * @example
                             *
                             * _.unescape('Fred, Barney &amp; Pebbles');
                             * // => 'Fred, Barney & Pebbles'
                             */

                            function unescape(string) {
                                return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
                            }

                            /**
                             * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
                             *
                             * @static
                             * @memberOf _
                             * @category Utilities
                             * @param {string} [prefix] The value to prefix the ID with.
                             * @returns {string} Returns the unique ID.
                             * @example
                             *
                             * _.uniqueId('contact_');
                             * // => 'contact_104'
                             *
                             * _.uniqueId();
                             * // => '105'
                             */

                            function uniqueId(prefix) {
                                var id = ++idCounter;
                                return String(prefix == null ? '' : prefix) + id;
                            }

                            /*--------------------------------------------------------------------------*/

                            /**
                             * Creates a `lodash` object that wraps the given value with explicit
                             * method chaining enabled.
                             *
                             * @static
                             * @memberOf _
                             * @category Chaining
                             * @param {*} value The value to wrap.
                             * @returns {Object} Returns the wrapper object.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney',  'age': 36 },
                             *   { 'name': 'fred',    'age': 40 },
                             *   { 'name': 'pebbles', 'age': 1 }
                             * ];
                             *
                             * var youngest = _.chain(characters)
                             *     .sortBy('age')
                             *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
                             *     .first()
                             *     .value();
                             * // => 'pebbles is 1'
                             */

                            function chain(value) {
                                value = new lodashWrapper(value);
                                value.__chain__ = true;
                                return value;
                            }

                            /**
                             * Invokes `interceptor` with the `value` as the first argument and then
                             * returns `value`. The purpose of this method is to "tap into" a method
                             * chain in order to perform operations on intermediate results within
                             * the chain.
                             *
                             * @static
                             * @memberOf _
                             * @category Chaining
                             * @param {*} value The value to provide to `interceptor`.
                             * @param {Function} interceptor The function to invoke.
                             * @returns {*} Returns `value`.
                             * @example
                             *
                             * _([1, 2, 3, 4])
                             *  .tap(function(array) { array.pop(); })
                             *  .reverse()
                             *  .value();
                             * // => [3, 2, 1]
                             */

                            function tap(value, interceptor) {
                                interceptor(value);
                                return value;
                            }

                            /**
                             * Enables explicit method chaining on the wrapper object.
                             *
                             * @name chain
                             * @memberOf _
                             * @category Chaining
                             * @returns {*} Returns the wrapper object.
                             * @example
                             *
                             * var characters = [
                             *   { 'name': 'barney', 'age': 36 },
                             *   { 'name': 'fred',   'age': 40 }
                             * ];
                             *
                             * // without explicit chaining
                             * _(characters).first();
                             * // => { 'name': 'barney', 'age': 36 }
                             *
                             * // with explicit chaining
                             * _(characters).chain()
                             *   .first()
                             *   .pick('age')
                             *   .value();
                             * // => { 'age': 36 }
                             */

                            function wrapperChain() {
                                this.__chain__ = true;
                                return this;
                            }

                            /**
                             * Produces the `toString` result of the wrapped value.
                             *
                             * @name toString
                             * @memberOf _
                             * @category Chaining
                             * @returns {string} Returns the string result.
                             * @example
                             *
                             * _([1, 2, 3]).toString();
                             * // => '1,2,3'
                             */

                            function wrapperToString() {
                                return String(this.__wrapped__);
                            }

                            /**
                             * Extracts the wrapped value.
                             *
                             * @name valueOf
                             * @memberOf _
                             * @alias value
                             * @category Chaining
                             * @returns {*} Returns the wrapped value.
                             * @example
                             *
                             * _([1, 2, 3]).valueOf();
                             * // => [1, 2, 3]
                             */

                            function wrapperValueOf() {
                                return this.__wrapped__;
                            }

                            /*--------------------------------------------------------------------------*/

                            // add functions that return wrapped values when chaining
                            lodash.after = after;
                            lodash.assign = assign;
                            lodash.at = at;
                            lodash.bind = bind;
                            lodash.bindAll = bindAll;
                            lodash.bindKey = bindKey;
                            lodash.chain = chain;
                            lodash.compact = compact;
                            lodash.compose = compose;
                            lodash.constant = constant;
                            lodash.countBy = countBy;
                            lodash.create = create;
                            lodash.createCallback = createCallback;
                            lodash.curry = curry;
                            lodash.debounce = debounce;
                            lodash.defaults = defaults;
                            lodash.defer = defer;
                            lodash.delay = delay;
                            lodash.difference = difference;
                            lodash.filter = filter;
                            lodash.flatten = flatten;
                            lodash.forEach = forEach;
                            lodash.forEachRight = forEachRight;
                            lodash.forIn = forIn;
                            lodash.forInRight = forInRight;
                            lodash.forOwn = forOwn;
                            lodash.forOwnRight = forOwnRight;
                            lodash.functions = functions;
                            lodash.groupBy = groupBy;
                            lodash.indexBy = indexBy;
                            lodash.initial = initial;
                            lodash.intersection = intersection;
                            lodash.invert = invert;
                            lodash.invoke = invoke;
                            lodash.keys = keys;
                            lodash.map = map;
                            lodash.mapValues = mapValues;
                            lodash.max = max;
                            lodash.memoize = memoize;
                            lodash.merge = merge;
                            lodash.min = min;
                            lodash.omit = omit;
                            lodash.once = once;
                            lodash.pairs = pairs;
                            lodash.partial = partial;
                            lodash.partialRight = partialRight;
                            lodash.pick = pick;
                            lodash.pluck = pluck;
                            lodash.property = property;
                            lodash.pull = pull;
                            lodash.range = range;
                            lodash.reject = reject;
                            lodash.remove = remove;
                            lodash.rest = rest;
                            lodash.shuffle = shuffle;
                            lodash.sortBy = sortBy;
                            lodash.tap = tap;
                            lodash.throttle = throttle;
                            lodash.times = times;
                            lodash.toArray = toArray;
                            lodash.transform = transform;
                            lodash.union = union;
                            lodash.uniq = uniq;
                            lodash.values = values;
                            lodash.where = where;
                            lodash.without = without;
                            lodash.wrap = wrap;
                            lodash.xor = xor;
                            lodash.zip = zip;
                            lodash.zipObject = zipObject;

                            // add aliases
                            lodash.collect = map;
                            lodash.drop = rest;
                            lodash.each = forEach;
                            lodash.eachRight = forEachRight;
                            lodash.extend = assign;
                            lodash.methods = functions;
                            lodash.object = zipObject;
                            lodash.select = filter;
                            lodash.tail = rest;
                            lodash.unique = uniq;
                            lodash.unzip = zip;

                            // add functions to `lodash.prototype`
                            mixin(lodash);

                            /*--------------------------------------------------------------------------*/

                            // add functions that return unwrapped values when chaining
                            lodash.clone = clone;
                            lodash.cloneDeep = cloneDeep;
                            lodash.contains = contains;
                            lodash.escape = escape;
                            lodash.every = every;
                            lodash.find = find;
                            lodash.findIndex = findIndex;
                            lodash.findKey = findKey;
                            lodash.findLast = findLast;
                            lodash.findLastIndex = findLastIndex;
                            lodash.findLastKey = findLastKey;
                            lodash.has = has;
                            lodash.identity = identity;
                            lodash.indexOf = indexOf;
                            lodash.isArguments = isArguments;
                            lodash.isArray = isArray;
                            lodash.isBoolean = isBoolean;
                            lodash.isDate = isDate;
                            lodash.isElement = isElement;
                            lodash.isEmpty = isEmpty;
                            lodash.isEqual = isEqual;
                            lodash.isFinite = isFinite;
                            lodash.isFunction = isFunction;
                            lodash.isNaN = isNaN;
                            lodash.isNull = isNull;
                            lodash.isNumber = isNumber;
                            lodash.isObject = isObject;
                            lodash.isPlainObject = isPlainObject;
                            lodash.isRegExp = isRegExp;
                            lodash.isString = isString;
                            lodash.isUndefined = isUndefined;
                            lodash.lastIndexOf = lastIndexOf;
                            lodash.mixin = mixin;
                            lodash.noConflict = noConflict;
                            lodash.noop = noop;
                            lodash.now = now;
                            lodash.parseInt = parseInt;
                            lodash.random = random;
                            lodash.reduce = reduce;
                            lodash.reduceRight = reduceRight;
                            lodash.result = result;
                            lodash.runInContext = runInContext;
                            lodash.size = size;
                            lodash.some = some;
                            lodash.sortedIndex = sortedIndex;
                            lodash.template = template;
                            lodash.unescape = unescape;
                            lodash.uniqueId = uniqueId;

                            // add aliases
                            lodash.all = every;
                            lodash.any = some;
                            lodash.detect = find;
                            lodash.findWhere = find;
                            lodash.foldl = reduce;
                            lodash.foldr = reduceRight;
                            lodash.include = contains;
                            lodash.inject = reduce;

                            mixin(function() {
                                var source = {}
                                forOwn(lodash, function(func, methodName) {
                                    if (!lodash.prototype[methodName]) {
                                        source[methodName] = func;
                                    }
                                });
                                return source;
                            }(), false);

                            /*--------------------------------------------------------------------------*/

                            // add functions capable of returning wrapped and unwrapped values when chaining
                            lodash.first = first;
                            lodash.last = last;
                            lodash.sample = sample;

                            // add aliases
                            lodash.take = first;
                            lodash.head = first;

                            forOwn(lodash, function(func, methodName) {
                                var callbackable = methodName !== 'sample';
                                if (!lodash.prototype[methodName]) {
                                    lodash.prototype[methodName] = function(n, guard) {
                                        var chainAll = this.__chain__,
                                            result = func(this.__wrapped__, n, guard);

                                        return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function'))) ? result : new lodashWrapper(result, chainAll);
                                    };
                                }
                            });

                            /*--------------------------------------------------------------------------*/

                            /**
                             * The semantic version number.
                             *
                             * @static
                             * @memberOf _
                             * @type string
                             */
                            lodash.VERSION = '2.4.1';

                            // add "Chaining" functions to the wrapper
                            lodash.prototype.chain = wrapperChain;
                            lodash.prototype.toString = wrapperToString;
                            lodash.prototype.value = wrapperValueOf;
                            lodash.prototype.valueOf = wrapperValueOf;

                            // add `Array` functions that return unwrapped values
                            forEach(['join', 'pop', 'shift'], function(methodName) {
                                var func = arrayRef[methodName];
                                lodash.prototype[methodName] = function() {
                                    var chainAll = this.__chain__,
                                        result = func.apply(this.__wrapped__, arguments);

                                    return chainAll ? new lodashWrapper(result, chainAll) : result;
                                };
                            });

                            // add `Array` functions that return the existing wrapped value
                            forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
                                var func = arrayRef[methodName];
                                lodash.prototype[methodName] = function() {
                                    func.apply(this.__wrapped__, arguments);
                                    return this;
                                };
                            });

                            // add `Array` functions that return new wrapped values
                            forEach(['concat', 'slice', 'splice'], function(methodName) {
                                var func = arrayRef[methodName];
                                lodash.prototype[methodName] = function() {
                                    return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
                                };
                            });

                            return lodash;
                        }

                        /*--------------------------------------------------------------------------*/

                        // expose Lo-Dash
                        var _ = runInContext();

                        // some AMD build optimizers like r.js check for condition patterns like the following:
                        if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
                            // Expose Lo-Dash to the global object even when an AMD loader is present in
                            // case Lo-Dash is loaded with a RequireJS shim config.
                            // See http://requirejs.org/docs/api.html#config-shim
                            root._ = _;

                            // define as an anonymous module so, through path mapping, it can be
                            // referenced as the "underscore" module
                            define(function() {
                                return _;
                            });
                        }
                        // check for `exports` after `define` in case a build optimizer adds an `exports` object
                        else if (freeExports && freeModule) {
                            // in Node.js or RingoJS
                            if (moduleExports) {
                                (freeModule.exports = _)._ = _;
                            }
                            // in Narwhal or Rhino -require
                            else {
                                freeExports._ = _;
                            }
                        } else {
                            // in a browser or Rhino
                            root._ = _;
                        }
                    }.call(this));

                }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
            }, {}
        ],
        18: [
            function(require, module, exports) {
                var retries = require('./retries');


                /**
                 * Add to the request prototype.
                 */

                module.exports = function(superagent) {
                    var Request = superagent.Request;
                    Request.prototype.retry = retry;
                    return superagent;
                };


                /**
                 * Export retries for extending
                 */

                module.exports.retries = retries;


                /**
                 * Sets the amount of times to retry the request
                 * @param  {Number} count
                 */

                function retry(retries) {

                    var self = this,
                        oldEnd = this.end;

                    retries = retries || 1;

                    this.end = function(fn) {
                        var timeout = this._timeout;

                        function attemptRetry() {
                            return oldEnd.call(self, function(err, res) {
                                if (!retries || !shouldRetry(err, res)) return fn && fn(err, res);

                                reset(self, timeout);

                                retries--;
                                return attemptRetry();
                            });
                        }

                        return attemptRetry();
                    };

                    return this;
                }


                /**
                 * HACK: Resets the internal state of a request:
                 */

                function reset(request, timeout) {
                    var headers = request.req._headers;
                    request.req.abort();
                    request.called = false;
                    request.timeout(timeout);
                    delete request.req;
                    delete request._timer;
                    for (var k in headers) request.set(k, headers[k]);
                }


                /**
                 * Determine whether we should retry based upon common error conditions
                 * @param  {Error}    err
                 * @param  {Response} res
                 * @return {Boolean}
                 */

                function shouldRetry(err, res) {
                    return retries.some(function(check) {
                        return check(err, res);
                    });
                }

            }, {
                "./retries": 19
            }
        ],
        19: [
            function(require, module, exports) {
                /**
                 * Common retry conditions
                 */

                module.exports = [
                    econnreset,
                    etimedout,
                    eaddrinfo,
                    esockettimedout,
                    gateway,
                    timeout
                ];


                /**
                 * Connection reset detection
                 */

                function econnreset(err, res) {
                    return err && err.code === 'ECONNRESET';
                }


                /**
                 * Timeout detection
                 */

                function etimedout(err, res) {
                    return err && err.code === 'ETIMEDOUT';
                }


                /**
                 * Can't get address info
                 */

                function eaddrinfo(err, res) {
                    return err && err.code === 'EADDRINFO';
                }


                /**
                 * Socket timeout detection
                 */

                function esockettimedout(err, res) {
                    return err && err.code === 'ESOCKETTIMEDOUT';
                }


                /**
                 * Bad gateway error detection
                 */

                function gateway(err, res) {
                    return res && [502, 503, 504].indexOf(res.status) !== -1;
                }


                /**
                 * Superagent timeout errors
                 */

                function timeout(err, res) {
                    return err && /^timeout of \d+ms exceeded$/.test(err.message);
                }
            }, {}
        ],
        20: [
            function(require, module, exports) {
                /**
                 * Module dependencies.
                 */

                var Emitter = require('emitter');
                var reduce = require('reduce');

                /**
                 * Root reference for iframes.
                 */

                var root = 'undefined' == typeof window ? this : window;

                /**
                 * Noop.
                 */

                function noop() {};

                /**
                 * Check if `obj` is a host object,
                 * we don't want to serialize these :)
                 *
                 * TODO: future proof, move to compoent land
                 *
                 * @param {Object} obj
                 * @return {Boolean}
                 * @api private
                 */

                function isHost(obj) {
                    var str = {}.toString.call(obj);

                    switch (str) {
                        case '[object File]':
                        case '[object Blob]':
                        case '[object FormData]':
                            return true;
                        default:
                            return false;
                    }
                }

                /**
                 * Determine XHR.
                 */

                function getXHR() {
                    if (root.XMLHttpRequest && ('file:' != root.location.protocol || !root.ActiveXObject)) {
                        return new XMLHttpRequest;
                    } else {
                        try {
                            return new ActiveXObject('Microsoft.XMLHTTP');
                        } catch (e) {}
                        try {
                            return new ActiveXObject('Msxml2.XMLHTTP.6.0');
                        } catch (e) {}
                        try {
                            return new ActiveXObject('Msxml2.XMLHTTP.3.0');
                        } catch (e) {}
                        try {
                            return new ActiveXObject('Msxml2.XMLHTTP');
                        } catch (e) {}
                    }
                    return false;
                }

                /**
                 * Removes leading and trailing whitespace, added to support IE.
                 *
                 * @param {String} s
                 * @return {String}
                 * @api private
                 */

                var trim = ''.trim ? function(s) {
                        return s.trim();
                    } : function(s) {
                        return s.replace(/(^\s*|\s*$)/g, '');
                    };

                /**
                 * Check if `obj` is an object.
                 *
                 * @param {Object} obj
                 * @return {Boolean}
                 * @api private
                 */

                function isObject(obj) {
                    return obj === Object(obj);
                }

                /**
                 * Serialize the given `obj`.
                 *
                 * @param {Object} obj
                 * @return {String}
                 * @api private
                 */

                function serialize(obj) {
                    if (!isObject(obj)) return obj;
                    var pairs = [];
                    for (var key in obj) {
                        if (null != obj[key]) {
                            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
                        }
                    }
                    return pairs.join('&');
                }

                /**
                 * Expose serialization method.
                 */

                request.serializeObject = serialize;

                /**
                 * Parse the given x-www-form-urlencoded `str`.
                 *
                 * @param {String} str
                 * @return {Object}
                 * @api private
                 */

                function parseString(str) {
                    var obj = {};
                    var pairs = str.split('&');
                    var parts;
                    var pair;

                    for (var i = 0, len = pairs.length; i < len; ++i) {
                        pair = pairs[i];
                        parts = pair.split('=');
                        obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
                    }

                    return obj;
                }

                /**
                 * Expose parser.
                 */

                request.parseString = parseString;

                /**
                 * Default MIME type map.
                 *
                 *     superagent.types.xml = 'application/xml';
                 *
                 */

                request.types = {
                    html: 'text/html',
                    json: 'application/json',
                    xml: 'application/xml',
                    urlencoded: 'application/x-www-form-urlencoded',
                    'form': 'application/x-www-form-urlencoded',
                    'form-data': 'application/x-www-form-urlencoded'
                };

                /**
                 * Default serialization map.
                 *
                 *     superagent.serialize['application/xml'] = function(obj){
                 *       return 'generated xml here';
                 *     };
                 *
                 */

                request.serialize = {
                    'application/x-www-form-urlencoded': serialize,
                    'application/json': JSON.stringify
                };

                /**
                 * Default parsers.
                 *
                 *     superagent.parse['application/xml'] = function(str){
                 *       return { object parsed from str };
                 *     };
                 *
                 */

                request.parse = {
                    'application/x-www-form-urlencoded': parseString,
                    'application/json': JSON.parse
                };

                /**
                 * Parse the given header `str` into
                 * an object containing the mapped fields.
                 *
                 * @param {String} str
                 * @return {Object}
                 * @api private
                 */

                function parseHeader(str) {
                    var lines = str.split(/\r?\n/);
                    var fields = {};
                    var index;
                    var line;
                    var field;
                    var val;

                    lines.pop(); // trailing CRLF

                    for (var i = 0, len = lines.length; i < len; ++i) {
                        line = lines[i];
                        index = line.indexOf(':');
                        field = line.slice(0, index).toLowerCase();
                        val = trim(line.slice(index + 1));
                        fields[field] = val;
                    }

                    return fields;
                }

                /**
                 * Return the mime type for the given `str`.
                 *
                 * @param {String} str
                 * @return {String}
                 * @api private
                 */

                function type(str) {
                    return str.split(/ *; */).shift();
                };

                /**
                 * Return header field parameters.
                 *
                 * @param {String} str
                 * @return {Object}
                 * @api private
                 */

                function params(str) {
                    return reduce(str.split(/ *; */), function(obj, str) {
                        var parts = str.split(/ *= */),
                            key = parts.shift(),
                            val = parts.shift();

                        if (key && val) obj[key] = val;
                        return obj;
                    }, {});
                };

                /**
                 * Initialize a new `Response` with the given `xhr`.
                 *
                 *  - set flags (.ok, .error, etc)
                 *  - parse header
                 *
                 * Examples:
                 *
                 *  Aliasing `superagent` as `request` is nice:
                 *
                 *      request = superagent;
                 *
                 *  We can use the promise-like API, or pass callbacks:
                 *
                 *      request.get('/').end(function(res){});
                 *      request.get('/', function(res){});
                 *
                 *  Sending data can be chained:
                 *
                 *      request
                 *        .post('/user')
                 *        .send({ name: 'tj' })
                 *        .end(function(res){});
                 *
                 *  Or passed to `.send()`:
                 *
                 *      request
                 *        .post('/user')
                 *        .send({ name: 'tj' }, function(res){});
                 *
                 *  Or passed to `.post()`:
                 *
                 *      request
                 *        .post('/user', { name: 'tj' })
                 *        .end(function(res){});
                 *
                 * Or further reduced to a single call for simple cases:
                 *
                 *      request
                 *        .post('/user', { name: 'tj' }, function(res){});
                 *
                 * @param {XMLHTTPRequest} xhr
                 * @param {Object} options
                 * @api private
                 */

                function Response(req, options) {
                    options = options || {};
                    this.req = req;
                    this.xhr = this.req.xhr;
                    this.text = this.xhr.responseText;
                    this.setStatusProperties(this.xhr.status);
                    this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
                    // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
                    // getResponseHeader still works. so we get content-type even if getting
                    // other headers fails.
                    this.header['content-type'] = this.xhr.getResponseHeader('content-type');
                    this.setHeaderProperties(this.header);
                    this.body = this.req.method != 'HEAD' ? this.parseBody(this.text) : null;
                }

                /**
                 * Get case-insensitive `field` value.
                 *
                 * @param {String} field
                 * @return {String}
                 * @api public
                 */

                Response.prototype.get = function(field) {
                    return this.header[field.toLowerCase()];
                };

                /**
                 * Set header related properties:
                 *
                 *   - `.type` the content type without params
                 *
                 * A response of "Content-Type: text/plain; charset=utf-8"
                 * will provide you with a `.type` of "text/plain".
                 *
                 * @param {Object} header
                 * @api private
                 */

                Response.prototype.setHeaderProperties = function(header) {
                    // content-type
                    var ct = this.header['content-type'] || '';
                    this.type = type(ct);

                    // params
                    var obj = params(ct);
                    for (var key in obj) this[key] = obj[key];
                };

                /**
                 * Parse the given body `str`.
                 *
                 * Used for auto-parsing of bodies. Parsers
                 * are defined on the `superagent.parse` object.
                 *
                 * @param {String} str
                 * @return {Mixed}
                 * @api private
                 */

                Response.prototype.parseBody = function(str) {
                    var parse = request.parse[this.type];
                    return parse && str && str.length ? parse(str) : null;
                };

                /**
                 * Set flags such as `.ok` based on `status`.
                 *
                 * For example a 2xx response will give you a `.ok` of __true__
                 * whereas 5xx will be __false__ and `.error` will be __true__. The
                 * `.clientError` and `.serverError` are also available to be more
                 * specific, and `.statusType` is the class of error ranging from 1..5
                 * sometimes useful for mapping respond colors etc.
                 *
                 * "sugar" properties are also defined for common cases. Currently providing:
                 *
                 *   - .noContent
                 *   - .badRequest
                 *   - .unauthorized
                 *   - .notAcceptable
                 *   - .notFound
                 *
                 * @param {Number} status
                 * @api private
                 */

                Response.prototype.setStatusProperties = function(status) {
                    var type = status / 100 | 0;

                    // status / class
                    this.status = status;
                    this.statusType = type;

                    // basics
                    this.info = 1 == type;
                    this.ok = 2 == type;
                    this.clientError = 4 == type;
                    this.serverError = 5 == type;
                    this.error = (4 == type || 5 == type) ? this.toError() : false;

                    // sugar
                    this.accepted = 202 == status;
                    this.noContent = 204 == status || 1223 == status;
                    this.badRequest = 400 == status;
                    this.unauthorized = 401 == status;
                    this.notAcceptable = 406 == status;
                    this.notFound = 404 == status;
                    this.forbidden = 403 == status;
                };

                /**
                 * Return an `Error` representative of this response.
                 *
                 * @return {Error}
                 * @api public
                 */

                Response.prototype.toError = function() {
                    var req = this.req;
                    var method = req.method;
                    var url = req.url;

                    var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
                    var err = new Error(msg);
                    err.status = this.status;
                    err.method = method;
                    err.url = url;

                    return err;
                };

                /**
                 * Expose `Response`.
                 */

                request.Response = Response;

                /**
                 * Initialize a new `Request` with the given `method` and `url`.
                 *
                 * @param {String} method
                 * @param {String} url
                 * @api public
                 */

                function Request(method, url) {
                    var self = this;
                    Emitter.call(this);
                    this._query = this._query || [];
                    this.method = method;
                    this.url = url;
                    this.header = {};
                    this._header = {};
                    this.on('end', function() {
                        try {
                            var res = new Response(self);
                            if ('HEAD' == method) res.text = null;
                            self.callback(null, res);
                        } catch (e) {
                            var err = new Error('Parser is unable to parse the response');
                            err.parse = true;
                            err.original = e;
                            self.callback(err);
                        }
                    });
                }

                /**
                 * Mixin `Emitter`.
                 */

                Emitter(Request.prototype);

                /**
                 * Allow for extension
                 */

                Request.prototype.use = function(fn) {
                    fn(this);
                    return this;
                }

                /**
                 * Set timeout to `ms`.
                 *
                 * @param {Number} ms
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.timeout = function(ms) {
                    this._timeout = ms;
                    return this;
                };

                /**
                 * Clear previous timeout.
                 *
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.clearTimeout = function() {
                    this._timeout = 0;
                    clearTimeout(this._timer);
                    return this;
                };

                /**
                 * Abort the request, and clear potential timeout.
                 *
                 * @return {Request}
                 * @api public
                 */

                Request.prototype.abort = function() {
                    if (this.aborted) return;
                    this.aborted = true;
                    this.xhr.abort();
                    this.clearTimeout();
                    this.emit('abort');
                    return this;
                };

                /**
                 * Set header `field` to `val`, or multiple fields with one object.
                 *
                 * Examples:
                 *
                 *      req.get('/')
                 *        .set('Accept', 'application/json')
                 *        .set('X-API-Key', 'foobar')
                 *        .end(callback);
                 *
                 *      req.get('/')
                 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
                 *        .end(callback);
                 *
                 * @param {String|Object} field
                 * @param {String} val
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.set = function(field, val) {
                    if (isObject(field)) {
                        for (var key in field) {
                            this.set(key, field[key]);
                        }
                        return this;
                    }
                    this._header[field.toLowerCase()] = val;
                    this.header[field] = val;
                    return this;
                };

                /**
                 * Remove header `field`.
                 *
                 * Example:
                 *
                 *      req.get('/')
                 *        .unset('User-Agent')
                 *        .end(callback);
                 *
                 * @param {String} field
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.unset = function(field) {
                    delete this._header[field.toLowerCase()];
                    delete this.header[field];
                    return this;
                };

                /**
                 * Get case-insensitive header `field` value.
                 *
                 * @param {String} field
                 * @return {String}
                 * @api private
                 */

                Request.prototype.getHeader = function(field) {
                    return this._header[field.toLowerCase()];
                };

                /**
                 * Set Content-Type to `type`, mapping values from `request.types`.
                 *
                 * Examples:
                 *
                 *      superagent.types.xml = 'application/xml';
                 *
                 *      request.post('/')
                 *        .type('xml')
                 *        .send(xmlstring)
                 *        .end(callback);
                 *
                 *      request.post('/')
                 *        .type('application/xml')
                 *        .send(xmlstring)
                 *        .end(callback);
                 *
                 * @param {String} type
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.type = function(type) {
                    this.set('Content-Type', request.types[type] || type);
                    return this;
                };

                /**
                 * Set Accept to `type`, mapping values from `request.types`.
                 *
                 * Examples:
                 *
                 *      superagent.types.json = 'application/json';
                 *
                 *      request.get('/agent')
                 *        .accept('json')
                 *        .end(callback);
                 *
                 *      request.get('/agent')
                 *        .accept('application/json')
                 *        .end(callback);
                 *
                 * @param {String} accept
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.accept = function(type) {
                    this.set('Accept', request.types[type] || type);
                    return this;
                };

                /**
                 * Set Authorization field value with `user` and `pass`.
                 *
                 * @param {String} user
                 * @param {String} pass
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.auth = function(user, pass) {
                    var str = btoa(user + ':' + pass);
                    this.set('Authorization', 'Basic ' + str);
                    return this;
                };

                /**
                 * Add query-string `val`.
                 *
                 * Examples:
                 *
                 *   request.get('/shoes')
                 *     .query('size=10')
                 *     .query({ color: 'blue' })
                 *
                 * @param {Object|String} val
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.query = function(val) {
                    if ('string' != typeof val) val = serialize(val);
                    if (val) this._query.push(val);
                    return this;
                };

                /**
                 * Write the field `name` and `val` for "multipart/form-data"
                 * request bodies.
                 *
                 * ``` js
                 * request.post('/upload')
                 *   .field('foo', 'bar')
                 *   .end(callback);
                 * ```
                 *
                 * @param {String} name
                 * @param {String|Blob|File} val
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.field = function(name, val) {
                    if (!this._formData) this._formData = new FormData();
                    this._formData.append(name, val);
                    return this;
                };

                /**
                 * Queue the given `file` as an attachment to the specified `field`,
                 * with optional `filename`.
                 *
                 * ``` js
                 * request.post('/upload')
                 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
                 *   .end(callback);
                 * ```
                 *
                 * @param {String} field
                 * @param {Blob|File} file
                 * @param {String} filename
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.attach = function(field, file, filename) {
                    if (!this._formData) this._formData = new FormData();
                    this._formData.append(field, file, filename);
                    return this;
                };

                /**
                 * Send `data`, defaulting the `.type()` to "json" when
                 * an object is given.
                 *
                 * Examples:
                 *
                 *       // querystring
                 *       request.get('/search')
                 *         .end(callback)
                 *
                 *       // multiple data "writes"
                 *       request.get('/search')
                 *         .send({ search: 'query' })
                 *         .send({ range: '1..5' })
                 *         .send({ order: 'desc' })
                 *         .end(callback)
                 *
                 *       // manual json
                 *       request.post('/user')
                 *         .type('json')
                 *         .send('{"name":"tj"})
                 *         .end(callback)
                 *
                 *       // auto json
                 *       request.post('/user')
                 *         .send({ name: 'tj' })
                 *         .end(callback)
                 *
                 *       // manual x-www-form-urlencoded
                 *       request.post('/user')
                 *         .type('form')
                 *         .send('name=tj')
                 *         .end(callback)
                 *
                 *       // auto x-www-form-urlencoded
                 *       request.post('/user')
                 *         .type('form')
                 *         .send({ name: 'tj' })
                 *         .end(callback)
                 *
                 *       // defaults to x-www-form-urlencoded
                 *      request.post('/user')
                 *        .send('name=tobi')
                 *        .send('species=ferret')
                 *        .end(callback)
                 *
                 * @param {String|Object} data
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.send = function(data) {
                    var obj = isObject(data);
                    var type = this.getHeader('Content-Type');

                    // merge
                    if (obj && isObject(this._data)) {
                        for (var key in data) {
                            this._data[key] = data[key];
                        }
                    } else if ('string' == typeof data) {
                        if (!type) this.type('form');
                        type = this.getHeader('Content-Type');
                        if ('application/x-www-form-urlencoded' == type) {
                            this._data = this._data ? this._data + '&' + data : data;
                        } else {
                            this._data = (this._data || '') + data;
                        }
                    } else {
                        this._data = data;
                    }

                    if (!obj) return this;
                    if (!type) this.type('json');
                    return this;
                };

                /**
                 * Invoke the callback with `err` and `res`
                 * and handle arity check.
                 *
                 * @param {Error} err
                 * @param {Response} res
                 * @api private
                 */

                Request.prototype.callback = function(err, res) {
                    var fn = this._callback;
                    if (2 == fn.length) return fn(err, res);
                    if (err) return this.emit('error', err);
                    fn(res);
                };

                /**
                 * Invoke callback with x-domain error.
                 *
                 * @api private
                 */

                Request.prototype.crossDomainError = function() {
                    var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
                    err.crossDomain = true;
                    this.callback(err);
                };

                /**
                 * Invoke callback with timeout error.
                 *
                 * @api private
                 */

                Request.prototype.timeoutError = function() {
                    var timeout = this._timeout;
                    var err = new Error('timeout of ' + timeout + 'ms exceeded');
                    err.timeout = timeout;
                    this.callback(err);
                };

                /**
                 * Enable transmission of cookies with x-domain requests.
                 *
                 * Note that for this to work the origin must not be
                 * using "Access-Control-Allow-Origin" with a wildcard,
                 * and also must set "Access-Control-Allow-Credentials"
                 * to "true".
                 *
                 * @api public
                 */

                Request.prototype.withCredentials = function() {
                    this._withCredentials = true;
                    return this;
                };

                /**
                 * Initiate request, invoking callback `fn(res)`
                 * with an instanceof `Response`.
                 *
                 * @param {Function} fn
                 * @return {Request} for chaining
                 * @api public
                 */

                Request.prototype.end = function(fn) {
                    var self = this;
                    var xhr = this.xhr = getXHR();
                    var query = this._query.join('&');
                    var timeout = this._timeout;
                    var data = this._formData || this._data;

                    // store callback
                    this._callback = fn || noop;

                    // state change
                    xhr.onreadystatechange = function() {
                        if (4 != xhr.readyState) return;
                        if (0 == xhr.status) {
                            if (self.aborted) return self.timeoutError();
                            return self.crossDomainError();
                        }
                        self.emit('end');
                    };

                    // progress
                    if (xhr.upload) {
                        xhr.upload.onprogress = function(e) {
                            e.percent = e.loaded / e.total * 100;
                            self.emit('progress', e);
                        };
                    }

                    // timeout
                    if (timeout && !this._timer) {
                        this._timer = setTimeout(function() {
                            self.abort();
                        }, timeout);
                    }

                    // querystring
                    if (query) {
                        query = request.serializeObject(query);
                        this.url += ~this.url.indexOf('?') ? '&' + query : '?' + query;
                    }

                    // initiate request
                    xhr.open(this.method, this.url, true);

                    // CORS
                    if (this._withCredentials) xhr.withCredentials = true;

                    // body
                    if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
                        // serialize stuff
                        var serialize = request.serialize[this.getHeader('Content-Type')];
                        if (serialize) data = serialize(data);
                    }

                    // set header fields
                    for (var field in this.header) {
                        if (null == this.header[field]) continue;
                        xhr.setRequestHeader(field, this.header[field]);
                    }

                    // send stuff
                    this.emit('request', this);
                    xhr.send(data);
                    return this;
                };

                /**
                 * Expose `Request`.
                 */

                request.Request = Request;

                /**
                 * Issue a request:
                 *
                 * Examples:
                 *
                 *    request('GET', '/users').end(callback)
                 *    request('/users').end(callback)
                 *    request('/users', callback)
                 *
                 * @param {String} method
                 * @param {String|Function} url or callback
                 * @return {Request}
                 * @api public
                 */

                function request(method, url) {
                    // callback
                    if ('function' == typeof url) {
                        return new Request('GET', method).end(url);
                    }

                    // url first
                    if (1 == arguments.length) {
                        return new Request('GET', method);
                    }

                    return new Request(method, url);
                }

                /**
                 * GET `url` with optional callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Mixed|Function} data or fn
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.get = function(url, data, fn) {
                    var req = request('GET', url);
                    if ('function' == typeof data) fn = data, data = null;
                    if (data) req.query(data);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * HEAD `url` with optional callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Mixed|Function} data or fn
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.head = function(url, data, fn) {
                    var req = request('HEAD', url);
                    if ('function' == typeof data) fn = data, data = null;
                    if (data) req.send(data);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * DELETE `url` with optional callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.del = function(url, fn) {
                    var req = request('DELETE', url);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * PATCH `url` with optional `data` and callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Mixed} data
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.patch = function(url, data, fn) {
                    var req = request('PATCH', url);
                    if ('function' == typeof data) fn = data, data = null;
                    if (data) req.send(data);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * POST `url` with optional `data` and callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Mixed} data
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.post = function(url, data, fn) {
                    var req = request('POST', url);
                    if ('function' == typeof data) fn = data, data = null;
                    if (data) req.send(data);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * PUT `url` with optional `data` and callback `fn(res)`.
                 *
                 * @param {String} url
                 * @param {Mixed|Function} data or fn
                 * @param {Function} fn
                 * @return {Request}
                 * @api public
                 */

                request.put = function(url, data, fn) {
                    var req = request('PUT', url);
                    if ('function' == typeof data) fn = data, data = null;
                    if (data) req.send(data);
                    if (fn) req.end(fn);
                    return req;
                };

                /**
                 * Expose `request`.
                 */

                module.exports = request;

            }, {
                "emitter": 21,
                "reduce": 22
            }
        ],
        21: [
            function(require, module, exports) {

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
                    Emitter.prototype.addEventListener = function(event, fn) {
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

                Emitter.prototype.once = function(event, fn) {
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
                    Emitter.prototype.removeEventListener = function(event, fn) {
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

                Emitter.prototype.emit = function(event) {
                    this._callbacks = this._callbacks || {};
                    var args = [].slice.call(arguments, 1),
                        callbacks = this._callbacks[event];

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

                Emitter.prototype.listeners = function(event) {
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

                Emitter.prototype.hasListeners = function(event) {
                    return !!this.listeners(event).length;
                };

            }, {}
        ],
        22: [
            function(require, module, exports) {

                /**
                 * Reduce `arr` with `fn`.
                 *
                 * @param {Array} arr
                 * @param {Function} fn
                 * @param {Mixed} initial
                 *
                 * TODO: combatible error handling?
                 */

                module.exports = function(arr, fn, initial) {
                    var idx = 0;
                    var len = arr.length;
                    var curr = arguments.length == 3 ? initial : arr[idx++];

                    while (idx < len) {
                        curr = fn.call(null, curr, arr[idx], ++idx, arr);
                    }

                    return curr;
                };
            }, {}
        ],
        23: [
            function(require, module, exports) {
                /**
                 * Export `uid`
                 */

                module.exports = uid;

                /**
                 * Create a `uid`
                 *
                 * @param {String} len
                 * @return {String} uid
                 */

                function uid(len) {
                    len = len || 7;
                    return Math.random().toString(35).substr(2, len);
                }

            }, {}
        ],
        24: [
            function(require, module, exports) {
                module.exports = {
                    "name": "analytics-node",
                    "repository": "git://github.com/segmentio/analytics-node",
                    "version": "1.1.1",
                    "description": "The hassle-free way to integrate analytics into any node application.",
                    "keywords": [
                        "analytics",
                        "segment.io",
                        "segmentio",
                        "client",
                        "driver",
                        "analytics"
                    ],
                    "main": "lib/index.js",
                    "browserify": {
                        "transform": ["brfs"]
                    },
                    "dependencies": {
                        "clone": "~0.1.17",
                        "component-type": "~1.0.0",
                        "join-component": "~1.0.0",
                        "lodash": "~2.4.1",
                        "superagent": "~0.19.1",
                        "superagent-proxy": "~0.3.1",
                        "superagent-retry": "~0.4.0",
                        "debug": "~1.0.4",
                        "uid": "0.0.2"
                    },
                    "devDependencies": {
                        "async": "~0.9.0",
                        "browserify": "^8.1.3",
                        "express": "~3.4.8",
                        "http-proxy": "~1.3.0",
                        "mocha": "1.8.1",
                        "brfs": "^1.3.0"
                    },
                    "engines": {
                        "node": ">= 0.8.x"
                    },
                    "scripts": {
                        "test": "make test"
                    },
                    "license": "MIT"
                }

            }, {}
        ]
    }, {}, [1])(1)
});