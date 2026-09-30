---
name: interview
description: Use this skill whenever a request is ambiguous, underspecified, or could reasonably be built several different ways — before writing code, a plan, a workflow, or any other deliverable. Conduct a short, structured interview to pin down goals, constraints, inputs/outputs, and success criteria instead of guessing and building the wrong thing. Trigger this whenever the user's request leaves open questions a reasonable builder couldn't answer alone, or when they explicitly ask to be interviewed, asked questions first, or want requirements gathered before work starts.
---

# Interview

Building the wrong thing fast is slower than building the right thing. This skill exists because the cheapest moment to catch a wrong assumption is before any work has started — not after the deliverable is finished and needs to be redone.

## When to interview

Interview when the answer to "what should I build?" has more than one reasonable interpretation, or when a wrong guess would be expensive to unwind (an architecture choice, a workflow that touches real data, a deliverable someone else depends on). Do not interview when the task is genuinely well-specified, or when the answer is already derivable from the codebase, prior conversation, or obvious convention — asking there just wastes the user's time and signals you didn't bother to look.

## How to run the interview

1. **Do your homework first.** Before asking anything, check what you can already infer — read the relevant files, prior messages, and any project conventions. Never ask a question whose answer is sitting in front of you.
2. **Ask the highest-leverage questions first.** Prioritize the unknowns that would most change your approach if answered differently (e.g. "who is this for" or "what does success look like" usually matters more than a naming detail). Don't front-load minor polish questions.
3. **Ask a few at a time, not twenty.** Group related questions together. Use the `AskUserQuestion` tool when available so the user can pick from concrete options rather than freehand every answer — concrete options are faster to answer than open questions and reveal tradeoffs the user might not have considered.
4. **Go one round deeper only if needed.** If an answer opens a new fork, ask a follow-up. Stop as soon as you have enough to proceed with confidence — an interview that drags on past the point of diminishing returns is its own failure mode.
5. **Reflect back your understanding before building.** Summarize what you heard in a few sentences ("So: X for audience Y, must handle Z, out of scope is W") and let the user correct you before you commit time to building it. This catches misunderstandings cheaply.

## What to ask about

Adapt to the task, but the useful categories are usually:
- **Goal** — what outcome does this need to produce, and for whom?
- **Constraints** — what's fixed (deadline, stack, format, budget) vs. flexible?
- **Inputs and outputs** — what does this consume, what does it produce, in what shape?
- **Success criteria** — how will you (or the user) know this worked?
- **Scope boundaries** — what's explicitly out of scope, so you don't over-build?

## What good looks like

A good interview is short, concrete, and converges — not a checklist marched through mechanically. If the user says "just use your judgment" or "stop asking and build it," respect that immediately and proceed with your best inference, noting any assumptions you're making along the way so they're easy to correct later.
