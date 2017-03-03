import { createAction } from 'redux-actions'
import { RECEIVE_RECORDING } from './types'

const receiveRecording = createAction(RECEIVE_RECORDING)

export function getRecording () {
  return dispatch => {
    chrome.storage.sync.get('recording', recording => {
      dispatch(receiveRecording(recording))
    })
  }
}

export function restart () {
  chrome.browserAction.setBadgeText({ text: '' })
  chrome.runtime.reload()
  window.close()
}
