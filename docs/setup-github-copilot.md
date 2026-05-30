# GitHub Copilot CLI OpenTelemetry Configuration

Configuring [GitHub Copilot CLI](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line) with telemetry exported via its **native** OpenTelemetry integration — no plugin required.

Any observability backend that accepts OTLP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

> **Heads up — brand new feature**: OTel support in GitHub Copilot CLI is so recent that it does not yet appear anywhere in the official web-based documentation. The information in this guide comes from `copilot help monitoring` (available in the CLI itself) and from direct inspection of the running tool. Expect the official docs to catch up — and expect rough edges.

## What is sent

GitHub Copilot CLI exports the following OTel signals:

- **Metrics** (e.g. `gen_ai.client.token.usage`, `gen_ai.client.operation.duration`, `github.copilot.tool.call.count`, `github.copilot.tool.call.duration`, `github.copilot.agent.turn.count`)
- **Traces** (a hierarchical span tree per agent interaction — `invoke_agent`, `plan`, `chat <model>`, `execute_tool <tool>`)

> **No logs signal**: GitHub Copilot CLI does not export an OTel logs signal. All observability is through metrics and traces.

## Configuration

GitHub Copilot CLI is configured entirely through environment variables — no config files or plugins needed. OTel is off by default; it activates when `COPILOT_OTEL_ENABLED=true` or `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

Set persistently in `~/.bashrc` and `~/.profile`:

```bash
# Enable telemetry
export COPILOT_OTEL_ENABLED=true

# Choose exporters
export OTEL_METRICS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp

# OTLP endpoint and protocol
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://<your-otel-collector>:4318

# Use cumulative temporality (required for Prometheus Remote Write backends)
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative

# Metric interval: 30s is more than sufficient for dashboard panels (1h/1d buckets).
# The OTel SDK ForceFlush()es on exit, so the final data point is always sent
# regardless of interval. 1s generates ~6M samples/week per metric; 30s yields ~200K.
export OTEL_METRIC_EXPORT_INTERVAL=30000
# Keep traces at 1s — they are event-driven and low-volume.
export OTEL_TRACES_EXPORT_INTERVAL=1000
```

| Variable | Example value | Notes |
|---|---|---|
| `COPILOT_OTEL_ENABLED` | `true` | Master switch; also auto-enabled by setting `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `OTEL_METRICS_EXPORTER` | `otlp` | Export metrics via OTLP |
| `OTEL_TRACES_EXPORTER` | `otlp` | Export traces via OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | Port 4318 is HTTP (not gRPC on 4317) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otelcol:4318` | Your OpenTelemetry Collector endpoint |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | `cumulative` | Required for Prometheus Remote Write backends (see below) |
| `OTEL_METRIC_EXPORT_INTERVAL` | `30000` | 30 s; OTel SDK flushes on exit so final data is never lost regardless of interval |
| `OTEL_TRACES_EXPORT_INTERVAL` | `1000` | 1 s; traces are event-driven and low-volume — keep prompt |

> **Metric interval**: The default (60 s) may miss very short sessions, but 1 s generates ~6 M samples/week per metric — far more than any dashboard needs. 30 s is the right balance: fine enough for 1 h/1 d dashboard panels, and the OTel SDK always calls `ForceFlush()` on process exit so the final counters are sent regardless of the interval. Traces are kept at 1 s because they are event-driven and contribute negligible volume.

Both `.bashrc` and `.profile` should contain these exports so they are available in interactive shells and login/non-interactive shells alike.

### Optional: content capture

By default, GitHub Copilot CLI redacts prompt text, tool arguments, and responses from telemetry. To include this data:

```bash
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true
```

This captures full prompt and response messages, system instructions, tool definitions, and tool call arguments and results. **Only enable in trusted environments** — content capture may include sensitive information such as code and file contents.

### Optional: multi-team attributes

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform"
```

These custom attributes are included in all metrics and traces, allowing filtering by team or cost center.

## Trace structure

Each agent invocation produces a single root span with nested children:

```
invoke_agent
  ├── chat <model>          (LLM API call)
  ├── execute_tool <tool>   (tool invocation)
  ├── chat <model>
  └── execute_tool <tool>

invoke_agent (plan mode)
  └── plan
        ├── chat <model>
        └── execute_tool <tool>
```

Spans carry attributes including model name, token counts, durations, and error info. Sub-agent invocations are linked into the same trace via context propagation.

## Data flow

```
copilot session
  → native OTel SDK (OTLP HTTP/protobuf)
    → OpenTelemetry Collector (<your-otel-collector>:4318)
      → your backend (metrics, traces)
```

## Troubleshooting

### Traces not appearing

If metrics arrive but traces do not, check whether your collector has a **tail-based sampling policy** that filters by service name. The COS OTel Collector, for example, applies a `tail_sampling` processor that classifies traces as "charm" (service name ending in `-charm`) or "workload" (everything else) and uses different sampling rates for each.

By default, the COS collector only keeps **1 %** of workload traces. GitHub Copilot CLI traces are classified as workload traces (service name: `github-copilot`), so nearly all of them are dropped. To fix this, increase the workload sampling rate:

```bash
juju config otelcol -m <model> tracing_sampling_rate_workload=100
```

The three sampling rate config options on the COS OTel Collector charm are:

| Config option | Default | Scope |
|---|---|---|
| `tracing_sampling_rate_charm` | `100` | Charm traces (service name matching `.*-charm`) |
| `tracing_sampling_rate_error` | `100` | Error-status traces from any source |
| `tracing_sampling_rate_workload` | `1` | All other traces (including `github-copilot`) |

For other backends, check if your collector or tracing backend has a similar sampling policy and adjust accordingly.

### Dashboard panels loading slowly or not at all (7-day range)

If panels in a 7-day dashboard take 8–20 seconds to load, the most likely cause is **metric export interval set too low** (e.g. `1000` ms instead of `30000`). At 1 s/sample, a single metric accumulates ~6 M samples/week per series, forcing Prometheus to scan all of that data on every range query.

Confirm the running session's interval:

```bash
# Should show avg_gap ~30s; if it shows 1.0s the interval was wrong at launch
PROM="http://<prometheus>:9090"
NOW=$(date +%s); START=$((NOW-60))
curl -s "${PROM}/api/v1/query_range?query=github_copilot_tool_call_count&start=${START}&end=${NOW}&step=1" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['data']['result'][:1]:
    vals=s['values']; times=[float(v[0]) for v in vals]
    gaps=[times[i+1]-times[i] for i in range(len(times)-1)]
    print(f'samples={len(vals)} avg_gap={sum(gaps)/len(gaps):.1f}s' if gaps else 'too few samples')
"
```

If the interval is wrong for a running session, it cannot be changed in-place — the env var is inherited at process start. Fix: correct `OTEL_METRIC_EXPORT_INTERVAL` in `.bashrc`/`.profile`, then start a **new terminal** and launch a new `copilot` session.

### Environment variables not taking effect

GitHub Copilot CLI reads these variables at startup. If you add them to `.bashrc` or `.profile`, you must start a **new shell** before launching `copilot` for the changes to take effect. Existing sessions will not pick up the new configuration.
