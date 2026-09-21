# observing-agents

Companion repository for the "Observing Coding Agents" talk, presented at [Devoxx Poland 2026](https://devoxx.pl/talk?id=9126) and upcoming at [SREday Warsaw Q4 2026](https://sreday.com/2026-warsaw-q4/). Setup guides, Grafana dashboards, and findings on applying observability to LLM-based agent tools.

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
