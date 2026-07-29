# Phantom Docker Deployment

This folder contains container deployment files for the **Phantom SecOps** platform.

## Structure

- `*.Dockerfile`: Individual service Dockerfiles (API, Web, parser, ingester).
- `docker-compose.yml`: Default multi-container deployment stack configuration.
- `docker-compose.dev.yml`: Development-specific compose file.
- `docker-compose.prod.yml`: Production-specific compose file with persistent policies and scaling defaults.

## Usage

All docker commands should be invoked using the unified `phantom` CLI at the root of the project:

```bash
# Build images
./phantom docker build

# Start the stack
./phantom docker start

# View logs
./phantom docker logs

# Stop the stack
./phantom docker stop
```
