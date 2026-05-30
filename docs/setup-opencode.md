# OpenCode OpenTelemetry Configuration

Configuring [opencode](https://opencode.ai) (snap) with telemetry exported via the [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) plugin.

Any observability backend that accepts OTLP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

## What is sent

The plugin exports the following OTel signals:

- **Metrics** (e.g. `opencode.session.count`, `opencode.token.usage`, `opencode.cost.usage`, `opencode.tool.duration`)
- **Logs** (session events, API requests, tool results, commits)
- **Traces** (session, LLM, and tool spans — e.g. `opencode.session`, `opencode.llm`, `opencode.tool.bash`)

## Configuration files

### Plugin registration

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@devtheops/opencode-plugin-otel"]
}
```

The plugin npm package must be installed in `~/.config/opencode/node_modules/` for opencode to pick it up:

```bash
cd ~/.config/opencode && npm install @devtheops/opencode-plugin-otel
```

### Environment variables

Set persistently in `~/.bashrc` and `~/.profile`:

```bash
export OPENCODE_ENABLE_TELEMETRY=1
export OPENCODE_OTLP_ENDPOINT=http://<your-otel-collector>:4318
export OPENCODE_OTLP_PROTOCOL=http/protobuf
export OPENCODE_OTLP_METRICS_INTERVAL=15000
export OPENCODE_OTLP_LOGS_INTERVAL=1000
```

| Variable | Example value | Notes |
|---|---|---|
| `OPENCODE_ENABLE_TELEMETRY` | `1` | Enables the plugin |
| `OPENCODE_OTLP_ENDPOINT` | `http://otelcol:4318` | Your OpenTelemetry Collector endpoint |
| `OPENCODE_OTLP_PROTOCOL` | `http/protobuf` | Port 4318 is HTTP (not gRPC on 4317) |
| `OPENCODE_OTLP_METRICS_INTERVAL` | `15000` | 15 s; OTel SDK flushes on exit so session-end data is always captured |
| `OPENCODE_OTLP_LOGS_INTERVAL` | `1000` | 1 s; logs are event-driven — keep prompt |

> **Metric interval**: The default (60 s) is too long for short sessions, but 1 s generates unnecessary volume. 15 s is the right balance for OpenCode: short enough for sessions of a few minutes, and the OTel SDK calls `ForceFlush()` on exit so metrics are always sent at session end regardless of interval. Logs are kept at 1 s because they are event-driven and low-volume.

Both `.bashrc` and `.profile` should contain these exports so they are available in interactive shells and login/non-interactive shells alike.

## Data flow

```
opencode session
  → @devtheops/opencode-plugin-otel (OTLP HTTP/protobuf)
    → OpenTelemetry Collector (<your-otel-collector>:4318)
      → your backend (metrics, logs, traces)
```

## LangFuse compatibility

OpenCode is the richest LangFuse subject of the three agents covered in this repo. The plugin uses the **OpenInference** convention (`openinference.span.kind`, `llm.model_name`, `llm.system`), which LangFuse natively understands:

- `opencode.session` root spans carry `session.total_cost_usd` and `session.total_tokens` as metadata attributes. LangFuse's own cost and token roll-ups are computed by aggregating the child `opencode.llm` generation spans (which carry `llm.token_count.prompt` / `llm.token_count.completion`), not from these session-level attributes directly.
- Tool calls are typed granularly (`opencode.tool.read`, `opencode.tool.grep`, `opencode.tool.bash`, `opencode.tool.write`, etc.) and appear as distinct span types in the session view.
- LLM generation spans carry `llm.model_name` — LangFuse renders the model name without extra configuration.

Without content capture, `input.value` / `output.value` span attributes are absent — LangFuse shows structure, cost, and model name but no conversation content. Enable content capture by setting `captureContent` in the plugin config (see OpenCode docs).

## Troubleshooting

### Traces not appearing

If metrics and logs arrive but traces do not, check whether your collector has a **tail-based sampling policy** that filters by service name. The COS OTel Collector, for example, applies a `tail_sampling` processor that classifies traces as "charm" (service name ending in `-charm`) or "workload" (everything else) and uses different sampling rates for each.

By default, the COS collector only keeps **1 %** of workload traces. OpenCode traces are classified as workload traces, so nearly all of them are dropped. To fix this, increase the workload sampling rate:

```bash
juju config otelcol -m <model> tracing_sampling_rate_workload=100
```

The three sampling rate config options on the COS OTel Collector charm are:

| Config option | Default | Scope |
|---|---|---|
| `tracing_sampling_rate_charm` | `100` | Charm traces (service name matching `.*-charm`) |
| `tracing_sampling_rate_error` | `100` | Error-status traces from any source |
| `tracing_sampling_rate_workload` | `1` | All other traces (including opencode) |

For other backends, check if your collector or tracing backend has a similar sampling policy and adjust accordingly.
