# Claude: complex, but not using the common standard; watch out for IDs

![Claude's example trace, showing time to first token](images/claude-trace-ttft.png)

```bash
# Claude
export OTEL_LOG_USER_PROMPTS=1      # Include user prompt text in events and traces
export OTEL_LOG_TOOL_DETAILS=1      # Include tool parameters and commands
export OTEL_LOG_TOOL_CONTENT=1      # Include tool input/output in trace spans
```

Note:
Claude's traces contents are complex: their traces have several metrics that can help you in understanding whether their models are performing well: we get the token counts, even time to first token is one of the values in the span. They however also log quite a lot of sensitive data that I felt like I should probably cut some of it from the screenshots.

While most of the industry has started to use a shared naming scheme for the token-related values, they start theirs with `gen_ai_`, this is not the case for Claude. It means that the tools that use these conventions will not detect Claude's LLM calls in the same manner as the others.

You can make also make the telemetry much more verbose by asking it to log almost everything: prompts, tool call results, even raw API bodies. Thing is: it will not be here in the logs, but rather in traces. It also, however, comes with privacy concerns - especially if you don't own your observability stack.
