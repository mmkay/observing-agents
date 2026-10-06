# Is Hermes better?

![Hermes dashboard](images/dashboard-hermes.png)

Note:
As a comparison, I wanted to test Hermes Agent as well. It's similar to OpenClaw, but a bit different. The first thing I noticed is that it feels much more like a coding harness: you have sessions, it usually does predictable things and, generally, works. But, what is much more important in the context of observability - it treats observability differently. Its assumption is that for privacy reasons, you shouldn't be getting details about its interactions with LLM providers. Hermes will therefore focus on things that you would expect from monitoring a service: is it up? Do cron jobs trigger? Are we getting any errors?
