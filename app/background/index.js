
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
