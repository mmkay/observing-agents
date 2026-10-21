# Github Copilot - shared conventions, context

![A screenshot, showing a span from Github Copilot. It uses the gen_ai prefix for the shared metrics and has context-related data](images/copilot-trace-events.png)

Note:
Github Copilot is still undocumented with its telemetry support. After 4 months, I'm not sure if that isn't on purpose. The developers have however mostly made all the right choices: they use the `gen_ai` prefix for shared metrics, they don't go overly excessive with the logged data. The nice part is also the fact that they provide data about the context usage, which could be useful.