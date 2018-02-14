import Selector from 'css-selector-generator'

const selector = new Selector()

class EventRecorder {
  start () {
    const typeableElements = document.querySelectorAll('input, textarea')
    const clickableElements = document.querySelectorAll('a, button')

    for (let i = 0; i < typeableElements.length; i++) {
      typeableElements[i].addEventListener('keydown', this.handleKeydown)
    }

    for (let i = 0; i < clickableElements.length; i++) {
      clickableElements[i].addEventListener('click', this.handleClick)
    }
  }

  handleKeydown (e) {
    if (e.keyCode !== 9) {
      return
    }
    sendMessage(e)
  }

  handleClick (e) {
    if (e.target.href) {
      chrome.runtime.sendMessage({
        action: 'url',
        value: e.target.href
      })
    }
    sendMessage(e)
  }
}

function sendMessage (e) {
  chrome.runtime.sendMessage({
    selector: selector.getSelector(e.target),
    value: e.target.value,
    action: e.type
  })
}

const eventRecorder = new EventRecorder()
eventRecorder.start()
