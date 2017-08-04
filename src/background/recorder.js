
export default class Recorder {
  constructor () {
    this.recording = []
    this.running = false
  }

  start () {
    this.running = true
    chrome.webNavigation.onCompleted.addListener(this.handleCompletedNavigation.bind(this))
    chrome.webNavigation.onCommitted.addListener(this.handleCommittedNavigation.bind(this))
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    chrome.browserAction.setTitle({ title: 'Recording events...' })
  }

  stop () {
    this.running = false
    chrome.webNavigation.onCommitted.removeListener()
    chrome.runtime.onMessage.removeListener()
    chrome.tabs.onUpdated.removeListener()
  }

  incrementCounter () {
    if (this.running) {
      chrome.browserAction.getBadgeText({}, count => {
        chrome.browserAction.setBadgeBackgroundColor({
          color: '#00386C'
        })

        chrome.browserAction.setBadgeText({
          text: String(+count + 1)
        })
      })
    }
  }

  handleCompletedNavigation ({ url, frameId }) {
    if (frameId === 0) {
      chrome.tabs.executeScript({ file: 'content-script.js' })
    }
  }

  handleCommittedNavigation ({ transitionQualifiers, url }) {
    if (transitionQualifiers.includes('from_address_bar')) {
      this.incrementCounter()
      this.handleMessage({ action: 'goto', url })
    }
  }

  handleMessage (message) {
    this.incrementCounter()
    this.recording.push(message)
  }
}
