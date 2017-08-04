'use strict'

import test from 'ava'

import generateJavascript from '../src/popup/components/generateJavascript'

test('no events', t => {
  t.plan(1)

  const events = []

  const expected = `const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true });

nightmare

  .end()
  .then(result => {
    console.log(result);
  })
  .catch(error => {
    console.error('Error:', error);
  });`

  const output = generateJavascript(events)

  t.is(expected, output)
})

test('some events', t => {
  t.plan(1)

  const events = [
    {action: 'goto', url: 'https://github.com'}
  ]

  const expected = `const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true });

nightmare
  .goto('https://github.com')
  .end()
  .then(result => {
    console.log(result);
  })
  .catch(error => {
    console.error('Error:', error);
  });`

  const output = generateJavascript(events)

  t.is(expected, output)
})

test('swap text change and enter keypress to correct order', t => {
  t.plan(1)

  const events = [
    {action: 'goto', url: 'https://github.com'},
    {action: 'keypress', selector: '#search'},
    {action: 'change', selector: '#search', value: 'Daydream'}
  ]

  const expected = `const Nightmare = require('nightmare');
const nightmare = Nightmare({ show: true });

nightmare
  .goto('https://github.com')
  .type('#search', 'Daydream')
  .type('#search', '\\u000d')
  .end()
  .then(result => {
    console.log(result);
  })
  .catch(error => {
    console.error('Error:', error);
  });`

  const output = generateJavascript(events)

  t.is(expected, output)
})
