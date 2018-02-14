
export default class Recorder {
  constructor () {
    this.recording = []
    this.lastUrl
  }

  start () {
    chrome.webNavigation.onCompleted.addListener(this.handleCompletedNavigation.bind(this))
    chrome.webNavigation.onCommitted.addListener(this.handleCommittedNavigation.bind(this))
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
  }

  stop () {
    chrome.webNavigation.onCommitted.removeListener()
    chrome.runtime.onMessage.removeListener()
    chrome.tabs.onUpdated.removeListener()
  }

  handleCompletedNavigation ({ url, frameId }) {
    if (frameId === 0) {
      chrome.tabs.executeScript({ file: 'content-script.js' })
    }
  }

  handleCommittedNavigation ({ transitionQualifiers, url }) {
    if (transitionQualifiers.includes('from_address_bar') || url === this.lastUrl) {
      this.handleMessage({ action: 'goto', url })
    }
  }

  handleMessage (message) {
    if (message.action === 'url') {
      this.lastUrl = message.value
    } else {
      this.recording.push(message)
    }
  }
}
