# OpenClaw OpenTelemetry Configuration

Configuring [OpenClaw](https://openclaw.ai) with telemetry exported via the [`@openclaw/diagnostics-otel`](https://docs.openclaw.ai/gateway/opentelemetry) plugin.

Any observability backend that accepts OTLP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

> This guide assumes OpenClaw is deployed via **docker-compose** with a config volume mounted at `./config:/home/node/.openclaw`. Both plugin files and gateway configuration live in that volume, so all changes survive container restarts and image updates automatically — no re-installation needed after `docker compose pull && docker compose up -d`.

## What is sent

The plugin exports the following OTel signals:

- **Metrics** (token usage, cost, duration histograms, operational counters per agent run)
- **Traces** (agent lifecycle phases, model interactions, tool execution spans — e.g. `openclaw.diagnostic.phase`, `openclaw.agent.run`)
- **Logs** (structured gateway events)

Raw prompt and response content is **not** included by default. See [Optional: content capture](#optional-content-capture) below.

## Prerequisites

OpenClaw `>= 2026.4.25` is required. The plugin version must match the gateway version. Run `openclaw update` (or pull the latest Docker image) before installing.

## Installation

### 1. Install the plugin

```bash
docker exec openclaw openclaw plugins install clawhub:@openclaw/diagnostics-otel
```

The command downloads the plugin from ClawHub, installs it into the config volume at `./config/extensions/diagnostics-otel/`, and writes the entry to `plugins.entries` in `openclaw.json`. A gateway restart is triggered automatically via hot-reload.

Because the plugin lands inside the mounted volume, it persists across container recreations. After a `docker compose pull && docker compose up -d`, the plugin is already present and loads on startup with no further action.

### 2. Configure the endpoint

Add a `diagnostics` block to `openclaw.json`:

```json
{
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://<your-otel-collector>:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway"
    }
  }
}
```

The gateway hot-reloads this change and restarts with the exporter active. No manual restart needed.

| Key | Example | Notes |
|---|---|---|
| `endpoint` | `http://otelcol:4318` | OTLP HTTP endpoint of your collector |
| `protocol` | `http/protobuf` | Only `http/protobuf` is supported |
| `serviceName` | `openclaw-gateway` | Appears as the service name in Tempo/Grafana |
| `sampleRate` | `1.0` | Root-span sampling rate (0.0–1.0, default 1.0) |
| `flushIntervalMs` | `5000` | Metric export interval in ms (minimum 1000) |

### 3. Verify

Check that the exporters started — this metric appears in Prometheus within seconds of restart:

```
openclaw_telemetry_exporter_events{openclaw_signal="traces", openclaw_status="started"}
openclaw_telemetry_exporter_events{openclaw_signal="metrics", openclaw_status="started"}
```

Both should have `value = 1` and `job = openclaw-gateway`.

For traces, query Tempo after the first agent activity:

```bash
curl "http://<tempo>:3200/api/search?tags=service.name%3Dopenclaw-gateway&limit=5"
```

## Connecting to COS on the same host

If OpenClaw runs in Docker on the same host as a Canonical Observability Stack (COS) on Kubernetes (e.g. via Canonical K8s or MicroK8s), it can reach the otelcol directly via the Kubernetes ClusterIP — no Tailscale or ingress needed.

Find the otelcol ClusterIP:

```bash
juju show-unit otelcol/0 -m cos 2>&1 | grep "private-address" | head -1
```

From the Docker container, confirm it is reachable:

```bash
docker exec openclaw sh -c \
  "curl -s -o /dev/null -w '%{http_code}' \
   -X POST http://<cluster-ip>:4318/v1/traces \
   -H 'Content-Type: application/x-protobuf'"
# Expected: 200
```

Use that ClusterIP as the `endpoint` in `openclaw.json`.

> **Why the ClusterIP is reachable from Docker:** The Kubernetes dataplane installs routes for the service CIDR on the host's routing table. Docker bridge containers inherit those routes, so the ClusterIP is directly reachable without extra network configuration.

> **Tailnet vs ClusterIP:** When Tailscale MagicDNS is active, the hostname `cos-otelcol` may resolve to a Tailscale IP rather than the ClusterIP. Using the ClusterIP directly keeps traffic local and avoids an unnecessary Tailnet hop.

## Sampling: COS tail-based sampler

The COS OTel Collector applies a `tail_sampling` processor that classifies traces by service name:

| Config option | Default | Scope |
|---|---|---|
| `tracing_sampling_rate_charm` | `100` | Charm traces (service name matching `.*-charm`) |
| `tracing_sampling_rate_error` | `100` | Error-status traces from any source |
| `tracing_sampling_rate_workload` | `1` | All other traces (including `openclaw-gateway`) |

OpenClaw traces are classified as **workload** traces. At the default 1 % rate nearly all of them are dropped. Increase the rate for development and testing:

```bash
juju config otelcol -m <model> tracing_sampling_rate_workload=100
```

## Optional: content capture

By default, prompt text, tool inputs/outputs, and system prompt content are excluded from all exported signals. To include them:

```json
{
  "diagnostics": {
    "otel": {
      "captureContent": {
        "inputMessages": true,
        "outputMessages": true,
        "toolInputs": true,
        "toolOutputs": true,
        "systemPrompt": false
      }
    }
  }
}
```

## Data flow

```
OpenClaw gateway (docker-compose)
  → @openclaw/diagnostics-otel plugin (OTLP HTTP/protobuf)
    → OpenTelemetry Collector (<endpoint>:4318)
      → Tempo (traces)
      → Prometheus via Remote Write (metrics)
      → Loki (logs)
```

## Troubleshooting

### Plugin loads but only 2 plugins appear in the gateway

Setting `plugins.allow` to `["diagnostics-otel"]` restricts all plugins, including bundled ones. Either omit `plugins.allow` entirely (non-bundled plugins auto-load from `extensions/`) or list every plugin you need. The security warning about an empty allow list is informational and does not block operation.

### Traces not appearing in Tempo

See [Sampling: COS tail-based sampler](#sampling-cos-tail-based-sampler). At the default workload sampling rate of 1 %, nearly all OpenClaw traces are dropped. Increase the rate to 100 % with the `juju config` command above.

### Exporters started but no per-agent metrics in Prometheus

The plugin only emits per-run metrics after an agent run completes. The `openclaw_telemetry_exporter_events` startup metrics appear immediately, but counters such as token usage require at least one completed run. Send a Telegram message or wait for the next scheduled cron job.

### Endpoint unreachable from Docker container

Check that Kubernetes has installed routes for the service CIDR on the host:

```bash
ip route | grep <service-cidr-prefix>
```

If the route is absent, expose otelcol via a NodePort service or use host-network mode instead.
