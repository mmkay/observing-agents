# But first, Observability 101

## Observability - do we know what's going on?

an artist formerly known as _application monitoring_ - but it's nuanced

### Signals

#### Metrics

> a measurement of a service captured at runtime

```
# TYPE go_gc_heap_objects_objects gauge
go_gc_heap_objects_objects 360733
```

#### Logs

Often the first and most intuitive method of trying to troubleshoot software.

```
System.out.println("TUTAJ");
```

#### Traces

Timing and call flow. Can span multiple systems and contain tags.

![an example trace](images/example-trace.png)

### OpenTelemetry

- vendor-neutral
- just graduated from CNCF!
- a de facto standard

### Want to see them in practice?

Check [Grafana Play](https://play.grafana.org/) for live examples!


