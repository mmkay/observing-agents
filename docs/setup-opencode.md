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
| `OPENCODE_OTLP_PROTOCOL` | `http/protobuf` | Port 4318 is HTTP (not gRPC on 4317). Any other value selects gRPC, and the plugin's own default is gRPC on `localhost:4317` |
| `OPENCODE_OTLP_METRICS_INTERVAL` | `15000` | 15 s; the plugin default is 60 s |
| `OPENCODE_OTLP_LOGS_INTERVAL` | `1000` | 1 s; logs are event-driven, keep prompt. The plugin default is 5 s |

> **Metric interval**: The default (60 s) is too long for short sessions, but 1 s generates unnecessary volume. 15 s is a reasonable balance for OpenCode. Do not rely on a flush at exit to make up for a long interval: in a headless `opencode run` on OpenCode 1.18.27 the process exited without flushing the pending metric and trace batches. The last metrics window and the root `opencode.session` span of a short run were never sent (logs were, thanks to their 1 s interval). Interactive sessions were not tested. If you script short `opencode run` invocations, lower `OPENCODE_OTLP_METRICS_INTERVAL` accordingly.

> **Wire format**: With `OPENCODE_OTLP_PROTOCOL=http/protobuf` the plugin sends OTLP over HTTP with a JSON body (`Content-Type: application/json`). Collectors accept this on port 4318, so nothing needs to change, but do not expect protobuf on the wire.

Newer plugin versions (1.5.x) add optional variables that are not needed for the setup above: `OPENCODE_DISABLE_LOGS`, `OPENCODE_CAPTURE_PROMPT_IN_LOGS`, `OPENCODE_SPAN_ATTRIBUTES`, `OPENCODE_TRACEPARENT`, `OPENCODE_TRACESTATE`, and `OPENCODE_TRACE_PROPAGATION_PROVIDERS`. Every setting can also be passed inline through the plugin tuple form in `opencode.json`, see the [plugin README](https://github.com/DEVtheOPS/opencode-plugin-otel#readme).

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

There is no content-capture switch for spans: `input.value` / `output.value` (and `tool.parameters`, plus `llm.input_messages` on LLM spans) are present by default, so LangFuse shows conversation content out of the box. This holds for plugin 1.0.0 and 1.5.1, and neither has a `captureContent` option.

Prompt text in **log events** is a separate matter. The `user_prompt` event carries only `prompt_length` unless you set `OPENCODE_CAPTURE_PROMPT_IN_LOGS` (present in 1.5.1, absent in 1.0.0, see the plugin README). That variable does not affect spans. Prompts and tool arguments reach your backend through traces regardless, so only send them to a collector you trust.

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
