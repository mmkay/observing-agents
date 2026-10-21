# OpenClaw: it burns tokens and occasionally breaks

![OpenClaw's token usage](images/openclaw-token-usage.png)

Note:
You can also see more: for instance, just by seeing the error rates I was able to spot that something was off a couple weeks ago. The heartbeat job started consuming lots of tokens and then, several hours later, completely stopped. When I browsed through my discussion history, a question I'd asked a day earlier had likely updated the heartbeat file. It corrected itself after a few hours of heavy token burn.

The dashboards show what's the most crucial thing one needs to know about OpenClaw: it burns tokens all the time. While each individual call might be smaller than your usual token burn for an interactive session, they all combine to a pretty heavy cost - which explains why major model providers have blocked claws.
