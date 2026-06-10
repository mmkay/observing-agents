# Where RED metrics make more sense

![OpenClaw's dashboard](images/dashboard-openclaw.png)

Note:
Metrics make more sense for something that really runs as a service: OpenClaw. Especially given how fragile an OpenClaw setup may feel, this is the place where metrics give you real understanding.

For instance, just by seeing the error rates I was able to spot that something was off a couple weeks ago. The heartbeat job started consuming lots of tokens and then, several hours later, completely stopped. When I browsed through my discussion history, a question I'd asked a day earlier had likely updated the heartbeat file. It corrected itself after a few hours of heavy token burn.
