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

## 2026-07-06 — Deployment

Published to GitHub Pages: https://ormaman14.github.io/playing-with-paradoxes/
(repo `ormaman14/playing-with-paradoxes`, auto-deploys from `master`). Verified
the site is reachable without any login — a submission requirement.

## 2026-07-06 — Hilbert's Hotel

**Key design choice: the hotel state is a rule, not a list.** We never store an
infinite guest register; we store the *sequence of operations* (shift n→n+1,
bus n→2n) and compute the occupant of any room on demand by inverting the ops.
This mirrors the mathematical point exactly: after Cantor, infinity is handled
by functions/bijections, not by enumeration. The page's philosophy section
draws the explicit contrast with Zeno: Achilles' stages had to be executed one
after another (and our simulation collapsed); the manager's announcement moves
ℵ₀ guests in one act because it is a rule.

**Scenarios.** (1) "+1 guest": everyone shifts up one; the k-th walk-in is
visible in room k after later shifts. (2) "Infinite bus": n→2n, originals on
evens, passengers on odds — the corridor visibly interleaves two infinite
populations. (3) **"The Cantor bus"** (added beyond the original proposal): a
bus with one passenger per real in [0,1]. An animated diagonal-argument table
(digits of √2−1, e−2, π−3, γ, ln2, φ−1, log₁₀2) builds the stowaway ρ = 0.555…
and the hotel refuses a bus for the first time — introducing levels of infinity
(course lecture of June 16).

**The machine-fails moment #2: integer overflow.** "Find the last room" is a
hold-to-warp scroll that accelerates exponentially (~1.4 orders of magnitude
per second). Around room 2^53 JavaScript doubles can no longer distinguish n
from n+1; the simulation detects `n + 1 === n`, stops, and explains: the machine
ran out of numbers before the hotel ran out of rooms. Companion piece to the
Achilles floating-point collapse — rounding there, overflow here.

**Interaction details.** Canvas corridor with drag/swipe panning (Pointer
Events, `touch-action: pan-y` so vertical page scroll still works on mobile);
camera pattern reused from the Achilles page; guests color-coded (amber
originals, red walk-ins, green bus passengers) with identity labels so the
bijections are visually traceable.

## 2026-07-06 — Russell's Paradox

**The barber registry game.** DOM-based (no canvas): six villager cards plus
the barber, two "drawers" (drop bins). Two input paths — tap-to-select then
tap-a-drawer, and full drag-and-drop via Pointer Events (works with touch;
`touch-action: none` on cards). Regular villagers validate against the fact on
their card; wrong placements bounce back with an explanation. The barber is
rejected from *both* drawers, each rejection showing its half of the loop
("if he shaves himself → the rule forbids it…"). After the second rejection a
LOGIC ERROR panel opens: for a village, the exit is "no such barber exists" —
which sets up the set-theoretic version, where that exit is bricked up by
Frege's comprehension principle.

**The machine-fails moment #3: non-termination.** The "village logic machine"
widget tries to evaluate `does the barber shave himself?` and flips
TRUE/FALSE every 600 ms with a step counter, forever. Completes the site's
trilogy: rounding (Achilles), overflow (Hilbert), non-termination (Russell).

**Content sections.** Naive comprehension → R = {x : x ∉ x} → R∈R ⇔ R∉R;
Russell's June 16, 1902 letter to Frege (Grundgesetze II in press) and Frege's
"foundation give way" reply; the fixes (Zermelo/ZFC restricted comprehension,
Russell's type theory making x∈x ungrammatical). Section 4 classifies the
site's three paradoxes per Quine: falsidical (Zeno), veridical (Hilbert),
antinomy (Russell), and points forward to Gödel, where self-reference returns
as a theorem instead of a disaster.
