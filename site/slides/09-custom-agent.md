# If you write a custom agentic system, you're covered too

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

Note:
This is an example for Python using Traceloop's SDK also known as OpenLLMetry, but the drill is similar to basically any large library, including LangChain. You usually add a dependency that exports traces or enable a config property in your application, initialize an instrumenting library and your LLM calls are auto-instrumented. Usually together with the prompts contents, the token count and other calls in your system as tracing is well supported in most frameworks.