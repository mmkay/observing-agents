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

# Metric interval: 30s is more than sufficient for dashboard panels (1h/1d buckets).
# The OTel SDK ForceFlush()es on exit, so the final data point is always sent
# regardless of interval. 1s generated ~6M samples/week per metric; 30s yields ~200K.
export OTEL_METRIC_EXPORT_INTERVAL=30000
# Keep logs and traces at 1s — they are event-driven and low-volume.
export OTEL_LOGS_EXPORT_INTERVAL=1000
export OTEL_TRACES_EXPORT_INTERVAL=1000
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
| `OTEL_METRIC_EXPORT_INTERVAL` | `30000` | 30 s; OTel SDK flushes on exit so final data is never lost regardless of interval |
| `OTEL_LOGS_EXPORT_INTERVAL` | `1000` | 1 s; logs are event-driven and low-volume — keep prompt |
| `OTEL_TRACES_EXPORT_INTERVAL` | `1000` | 1 s; same |

> **Important — metric temporality**: Claude Code defaults to `delta` temporality. If your collector exports to Prometheus via Remote Write (as COS does), you **must** set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`. Without this, only the `target_info` resource metric appears in Prometheus — all actual metric data points are silently dropped during the delta-to-cumulative conversion.

> **Metric interval**: The default (60 s) is too long for very short sessions, but 1 s generates ~6 M samples/week per metric — far more than any dashboard needs. 30 s is the right balance: fine enough for 1 h/1 d dashboard panels, and the OTel SDK always calls `ForceFlush()` on process exit so the final counters are sent regardless of the interval. Logs and traces are kept at 1 s because they are event-driven and contribute negligible volume.

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

### Dashboard panels loading slowly or not at all (7-day range)

If most panels in a 7-day dashboard take 8–20 seconds to load or appear to time out in the browser, the most likely cause is **metric export interval set too low** (e.g. `1000` ms instead of `30000`). At 1 s/sample, a single metric accumulates ~6 M samples/week per series. Grafana sends range queries that force Prometheus to scan all of that data at every step — the overview dashboard's "Token share by model" pie chart, for example, took **8.9 s** from a remote client at 1 s density vs. under 1 s at 30 s density.

Confirm the running session's interval:

```bash
# Should show avg_interval ~30s; if it shows 1.0s the interval was wrong at launch
PROM="http://<prometheus>:9090"
NOW=$(date +%s); START=$((NOW-60))
curl -s "${PROM}/api/v1/query_range?query=claude_code_cost_usage&start=${START}&end=${NOW}&step=1" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['data']['result'][:1]:
    vals=s['values']; times=[float(v[0]) for v in vals]
    gaps=[times[i+1]-times[i] for i in range(len(times)-1)]
    print(f'samples={len(vals)} avg_gap={sum(gaps)/len(gaps):.1f}s' if gaps else 'too few samples')
"
```

If the interval is wrong for a running session, it cannot be changed in-place — the env var is inherited at process start. Fix: correct `OTEL_METRIC_EXPORT_INTERVAL` in `.bashrc`/`.profile`, then start a **new terminal** and launch a new `claude` session. The old high-density data remains in Prometheus until the retention window passes; narrowing the dashboard time range to 1–3 days gives immediate relief while it ages out.

### Environment variables not taking effect

Claude Code reads these variables at startup. If you add them to `.bashrc` or `.profile`, you must start a **new shell** before launching `claude` for the changes to take effect. Existing sessions will not pick up the new configuration.
