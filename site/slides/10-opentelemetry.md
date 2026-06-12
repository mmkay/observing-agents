# Good news - they all use OpenTelemetry

## Example: Claude Code

Set in `~/.bashrc` / `~/.profile`:

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

export OTEL_METRIC_EXPORT_INTERVAL=30000
export OTEL_LOGS_EXPORT_INTERVAL=1000
export OTEL_TRACES_EXPORT_INTERVAL=1000
```

Note:
The first good news that I had was that many coding agents now support OpenTelemetry - and most of them even do it out of the box. In case of the best harnesses, the only thing that you needed to set up is enabling some feature flags and pointing them at my instance of OpenTelemetry Collector - and all of that was done using environment variables. You could get metrics, logs and traces that way.