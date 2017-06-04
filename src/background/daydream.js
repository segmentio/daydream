import Recorder from './recorder'
import each from 'component-each'
import os from 'component-os'

/**
 * Daydream is responsible for the following:
 *  - When the extension's icon is clicked to start, change the color
 *  of the icon to green and starting the recording
 *  - When the extension's icon is clicked to stop, change the color
 *  of the icon to black, stop the recording, and open the popup
 */

class Daydream {
  constructor () {
    this.isRunning = false
    this.recorder = new Recorder()
  }

  boot () {
    chrome.browserAction.onClicked.addListener(tab => {
      chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
        if (!this.isRunning) {
          this.recorder.startRecording()
          chrome.browserAction.setIcon({ path: 'images/icon-green.png', tabId: tab.id })
        } else {
          this.recorder.stopRecording()
          chrome.browserAction.setIcon({ path: 'images/icon-black.png', tabId: tab.id })
          const nightmare = this.parse(this.recorder.recording)
          chrome.storage.sync.set({ 'nightmare': nightmare })
          chrome.browserAction.setPopup({ popup: 'popup.html' })
          chrome.browserAction.setBadgeText({ text: '1' })
        }
        this.isRunning = !this.isRunning
      })
    })

    chrome.webNavigation.onCommitted.addListener(details => {
      chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
        if (this.isRunning) {
          chrome.browserAction.setIcon({ path: 'images/icon-green.png', tabId: tabs[0].id })
        }
      })
    })
  }

  parse (recording) {
    let newLine = '\n'
    if (os === 'windows') newLine = '\r\n'

    let result = [
      'const Nightmare = require(\'nightmare\')',
      `const nightmare = Nightmare({ show: true })${newLine}`,
      `nightmare${newLine}`
    ].join(newLine)

    each(recording, function (record, i) {
      const type = record[0]
      const content = record[1]
      switch (type) {
        case 'goto':
          result += `  .goto('${content}')${newLine}`
          break
        case 'click':
          result += `  .wait('${content}')${newLine}  .click('${content}')${newLine}`
          break
        case 'type':
          const val = record[2]
          result += `  .wait('${content}')${newLine}  .type('${content}', '${val}')${newLine}`
          break
        case 'screenshot':
          result += `  .screenshot('${content}')${newLine}`
          break
        case 'reload':
          result += `  .refresh()${newLine}`
          break
        case 'evaluate':
          const textEl = `    return document.querySelector('${content}').innerText`

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
}

export default Daydream
