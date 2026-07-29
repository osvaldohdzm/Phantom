# Phantom Kubernetes Deployment

This directory contains the Kubernetes manifests and configurations to run Phantom in a cluster.

## Structure

- `base/`: Core manifests (namespace, services, deployments, ingress) for the application.
- `helm/`: Future Helm chart directory.
- `overlays/`: Future Kustomize overlay layers (e.g. staging vs production overrides).

## Usage

Use the unified `phantom` CLI to build manifests or trigger deploys:

```bash
# Generate/update the main manifest
./phantom cluster deploy
```

Manual deployment:

```bash
# Apply deployment to the cluster
kubectl apply -f deploy/kubernetes/base/deployment.yaml
```
