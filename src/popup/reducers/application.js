import { handleActions } from 'redux-actions'
import { RECEIVE_RECORDING } from '../actions/types'

const initialState = {
  recording: []
}

export default handleActions({
  [RECEIVE_RECORDING] (state, { payload }) {
    return {
      ...state,
      recording: payload.recording
    }
  }
}, initialState)
