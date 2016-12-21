
import js from 'highlight-javascript'
import Highlight from 'syntax-highlighter'
import './index.css'

chrome.storage.sync.get('nightmare', function (res) {
  var el = document.querySelector('pre')
  var highlight = Highlight().use(js)
  el.innerText = res.nightmare
  highlight.element(el)
})

const restart = document.querySelector('.Restart-Button')
restart.addEventListener('click', function (event) {
  chrome.browserAction.setBadgeText({text: ''})
  chrome.runtime.reload()
  window.close()
})
