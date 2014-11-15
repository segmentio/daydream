
#
# Binaries.
#

BIN := ./node_modules/.bin
DUO := $(BIN)/_duo

BG := $(shell find app/background/index.js)
FG := $(shell find app/foreground/index.js)

#
# Targets.
#

default: build

build: folders
	@cp app/manifest.json build/manifest.json
	@cp app/background/images/icon-black.png build/images/icon-black.png
	@cp app/background/images/icon-green.png build/images/icon-green.png
	@$(DUO) $(BG) > build/background.js
	@$(DUO) $(FG) > build/foreground.js

folders: node_modules
	@mkdir -p build
	@mkdir -p build/images

node_modules: package.json
	@npm install

#
# Clean.
#

clean:
	@rm -rf build
	@rm -rf components
	@rm -rf node_modules
	@npm cache clean

#
# Phonies.
#

.PHONY: build
.PHONY: clean
