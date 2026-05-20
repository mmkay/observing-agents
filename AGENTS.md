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
├── README.md                    # Links to github.io, brief repo intro
├── LICENSE                      # MIT
├── presentation/
│   ├── observing-agents.pdf     # Talk slides (Devoxx Poland 2026)
│   └── diagrams/                # Supporting diagrams used in the talk
├── dashboards/
│   ├── opencode.json            # Grafana dashboard for OpenCode
│   └── claude-code.json         # Grafana dashboard for Claude Code
├── docs/
│   ├── index.md                 # GitHub Pages landing page
│   ├── setup-opencode.md        # How to set up OpenCode observability
│   ├── setup-claude-code.md     # How to set up Claude Code observability
│   ├── reference-opencode.md    # Findings: signals, metrics, traces from OpenCode
│   └── reference-claude-code.md # Findings: signals, metrics, traces from Claude Code
└── .github/
    └── workflows/
        └── pages.yml            # GitHub Actions: build & deploy docs/ to GitHub Pages
```

## Conventions

- **By concern, not by tool**: dashboards live in `dashboards/`, setup guides and reference docs live in `docs/`. Each tool gets its own file in the relevant directory.
- **Dashboards**: JSON files in `dashboards/` must be directly consumable by `cos-configuration-k8s`. They should be exportable Grafana dashboard JSON.
- **Docs**: Written in Markdown. Built and served via GitHub Pages. No blog structure; flat reference pages with narratives woven in.
- **Presentation**: PDF lives in `presentation/`. The website links to the raw file on GitHub. Diagrams used in the talk also live in `presentation/diagrams/`.
- **Adding a new tool**: Create `<tool>.json` in `dashboards/`, `setup-<tool>.md` and `reference-<tool>.md` in `docs/`, and update `docs/index.md` to link to the new pages.

## Tools covered (current and planned)

- **OpenCode**: Metrics and logs via OTel plugin; traces under investigation
- **Claude Code**: Native OTel integration for metrics, logs, and experimental traces
- **OpenClaw / ZeroClaw / others**: To be evaluated as the talk and research progress
