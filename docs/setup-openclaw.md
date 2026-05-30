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

Both should have `value = 1` and `job = openclaw-gateway`. If only one series appears, one exporter failed to initialize cleanly — restart the gateway (`docker compose restart openclaw`).

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

## LangFuse compatibility

OpenClaw uses its own `@openclaw/diagnostics-otel` plugin. The actual span names emitted are `openclaw.run`, `openclaw.model.call`, `openclaw.model.usage`, `openclaw.harness.run`, `openclaw.exec`, and `openclaw.context.assembled`. Despite the custom naming, the plugin does use `gen_ai.*` attributes:

- `openclaw.model.call` spans carry `gen_ai.system`, `gen_ai.request.model`, and `gen_ai.operation.name` — LangFuse renders them as typed LLM generations (`GENERATION`).
- `openclaw.model.usage` spans carry `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens` (the standard OTel names) — LangFuse picks up token counts correctly, unlike Claude Code.
- `exec` tool spans carry `gen_ai.tool.name` — LangFuse renders them as `TOOL` type.

OpenClaw does not use the OpenInference convention (`openinference.span.kind`), so there is no session-level cost or agent roll-up view. The LLM and tool spans are typed, but the overall trace reads as a flat list without an agent-session wrapper.

## Troubleshooting

### Plugin loads but only 2 plugins appear in the gateway

Setting `plugins.allow` to `["diagnostics-otel"]` restricts all plugins, including bundled ones. Either omit `plugins.allow` entirely (non-bundled plugins auto-load from `extensions/`) or list every plugin you need. The security warning about an empty allow list is informational and does not block operation.

Removing `plugins.allow` from the config hot-reloads the key but does **not** retroactively load plugins that were excluded at startup. A gateway restart is required for the full plugin set to take effect:

```bash
docker compose restart openclaw
```

### Traces not appearing in Tempo

First check the plugin count:

```bash
docker logs openclaw | grep "http server listening" | tail -1
```

If the count is lower than expected (e.g. `2 plugins` instead of 9), see [Plugin loads but only 2 plugins appear](#plugin-loads-but-only-2-plugins-appear-in-the-gateway) below. Traces for runs that completed while the plugin was not loaded will never appear — only runs after a clean restart with the full plugin set will produce traces.

If the plugin count is correct, check the sampling rate. See [Sampling: COS tail-based sampler](#sampling-cos-tail-based-sampler). At the default workload sampling rate of 1 %, nearly all OpenClaw traces are dropped. Increase the rate to 100 % with the `juju config` command above.

### Exporters started but no per-agent metrics in Prometheus

The plugin only emits per-run metrics after an agent run completes. The `openclaw_telemetry_exporter_events` startup metrics appear immediately, but counters such as token usage require at least one completed run. Send a Telegram message or wait for the next scheduled cron job.

If metrics still do not appear after a confirmed completed run, check the plugin count (see [Traces not appearing in Tempo](#traces-not-appearing-in-tempo)). A gateway running with a reduced plugin set due to a past `plugins.allow` restriction will not emit per-run metrics even though the startup metrics appeared.

### Endpoint unreachable from Docker container

Check that Kubernetes has installed routes for the service CIDR on the host:

```bash
ip route | grep <service-cidr-prefix>
```

If the route is absent, expose otelcol via a NodePort service or use host-network mode instead.

### Metrics stop after a gateway in-process restart

**Symptom:** OpenClaw dashboards show data up to a point in time and then go blank, even though the container is healthy, agents are running, and logs continue flowing. The `openclaw_telemetry_exporter_events` metric may show a brief data point right after the restart, then nothing.

**Cause:** OpenClaw performs *in-process* gateway restarts (via SIGUSR1) for config hot-reloads (e.g. browser plugin changes, `plugins.allow` changes). These restarts reload all plugins without terminating the Node.js process. The OpenTelemetry SDK registers its MeterProvider as a module-level singleton — it survives the in-process restart unmodified. When the diagnostics-otel plugin re-initializes on top of the stale global MeterProvider, the periodic metric export interval breaks silently: one "last gasp" batch is sent and then the exporter freezes. No error is logged.

**Identify:** Check when the data gap starts and compare against gateway restart events in the logs:

```bash
docker logs openclaw | grep "received SIGUSR1\|http server listening" | tail -10
```

If a restart lines up with the start of the data gap, this is the cause.

**Fix:** Do a full container restart to reset all Node.js global state:

```bash
docker compose restart openclaw
```

The exporter re-initializes cleanly on the next container start. Verify within 60–90 seconds:

```bash
curl -s 'http://<prometheus>:9090/api/v1/query?query=openclaw_telemetry_exporter_events' \
  | python3 -m json.tool
```

Both `openclaw_signal="metrics"` and `openclaw_signal="traces"` series should appear with a fresh timestamp.

> **Note on verification:** The presence of `openclaw_telemetry_exporter_events{status="started"}` immediately after a restart does not confirm the exporter is healthy — a single "last gasp" batch fires even when the exporter is broken. A reliable check is to confirm the metric timestamp has advanced more than once across two consecutive flush intervals (default 5s each).
