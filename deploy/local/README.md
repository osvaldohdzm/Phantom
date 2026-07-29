# Phantom Host Deployment

This folder contains wrapper scripts to install, run, and manage **Phantom** native host environments.

## Scripts

- `install.sh`: Setup Node/npm and Python virtual environment.
- `dev.sh`: Run the development server with HTTPS + hot reloading.
- `prod.sh`: Run the production version locally.

All scripts delegate execution directly to the central `./phantom` CLI at the project root.
