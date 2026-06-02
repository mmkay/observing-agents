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
This is the setup that I ended up using. I deployed Canonical Observability Stack using Juju alongside of an OpenTelemetry Collector and a LangFuse container - I'll get back to this part later. OpenTelemetry Collector and Grafana were made accessible from all my devices using Tailscale, so I could write up multiple machines and VMs to send telemetry.