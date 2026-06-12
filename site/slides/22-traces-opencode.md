# OpenCode: powerful, but perhaps too verbose?

![OpenCode trace showing the full prompt](images/opencode-trace-llm.png)

Note:
OpenCode's traces by default log the prompts and the outputs. With each call, there's also two traces stored: one for the things that are related to the interaction with the end user, another one for everything that's happening in the background in OpenCode itself. This can be super useful for better understanding of the trace, but it also means a significant cost.