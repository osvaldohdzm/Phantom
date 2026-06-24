# Phantom — entrypoints operativos (delegan en ./phantom).
# Uso: make help | make start | make update

.PHONY: help install start stop restart update build logs health backup clean \
        dev prod debug verify-env uninstall change catalog-export catalog-import fix-docker

help:
	@./phantom help

install:
	@./phantom install

start:
	@./phantom start

stop:
	@./phantom stop

restart:
	@./phantom restart

update deploy:
	@./phantom update

build:
	@./phantom build

logs:
	@./phantom logs

health:
	@./phantom health

backup:
	@./phantom backup $(ARGS)

clean:
	@./phantom clean

dev:
	@./phantom dev

prod:
	@./phantom prod

debug:
	@./phantom debug

verify-env:
	@./phantom verify-env

uninstall:
	@./phantom uninstall

change:
	@./phantom change

catalog-export:
	@./phantom catalog-export $(ARGS)

catalog-import:
	@./phantom catalog-import

fix-docker:
	@./phantom fix-docker
