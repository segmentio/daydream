import Selector from 'css-selector-generator'

const selector = new Selector()

const escape = text => text.replace(/'/gm, '\\\'')

class EventRecorder {
  start () {
    const inputs = document.querySelectorAll('input, textarea')
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('change', this.handleEvent)
    }
    document.body.addEventListener('click', this.handleEvent)
  }

  handleEvent (e) {
    chrome.runtime.sendMessage({
      selector: selector.getSelector(e.target),
      value: escape(e.target.value),
      action: e.type
    })
  }
}

const eventRecorder = new EventRecorder()
eventRecorder.start()
