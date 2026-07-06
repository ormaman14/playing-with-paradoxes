# Design notes — running log

Working notes on design choices, challenges, and how AI tools were used.
This feeds the written description required for the final submission
(goals, design choices, challenges, AI contribution, sources).

## 2026-07-06 — Project kickoff

**Infrastructure decision.** We originally considered base44 for hosting plus a
separately coded backend. Realized the site needs **no backend at all**: the
simulations are pure client-side logic (no accounts, no data storage). Settled on
a static site hosted on **GitHub Pages** — free, gives a public URL the instructor
can open without permissions (a submission requirement), and the git history
documents our development process.

**Stack decision.** Plain HTML/CSS/JS, no framework and no build step. Rationale:
easiest to run/reproduce/grade, zero dependencies, and fully sufficient for
canvas-based simulations. KaTeX (CDN) renders the math. Scalability comes from
structure, not tooling: each paradox is a self-contained folder sharing one CSS
design system; the hub page links them.

**Pedagogical framing (responding to Dustin's feedback).** Dustin pushed back on
"convergence resolves Zeno" and suggested that the *impossibility of literally
simulating infinity* may be the most instructive part. We built the page around
exactly that:

1. The paradox as Zeno/Aristotle state it.
2. An interactive Zeno-step race with a log-zooming camera (the regress never
   visually ends) vs. a "real race" mode (continuous time; Achilles just wins).
   The contrast between the two modes *is* the paradox.
3. The mathematics: geometric series, partial sums, convergence — presented as
   what math *can* say (where/when they meet), explicitly not oversold.
4. A philosophy section: supertasks, Aristotle's potential vs. actual infinity,
   Black/Thomson vs. Benacerraf/Grünbaum — the debate is open.

**The floating-point moment (key design choice).** The simulation computes
positions *incrementally in floating point on purpose*. After ~16 steps (at 10×
speed), the tortoise's advance falls below double precision (~16 significant
digits) and the gap rounds to exactly 0. Instead of hiding this artifact, the
page detects it and surfaces a callout: the computer did not complete infinity —
it rounded. A finite machine cannot run Zeno's supertask, which was precisely
Zeno's challenge. This turns a numerical limitation into the central exhibit,
directly implementing Dustin's remark.

**Visual design.** Dark "deep ink" theme with amber/gold accents and a Greek
meander divider; Fraunces (serif) for headings, Inter for body. Playful touches
(emoji runners) on top of rigorous text.

**AI use.** Site planned and coded with Claude Code (Anthropic), per the course's
encouragement of AI tools for applied projects; concept, paradox selection, and
pedagogical direction are ours (see email exchange with the instructor).
