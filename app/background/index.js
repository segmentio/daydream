
/**
 * Module dependencies.
 */

var daydream = require('./daydream')();
var recorder = require('./recorder')();

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
  this.store(res);
  this.showPopup();
});
