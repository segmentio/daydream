WEBPACK_FLAGS ?=

build: node_modules
	node_modules/.bin/webpack $(WEBPACK_FLAGS) --bail

watch: node_modules
	node_modules/.bin/webpack $(WEBPACK_FLAGS) --watch

node_modules: yarn.lock
	yarn
	touch $@

clean:
	rm -rf build

lint: node_modules
	node_modules/.bin/standard

.PHONY: clean lint
