# Telemetry Gaps for Coding Agent Observability

This document catalogues signals that would be useful for understanding coding agent behavior but are not currently emitted by any of the three tools (Claude Code, OpenCode, OpenClaw). Where a partial proxy exists, it is noted.

## 1. Skill / Command Invocation Tracking

**What we want:** How often is each Claude Code skill or slash command used?  
(`/browser-session`, `/grill-me`, `/verify`, `/code-review`, `/run`, etc.)

**Current state:** Not tracked. No metric exists.  
**Why it matters:** Skills drive qualitatively different workloads (a browser session is very different from a code review). Knowing the distribution of skill usage helps explain token and cost patterns and shows which capabilities are actually used.  
**What would fix it:** A `claude_code_skill_invocation_count` counter with a `skill_name` label, incremented each time a skill is invoked.

---

## 2. Memory Operations

**What we want:** How often are memory files read from or written to during a session?

**Current state:** Not tracked. No metric exists.  
**Why it matters:** The memory system is a key part of Claude Code's long-term context management. High write rates might indicate the user is frequently course-correcting; high read rates show memory is actually being used for context. Zero reads would flag that memory isn't being loaded.  
**What would fix it:** A `claude_code_memory_operation_count` counter with a `type` label (`read` | `write` | `delete`) and optionally a `memory_type` label (`user` | `feedback` | `project` | `reference`).

---

## 3. Time to First Byte (TTFB) — Claude Code & OpenCode

**What we want:** How long from sending the API request until the first token arrives from the model.

**Current state:**  
- **OpenClaw:** `openclaw_model_call_time_to_first_byte_ms` — histogram, fully tracked. Also visible in LangFuse as `openclaw.model_call.time_to_first_byte_ms` on `openclaw.model.call` span metadata.  
- **Claude Code:** Not a Prometheus metric. However, `ttft_ms` **is** emitted per call as a `claude_code.llm_request` span attribute and is visible in LangFuse per observation. The gap is in the metrics layer only.  
- **OpenCode:** Still a gap in both layers. `opencode.llm` spans carry only total call latency; no TTFB attribute is emitted.

**Why it matters:** TTFB is the clearest signal for model responsiveness degradation. A sudden TTFB increase (by provider or model version) is the "is it nerfed?" canary. Without it, you can only see throughput proxies.  
**What would fix it:** For OpenCode: add a per-call TTFB attribute to `opencode.llm` spans and a Prometheus histogram. For Claude Code: the trace data already exists — a Prometheus histogram would close the metric-layer gap.

---

## 4. Context Window Utilization Percentage

**What we want:** What fraction of the available context window is filled for each model call?

**Current state:**  
- **OpenClaw:** `openclaw_context_tokens` (histogram) — raw token count, now visualised. No per-model context limit metadata to compute a %.  
- **Claude Code / OpenCode:** Cumulative token counters only; no per-call context size snapshot.

**Why it matters:** "Are we close to the context limit?" is the most common scaling concern for long sessions. Without this, you can only see total token spend, not whether any individual call is near the 200k limit.  
**What would fix it:** A `context_utilization_ratio` gauge or histogram emitted per model call: `context_tokens / model_context_window_size` as a float 0–1. Requires the tool to know the context limit for each model (lookup table).

---

## 5. Session Abort / Interrupt Rate

**What we want:** How often does the user interrupt a session mid-run (Ctrl-C, timeout, forced kill)?

**Current state:** Not tracked. Sessions that end abruptly look identical to sessions that complete normally.  
**Why it matters:** High abort rates signal the model is going in the wrong direction, producing low-value output, or taking too long. It is a leading indicator of user frustration.  
**What would fix it:** A `session_end_reason` label on session completion metrics (`completed` | `interrupted` | `timeout` | `error`), or a separate `session_abort_count` counter.

---

## 6. Per-Tool Invocation Counts — Claude Code

**What we want:** How many times was each tool called (Read, Edit, Write, Bash, WebSearch, etc.) per session?

**Current state:** `claude_code_code_edit_tool_decision` exists (now visualised) but it appears to be a single aggregate counter with no `tool_name` label. It covers only edit decisions. However, `claude_code.tool` spans **are** emitted per tool call with a `tool_name` attribute (`Bash`, `Read`, `Edit`, etc.) and are visible as individual observations in LangFuse. This covers per-session tool distribution at the trace level even without a dedicated metric.  
**Why it matters:** Tool usage distribution reveals the nature of work (lots of Bash = scripting work; lots of Edit/Write = active development; lots of WebSearch = research). It also lets you correlate tool call count with token cost.  
**What would fix it:** For aggregated dashboards: a `claude_code_tool_invocation_count` counter with a `tool_name` label in Prometheus. For per-session inspection: LangFuse already shows this via `claude_code.tool` observations.

---

## 7. Token Generation Speed — Claude Code & OpenCode

**What we want:** Output tokens per second per model call, to detect model throughput changes.

**Current state (proxies only for Prometheus; raw data available in LangFuse):**  
- **Claude Code:** `output tokens / active_time` (Prometheus proxy). In LangFuse, every `claude_code.llm_request` observation carries both `output_tokens` and `duration_ms` as raw span attributes — the per-call data is present but not auto-computed.  
- **OpenCode:** `output tokens / session duration` (Prometheus proxy). In LangFuse, every `opencode.llm` observation exposes `llm.token_count.completion` and a call-level `latency` — again, raw data present but no automatic tok/sec column.  
- **OpenClaw:** Can be derived from `completion tokens / model_call_duration_ms` (now visualised in Prometheus). LangFuse also has both figures per `openclaw.model.call` span.

**Why it matters:** Direct tok/sec per model call is how you detect a model getting slower without confusing it with the user taking longer to type. The current proxies conflate user time with model time.  
**What would fix it:** For Prometheus dashboards: a per-call histogram `model_call_output_tokens` paired with `model_call_duration_ms`, both labelled by `model`. For one-off investigation: LangFuse already has the inputs — the data just needs to be queried via the observations API.

---

## 8. Output Quality Proxies

None of the tools emit any signal about whether generated output was accepted, reverted, or required correction. Possible proxy signals not currently tracked:

| Signal | Proxy for | Effort to instrument |
|---|---|---|
| User edits to AI-generated files (diff lines reversed) | Rework rate | High — needs VCS integration |
| Number of follow-up "fix this" messages | Model self-correction rate | Medium — needs message classification |
| Tool error rate after AI-generated commands | AI command quality | Low — tool error metrics already exist (OpenClaw) |
| Session messages > N (long back-and-forth) | Model stuck or misunderstood | Low — message count already tracked (OpenCode) |

The "Output Tokens per Message" panel added to OpenCode is the closest current proxy: a drop indicates the model is giving shorter answers, which may or may not indicate quality regression.

---

## 9. Subagent Chain Depth — OpenCode

**What we want:** How deep do subagent chains go? (Agent A spawns B spawns C…)

**Current state:** `is_subagent=true/false` on `opencode_session_count`. No nesting depth.  
**Why it matters:** Deep chains multiply cost and latency. A depth metric would flag runaway recursion or overly complex agent graphs.  
**What would fix it:** A `subagent_depth` label (integer) on all OpenCode session and token metrics.

---

## What We CAN Measure Today (Model Health Proxies)

For a rough "is it nerfed / slower?" dashboard, the following panels now exist or can be derived:

| Tool | Signal | Panel |
|---|---|---|
| OpenClaw | TTFB p95 | Model Call TTFB p95 (existing) |
| OpenClaw | Completion tok/sec | Context Size & Throughput → Completion Throughput (new) |
| Claude Code | Output tok/active min | Coding Throughput → Output Tokens per Active Minute (new) |
| Claude Code | Cost per 1k output tokens | Coding Throughput → Cost per 1k Output Tokens (new) |
| OpenCode | Output tokens per message | Reasoning & Efficiency → Output Tokens per Message (new) |
| OpenCode | Reasoning ratio | Reasoning & Efficiency → Reasoning Ratio (new) |
| OpenCode | Cost per 1k output tokens | Reasoning & Efficiency → Cost per 1k Output Tokens (new) |

A sustained TTFB increase combined with dropping throughput and shortening output token counts is the strongest available signal that model behaviour has changed.

---

## What LangFuse Adds

LangFuse is a second trace backend fed by the same otelcol pipeline as Tempo. It does not replace Tempo — Tempo is better for infrastructure-level waterfall debugging. LangFuse is better for everything session- and call-centric.

### Where it is most useful

**OpenCode — richest integration.** OpenCode uses the OpenInference convention, which LangFuse natively understands. Every session arrives as a properly typed hierarchy: `opencode.session` (AGENT) → `opencode.llm` (GENERATION) → `opencode.tool.*` (TOOL). Token counts (`llm.token_count.prompt`, `llm.token_count.completion`) and model names (`llm.model_name`) are populated correctly on every LLM generation. LangFuse's session view is genuinely useful here: you can browse what the agent did, what the model replied, and which tools were called, without reading raw trace JSON.

**Claude Code — TTFB and tool-call visibility.** Claude Code does not use OpenInference and its token counts show as 0 in LangFuse's standard fields (non-standard `input_tokens`/`output_tokens` names). However, two things are well-surfaced: (1) `ttft_ms` is present per `claude_code.llm_request` observation, giving call-level TTFB data that has no equivalent in the current Prometheus dashboards; (2) `claude_code.tool` observations carry `tool_name` (Bash, Read, Edit, etc.), making per-session tool distribution browsable. The absence of a top-level session wrapper makes Claude Code traces harder to navigate than OpenCode in LangFuse.

**OpenClaw — better than expected.** The initial assumption was that OpenClaw would appear as untyped spans. In practice, `openclaw.model.call` spans carry `gen_ai.system` and `gen_ai.request.model` and are rendered as GENERATION, `exec` spans carry `gen_ai.tool.name` and are rendered as TOOL, and `openclaw.model.usage` spans carry the standard `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` — the only tool of the three where LangFuse picks up token counts from standard OTel attribute names. There is no OpenInference session wrapper, so the view is a flat list of typed spans rather than a session hierarchy.

### Gaps it partially closes

| Gap | Tool | What LangFuse shows |
|---|---|---|
| [TTFB per call][gap-ttfb] | Claude Code | `ttft_ms` per `claude_code.llm_request` observation — not in Prometheus |
| [Per-tool invocations][gap-tools] | Claude Code | `claude_code.tool` spans with `tool_name` per session — not in Prometheus |
| [Token gen speed raw data][gap-speed] | Claude Code, OpenCode | `output_tokens`/`duration_ms` (Claude Code) and `llm.token_count.completion`/`latency` (OpenCode) per call — needs manual derivation |
| [Output quality proxy][gap-quality] | All | LangFuse's native scoring/evaluation feature can attach human or LLM-based quality scores to traces — nothing available in Prometheus/Tempo |

### Gaps it does not address

[Skill invocation tracking][gap-skills], [memory operations][gap-memory], [context window utilisation %][gap-context], [session abort/interrupt rate][gap-abort], and [subagent chain depth][gap-depth] are absent from the trace data itself — LangFuse, like Tempo, can only surface what the tools actually emit.

[gap-skills]: #1-skill--command-invocation-tracking
[gap-memory]: #2-memory-operations
[gap-ttfb]: #3-time-to-first-byte-ttfb--claude-code--opencode
[gap-context]: #4-context-window-utilization-percentage
[gap-abort]: #5-session-abort--interrupt-rate
[gap-tools]: #6-per-tool-invocation-counts--claude-code
[gap-speed]: #7-token-generation-speed--claude-code--opencode
[gap-quality]: #8-output-quality-proxies
[gap-depth]: #9-subagent-chain-depth--opencode
