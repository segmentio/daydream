import React, { Component } from 'react'
import App from '../components/App'

export default class AppContainer extends Component {
  constructor (props) {
    super(props)

    this.state = {
      selectedTab: 'Nightmare',
      recording: []
    }

    this.onSelectTab = this.onSelectTab.bind(this)
    this.onRestart = this.onRestart.bind(this)
  }

  render () {
    return React.createElement(App, {
      ...this.props,
      ...this.state,
      onSelectTab: this.onSelectTab,
      onRestart: this.onRestart
    })
  }

  componentDidMount () {
    chrome.storage.sync.get('recording', ({ recording }) => {
      this.setState({ recording })
    })
  }

  onSelectTab (selectedTab) {
    this.setState({ selectedTab })
  }

  onRestart () {
    chrome.browserAction.setBadgeText({ text: '' })
    chrome.runtime.reload()
    window.close()
  }
}
