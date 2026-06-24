.PHONY: help setup up down logs restart build ps shell-api change-credentials install deploy health backup clean verify

help:
	@echo "Phantom SecOps — comandos"
	@echo "  ./install.sh       Preparar .env y build imágenes"
	@echo "  ./start.sh         Levantar stack Docker"
	@echo "  ./stop.sh          Detener stack"
	@echo "  ./restart.sh       Reiniciar servicios"
	@echo "  ./deploy.sh        git pull + build + recreate"
	@echo "  ./healthcheck.sh   Comprobar web y API"
	@echo "  ./logs.sh          Seguir logs"
	@echo "  ./backup.sh        Respaldo BD + storage"
	@echo "  ./verify-env.sh    Validar .env"
	@echo "  ./clean.sh         Limpiar artefactos locales"
	@echo "  ./uninstall.sh     Desinstalar (ver --help)"
	@echo ""
	@echo "  make up / down     Atajos Docker (equivalente a start/stop)"

setup:
	@test -f .env || cp .env.example .env
	@echo "[+] .env listo — edita POSTGRES_PASSWORD y JWT_SECRET antes de make up"

up: setup
	docker compose up -d --build
	@echo ""
	@echo "[+] Phantom en https://localhost:$${PHANTOM_HTTP_PORT:-3000}"
	@echo "    Usuario: phantom  |  Contraseña: phantom"
	@echo "    Certificado autofirmado en Docker (acepta advertencia del navegador)."

down:
	docker compose down

logs:
	docker compose logs -f

restart:
	docker compose restart

build:
	docker compose build --no-cache

ps:
	docker compose ps

change-credentials:
	./change.sh

install:
	./install.sh

deploy:
	./deploy.sh

health:
	./healthcheck.sh

backup:
	./backup.sh

clean:
	./clean.sh

verify:
	./verify-env.sh
