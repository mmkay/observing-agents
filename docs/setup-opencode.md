# OpenCode OpenTelemetry Configuration

Configuring [opencode](https://opencode.ai) (snap) with telemetry exported via the [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) plugin.

Any observability backend that accepts OTLP data works: Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

## What is sent

The plugin exports the following OTel signals:

- **Metrics** (e.g. `opencode.session.count`, `opencode.token.usage`, `opencode.cost.usage`, `opencode.session.duration`, `opencode.model.usage`)
- **Logs** (`session.created`, `user_prompt`, `api_request`, `tool_result`, `session.idle`, plus `session.error`, `api_error` and `commit` when they occur)
- **Traces** (an `opencode.session` root span with one `opencode.llm` child span per LLM step)

In a headless `opencode run` test (OpenCode 2.0.16, plugin 2.0.0), tool calls showed up only as `tool_result` log events. No per-tool spans (`opencode.tool.<name>`) and no `opencode.tool.duration` samples were exported.

## Configuration files

### Plugin registration

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@devtheops/opencode-plugin-otel@2.0.0"]
}
```

> **Pin the version.** OpenCode V2 (`opencode-ai@2.x`, the `2/stable` snap channel) needs plugin `2.x`. V2 accepts both the `plugins` key and the older `plugin` key, but the plugin major version has to match: loading `1.x` on V2 logs a `failed to load plugin` warning and no telemetry is exported. OpenCode V1 needs the `1.x` line (`"plugin": ["@devtheops/opencode-plugin-otel@1.5.1"]`). The npm `latest` dist-tag points to `2.0.0`. Pin the version anyway, so a future major release does not change behavior under you.
>
> Settings can also be passed inline instead of (or as well as) environment variables, using the plugin's object form; inline options take precedence over the matching `OPENCODE_*` variable:
>
> ```json
> {
>   "plugins": [
>     {
>       "package": "@devtheops/opencode-plugin-otel@2.0.0",
>       "options": { "enabled": true, "metricPrefix": "opencode." }
>     }
>   ]
> }
> ```

opencode downloads and caches the plugin package itself the first time it loads the config, so the first start takes a few seconds longer. There is no separate `npm install` step for the plugin entry above.

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
| `OPENCODE_OTLP_PROTOCOL` | `http/protobuf` | One of `grpc`, `http/protobuf`, `http/json`. Port 4318 is HTTP; the plugin's own default is `grpc` on `localhost:4317` |
| `OPENCODE_OTLP_METRICS_INTERVAL` | `15000` | 15 s; the plugin default is 60 s |
| `OPENCODE_OTLP_LOGS_INTERVAL` | `1000` | 1 s; logs are event-driven, so keep it short. The plugin default is 5 s |

> **Metric interval**: The plugin default (60 s) is too long for short sessions, and 1 s generates unnecessary volume. 15 s is a reasonable balance for OpenCode. A headless `opencode run` flushes pending metrics, logs and traces on exit: with a 15 s interval, a run lasting a few seconds still delivered the root `opencode.session` span and session-end metrics such as `opencode.session.duration`.

> **Wire format**: `OPENCODE_OTLP_PROTOCOL=http/protobuf` sends real binary protobuf over HTTP (`Content-Type: application/x-protobuf`) on port 4318. Use `http/json` instead if you specifically need a JSON body over HTTP.

The plugin also supports optional variables not needed for the setup above: `OPENCODE_DISABLE_LOGS`, `OPENCODE_DISABLE_TRACES`, `OPENCODE_DISABLE_METRICS`, `OPENCODE_CAPTURE_PROMPT_IN_LOGS`, `OPENCODE_CAPTURE_MODEL_CONTEXT`, `OPENCODE_METRIC_PREFIX`, `OPENCODE_OTLP_HEADERS`, `OPENCODE_OTLP_HEADERS_HELPER`, `OPENCODE_RESOURCE_ATTRIBUTES`, `OPENCODE_SPAN_ATTRIBUTES`, `OPENCODE_OTLP_METRICS_TEMPORALITY`, `OPENCODE_TRACEPARENT`, `OPENCODE_TRACESTATE`, and `OPENCODE_TRACE_PROPAGATION_PROVIDERS`. Every setting can also be passed inline through the plugin's object form in `opencode.json`, see the [plugin README](https://github.com/DEVtheOPS/opencode-plugin-otel#readme).

Both `.bashrc` and `.profile` should contain these exports so they are available in interactive shells and login/non-interactive shells alike.

## Data flow

```
opencode session
  → @devtheops/opencode-plugin-otel (OTLP HTTP/protobuf)
    → OpenTelemetry Collector (<your-otel-collector>:4318)
      → your backend (metrics, logs, traces)
```

## LangFuse compatibility

The plugin uses the **OpenInference** convention (`openinference.span.kind`, `llm.model_name`, `llm.system`), which LangFuse natively understands:

- `opencode.session` root spans carry `session.total_cost_usd` and `session.total_tokens` as metadata attributes. LangFuse's own cost and token roll-ups are computed by aggregating the child `opencode.llm` generation spans (which carry `llm.token_count.prompt` / `llm.token_count.completion`), not from these session-level attributes directly.
- LLM generation spans carry `llm.model_name`, and LangFuse renders it without extra configuration.

There is no content-capture switch for spans: `input.value` / `output.value` (plus `llm.input_messages` on LLM spans) are present by default, so LangFuse shows conversation content out of the box. The plugin has no `captureContent` option to turn this off.

Prompt text in **log events** is a separate matter. The `user_prompt` event carries only `prompt_length` unless you set `OPENCODE_CAPTURE_PROMPT_IN_LOGS` (see the plugin README). That variable does not affect spans. Prompts and model output reach your backend through traces regardless, so only send them to a collector you trust.

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
