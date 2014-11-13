
#
# Binaries.
#

BIN := ./node_modules/.bin
DUO := $(BIN)/_duo

#
# Targets.
#

JS1 := $(shell find lib/index.js)
JS2 := $(shell find lib/background.js)

#
# Default.
#

default: build

#
# Build.
#

build: folders
	@cp lib/manifest.json build/manifest.json
	@cp lib/images/icon-black.png build/images/icon-black.png
	@cp lib/images/icon-green.png build/images/icon-green.png
	@$(DUO) $(JS1) > build/index.js
	@$(DUO) $(JS2) > build/background.js

folders: node_modules
	@mkdir -p build
	@mkdir -p build/images

#
# Target for `node_modules` folder.
#

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
# Clean-dev.
#

clean-dev:
	@rm -rf build
	@rm -rf components

#
# Phonies.
#

.PHONY: build
.PHONY: clean
