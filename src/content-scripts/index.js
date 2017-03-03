import CssSelectorGenerator from 'css-selector-generator'
import each from 'component-each'

const cssSelectorGeneratorInstance = new CssSelectorGenerator

detect('click')
detect('keydown')
detect('copy')

function detect (listener) {
  if (listener === 'copy') return copyText()

  const els = document.querySelectorAll('body')
  each(els, function (el) {
    el.addEventListener(listener, function (event) {
      if (listener === 'click') handle('click', event.target)
      if (listener === 'keydown' && event.keyCode === 9) handle('type', event.target)
    })
  })
};

function copyText () {
  window.onkeydown = function (event) {
    if (event.keyCode === 67 && event.ctrlKey) {
      const selObj = window.getSelection()
      handle('evaluate', selObj.focusNode)
    }
  }
};

function handle (event, node) {
  if (chrome && chrome.runtime) {
    const path = cssSelectorGeneratorInstance.getSelector(node)
    const message = [event, path]
    message.push(node.value)
    chrome.runtime.sendMessage(message)
  }
};
