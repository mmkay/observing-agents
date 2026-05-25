# Ollama observability

## Overview

Ollama is a local LLM server. Observability for it falls into two categories:

- **Application-level**: token counts, request latency, model name — from the perspective of the client application making ollama API calls.
- **Infrastructure-level**: VRAM usage, which models are loaded, process CPU/memory — from the server itself.

These two categories require different instrumentation approaches, and no single option covers both without trade-offs.

## Ollama's native telemetry

Ollama has **no native Prometheus `/metrics` endpoint**. This is a long-standing upstream request ([issue #3144](https://github.com/ollama/ollama/issues/3144)) with a PR open but unmerged as of 2026-05. There is also no OpenTelemetry support in ollama itself ([issue #9254](https://github.com/ollama/ollama/issues/9254)).

The `/api/ps` endpoint returns which models are currently loaded, but that is the only built-in observability hook.

---

## Option A: Application-level instrumentation (recommended)

Instrument the Python client using [OpenLLMetry](https://github.com/traceloop/openllmetry) (`traceloop-sdk` + `opentelemetry-instrumentation-ollama`).

**What you get:**
- Token counts (input and output) per request — `gen_ai.client.token.usage` histogram
- End-to-end latency per operation — `gen_ai.client.operation.duration` histogram
- Model name, operation type (`chat` / `generate`) on every metric and trace
- Distributed traces correlated with metrics via the same OTLP pipeline

**What you don't get:**
- VRAM / GPU utilisation
- Model load state
- ollama process-level resource usage

**Prometheus metric names** (dots replaced by underscores):
- `gen_ai_client_token_usage` — histogram; labels: `gen_ai_system`, `gen_ai_token_type` (`input`|`output`), `gen_ai_response_model`
- `gen_ai_client_operation_duration` — histogram; labels: `gen_ai_system`, `gen_ai_operation_name`, `gen_ai_response_model`

### How to enable

Install the SDK (adds `opentelemetry-instrumentation-ollama` automatically):

```bash
pip install traceloop-sdk
```

In your application entry point, pass both a trace exporter and a metrics exporter:

```python
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from traceloop.sdk import Traceloop

def setup_otel(otel_endpoint: str, service_name: str) -> None:
    exporter = OTLPSpanExporter(endpoint=f"{otel_endpoint}/v1/traces")
    metrics_exporter = OTLPMetricExporter(endpoint=f"{otel_endpoint}/v1/metrics")
    Traceloop.init(
        app_name=service_name,
        disable_batch=True,
        exporter=exporter,
        metrics_exporter=metrics_exporter,
    )
```

**Important:** if you pass a custom `exporter` to `Traceloop.init()` without also passing `metrics_exporter`, the SDK silently disables metrics (see `traceloop/sdk/__init__.py` lines 151–155). Both must be provided explicitly.

The `opentelemetry-exporter-otlp-proto-http` package provides both exporters, so no extra dependency is needed if you already import the trace exporter.

---

## Option B: Transparent proxy exporter

[`NorskHelsenett/ollama-metrics`](https://github.com/NorskHelsenett/ollama-metrics) is a Go proxy that forwards every request from the client to ollama and exposes a Prometheus `/metrics` endpoint with per-request token counts, duration, and model RAM.

**What you get:**
- Per-request token counts and latency (same as Option A but without requiring code changes in the client)
- Model RAM usage
- Works with any language, not just Python

**Trade-off:**
- The proxy sits in the request path — a crash or restart drops all in-flight requests.
- Clients must point at the proxy URL instead of ollama directly (`OLLAMA_BASE_URL` or equivalent).

### Running with Docker

```yaml
services:
  ollama-metrics:
    image: ghcr.io/norskhelsenett/ollama-metrics:latest
    network_mode: host          # required for Prometheus in K8s to reach it via node IP
    environment:
      OLLAMA_HOST: http://localhost:11434
      METRICS_PORT: "9090"
```

`network_mode: host` is required if Prometheus runs inside Kubernetes and needs to scrape the proxy on the bare-metal host. Check your node IP with `ip route get 1` or `hostname -I`.

### Connecting to COS (Juju / Charmed K8s)

Deploy a scrape target charm in the `cos` model pointing at the proxy's metrics port:

```bash
juju deploy prometheus-scrape-target-k8s --channel 2/stable -m cos
juju config -m cos prometheus-scrape-target-k8s \
  scrape_jobs="[{\"targets\": [\"<node-ip>:9090\"]}]"
juju relate -m cos prometheus-scrape-target-k8s prometheus
```

Replace `<node-ip>` with the K8s node's IP as seen from the cluster (e.g. `10.1.0.12`).

---

## Option C: Infrastructure state only

Poll ollama's `/api/ps` endpoint to find out which models are loaded and how much VRAM they occupy. This gives no per-request data — only a point-in-time snapshot.

Options:
- **Custom script**: a small cron job or loop calling `curl http://localhost:11434/api/ps` and pushing metrics to a Pushgateway.
- **[`lucabecker42/ollama-exporter`](https://github.com/lucabecker42/ollama-exporter)**: a tiny exporter that scrapes `/api/ps` and exposes Prometheus metrics. Very limited: no token counts, no latency.

This option is only useful if you specifically need to know model load state and don't want a proxy in the request path.

---

## Combining options

| Goal | Combination |
|---|---|
| Token counts + latency + traces, no proxy | Option A only |
| Token counts + latency + VRAM + model RAM | Option A + Option B |
| Token counts + latency + model load state, no proxy | Option A + Option C |
| Any language, no code changes | Option B (+ Option C if you want load state) |

Option A and Option B can coexist — they instrument at different layers (client vs. proxy) and the metrics are additive, not duplicated, as long as you don't double-count.

---

## Dashboard

[`dashboards/ollama.json`](../dashboards/ollama.json) in this repo covers **Option A only**. It shows token usage rate, cumulative tokens, request rate, and operation latency, with `$job` and `$model` template variables so it works for any application using OpenLLMetry.

A text panel inside the dashboard explains what is missing and points back to this document.

