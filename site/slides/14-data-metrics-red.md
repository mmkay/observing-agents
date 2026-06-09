# Where RED metrics make more sense

![OpenClaw's dashboard](images/dashboard-openclaw.png)

![OpenClaw's tools usage](images/openclaw-tools.png)

![OpenClaw's token usage](images/openclaw-token-usage.png)

Note:
Of course, the metrics as you may know them from other uses of observability make more sense in case of something that really runs as a service: OpenClaw. Especially given how fragile an OpenClaw setup may feel, this is the place where metrics may give you more understanding.

For instance, just by seeing the error rates I was able to spot that something was off on my environment a couple weeks ago. The heartbeat job started to consume lots of tokens, and then, several hours later, completely stopped. When I browsed through my discussion history, it became likely a question I asked a day earlier has updated the heartbeat file. It corrected itself after a few hours of heavy token burn.

The dashboards also show what's the most crucial thing one needs to know about OpenClaw: it burns tokens all the time. While each of the calls might be smaller than your usual token burn for an interactive session, they all together combine to a pretty heavy cost - which explains why major model providers have blocked claws.