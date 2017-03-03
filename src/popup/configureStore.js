import { compose, createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'
import rootReducer from './reducers'

const { NODE_ENV = 'development' } = process.env

const configureStore = (preloadedState = {}) => {
  const middleware = [ thunk ]

  if (NODE_ENV === 'development') {
    const createLogger = require('redux-logger')
    const logger = createLogger({ collapsed: true })
    middleware.push(logger)
  }

  const store = createStore(rootReducer, preloadedState, compose(
    applyMiddleware(...middleware),
    global.devToolsExtension ? global.devToolsExtension() : f => f
  ))

  return store
}

export default configureStore
