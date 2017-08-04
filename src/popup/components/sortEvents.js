'use strict'

// when typing and then pressing enter, the 'change' event will only
// fire after the 'keypress' event and re-playing that back will be
// in the wrong order, so we need to swap only these whenever they happen

export default function (events) {
  const output = []

  for (let i = 0, len = events.length; i < len; i++) {
    const {action, selector} = events[i]

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
