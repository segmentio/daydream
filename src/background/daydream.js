
import Recorder from './recorder'

export default class Daydream {
  constructor () {
    this.isRunning = false
    this.recorder = new Recorder()
  }

  boot () {
    chrome.browserAction.onClicked.addListener(() => {
      if (this.isRunning) {
        this.recorder.stop()
        chrome.storage.sync.set({ recording: this.recorder.recording })
        chrome.browserAction.setIcon({ path: './images/icon-idle.png' })
        chrome.browserAction.setPopup({ popup: 'index.html' })
        chrome.browserAction.setBadgeBackgroundColor({ color: '#00386C' })
        chrome.browserAction.setBadgeText({ text: '1' })
      } else {
        this.recorder.start()
        chrome.browserAction.setIcon({ path: './images/icon-recording.png' })
      }

      this.isRunning = !this.isRunning
    })
  }
}
