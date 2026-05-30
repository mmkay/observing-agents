# AGENTS.md

This file describes the purpose, structure, and conventions of the `observing-agents` repository.

## Purpose

This repository is the companion to the "Observing Agents" talk at Devoxx Poland 2026. It serves as a single home for:

- Setup guides for observing LLM-based agent tools (OpenCode, Claude Code, and others)
- Grafana dashboards compatible with the `cos-configuration-k8s` charm
- A reference knowledge base hosted on GitHub Pages (`mmkay.github.io/observing-agents`)
- The talk presentation (PDF) and supporting diagrams

The primary audience is Devoxx attendees and anyone interested in applying observability to agentic LLM tools. The github.io site is the "home page"; the repo is the technical source.

## Observability stack

The reference deployment uses the Canonical Observability Stack (COS), deployed with Juju on Kubernetes, with an OpenTelemetry Collector for telemetry ingestion. However, all setup guides and dashboards focus on OpenTelemetry as the shared standard. Any observability backend that accepts OTLP data (Grafana Cloud, Datadog, Jaeger, SigNoz, etc.) can be used as a replacement.

## Repository structure

```
observing-agents/
├── AGENTS.md                    # This file
├── README.md                    # Brief repo intro
├── LICENSE                      # MIT
├── dashboards/
│   ├── overview.json            # Cross-tool overview dashboard (uid: ao-overview)
│   ├── openclaw.json            # OpenClaw dashboard (uid: ao-openclaw)
│   ├── opencode.json            # OpenCode dashboard (uid: ao-opencode)
│   └── claude-code.json         # Claude Code dashboard (uid: ao-claude-code)
└── docs/
├── setup-opencode.md           # How to set up OpenCode observability
├── setup-claude-code.md        # How to set up Claude Code observability
├── setup-openclaw.md           # How to set up OpenClaw observability
└── setup-github-copilot.md     # How to set up GitHub Copilot CLI observability
```

## Conventions

- **By concern, not by tool**: dashboards live in `dashboards/`, setup guides live in `docs/`. Each tool gets its own file in the relevant directory.
- **Dashboards**: JSON files in `dashboards/` must be directly consumable by `cos-configuration-k8s`. Dashboard UIDs follow the pattern `ao-<tool>`. Each dashboard defines three datasource template variables (`DS_PROMETHEUS`, `DS_LOKI`, `DS_TEMPO`) and references them in all panel targets.
- **Docs**: Written in Markdown. Flat reference pages with setup steps and signal inventories.
- **Adding a new tool**: create `dashboards/<tool>.json` following the conventions above (copy an existing dashboard as a starting point), and add `docs/setup-<tool>.md`.

## Tools covered

- **OpenCode**: Metrics and logs via OTel plugin; traces present (root span names currently blank — known plugin issue)
- **Claude Code**: Native OTel integration; metrics, logs, and traces
- **OpenClaw**: Full setup guide and Grafana dashboard; metrics and traces via OTel
- **GitHub Copilot CLI**: Native OTel integration; metrics and traces (no logs signal); feature is very new and not yet in official web documentation
