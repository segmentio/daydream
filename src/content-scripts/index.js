/* global performance */

import Selector from 'css-selector-generator'

const selector = new Selector()
const escape = text => text.replace(/'/gm, '\\\'')

class EventRecorder {
  constructor () {
    this.startTime = performance.now()
    this.scrollDebounceTimer
    this.mouseDebounceTimer
    this.lastScroll
    this.lastMouse
  }

  start () {
    const inputs = document.querySelectorAll('input, textarea')

    for (let i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('change', this.handleEvent)
    }

    document.body.addEventListener('keypress', this.handleKeypress)
    document.body.addEventListener('click', this.handleEvent)
    document.body.addEventListener('scroll', this.handleScroll)
    document.body.addEventListener('mouseover', this.handleMouseover)
  }

  handleMouseover (e) {
    if (this.mouseDebounceTimer) {
      clearTimeout(this.mouseDebounceTimer)
    }

    this.mouseDebounceTimer = setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'wait',
        value: Math.floor(e.timeStamp - (this.lastMouse || this.startTime))
      })

      chrome.runtime.sendMessage({
        action: e.type,
        selector: selector.getSelector(e.target)
      })

      this.lastMouse = performance.now()
    }, 100)
  }

  handleScroll (e) {
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer)
    }

    this.scrollDebounceTimer = setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'wait',
        value: Math.floor(e.timeStamp - (this.lastScroll || this.startTime))
      })

      chrome.runtime.sendMessage({
        action: e.type,
        left: window.scrollX,
        top: window.scrollY
      })

      this.lastScroll = performance.now()
    }, 100)
  }

  handleKeypress (e) {
    if (e.keyCode === 13) {
      chrome.runtime.sendMessage({
        selector: selector.getSelector(e.target),
        action: e.type
      })
    }
  }

  handleEvent (e) {
    chrome.runtime.sendMessage({
      selector: selector.getSelector(e.target),
      value: e.target.value && typeof e.target.value === 'string'
        ? escape(e.target.value)
        : (e.target.value || null),
      action: e.type
    })
  }
}

const eventRecorder = new EventRecorder()
eventRecorder.start()
