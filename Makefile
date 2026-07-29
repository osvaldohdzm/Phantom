# Phantom — entrypoints operativos (delegan en ./phantom).
# Uso: make help | make start | make update

.PHONY: help install start stop restart update deploy build logs health backup clean \
        dev prod debug verify-env uninstall change catalog-export catalog-import fix-docker sbom

help:
	@./phantom help

install:
	@./phantom local install

start:
	@./phantom local start dev

stop:
	@./phantom local stop

restart:
	@./phantom local restart

update:
	@./phantom update

deploy:
	@./phantom cluster deploy

build:
	@./phantom docker build

logs:
	@./phantom docker logs

health:
	@./phantom doctor

backup:
	@./phantom backup $(ARGS)

clean:
	@./phantom local clean

dev:
	@./phantom local dev

prod:
	@./phantom local prod

debug:
	@./phantom local debug

verify-env:
	@./phantom doctor

uninstall:
	@./phantom local uninstall

change:
	@./phantom local passwd

catalog-export:
	@./phantom local catalog-export $(ARGS)

catalog-import:
	@./phantom local catalog-import

fix-docker:
	@./phantom docker fix

sbom:
	@./phantom local sbom $(ARGS)
