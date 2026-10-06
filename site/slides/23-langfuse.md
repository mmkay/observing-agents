# Tempo is great but it's not LLM-aware: LangFuse speaks tokens, models, sessions natively

![An example trace in LangFuse](images/langfuse-trace-example.png)

Note:
When I researched observability, I stumbled upon LangFuse, which is a tracing backend that is dedicated for LLM-related traces. I tested it out in this experiment too and I liked the details it shows you. It's the tiny UX things, like how many tokens did this interaction use, which model was used, the ability to see the full sessions.

It also has much more features that can be super interesting, like prompt management or scoring the outputs - but all that is another rabbit hole for another talk. I'd probably say that for the agentic traces, LangFuse is the best open source thing I've found so far. And it's possible to deploy it in Docker with six Docker containers - it for some reason requires four different storage backends.