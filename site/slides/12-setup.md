# The setup

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
    otelcol -- "traces" --> LangFuse
```

Note:
This is the setup that I ended up using. I deployed Canonical Observability Stack using Juju alongside of an OpenTelemetry Collector and added a LangFuse container - I'll get back to this part later. OpenTelemetry Collector and Grafana were made accessible from all my devices using Tailscale, so I could connect multiple machines and VMs to send telemetry to a single backend.

What types of telemetry do the coding agents produce? In most cases, all of the signal trio are present: in all cases, metrics and traces were present (though for Claude Code they required setting a separate feature flag). Github Copilot did not send any logs, but its OpenTelemetry integration is so fresh it wasn't mentioned anywhere in the official docs - I found out about it by accident because it uses the same environment variables as OpenClaw. 