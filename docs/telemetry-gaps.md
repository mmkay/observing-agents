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
- **OpenClaw:** `openclaw_model_call_time_to_first_byte_ms` — histogram, fully tracked.  
- **Claude Code:** Not tracked. Only session-level timing is available (active time and span duration in Tempo).  
- **OpenCode:** Not tracked. Session-end histograms exist but no per-call TTFB.

**Why it matters:** TTFB is the clearest signal for model responsiveness degradation. A sudden TTFB increase (by provider or model version) is the "is it nerfed?" canary. Without it, you can only see throughput proxies.  
**What would fix it:** Per model-call TTFB histograms in Claude Code and OpenCode, labelled by `model`.

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

**Current state:** `claude_code_code_edit_tool_decision` exists (now visualised) but it appears to be a single aggregate counter with no `tool_name` label. It covers only edit decisions.  
**Why it matters:** Tool usage distribution reveals the nature of work (lots of Bash = scripting work; lots of Edit/Write = active development; lots of WebSearch = research). It also lets you correlate tool call count with token cost.  
**What would fix it:** A `claude_code_tool_invocation_count` counter with a `tool_name` label, incremented on each tool use.

---

## 7. Token Generation Speed — Claude Code & OpenCode

**What we want:** Output tokens per second per model call, to detect model throughput changes.

**Current state (proxies only):**  
- **Claude Code:** `output tokens / active_time` (now visualised as "Output Tokens per Active Minute") — rough proxy; active_time includes user think-time, not just model generation.  
- **OpenCode:** `output tokens / session duration` — even rougher; session includes tool execution wait time.  
- **OpenClaw:** Can be derived from `completion tokens / model_call_duration_ms` (now visualised).

**Why it matters:** Direct tok/sec per model call is how you detect a model getting slower without confusing it with the user taking longer to type. The current proxies conflate user time with model time.  
**What would fix it:** A per-call histogram `model_call_output_tokens` + existing `model_call_duration_ms` (both labelled by `model`). OpenClaw has duration; it just needs token count paired at that granularity.

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
