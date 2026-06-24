.PHONY: help setup up down logs restart build ps shell-api change-credentials install deploy health backup clean verify phantom

help:
	@echo "Phantom SecOps — comandos (ver también: ./phantom help)"
	@echo "  ./phantom install    Preparar .env y build imágenes"
	@echo "  ./phantom start      Levantar stack Docker"
	@echo "  ./phantom stop       Detener stack"
	@echo "  ./phantom restart    Reiniciar servicios"
	@echo "  ./phantom update     git pull + build + recreate"
	@echo "  ./phantom health     Comprobar web y API"
	@echo "  ./phantom logs       Seguir logs"
	@echo "  ./phantom backup     Respaldo BD + storage"
	@echo "  ./phantom verify-env Validar .env"
	@echo "  ./phantom clean      Limpiar artefactos locales"
	@echo "  ./phantom debug      Dev nativo + diagnóstico de puertos"
	@echo "  ./phantom uninstall  Desinstalar (ver --help)"
	@echo ""
	@echo "  make up / down       Atajos Docker (equivalente a start/stop)"

phantom:
	@./phantom help

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
	./phantom change

install:
	./phantom install

deploy:
	./phantom update

health:
	./phantom health

backup:
	./phantom backup

clean:
	./phantom clean

verify:
	./phantom verify-env
