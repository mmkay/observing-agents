# Observability 101 - Traces

Timing and call flow. Can span multiple systems and contain tags. A single trace is often **distributed** between multiple services.

![an example trace](images/example-trace.png)

### 1 trace = multiple spans

### You can make metrics out of traces

Note:
Traces show you the exact timing of a specific request, together with metadata the application creators chose to bring alongside the trace. A single trace consists of multiple spans, that usually correspond to a single call within the flow. Spans can come from different parts of your system - a basic application could start a trace in the frontend, then do a backend API request that will in turn call several other services and a database.

Traces are the most useful in pinpointing bottlenecks. It can be a loop in the flow, or a service that always adds 100ms to the call flow. They are, however, the most expensive to store. At my previous company, a single span was on average about 10 KB of data. It is much more with coding agents.

A very interesting feature of modern tracing backends is an ability to create metrics out of traces. They can be based on the timing of the traces themselves, but also out of the provided tags. This can be super useful for low-effort instrumentation.