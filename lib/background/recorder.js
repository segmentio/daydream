import Analytics from 'analytics-node/analytics-node.js'
import uid from 'uid'

const analytics = new Analytics('J0KCCfAPH6oXQJ8Np1IwI0HgAGW5oFOX')
const oldId = window.localStorage['userId']
const newId = oldId || uid()
if (!oldId) window.localStorage['userId'] = newId

module.exports = Recorder

function Recorder () {
  if (!(this instanceof Recorder)) return new Recorder()
  this.recording = []
}

Recorder.prototype.record = function (message) {
  const lastElement = this.recording[this.recording.length - 1]
  if (!lastElement) return this.recording.push(message)
  if (lastElement[1] === message[1]) return
  this.recording.push(message)
}

Recorder.prototype.startRecording = function () {
  const self = this

  this.detectScreenshots()
  this.detectUrl()
  this.detectEvents()

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    const message = request
    self.record(message)
  })

  analytics.track({ event: 'Started recording', userId: newId })
}

Recorder.prototype.detectEvents = function () {
  chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
    inject('content-script.js', tabs[0].id)
  })

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      chrome.tabs.query({currentWindow: true, active: true}, function (tabs) {
        if (tabId === tabs[0].id) inject('content-script.js', tabs[0].id)
      })
    }
  })
}

Recorder.prototype.detectUrl = function () {
  const self = this

  chrome.webNavigation.onCommitted.addListener(function (details) {
    const type = details.transitionType
    const from = details.transitionQualifiers

    switch (type) {
      case 'reload':
        if (!self.recording.length) return self.record(['goto', details.url])
        self.record(['reload'])

        analytics.track({ event: 'Reloaded page', userId: newId })
        break
      case 'typed':
        if (!from.length) return self.record(['goto', details.url])
        if (from[0] === 'from_address_bar') return self.record(['goto', details.url])
        if (from[0] === 'server_redirect' && from[1] === 'from_address_bar') return self.record(['goto', details.url])

        analytics.track({ event: 'Changed url', userId: newId })
        break
      case 'auto_bookmark':
        self.record(['goto', details.url])

        analytics.track({ event: 'Changed url', userId: newId })
        break
    }
  })
}

Recorder.prototype.detectScreenshots = function () {
  const self = this

  chrome.commands.onCommand.addListener(function (command) {
    if (command === 'detect-screenshot') self.record(['screenshot', 'index.png'])
    analytics.track({ event: 'Took screenshot', userId: newId })
  })
}

Recorder.prototype.stopRecording = function () {
  chrome.commands.onCommand.removeListener()
  chrome.webNavigation.onCommitted.removeListener()
  chrome.runtime.onMessage.removeListener()
  chrome.tabs.onUpdated.removeListener()
  analytics.track({ event: 'Stopped recording', userId: newId })
}

function inject (name, id) {
  chrome.tabs.executeScript(id, {file: name})
};
