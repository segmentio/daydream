import React, { Component } from 'react'
import { connect } from 'react-redux'
import { getRecording, restart } from '../actions/creators'
import App from '../components/App'

class AppContainer extends Component {
  render () {
    return React.createElement(App, this.props)
  }

  componentDidMount () {
    this.props.init()
  }
}

function mapStateToProps (state) {
  return {
    recording: state.application.recording
  }
}

function mapDispatchToProps (dispatch) {
  return {
    init () {
      dispatch(getRecording())
    },
    handleRestart: restart
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
