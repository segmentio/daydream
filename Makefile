
BIN = node_modules/.bin
DUO = $(BIN)/duo

BG := $(shell find app/background/index.js)
FG := $(shell find app/foreground/index.js)

default: build

build: node_modules
	@mkdir -p build
	@mkdir -p build/images
	@cp app/manifest.json build/manifest.json
	@cp app/background/images/icon-black.png build/images/icon-black.png
	@cp app/background/images/icon-green.png build/images/icon-green.png
	@cp app/foreground/popup/index.html build/index.html
	@cp app/foreground/popup/index.css build/index.css
	@$(DUO) app/foreground/popup/index.js > build/index.js
	@$(DUO) $(BG) > build/background.js
	@$(DUO) $(FG) > build/foreground.js

node_modules: package.json
	@npm install

clean:
	@rm -rf build
	
distclean:
	@rm -rf components node_modules

.PHONY: clean
