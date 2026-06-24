.PHONY: help setup up down logs restart build ps shell-api change-credentials

help:
	@echo "Phantom SecOps — comandos"
	@echo "  make setup     Copia .env.example → .env"
	@echo "  make up        docker compose up -d --build"
	@echo "  make down      docker compose down"
	@echo "  make logs      Seguir logs de todos los servicios"
	@echo "  make restart   Reiniciar stack"
	@echo "  make build     Reconstruir imágenes"
	@echo "  make ps        Estado de contenedores"
	@echo "  make change-credentials  Cambiar usuario/contraseña admin"

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
