#!/usr/bin/env node

import { Command } from 'commander';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import http from 'http';
import https from 'https';
import net from 'net';
import { exec } from 'child_process';
import client from 'prom-client';
import express from 'express';

const program = new Command();

program
  .name('abena')
  .description('On-prem health probe toolkit (Blackbox-style)')
  .version('1.0.0')
  .argument('[targets...]', 'Targets to probe (URL or host:port)')
  .option('-c, --config <path>', 'Path to YAML config file', 'probes.yaml')
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '5000')
  .option('--json', 'Output in JSON format')
  .option('--metrics', 'Start Prometheus metrics server')
  .option('--metrics-port <port>', 'Metrics server port', '9090')
  .option('--module <type>', 'Probe module (http, tcp, icmp)', 'http')
  .action(async (targets, options) => {
    if (options.metrics) {
      await startMetricsServer(options.metricsPort);
      return;
    }

    const results = [];
    let probeTargets = targets;

    if (probeTargets.length === 0) {
      probeTargets = await loadConfig(options.config);
    }

    for (const target of probeTargets) {
      const result = await performProbe(target, options);
      results.push(result);
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      results.forEach(r => console.log(r.message));
    }

    // Exit code
    process.exit(results.every(r => r.status === 'healthy') ? 0 : 1);
  });

async function loadConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(content);
    return config.targets || [];
  } catch (e) {
    console.error('Config load failed:', e.message);
    return [];
  }
}

async function performProbe(target, options) {
  const start = Date.now();
  try {
    if (target.startsWith('http')) {
      return await httpProbe(target, options);
    } else if (target.includes(':')) {
      const [host, port] = target.split(':');
      return await tcpProbe(host, parseInt(port), options);
    } else {
      return await icmpProbe(target, options);
    }
  } catch (error) {
    return { target, status: 'failed', message: `❌ ${target} → ${error.message}` };
  }
}

async function httpProbe(url, options) {
  return new Promise((resolve) => {
    const req = (url.startsWith('https') ? https : http).get(url, { timeout: +options.timeout }, (res) => {
      resolve({
        target: url,
        status: res.statusCode < 400 ? 'healthy' : 'failed',
        statusCode: res.statusCode,
        message: `✅ ${url} → ${res.statusCode}`
      });
    });
    req.on('error', (e) => resolve({ target: url, status: 'failed', message: `❌ ${url} → ${e.message}` }));
    req.on('timeout', () => resolve({ target: url, status: 'failed', message: `❌ ${url} → timeout` }));
  });
}

async function tcpProbe(host, port, options) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(+options.timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve({ target: `${host}:${port}`, status: 'healthy', message: `✅ ${host}:${port} (TCP) open` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ target: `${host}:${port}`, status: 'failed', message: `❌ ${host}:${port} (TCP) timeout` });
    });

    socket.on('error', (e) => resolve({ target: `${host}:${port}`, status: 'failed', message: `❌ ${host}:${port} (TCP) ${e.message}` }));

    socket.connect(port, host);
  });
}

async function icmpProbe(host) {
  return new Promise((resolve) => {
    exec(`ping -c 1 -W 2 ${host}`, (error) => {
      if (error) {
        resolve({ target: host, status: 'failed', message: `❌ ${host} (ICMP) unreachable` });
      } else {
        resolve({ target: host, status: 'healthy', message: `✅ ${host} (ICMP) reachable` });
      }
    });
  });
}

async function startMetricsServer(port) {
  const app = express();
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.listen(port, () => {
    console.log(`🚀 Abena metrics server running → http://localhost:${port}/metrics`);
  });
}

program.parse();