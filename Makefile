WEBPACK_FLAGS ?=

build: node_modules
	node_modules/.bin/webpack $(WEBPACK_FLAGS) --bail

node_modules: package.json
	npm install
	touch $@

clean:
	rm -rf build

lint: node_modules
	node_modules/.bin/standard

.PHONY: clean lint
