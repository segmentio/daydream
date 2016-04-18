
BIN = node_modules/.bin
DUO = $(BIN)/duo

BG := $(shell find lib/background/index.js)
FG := $(shell find lib/foreground/index.js)

default: build

build: node_modules
	@mkdir -p build
	@mkdir -p build/images
	@cp lib/manifest.json build/manifest.json
	@cp lib/images/icon-black.png build/images/icon-black.png
	@cp lib/images/icon-green.png build/images/icon-green.png
	@cp lib/foreground/popup/index.html build/index.html
	@cp lib/foreground/popup/index.css build/index.css
	@$(DUO) lib/foreground/popup/index.js > build/index.js
	@$(DUO) $(BG) > build/background.js
	@$(DUO) $(FG) > build/foreground.js

node_modules: package.json
	@npm install

clean:
	@rm -rf build

distclean:
	@rm -rf components node_modules

.PHONY: clean
