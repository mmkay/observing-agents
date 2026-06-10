# How much data is stored per interaction?

## In my runs, between **200 KB and 4 MB**.

Note:
As I mentioned earlier, traces are expensive to store because of their structure. On one hand, you probably get less interactions with LLMs in your organization than the amount of HTTP requests your service is receiving. On the other, if your company hosts an observability stack, it's most likely central. Here we're dealing with a trail that is created by each individual contributor; and it doesn't make sense to use any sampling techniques. We don't want to keep just one in a hundred interactions with the agents.

So, as with any other observability stack, you need to think about data retention: how long do you want to store traces? Do you want each developer to have their own observability stack? How much data do you expect in your system? In my experiments, I managed to gather 10 GB of traces in less than a month.