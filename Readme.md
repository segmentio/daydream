
# Daydream

> A chrome extension to record your actions into a [nightmare](https://github.com/segmentio/nightmare) script.

## Demo

![Demo](app/background/images/demo.gif)

## Structure

The app is organized into two sections, *background* and *foreground*. Scripts running in the background do **not** run in the context of the page, but have access to Chrome Extension API methods for various things like injecting scripts and listening for interactions with the extension itself. Scripts running in the foreground run in the context of the page, and therefore can access the DOM, but **cannot** access certain Chrome Extension API methods that the background script can access. There is also an underlying connection between the background scripts and foreground scripts via messages.

## Usage

### Installing

You can download Daydream from the Chrome Web Store [here](https://chrome.google.com/webstore/detail/daydream/oajnmbophdhdobfpalhkfgahchpcoali).

### Developing

1. Run ```$ git clone https://github.com/segmentio/daydream.git && cd daydream && make```

2. Navigate to `chrome://extensions`

3. Click `Pack extension...`

4. Browse to `daydream/build`

5. Click `Load unpacked extension...`

6. Browse to `daydream/build` and press `Select`

### Notes

If you want daydream to capture url changes in the address bar, type `daydream`, press `tab`, and then type in the url. If you want daydream to capture the values in input elements, press `tab` after you finish typing in each element.
