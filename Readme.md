
# Daydream

> A chrome extension to record your actions into a [nightmare](https://github.com/segmentio/nightmare) script.

## Example

![Demo](http://f.cl.ly/items/2S3a3P2a1u3r1Z1I1y3f/screenshot.png)

## Installing

You can download Daydream from the Chrome Web Store [here](https://chrome.google.com/webstore/detail/daydream/oajnmbophdhdobfpalhkfgahchpcoali).

## Developing

1. Run `$ git clone https://github.com/segmentio/daydream.git && cd daydream && make`
2. Navigate to `chrome://extensions`
3. Ensure that 'Developer mode' is checked
4. Click `Load unpacked extension...`
5. Browse to `daydream/build` and press `Select`

## Notes

Daydream currently supports `.goto()`, `.click()`, `.type()`, `.screenshot()`, and `.refresh()`.

If you want daydream to capture typing, press <kbd>tab</kbd> after you finish typing in each input element.

## Analytics

You can easily add analytics-node to your own chrome extension:

```js
var Analytics = require('analytics-node');
var analytics = new Analytics('YOUR_WRITE_KEY');

var languages = window.navigator.languages;
var version = chrome.app.getDetails().version;

analytics.identify({ userId: '12345', version: version, languages: languages });
analytics.track({ userId: '12345', event: 'Opened Popup' });
```

## License

MIT
