# Observability 101 - Logs

Often the first and most intuitive method of trying to troubleshoot software.

```
System.out.println("TUTAJ");
```

```
{
    "timestamp": "2026-06-19 12:45:00Z+02:00",
    "level": "INFO",
    "message": "New presentation made - was it good?",
    "userId": "4253",
    "traceId": "ab24412bccaaa242",
    "action": "PRESENTATION_MADE"
} # this is also a log!
```

Note:
You surely have seen logs earlier. This is the first intuitive way we try to observe programs, though most of us have probably used a different expression in their logging than the one above. Logs can have context with them: it's often important when a specific log statement has happened and to be able to correlate it with other events that happened within the system. The second example shows a structured log - it also points at a trace id which can be used to correlate data between different signals.

Logs can be more expensive to store - especially if they come with a lot of context. They're also more prone to log explosion: if your application becomes overwhelmed by a spike in traffic, your logs will also be full. Logs are more often used in an incident investigation, but you can also set up alerts based on your logs contents.