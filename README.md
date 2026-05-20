# observing-agents

Companion repository for the ["Observing Agents"](https://devoxx.pl/talk?id=9126) talk at Devoxx Poland 2026. Setup guides, Grafana dashboards, and findings on applying observability to LLM-based agent tools.

**Website:** [mmkay.github.io/observing-agents](https://mmkay.github.io/observing-agents)

## What's in here

| Path | Contents |
|---|---|
| `dashboards/` | Grafana dashboard JSON files (compatible with `cos-configuration-k8s`) |
| `docs/` | Markdown source for the GitHub Pages site — setup guides and reference findings |
| `presentation/` | Talk slides (PDF) and supporting diagrams |

## Adding a tool

Create `<tool>.json` in `dashboards/`, `setup-<tool>.md` and `reference-<tool>.md` in `docs/`, and link them from `docs/index.md`.

## License

[MIT](LICENSE)
