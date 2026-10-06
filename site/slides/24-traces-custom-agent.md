# Custom agents also work

![A Langfuse trace from a custom agent](images/custom-agent-trace.png)

Note:
With a custom agentic system you can also see the full flow. This is a very simple example that I created for the sake of this presentation - an application that took voice notes, transcribed them using whisper and then created a summary using a local model, then deleted the recording. The whole thing was done on my computer, without any external calls other than the response. I especially liked the ability to see a system prompt alongside the input and output.

In case there are any tools passed alongside, you can also see the list of available tools. This has an impact on the amount of stored data too, but can be equally interesting.