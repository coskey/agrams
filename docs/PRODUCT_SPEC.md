# Agrams — Product Specification

Status: Draft v0.3
Last updated: 2026-09-16

Agrams is a web-based version of the classic word game **Anagrams** (also known
as Snatch, Grabscrab, or Snatch-It). This document defines what the game is,
how it plays, the user experience, and the order in which we will build it. It
is the reference we will code against, and it will evolve as decisions get made.

### Decisions log

- v0.1: initial draft.
- v0.2: word claims are **auto-validated** against the word list in Phase 1;
  classic social/trust play moves to Phase 2. Tile bag is **Bananagrams (144
  tiles, no blanks)**. Word list is **ENABLE**; the bot uses a restricted
  common-word vocabulary. Front-end is **React + TypeScript + Vite**, static
  deploy for Phase 1. Visual style is **NYT-Games-style minimalist black & white
  with light and dark mode** (replaces the earlier warm-brown direction). Still
  open: tile-flip mechanism and exact game-end trigger (Section 9, Q6/Q8).
- v0.3: **game end** is a countdown that starts when the last tile is flipped
  (default 60s, adjustable), **+15s per steal capped at 60s**, plus an **End
  game** button (host-only online) usable at any time. **Minimum word length**
  default 4, adjustable **2–6** in settings. UI has **distinct desktop and
  mobile layouts**. Added **notation/replay** to the backlog (Section 10).

---

## 1. Vision and goals

Build a fast, tactile game that is fun to play alone against a computer opponent
from day one, and grows into local and online multiplayer. The visual feel is
The New York Times Games aesthetic: minimalist, mostly black and white, a serif
display face for headings, generous whitespace, and full light/dark support.

Design principles:

- **Engine first.** Game rules live in one framework-free TypeScript module
  reused by every mode (bot, hotseat, online). No rule logic in UI code.
- **Play in seconds.** No account or setup required to start a game against the
  bot.
- **Tactile input.** Words can be built by typing or by tapping tiles.
- **Human-friendly rules.** The strict anagram rule is enforced automatically,
  but people can override a call through a challenge, because word games are
  social and dictionaries disagree.
- **Learn by playing.** A scripted tutorial runs automatically on first visit.

We reference two existing open-source projects: `ralphbarton/snatch-it` (Node +
Socket.IO realtime rooms) for the multiplayer transport model, and
`bpeel/verda-sxtelo` (a mature native anagram game) for rule handling and
protocol ideas. We take the ideas, not the code, and re-implement in a typed
stack.

---

## 2. The game

### 2.1 Core rules

- A shared **pool** in the center holds face-up letter tiles, revealed from a
  face-down bag one at a time.
- At any moment a player may **claim a new word** built entirely from unclaimed
  pool letters.
- A player may **steal** an existing word (their own or an opponent's) by using
  **all** of that word's letters plus **one or more** pool letters, rearranged
  into a new, longer valid word.
- Claimed words sit in front of the owning player as a row of tiles.

### 2.2 Minimum word length and scoring

- Minimum word length: **4 letters** by default, adjustable in Game Settings to
  any value from **2 to 6** letters.
- Score per word = **length − 3** (4 letters = 1 point, 5 = 2, 6 = 3, ...).
- When a word is stolen, its points move to the new owner; the old word ceases
  to exist.
- Final score is the sum of the points of the words a player owns at game end.

These are defaults and should be configurable so we can support house variants
(for example a 3-letter minimum) later.

### 2.3 The strict steal rule

A steal from word **A** to word **B** is legal only if:

1. **B** is a valid dictionary word (Section 4).
2. **B** uses every letter of **A**, plus at least one additional pool letter
   (as letter multisets, `A ⊆ B` and `count(B) > count(A)`).
3. **A** does **not** appear as a contiguous substring of **B**. This rejects
   plain extensions (CAT→CATS, ART→PART, CAT→SCAT) while allowing real
   rearrangements (CARE→RACER).

Rule 3 is the standard "you must actually rearrange the letters" enforcement. It
is a good approximation, not a perfect same-root detector; the gap is covered by
the manual challenge system, not by a fuzzy stemmer.

### 2.4 Word validation and challenges

- In **Phase 1**, every word (fresh claim or steal) is **auto-validated** against
  the bundled word list at the moment it is submitted. Invalid words are simply
  rejected and the letters stay where they were.
- The **challenge / override** layer sits on top so disputed but list-valid (or
  list-missing) words can still be contested. Against the bot the human is the
  arbiter and can accept or reject a call.
- In **Phase 2 and later** we add **classic social play**: an optional mode where
  words are accepted on trust (no auto-check) and validity is decided purely by
  challenge. Resolution is by **majority vote**; ties resolve to **Invalid**;
  an invalidated word's tiles return to the center pool and its points reverse.

### 2.5 The bot opponent

- Ships at a single **medium** level first, tuned to feel like a decent human
  rather than an oracle.
- Difficulty is expressed through a **reaction delay** (how long after a legal
  move exists before the bot takes it) and **search depth** (how hard it looks
  for steals versus simple claims).
- The bot plays only from a **restricted, common-word vocabulary**, even though
  the full list validates human words. This keeps it from winning on obscure
  words.
- The bot can make moves, be the target of the human's steals, and (open
  question) optionally challenge the human.

### 2.6 Tile bag

- **Bananagrams distribution: 144 tiles, no blanks.** Counts: A13 B3 C3 D6 E18
  F3 G4 H3 I12 J2 K2 L5 M3 N8 O11 P3 Q2 R9 S6 T9 U6 V3 W3 X2 Y3 Z2.
- Tiles are drawn from this bag one at a time into the pool. The flip mechanism
  is still being decided (Section 9, Q6): leading proposal is a **manual "flip
  next tile" button** the player controls, with the bot reacting to each new
  pool state.

### 2.7 Game end and the endgame timer

- Once the **last tile has been flipped** (bag empty), a countdown starts,
  default **60 seconds**, adjustable in Game Settings.
- Every **steal** during the countdown **adds 15 seconds**, capped so the
  remaining time never exceeds the **60-second max**. This keeps the endgame
  alive while players are actively stealing, then lets it wind down.
- An **"End game" button** is available at any point in the game. In
  single-player the player presses it; in online multiplayer only the **host**
  can. It ends the game immediately.
- When the countdown reaches zero (or End game is pressed), scoring is finalized
  per Section 2.2.

---

## 3. Input model

Two interchangeable ways to compose a word, both from Phase 1:

- **Typing.** A bottom input bar where the player types the full word and
  submits. The engine determines whether it is a valid claim from the pool or a
  steal of an existing word, and from which source.
- **Tapping / clicking.** The player taps pool tiles (and the tiles of a word
  being stolen) to assemble the target word, then confirms.

Both paths resolve to the same engine action, so a word is accepted only if it
satisfies the rules regardless of how it was entered. Desktop uses click plus
keyboard; mobile uses touch.

---

## 4. Word list and validation

- **ENABLE** is the bundled, offline source of truth for validity (open,
  public-domain, ~172k words; freely redistributable, unlike Collins/SOWPODS).
  No network lookups at play time.
- The list is preprocessed into an **anagram index**: a map from sorted-letter
  key to the set of words with those letters, making "what can these letters
  form" and steal-finding fast.
- The **bot's playable vocabulary** is a subset of ENABLE filtered by a
  **common-word frequency list**, so the bot plays words a person would know.
- Proper nouns, hyphenated words, and abbreviations are excluded (ENABLE already
  excludes them).

---

## 5. User experience and interface

Minimalist, black-and-white, NYT-Games-inspired, mobile-first, with light and
dark themes.

### 5.1 Screen layout (in-game)

- **Top bar:** a mode/status label, the game or room label, a player count, and
  contextual actions (for example Skip during the tutorial). Thin rule beneath.
- **Center pool:** a clearly labeled area holding the face-up tiles as squares
  with a border and a bold letter. In light mode, white tiles with black letters
  and a black border; inverted in dark mode.
- **Player rows:** one row per player with the player's name, current score, and
  claimed words shown as tile runs. Empty rows read "No words yet."
- **Input bar:** pinned to the bottom, a text field with a submit control.
  Tapping tiles fills the same pending word.

### 5.2 Challenge modal

A centered overlay with a heading, the disputed word rendered as tiles, an
optional discussion area (multiplayer), a per-player vote state, and clear
Valid / Invalid actions. On resolution, a banner explains the outcome and what
happened to the tiles.

### 5.3 Tutorial

- Runs automatically on a player's **first ever session** (detected via local
  storage); skippable at any time and replayable from a menu.
- Scripted, step-by-step: how tiles flip, how scoring works (with the 4/5/6
  examples), how to claim, how to steal, and how challenges resolve.
- Uses a canned demo game with sample opponents so the player sees a steal and a
  challenge without needing live opponents.

### 5.4 Visual style

- **Palette:** primarily black and white. Light mode is black on white; dark
  mode is white on near-black. A single restrained accent (an NYT-style blue) is
  used for the active selection/highlight and important actions. Valid/invalid
  affordances may use minimal green/red only where clarity demands it.
- **Type:** a serif display face for headings and the wordmark (evoking the NYT
  Games look) and a clean, highly legible face for body and tiles.
- **Tiles:** square, bordered, single bold letter, high contrast, consistent in
  both themes.
- **Theme switching:** respects the OS preference by default and offers a manual
  light/dark toggle; both fully supported from Phase 1. All colors are defined as
  CSS variables/tokens.
- **Motion:** subtle animation for tile flips, claims, and steals so moves are
  legible without feeling busy.
- **Player differentiation:** in a black-and-white scheme, distinguish players
  primarily by name/position and a small muted accent dot per player, not by
  large blocks of color.

### 5.5 Responsive layouts (desktop and mobile)

The UI has **distinct layouts** for desktop and mobile, not just a scaled single
design (mirroring how NYT Games adapts across screen sizes):

- **Mobile:** a single vertical column, the pool near the top, player rows
  stacked below, and the word-entry bar pinned to the bottom for thumb reach.
  Tapping tiles is the primary input.
- **Desktop:** a wider multi-column layout, for example the board/pool alongside
  player panels and controls, using the horizontal space; keyboard entry is
  first-class.
- Both share the same components and engine state; only arrangement and input
  emphasis differ, with breakpoints defined in one place.

---

## 6. Practice mode (later phase)

A solo mode focused on training and word discovery.

- Play solo at your own pace.
- A **hint / research button** reveals possible words in two modes:
  - **Hypothetical:** given any word the player types, show all longer words
    makeable from its letters plus extras, grouped by number of added letters
    (+1, +2, +3, ...), in the style of the `snatch-search` tool at filosophy.org.
  - **From the pool:** given the current pool and words on the board, show all
    legal claims and steals available right now.
- Reuses the same anagram index and steal-legality logic as the engine, so hints
  and gameplay never disagree.

---

## 7. Architecture

- **Stack:** TypeScript throughout. **React + Vite** for the web UI, plain CSS
  with variables for theming (no heavy UI library). The core engine is
  independent of React.
- **Engine module:** pure functions and state for the pool, claims, steals,
  strict-rule validation, scoring, and challenge resolution. No DOM, no network.
- **Bot module:** consumes the engine and the restricted vocabulary; emits moves
  with configurable timing and depth.
- **UI layer:** renders engine state; handles typing and tapping, the tutorial,
  theming, and the challenge modal.
- **Online later:** a Node WebSocket server (snatch-it's room model) imports the
  same engine and authoritatively resolves moves, broadcasting state to clients.
  The engine is not rewritten for online play.
- **Phase 1 is a static, client-only site**: it works offline and needs no
  server, since a single human versus a local bot needs no networking. Deploy to
  a static host.

---

## 8. Delivery phases

**Phase 1 — Single-player vs. the bot (first release).**
Client-only React app. Engine, ENABLE word list and anagram index, strict steal
rule, auto-validation of claims, medium bot with restricted vocabulary, manual
challenge/override, typing and tapping input, Bananagrams bag, minimalist B&W
light/dark UI, and the first-run tutorial.

**Phase 2 — Local hotseat multiplayer.**
Multiple humans sharing one device. Adds **classic social play** (trust +
challenge, no auto-check) and the full challenge-by-vote flow with majority
resolution and ties-to-invalid. Reuses the Phase 1 engine and UI.

**Phase 3 — Online realtime rooms.**
Node WebSocket server wrapping the engine. Shareable-link rooms, live sync,
in-room chat, and the multiplayer challenge/vote flow across devices.

**Phase 4 — Practice mode and anagram search.**
Solo practice with the hint/research tool from Section 6, both hypothetical and
pool-based.

**Phase 5 — Game notation and replay.**
A compact, human-readable notation recording every event so a finished game can
be **replayed step by step**, in the spirit of chess.com and colonist.io game
reviews. See Section 10.

Phases can overlap where engine work is shared, but this is the intended order
of user-visible releases.

---

## 9. Open questions

Resolved items are struck through; the rest still need answers.

**Rules and scoring**
1. ~~Minimum word length 4, scoring length − 3.~~ Confirmed.
2. Can a player steal their **own** words? (Classic: yes. Assumed yes — please
   confirm.)
3. ~~Auto-validate claims vs. trust-and-challenge.~~ Auto-validate in Phase 1;
   social play in Phase 2.
4. ~~Blanks/wildcards.~~ No blanks (Bananagrams bag).

**Tiles and pacing**
5. ~~Tile distribution.~~ Bananagrams, 144 tiles.
6. **Tile flipping (open):** manual "flip next tile" button (proposed) vs.
   auto-flip on a timer? In vs-bot, does the human control the flip?
7. Any **turn timer** or clock during the main game? (Assumed none in Phase 1;
   the endgame countdown in Section 2.7 is separate.)

**End of game**
8. ~~Game-end trigger.~~ Endgame countdown (default 60s, +15s per steal, capped
   at 60s) starting when the bag empties, plus an End game button (Section 2.7).

**Bot**
9. For medium difficulty, roughly how often should the bot beat an average
   player? Any word categories it should avoid entirely?
10. Should the bot ever **challenge** the human in Phase 1, or only the reverse?

**Word list**
11. ~~List choice.~~ ENABLE. (Any custom additions/removals?)

**Look and tech**
12. ~~Exact screenshot match vs. direction.~~ NYT-Games-style B&W, light + dark.
13. ~~Front-end framework / deploy.~~ React + TypeScript + Vite; static deploy.
14. Sound effects / haptics in scope for Phase 1? (Assumed no.)
15. Any accessibility requirements to design in now (screen reader support,
    color-blind-safe accents, font scaling)?

**Later phases**
16. For online play (Phase 3): anonymous rooms only, or accounts and history?
17. For practice (Phase 4): should the hint tool be usable inside a real game as
    a training aid, or strictly limited to practice mode?

---

## 10. Future feature backlog

Ideas beyond the numbered phases, captured so the engine can accommodate them:

- **Game notation and replay (Phase 5).** Record each game as an ordered,
  serializable log of events (tile flips, claims, steals with source/target,
  challenges and outcomes, timer changes, game end). From this we can offer a
  **replay viewer** that steps or scrubs through the game, like chess.com's
  move-by-move review or colonist.io's replay. Designing the engine to emit this
  event log from the start (even in Phase 1) makes replay cheap to add later and
  doubles as the online sync format.
- Additional bot difficulty levels beyond medium.
- House-rule presets and shareable game settings.
