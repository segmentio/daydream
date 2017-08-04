'use strict'

/* global describe, it */

require.extensions['.css'] = () => null;

import test from 'ava'
import React from 'react'
import {render} from 'enzyme'
import SyntaxHighlighter from 'react-syntax-highlighter'

import App from '../../src/popup/components/App'

test('render with no events', t => {
  t.plan(1)

  const wrapper = render(
    <App recording={[]} />
  )

  if (wrapper.text().match('No results were captured.')) {
    return t.pass()
  }

  t.fail()
})

test('render syntax highlighter', t => {
  t.plan(2)

  const events = [
    {action: 'goto', url: 'https://google.com'},
    {action: 'change', selector: '#search', value: 'JavaScript'},
    {action: 'click', selector: '#go'}
  ]

  const wrapper = render(
    <App recording={events} />
  )

  t.is(wrapper.find('pre').length, 1)
  t.truthy(wrapper.find('span').length > 3)
})