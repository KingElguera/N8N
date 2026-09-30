---
name: hostile-review
description: Use this skill when asked to adversarially review code, a design, a plan, a workflow, a PR, or an argument — to "hostile review," "red team," "poke holes in," or "play devil's advocate" against something before it ships. Actively try to break the work rather than politely validate it: assume it is wrong until it survives scrutiny, hunt for edge cases, security holes, unstated assumptions, and weak justifications. Trigger whenever the user asks for a hostile/adversarial/red-team review, wants brutal or maximally honest feedback instead of encouragement, or is about to ship something high-stakes and wants it stress-tested first.
---

# Hostile Review

A hostile review's job is to find every reason the work should NOT ship, argued as hard as a skeptical reviewer trying to reject it. This is not about being unpleasant — it's about applying real adversarial pressure that a friendly pass would never generate, because friendly passes systematically miss the failure modes that matter.

## Ground rules

- **Attack the work, never the person.** Every objection is about the artifact — a claim, a line of code, a design decision — not about the author's competence or effort.
- **Assume guilty until proven innocent.** Default to "this is broken" and require the work to earn your confidence, rather than defaulting to "looks fine" and waiting to be convinced otherwise. This inversion is the entire point of the exercise.
- **Every objection must be concrete and actionable.** "This feels fragile" is not a finding. "If the API returns an empty array here, line 42 divides by zero" is. Vague hostility wastes everyone's time; specific hostility is useful.
- **Steelman before you attack.** Understand the strongest version of what the work is trying to do before tearing into it — attacking a strawman produces findings nobody needs to act on.
- **Rank by severity.** A reviewer who treats a typo and a security hole as equally urgent isn't helping. Lead with what would actually cause harm or failure.

## What to hunt for

- **Fatal flaws first.** Actively try to construct at least one scenario where this completely fails — wrong output, crash, data loss, security breach, broken invariant. If you can't find one after genuinely trying, say so explicitly rather than padding the review with minor nitpicks to look thorough.
- **Unstated assumptions.** What does this rely on being true that nobody actually checked? (An API that always responds fast, a file that always exists, an input that's always well-formed.)
- **Edge cases and boundaries.** Empty inputs, huge inputs, concurrent access, the first run vs. the thousandth, what happens when a dependency is down.
- **Weak justifications.** Where is the reasoning "because that's how we've always done it" rather than something that actually holds up? Where is a claim asserted without evidence?
- **Blast radius.** If this is wrong, how bad is it, and how would anyone find out?

## Output structure

Present findings ranked most-severe first:

```
## Fatal / high severity
- [claim] → [concrete scenario where it breaks] → [why it matters]

## Real concerns
- ...

## Minor / polish
- ...

## What actually holds up
- (briefly — a hostile review that finds literally nothing right is usually not looking honestly)
```

## Where to stop

The goal is a work product that survives scrutiny, not scorched earth. Once you've genuinely tried to break something and it holds, say so plainly — manufacturing objections past that point is dishonest in the other direction. A hostile review earns trust by being rigorous, not by being harsh for its own sake.
