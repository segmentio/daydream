import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import syntaxStyle from './syntaxStyle'
import styles from './App.css'

const App = props => (
  <div>
    <SyntaxHighlighter language='javascript' style={syntaxStyle}>
      {`const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: true })

nightmare
${props.recording.reduce((records, record, i) => {
  const { action, url, selector, value } = record
  let result = records
  if (i !== records.length) result += '\n'

  switch (action) {
    case 'change':
      result += `.type('${selector}', '${value}')`
      break
    case 'click':
      result += `.click('${selector}')`
      break
    case 'goto':
      result += `.goto('${url}')`
      break
    case 'reload':
      result += `.refresh()`
      break
  }

  return result
}, '')}
.end()
.then(function (result) {
  console.log(result)
})
.catch(function (error) {
  console.error('Error:', error);
});`}
    </SyntaxHighlighter>

    <button className={styles.button} onClick={props.handleRestart}>Restart</button>
  </div>
)

App.displayName = 'App'

export default App
