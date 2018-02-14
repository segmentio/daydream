import React, { Component } from 'react'
import { connect } from 'react-redux'
import { getRecording, restart } from '../actions/creators'
import App from '../components/App'

class AppContainer extends Component {
  constructor (props) {
    super(props)

    this.state = {
      selectedTab: 'Nightmare'
    }

    this.onSelectTab = this.onSelectTab.bind(this)
  }

  render () {
    return React.createElement(App, {
      ...this.props,
      ...this.state,
      onSelectTab: this.onSelectTab
    })
  }

  onSelectTab (selectedTab) {
    this.setState({ selectedTab })
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
