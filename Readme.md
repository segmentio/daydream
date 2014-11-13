
# Daydream

Daydream is a chrome extension to record your actions into a [nightmare](https://github.com/segmentio/nightmare) script.

## Example

![Demo](lib/images/demo.gif)

## Usage

#### Installing

You can download Daydream from the Chrome Web Store [here](https://chrome.google.com/webstore/detail/daydream/oajnmbophdhdobfpalhkfgahchpcoali).

#### Developing

The entry point to the extension is `background.js`, where a recorder is initialized to start listening for icon clicks and messages from the content script `index.js`. `recorder.js` contains the background recorder logic, which includes injecting `index.js` as needed, and transforming the recording array into a nightmare script. `helper.js` contains wrappers for chrome extension API methods.

* Clone this repo
* Run `make`
* Navigate to `chrome://extensions` in your Chrome browser
* Click the `Pack extension...` button
* Browse to the `daydream/build` directory
* Click the `Pack Extension` button
* Click the `Load unpacked extension...` button
* Browse to the `daydream/build` directory and press the `Select` button

For the extension to work properly:

* When you change the URL from the address bar, you need to type `daydream`, press `tab`, and then type in the url

* When you type input elements, you need to press `tab` afterwards.
