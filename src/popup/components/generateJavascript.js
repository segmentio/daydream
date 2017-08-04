'use strict'

import sortEvents from './sortEvents'

function generateJavascript (events) {
  return sortEvents(events).reduce((records, record, i) => {
    const { action, url, selector, value } = record

    let result = records
    if (i !== records.length) result += '\n'

    switch (action) {
      case 'mouseover':
        result += `  .mouseover('${selector}')`
        break
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
  }, '')
}

export default function (events) {
  return `const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true });

nightmare
${generateJavascript(events)}
  .end()
  .then(result => {
    console.log(result);
  })
  .catch(error => {
    console.error('Error:', error);
  });`
}
