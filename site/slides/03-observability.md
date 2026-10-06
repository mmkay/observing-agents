# But first, Observability 101

## Observability - do we know what's going on?

an artist formerly known as _application monitoring_ - but it's nuanced

### Signals

<div class="signals-grid">
  <div class="signal-item"><h4>Metrics</h4></div>
  <div class="signal-item"><h4>Logs</h4></div>
  <div class="signal-item"><h4>Traces</h4></div>
  <div class="signal-item"><h4>(Profiles)</h4></div>
</div>

### OpenTelemetry

- vendor-neutral
- just graduated from CNCF!
- a de facto standard

### Want to see them in practice?

Check [Grafana Play](https://play.grafana.org/) for live examples!

Note:
Let's start with a short introduction to observability - which is a domain you may also know as application monitoring. The lines between them are blurry at best, but it's often said that monitoring is just the measurements, while observability means we're able to answer questions about the system.

In an industry where we create way more standards than we need, it's important to note that in case of observability data, there is a single standard that has emerged as the winner: OpenTelemetry has just graduated from CNCF and is supported by virtually all providers - both open and proprietary.

There's several distinct signals that have often been called "the pillars of observability". Historically, there's been three of them: metrics, logs and traces. We often hear about profiles these days too, and there's also another approach taken by Honeycomb where their take is that the only thing that matters is called wide events. When it comes to signals, I'll skip describing metrics and logs, because they're fairly straightforward, but will focus on the traces a bit more. If you want to see all of them in practice, Grafana Play is a good environment to experiment.