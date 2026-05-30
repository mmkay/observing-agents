# Observability Architecture

This document describes the telemetry environment used to observe the four coding agents covered in this repository: Claude Code, OpenCode, OpenClaw, and GitHub Copilot.

## Overview

All four agents emit OpenTelemetry signals over OTLP HTTP to a central OpenTelemetry Collector. The collector fans signals out to the appropriate backends. Traces are sent to two independent backends — Tempo for general-purpose waterfall inspection, and LangFuse for LLM-centric session analysis.

> **Note:** GitHub Copilot CLI does not emit an OTel logs signal — only metrics and traces. All other agents emit metrics, logs, and traces.

## Components

### Coding agents

| Agent | Instrumentation | Signals |
|---|---|---|
| Claude Code | Native OTel SDK (built-in, no plugin) | Metrics · Logs · Traces |
| OpenCode | [`@devtheops/opencode-plugin-otel`](https://github.com/DEVtheOPS/opencode-plugin-otel) | Metrics · Logs · Traces |
| OpenClaw | [`@openclaw/diagnostics-otel`](https://docs.openclaw.ai/gateway/opentelemetry) | Metrics · Logs · Traces |
| GitHub Copilot CLI | Native OTel SDK (built-in, env-var config) | Metrics · Traces |

All four agents are configured with the same OTLP HTTP endpoint — the OpenTelemetry Collector — so no agent needs to know which backends are in use.

GitHub Copilot CLI exports metrics using both its own `github.copilot.*` metric names and the OTel semantic convention `gen_ai.*` names. Because `gen_ai.*` metrics are also emitted by OpenClaw, all dashboard queries for GitHub Copilot filter on `job="github-copilot"` to avoid mixing sources.

### Canonical Observability Stack (COS)

The [Canonical Observability Stack](https://charmhub.io/topics/canonical-observability-stack) is deployed on Kubernetes using Juju charms. It provides:

| Component | Charm | Role |
|---|---|---|
| OpenTelemetry Collector | `opentelemetry-collector-k8s` | Central OTLP ingestion and routing |
| Prometheus | `prometheus-k8s` | Metrics storage and query |
| Loki | `loki-k8s` | Log storage and query |
| Tempo | `tempo-coordinator-k8s` + `tempo-worker-k8s` | Distributed trace storage and query |
| Grafana | `grafana-k8s` | Unified dashboard and datasource hub |

The collector uses a tail-based sampler on the traces pipeline. Workload traces (agent sessions) are sampled at a configurable rate; for development, 100% sampling is recommended.

A second collector instance — the `opentelemetry-collector-integrator` charm — is used to inject an additional trace exporter into otelcol's config via the `external-config` relation. This is how the LangFuse fan-out is wired without modifying the core COS deployment.

### LangFuse

LangFuse is deployed via Docker Compose on the same host as COS, using the official [`langfuse/langfuse:3`](https://hub.docker.com/r/langfuse/langfuse) image (web) and `langfuse/langfuse-worker:3` (background worker). It receives traces from the same otelcol pipeline via an `otlphttp/langfuse` exporter, using Basic Auth against the LangFuse OTLP ingest endpoint (`/api/public/otel`).

LangFuse is a second trace backend, not a replacement for Tempo. It adds an LLM-centric session view on top of the same sampled trace data — see [telemetry-gaps.md](telemetry-gaps.md#what-langfuse-adds) for a comparison of what each backend surfaces.

## Architecture diagram

```mermaid
flowchart LR
    subgraph agents [Coding Agents]
        CC["Claude Code\nnative OTel SDK"]
        OC["OpenCode\nopencode-plugin-otel"]
        OCL["OpenClaw\ndiagnostics-otel"]
        GHC["GitHub Copilot CLI\nnative OTel SDK"]
    end

    otelcol["OpenTelemetry Collector\notelcol-k8s"]

    subgraph cos [Canonical Observability Stack]
        direction TB
        Prometheus["Prometheus"]
        Loki["Loki"]
        Tempo["Tempo"]
        Grafana["Grafana"]
        Prometheus --> Grafana
        Loki --> Grafana
        Tempo --> Grafana
    end

    LangFuse["LangFuse\nlangfuse/langfuse:3"]

    CC -- "metrics · logs · traces\nOTLP HTTP" --> otelcol
    OC -- "metrics · logs · traces\nOTLP HTTP" --> otelcol
    OCL -- "metrics · logs · traces\nOTLP HTTP" --> otelcol
    GHC -- "metrics · traces\nOTLP HTTP" --> otelcol

    otelcol -- metrics --> Prometheus
    otelcol -- logs --> Loki
    otelcol -- traces --> Tempo
    otelcol -- "traces\n(fan-out)" --> LangFuse
```

## Signal routing

| Signal | Source | Destination |
|---|---|---|
| Metrics | All four agents | Prometheus (via otelcol remote write) |
| Logs | Claude Code, OpenCode, OpenClaw | Loki (via otelcol) |
| Traces | All four agents | Tempo (primary) and LangFuse (secondary) |

> GitHub Copilot CLI does not emit OTel logs — its log output goes to the terminal only.

Grafana queries Prometheus, Loki, and Tempo as datasources. LangFuse has its own UI and is queried independently.
