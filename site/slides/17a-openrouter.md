# You need a gateway(?)

![OpenRouter logs](images/openrouter-logs.png)

Note:
In this case, you need a gateway that will act as a proxy for your agentic requests. The gateway can be something deployed locally, you could probably even vibe code something that would work, but if you don't want to handle this and you're using external LLM providers like most mortals do, there is a way for you that already has built in observability. You might already use it and not know about that.

Openrouter, which is what I am pointing at, apart from being a marketplace for inference providers, also has built-in logging included. If you want (this is opt-in), it can store the contents of your prompt as well as the model response for every request, and it combines them well into a conversation. This is already a lot: and you don't need to pay anything extra for it.

It's not everything: you can also configure OpenRouter to send telemetry in the OTLP format to a provider: but then you need to either use someone's service or expose your ingester to the internet. 