# Observability 101 - metrics

#### Metrics

> a measurement of a service captured at runtime

```
# TYPE go_gc_heap_objects_objects gauge
go_gc_heap_objects_objects 360733
# TYPE grafana_alerting_request_duration_seconds histogram
grafana_alerting_request_duration_seconds_bucket{backend="grafana",method="GET",route="api_prometheus_grafana_api_v1_rules",status_code="200",le="0.005"} 29
grafana_alerting_request_duration_seconds_bucket{backend="grafana",method="GET",route="api_prometheus_grafana_api_v1_rules",status_code="200",le="10"} 38
grafana_alerting_request_duration_seconds_bucket{backend="grafana",method="GET",route="api_prometheus_grafana_api_v1_rules",status_code="200",le="+Inf"} 38
```

Out of metrics, you can create dashboards:

![Ollama Dashboard](images/dashboard-ollama.png)

Note:
Metrics are what you most often see in the dashboards. This is a single numeric value corresponding to a point in time. When you look for an example in nature, the current temperature outside is a perfect metric. You can draw graphs out of metrics, you can calculate more complex expressions (like "is my current token spend within my usual range?"). Metrics can come with labels that help you in distinguishing between them and are fairly inexpensive to store.

Based on metrics, you can create recording rules (which I'd describe as compound metrics) and alerts - that tell you when things are going in the wrong direction. Metrics often help us spotting an issue.