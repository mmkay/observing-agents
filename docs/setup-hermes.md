# Hermes Agent OpenTelemetry Configuration

Configuring [Hermes Agent](https://hermes-agent.nousresearch.com/) (Nous Research's self-hosted agent gateway, distributed as the `nousresearch/hermes-agent` Docker image) with its built-in gateway monitoring export.

Any observability backend that accepts OTLP/HTTP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

> These instructions apply regardless of how Hermes is deployed — the official Docker image, a pip install, a systemd service, etc. `config.yaml` and `.env` are read from wherever your deployment points Hermes at them (for the Docker image, conventionally a mounted data volume so changes survive container restarts and image updates). Where a step differs by deployment (restarting the process, reading logs), both forms are shown.

## What is sent

Hermes's `monitoring.gateway_health_export` feature exports:

- **Metrics** (observable gauges): `hermes.gateway.up`, `hermes.gateway.state`, `hermes.gateway.active_agents`, `hermes.gateway.busy`, `hermes.gateway.drainable`, `hermes.gateway.restart_requested`, `hermes.gateway.background_work`, `hermes.gateway.background_delegations`, `hermes.platform.up`, `hermes.platform.degraded`, `hermes.cron.scheduler.heartbeat_age_seconds`, `hermes.cron.scheduler.last_success_age_seconds`, `hermes.cron.scheduler.catch_up_occurrences`, `hermes.cron.jobs.enabled`, `hermes.cron.jobs.running`, `hermes.cron.jobs.overdue`. Prometheus renders the dots as underscores (e.g. `hermes_gateway_up`).
- **Traces**: one span per diagnostic event, named `hermes.<event>` (tracer name `hermes.monitoring`), attributes prefixed `hermes.*`.
- **Logs**: structured warning/error events from the gateway.

This is **structurally content-free**, not just off-by-default: the exporter allowlists attributes per event kind and never has a code path that can carry prompts, messages, tool arguments/results, session history, usage analytics, audit logs, or trajectories. Unlike OpenClaw's `diagnostics-otel` plugin, there is no `captureContent` opt-in — content capture isn't a config toggle you're forgetting to flip, it isn't implemented at all.

## Prerequisites

The OTel SDK (`hermes-agent[otlp]`) is an optional extra. It ships already installed in the `nousresearch/hermes-agent:latest` image — `hermes monitoring status` reports `OTel SDK: installed`. If it's ever missing, Hermes lazily installs it on first use (gated by `security.allow_lazy_installs`).

## Installation

### 1. Configure the endpoint

Add a `monitoring` block to `config.yaml`:

```yaml
monitoring:
  gateway_health_export:
    enabled: true
  export:
    otlp:
      enabled: true
      endpoint: "http://<your-otel-collector>:4318/v1/traces"
```

Restart the gateway to pick up the change — this is a config-file edit, not a hot-reloadable env var (`docker compose restart hermes` for the Docker image; restart the process/service directly otherwise, e.g. `systemctl restart hermes`).

| Key | Example | Notes |
|---|---|---|
| `monitoring.gateway_health_export.enabled` | `true` | Turns on the metrics/diagnostic-events/warning-log collectors |
| `monitoring.export.otlp.enabled` | `true` | Turns on the OTLP exporter itself |
| `monitoring.export.otlp.endpoint` | `http://otelcol:4318/v1/traces` | See the suffix gotcha below — **must** already end in `/v1/traces` or `/v1/metrics` |
| `monitoring.export.otlp.headers_env` | `{"Authorization": "MY_TOKEN_ENV_VAR"}` | Maps header name → **environment variable name** holding the value (never the value itself) |
| `monitoring.gateway_health_export.export_interval_seconds` | `60` | Metrics export interval |
| `monitoring.gateway_health_export.logs_export_interval_seconds` | `5` | Warning/error log export interval |

### 2. The endpoint-suffix gotcha (unlike most OTLP exporters)

Hermes's exporter does **not** append `/v1/traces`, `/v1/metrics`, or `/v1/logs` to a bare `host:port` endpoint the way the standard OTel SDK auto-defaulting does. It passes whatever string is in `endpoint` straight to `OTLPSpanExporter(endpoint=...)`, and only *rewrites* the suffix when the string already ends in `/v1/traces` or `/v1/metrics` (swapping to whichever signal is currently being exported).

Concretely:

- `endpoint: "http://otelcol:4318"` (bare, no path) → every export silently 404s. No startup error, no warning beyond a per-batch `ERROR opentelemetry.exporter.otlp.proto.http.trace_exporter: Failed to export span batch code: 404` repeating in the logs forever.
- `endpoint: "http://otelcol:4318/v1/traces"` (any one of the two known suffixes) → traces go to `/v1/traces`, metrics get correctly rewritten to `/v1/metrics`, logs to `/v1/logs`.

Always set the endpoint with an explicit `/v1/traces` (or `/v1/metrics`) suffix, never bare `host:port`.

### 3. Verify

```bash
hermes monitoring status
```

Run this wherever the `hermes` process runs — inside the container (`docker exec hermes hermes monitoring status`) for the Docker image, or directly on the host otherwise. Expected output includes the endpoint you set and confirms the SDK is installed. This does **not** confirm exports are actually succeeding — it only reports configuration, not delivery. To confirm delivery, watch the logs for a clean interval with no export errors:

```bash
# Docker image
docker logs hermes -f | grep -iE "otlp|otel|404"
# systemd service
journalctl -u hermes -f | grep -iE "otlp|otel|404"
# or tail whatever log file/stream your deployment writes to
```

Nothing printing for a couple of minutes (one metrics export cycle at the default 60s interval) means it's working. Any `Failed to export ... batch code: 404` means the endpoint suffix is wrong (see above).

## Connecting to COS on the same host

If Hermes runs on the same host as a Canonical Observability Stack (COS) on Kubernetes (e.g. via Canonical K8s or MicroK8s) — whether Hermes runs in a container or as a native process — it can reach the otelcol directly via the Kubernetes ClusterIP, no Tailscale or ingress needed.

Find the otelcol ClusterIP:

```bash
juju show-unit otelcol/0 -m cos 2>&1 | grep "private-address" | head -1
```

Confirm it is reachable (note the required path suffix), running curl from wherever Hermes runs:

```bash
curl -s -o /dev/null -w '%{http_code}' \
  -X POST http://<cluster-ip>:4318/v1/traces \
  -H 'Content-Type: application/json' -d '{}'
# Expected: 200
```

For the Docker image, run that from inside the container instead: `docker exec hermes sh -c "curl ..."`.

Use `http://<cluster-ip>:4318/v1/traces` as the `endpoint` in `config.yaml`.

> **Why the ClusterIP is reachable:** The Kubernetes dataplane installs routes for the service CIDR on the host's routing table. A native Hermes process on that host uses those routes directly; a container using bridge networking inherits them from the host. Either way, the ClusterIP is reachable without extra network configuration — a container on an isolated/custom network namespace may need host networking instead.

## Sampling: COS tail-based sampler

The COS OTel Collector applies a `tail_sampling` processor that classifies traces by service name. Hermes's spans carry `service.name: hermes-gateway` by default (`monitoring.gateway_health_export.resource_attributes`), which the sampler classifies as a **workload** trace — same bucket as OpenClaw:

| Config option | Default | Scope |
|---|---|---|
| `tracing_sampling_rate_charm` | `100` | Charm traces (service name matching `.*-charm`) |
| `tracing_sampling_rate_error` | `100` | Error-status traces from any source |
| `tracing_sampling_rate_workload` | `1` | All other traces (including `hermes-gateway`) |

At the default 1% rate nearly all Hermes traces are dropped. Increase the rate for development and testing:

```bash
juju config otelcol -m <model> tracing_sampling_rate_workload=100
```

## Data flow

```
Hermes gateway
  → agent.monitoring.otlp_exporter (OTLP HTTP/JSON, /v1/traces + /v1/metrics + /v1/logs)
    → OpenTelemetry Collector (<endpoint>:4318)
      → Tempo (traces)
      → Prometheus via Remote Write (metrics)
      → Loki (logs)
```

## Troubleshooting

### Every trace/metric/log export 404s

See [The endpoint-suffix gotcha](#2-the-endpoint-suffix-gotcha-unlike-most-otlp-exporters) above — the `endpoint` value is missing its `/v1/<signal>` suffix.

### `hermes monitoring status` looks fine but nothing appears in Prometheus/Tempo

`monitoring status` only reports configuration, not delivery — an endpoint with the wrong path still reports as "enabled" with the endpoint you typed. Check the gateway logs for `Failed to export ... batch` errors (see [Verify](#3-verify) above for how to read them on your deployment).

### Traces classified as low-priority workload traffic

See [Sampling: COS tail-based sampler](#sampling-cos-tail-based-sampler) above — at the default 1% workload rate, almost all `hermes-gateway` traces are dropped before they reach Tempo.
