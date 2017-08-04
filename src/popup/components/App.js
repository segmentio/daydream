import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import syntaxStyle from './syntaxStyle'
import styles from './App.css'
import generateJavascript from './generateJavascript'

const NoResults = props => (
  <div>
    No results were captured.
  </div>
)

const App = props => (
  <div>
    {props.recording.length
      ? <SyntaxHighlighter language='javascript' style={syntaxStyle}>
        {generateJavascript(props.recording)}
      </SyntaxHighlighter>
      : <NoResults />}

    <button
      className={styles.button}
      onClick={props.handleRestart}>
      Restart
    </button>
  </div>
)

App.displayName = 'App'

export default App
