
import js from 'highlight-javascript'
import Highlight from 'syntax-highlighter'
import './index.css'

chrome.storage.sync.get('nightmare', function (res) {
  const el = document.querySelector('pre')
  const highlight = Highlight().use(js)
  el.innerText = res.nightmare
  highlight.element(el)
})

const restart = document.querySelector('.Button')
restart.addEventListener('click', function (event) {
  chrome.browserAction.setBadgeText({text: ''})
  chrome.runtime.reload()
  window.close()
})
