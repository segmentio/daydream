
export default class Recorder {
  constructor () {
    this.recording = []
  }

  start () {
    chrome.webNavigation.onCommitted.addListener(this.handleNavigation.bind(this))
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this))
    chrome.runtime.onMessage.addListener(this.record.bind(this))
    chrome.tabs.executeScript({ file: 'content-script.js' })
  }

  stop () {
    chrome.webNavigation.onCommitted.removeListener()
    chrome.runtime.onMessage.removeListener()
    chrome.tabs.onUpdated.removeListener()
  }

  handleNavigation (details) {
    const { transitionType, url } = details
    if (transitionType === 'auto_bookmark' || transitionType === 'typed') {
      this.record({ action: 'goto', url })
    } else if (transitionType === 'reload') {
      if (!this.recording.length) return this.record({ action: 'goto', url })
      this.record({ action: 'reload' })
    }
  }

  handleTabUpdate (_, { status }) {
    if (status === 'complete') {
      chrome.tabs.executeScript({ file: 'content-script.js' })
    }
  }

  record (message) {
    this.recording.push(message)
  }
}
