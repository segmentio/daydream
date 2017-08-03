import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import syntaxStyle from './syntaxStyle'
import styles from './App.css'

// when typing and then pressing enter, the 'change' event will only
// fire after the 'keypress' event and re-playing that back will be
// in the wrong order, so we need to swap only these whenever they happen

let sortEvents = events => {
  const output = []

  for (let i = 0, len = events.length; i < len; i++) {
    const {action, value = null, selector} = events[i]

    if (action === 'keypress') {
      if (
        events[i + 1] &&
        events[i + 1].action === 'change' &&
        events[i + 1].selector === selector) {
        output.push(events[i + 1])
        output.push(events[i])
        i++
        continue
      }
    }

    output.push(events[i])
  }

  return output
}

const App = props => (
  <div>
    <SyntaxHighlighter language='javascript' style={syntaxStyle}>
      {`const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true });

nightmare
${sortEvents(props.recording).reduce((records, record, i) => {
  const { action, url, selector, value } = record
  let result = records
  if (i !== records.length) result += '\n'

  switch (action) {
    case 'wait':
      result += `  .wait(${value})`
      break
    case 'scroll':
      result += `  .scrollTo(${top}, ${left})`
      break
    case 'change':
      result += `  .type('${selector}', '${value}')`
      break
    case 'keypress':
      result += `  .type('${selector}', '\\u000d')`
      break
    case 'click':
      result += `  .click('${selector}')`
      break
    case 'goto':
      result += `  .goto('${url}')`
      break
    case 'reload':
      result += `  .refresh()`
      break
  }

  return result
}, '')}
  .end()
  .then(result => {
    console.log(result);
  })
  .catch(error => {
    console.error('Error:', error);
  });`}
    </SyntaxHighlighter>

    <button className={styles.button} onClick={props.handleRestart}>Restart</button>
  </div>
)

App.displayName = 'App'

export default App
