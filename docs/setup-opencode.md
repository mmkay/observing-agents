# OpenCode OpenTelemetry Configuration

Configuring [opencode](https://opencode.ai) (snap) with telemetry exported via the [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) plugin.

Any observability backend that accepts OTLP data can be used — Grafana Cloud, Datadog, Jaeger, SigNoz, or a self-hosted stack such as the [Canonical Observability Stack (COS)](https://charmhub.io/topics/canonical-observability-stack).

## What is sent

The plugin exports the following OTel signals:

- **Metrics** (e.g. `opencode.session.count`, `opencode.token.usage`, `opencode.cost.usage`, `opencode.tool.duration`, `opencode.subtask.count`)
- **Logs** (session events, API requests, tool results, commits)
- **Traces** (session, LLM, and tool spans — e.g. `opencode.session`, `opencode.llm`, `opencode.tool.bash` — root spans carry real names)

## Configuration files

### Plugin registration

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@devtheops/opencode-plugin-otel@2.0.0"]
}
```

> **Pin the version, and match the config key to your OpenCode line.** OpenCode V2 (`opencode-ai@2.x`, the `2/stable` snap channel) needs plugin `2.x` under the `plugins` key, as above. OpenCode V1 needs the `1.x` release line under the singular `plugin` key instead (`"plugin": ["@devtheops/opencode-plugin-otel@1.5.1"]`) — the two config keys and plugin major versions are not interchangeable, and loading the wrong one fails silently or errors depending on the mismatch. The npm `latest` dist-tag currently points to `2.0.0`; an unpinned `"plugins": ["@devtheops/opencode-plugin-otel"]` entry is fine on OpenCode V2 today but will break if a future major release changes behavior again, so pin explicitly regardless of which line you're on.
>
> Settings can also be passed inline instead of (or as well as) environment variables, using the plugin's object form — inline options take precedence over the matching `OPENCODE_*` variable:
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

opencode resolves and caches the plugin package itself the first time it loads the config — no separate `npm install` step is needed or supported for the plugin entry above.

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
| `OPENCODE_OTLP_LOGS_INTERVAL` | `1000` | 1 s; logs are event-driven, keep prompt. The plugin default is 5 s |

> **Metric interval**: The default (60 s) is too long for short sessions, but 1 s generates unnecessary volume. 15 s is a reasonable balance for OpenCode. Do not rely on a flush at exit to make up for a long interval: a headless `opencode run` process exits as soon as its task completes, without flushing any pending metric or trace batch. Any metrics or spans queued for the next export tick — including the root `opencode.session` span and session-end metrics such as `opencode.session.duration` — are lost if the process exits before that tick fires (logs are less affected, thanks to their 1 s interval). Interactive sessions, which stay open past task completion, do not have this problem. If you script short `opencode run` invocations, lower `OPENCODE_OTLP_METRICS_INTERVAL` accordingly.

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

OpenCode is the richest LangFuse subject of the three agents covered in this repo. The plugin uses the **OpenInference** convention (`openinference.span.kind`, `llm.model_name`, `llm.system`), which LangFuse natively understands:

- `opencode.session` root spans carry `session.total_cost_usd` and `session.total_tokens` as metadata attributes. LangFuse's own cost and token roll-ups are computed by aggregating the child `opencode.llm` generation spans (which carry `llm.token_count.prompt` / `llm.token_count.completion`), not from these session-level attributes directly.
- Tool calls are typed granularly (`opencode.tool.read`, `opencode.tool.grep`, `opencode.tool.bash`, `opencode.tool.write`, etc.) and appear as distinct span types in the session view.
- LLM generation spans carry `llm.model_name` — LangFuse renders the model name without extra configuration.

There is no content-capture switch for spans: `input.value` / `output.value` (and `tool.parameters`, plus `llm.input_messages` on LLM spans) are present by default, so LangFuse shows conversation content out of the box. The plugin has no `captureContent` option to turn this off.

Prompt text in **log events** is a separate matter. The `user_prompt` event carries only `prompt_length` unless you set `OPENCODE_CAPTURE_PROMPT_IN_LOGS` (see the plugin README). That variable does not affect spans. Prompts and tool arguments reach your backend through traces regardless, so only send them to a collector you trust.

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
