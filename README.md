# Abena

**On-Prem Health Probe Toolkit** — A lightweight, Blackbox-style CLI + Prometheus exporter for monitoring internal services.

## Features

- **Probe Types**: HTTP/HTTPS, TCP, ICMP, DNS
- **Batch & Config-driven** probing (YAML)
- **Prometheus Metrics** export (`/metrics`)
- **CLI + Long-running Exporter** modes
- **Docker** + **docker-compose** support
- **Exit codes** for CI/CD and cron jobs
- **Parallel** execution with retries

## Quick Start

```bash
# Install
npm install

# Basic usage
node src/index.mjs https://example.com

# With config
node src/index.mjs --config probes.yaml

# Start Prometheus metrics server
node src/index.mjs --metrics

# Help
node src/index.mjs --help