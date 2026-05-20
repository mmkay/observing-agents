# Claude Code OpenTelemetry Configuration

Configuring [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with telemetry exported via its **native** OpenTelemetry integration — no plugin required.

Any observability backend that accepts OTLP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

## What is sent

Claude Code exports the following OTel signals:

- **Metrics** (e.g. `claude_code.session.count`, `claude_code.token.usage`, `claude_code.cost.usage`, `claude_code.lines_of_code.count`, `claude_code.active_time.total`)
- **Logs/Events** (user prompts, API requests, API errors, tool results)
- **Traces** (beta — interaction, LLM request, tool execution, and hook spans; e.g. `claude_code.interaction`, `claude_code.llm_request`, `claude_code.tool`)

## Configuration

Claude Code is configured entirely through environment variables — no config files or plugins needed.

Set persistently in `~/.bashrc` and `~/.profile`:

```bash
# Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# Enable traces (beta)
export CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1

# Choose exporters
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp

# OTLP endpoint and protocol
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<your-otel-collector>:4318

# Use cumulative temporality (required for Prometheus Remote Write backends)
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative

# Short export intervals — ensures data is flushed before the process exits
export OTEL_METRIC_EXPORT_INTERVAL=1000
export OTEL_LOGS_EXPORT_INTERVAL=1000
```

| Variable | Example value | Notes |
|---|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | Master switch for all telemetry |
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` | `1` | Enables distributed traces (beta) |
| `OTEL_METRICS_EXPORTER` | `otlp` | Export metrics via OTLP |
| `OTEL_LOGS_EXPORTER` | `otlp` | Export logs/events via OTLP |
| `OTEL_TRACES_EXPORTER` | `otlp` | Export traces via OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | Port 4318 is HTTP (not gRPC on 4317) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otelcol:4318` | Your OpenTelemetry Collector endpoint |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | `cumulative` | Required for Prometheus Remote Write backends (see below) |
| `OTEL_METRIC_EXPORT_INTERVAL` | `1000` | 1 s; must be short for brief sessions |
| `OTEL_LOGS_EXPORT_INTERVAL` | `1000` | 1 s; same reason |

> **Important — metric temporality**: Claude Code defaults to `delta` temporality. If your collector exports to Prometheus via Remote Write (as COS does), you **must** set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`. Without this, only the `target_info` resource metric appears in Prometheus — all actual metric data points are silently dropped during the delta-to-cumulative conversion.

> **Important**: The default metrics export interval (60 s) is far too long for short-lived CLI sessions. Setting it to 1000 ms ensures data is flushed before the process exits. Without this, metrics may never appear in your backend.

Both `.bashrc` and `.profile` should contain these exports so they are available in interactive shells and login/non-interactive shells alike.

### Optional: content logging

By default, Claude Code redacts prompt text, tool input, and tool output in telemetry. To include this data:

```bash
export OTEL_LOG_USER_PROMPTS=1      # Include user prompt text in events and traces
export OTEL_LOG_TOOL_DETAILS=1      # Include tool parameters and commands
export OTEL_LOG_TOOL_CONTENT=1      # Include tool input/output in trace spans
```

### Optional: multi-team attributes

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform"
```

These custom attributes are included in all metrics and events, allowing filtering by team or cost center.

## Data flow

```
claude code session
  → native OTel SDK (OTLP HTTP/protobuf)
    → OpenTelemetry Collector (<your-otel-collector>:4318)
      → your backend (metrics, logs, traces)
```

## Troubleshooting

### Metrics not appearing (but logs/traces are fine)

If logs and traces arrive but metrics do not, the most likely cause is a **temporality mismatch**. Claude Code exports delta-temporality counters by default. When the OTel Collector forwards these via Prometheus Remote Write, the delta-to-cumulative conversion may silently drop data points.

Fix: set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`.

### Traces not appearing

If metrics and logs arrive but traces do not, check whether your collector has a **tail-based sampling policy** that filters by service name. The COS OTel Collector, for example, applies a `tail_sampling` processor that classifies traces as "charm" (service name ending in `-charm`) or "workload" (everything else) and uses different sampling rates for each.

By default, the COS collector only keeps **1 %** of workload traces. Claude Code traces are classified as workload traces, so nearly all of them are dropped. To fix this, increase the workload sampling rate:

```bash
juju config otelcol -m <model> tracing_sampling_rate_workload=100
```

The three sampling rate config options on the COS OTel Collector charm are:

| Config option | Default | Scope |
|---|---|---|
| `tracing_sampling_rate_charm` | `100` | Charm traces (service name matching `.*-charm`) |
| `tracing_sampling_rate_error` | `100` | Error-status traces from any source |
| `tracing_sampling_rate_workload` | `1` | All other traces (including claude-code) |

For other backends, check if your collector or tracing backend has a similar sampling policy and adjust accordingly.

### Environment variables not taking effect

Claude Code reads these variables at startup. If you add them to `.bashrc` or `.profile`, you must start a **new shell** before launching `claude` for the changes to take effect. Existing sessions will not pick up the new configuration.
