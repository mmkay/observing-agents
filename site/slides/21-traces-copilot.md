# Github Copilot - shared conventions, context

![A screenshot, showing a span from Github Copilot. It uses the gen_ai prefix for the shared metrics and has context-related data](images/copilot-trace-events.png)

Note:
Github Copilot is pretty fresh or undocumented with its telemetry support. The developers have mostly made all the right choices: they use the `gen_ai` prefix for shared metrics, they don't go overly excessive with the logged data. The nice part is also the fact that they provide data about the context usage, which could be useful.