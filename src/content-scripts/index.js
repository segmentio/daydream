import Selector from 'css-selector-generator'

const selector = new Selector()

class EventRecorder {
  start () {
    const inputs = document.querySelectorAll('input, textarea')
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('change', this.handleEvent)
    }
    document.body.addEventListener('click', this.handleEvent)
  }

  handleEvent (e) {
    if (e.target.href) {
      chrome.runtime.sendMessage({
        action: 'url',
        value: e.target.href
      })
    }

    chrome.runtime.sendMessage({
      selector: selector.getSelector(e.target),
      value: e.target.value,
      action: e.type
    })
  }
}

const eventRecorder = new EventRecorder()
eventRecorder.start()
