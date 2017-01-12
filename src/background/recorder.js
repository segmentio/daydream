
/**
 * Recorder is responsible for the following:
 *  - Detecting screenshots
 *  - Detecting URL changes
 *  - Injecting the content script that detects events on the page
 */

class Recorder {
  constructor () {
    this.recording = []
  }

  record (msg) {
    const lastElement = this.recording[this.recording.length - 1]
    if (!lastElement) return this.recording.push(msg)
    if (lastElement[1] === msg[1]) return
    this.recording.push(msg)
  }

  startRecording () {
    const self = this

    this.detectScreenshots()
    this.detectUrl()
    this.detectEvents()

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
      const message = request
      self.record(message)
    })
  }

  detectEvents () {
    chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
      chrome.tabs.executeScript(tabs[0].id, { file: 'content-script.js' })
    })

    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
      if (changeInfo.status === 'complete') {
        chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
          if (tabId === tabs[0].id) chrome.tabs.executeScript(tabs[0].id, { file: 'content-script.js' })
        })
      }
    })
  }

  detectScreenshots () {
    const self = this
    chrome.commands.onCommand.addListener(function (command) {
      if (command === 'detect-screenshot') self.record(['screenshot', 'index.png'])
    })
  }

  stopRecording () {
    chrome.commands.onCommand.removeListener()
    chrome.webNavigation.onCommitted.removeListener()
    chrome.runtime.onMessage.removeListener()
    chrome.tabs.onUpdated.removeListener()
  }

  detectUrl () {
    const self = this

    chrome.webNavigation.onCommitted.addListener(function (details) {
      const type = details.transitionType
      const from = details.transitionQualifiers

      switch (type) {
        case 'reload':
          if (!self.recording.length) return self.record(['goto', details.url])
          self.record(['reload'])
          break
        case 'typed':
          if (!from.length) return self.record(['goto', details.url])
          if (from[0] === 'from_address_bar') return self.record(['goto', details.url])
          if (from[0] === 'server_redirect' && from[1] === 'from_address_bar') return self.record(['goto', details.url])
          break
        case 'auto_bookmark':
          self.record(['goto', details.url])
          break
      }
    })
  }
}

export default Recorder
