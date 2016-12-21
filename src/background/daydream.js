import Recorder from './recorder'
import each from 'component-each'
import os from 'component-os'

const recorder = Recorder()

export default Daydream

function Daydream () {
  if (!(this instanceof Daydream)) return new Daydream()
  this.isRunning = false
}

Daydream.prototype.boot = function () {
  var self = this
  chrome.browserAction.onClicked.addListener(function (tab) {
    if (!self.isRunning) {
      recorder.startRecording()
      chrome.browserAction.setIcon({ path: 'images/icon-green.png', tabId: tab.id })
    } else {
      recorder.stopRecording()
      chrome.browserAction.setIcon({ path: 'images/icon-black.png', tabId: tab.id })
      const nightmare = self.parse(recorder.recording)
      chrome.storage.sync.set({ 'nightmare': nightmare })
      chrome.browserAction.setPopup({ popup: 'popup.html' })
      chrome.browserAction.setBadgeText({ text: '1' })
    }

    self.isRunning = !self.isRunning
  })
}

Daydream.prototype.parse = function (recording) {
  let newLine = '\n'
  if (os === 'windows') newLine = '\r\n'

  let result = [
    'const Nightmare = require(\'nightmare\')',
    `const nightmare = Nightmare({ show: true })${newLine}`,
    `nightmare${newLine}`
  ].join(newLine)

  each(recording, function (record, i) {
    var type = record[0]
    var content = record[1]
    switch (type) {
      case 'goto':
        result += `  .goto('${content}')${newLine}`
        break
      case 'click':
        result += `  .click('${content}')${newLine}`
        break
      case 'type':
        const val = record[2]
        result += `  .type('${content}', '${val}')${newLine}`
        break
      case 'screenshot':
        result += `  .screenshot('${content}')${newLine}`
        break
      case 'reload':
        result += `  .refresh()${newLine}`
        break
      case 'evaluate':
        var textEl = `    return document.querySelector('${content}').innerText`

        result += [
          '    .evaluate(function () {',
          textEl,
          '    }, function (text) {',
          '      console.log(text)',
          `    })${newLine}`
        ].join(newLine)

        break
      default:
        console.log('Not a valid nightmare command')
    }
  })

  result +=

  `  .end()
  .then(function (result) {
    console.log(result)
  })
  .catch(function (error) {
    console.error('Error:', error);
  });`

  return result
}
