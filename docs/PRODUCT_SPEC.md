# Agrams — Product Specification

Status: Draft v0.1
Last updated: 2026-09-16

Agrams is a web-based version of the classic word game **Anagrams** (also known
as Snatch, Grabscrab, or Snatch-It). This document defines what the game is,
how it plays, the user experience, and the order in which we will build it. It
is the reference we will code against, and it will evolve as decisions get made.

---

## 1. Vision and goals

Build a fast, tactile, mobile-first Anagrams game that is fun to play alone
against a computer opponent from day one, and grows into local and online
multiplayer. The feel we are targeting is the polished dark-theme mobile app in
the reference screenshots: a warm brown board, cream letter tiles, per-player
accent colors, and a clean word-entry bar at the bottom.

Design principles:

- **Engine first.** Game rules live in one framework-free module reused by
  every mode (bot, hotseat, online). No rule logic is duplicated in UI code.
- **Play in seconds.** No account or setup required to start a game against the
  bot.
- **Tactile input.** Words can be built either by typing or by tapping tiles.
- **Human-friendly rules.** The strict anagram rule is enforced automatically,
  but people can always override a call through a challenge, because word games
  are social and dictionaries disagree.
- **Learn by playing.** A scripted tutorial runs automatically on first visit.

We are basing the implementation on two existing open-source projects for
reference: `ralphbarton/snatch-it` (Node + Socket.IO realtime rooms, canvas UI)
for the multiplayer transport model, and `bpeel/verda-sxtelo` (a mature
C/native anagram game) for rule handling and protocol ideas. We take the ideas,
not the code, and re-implement in a typed stack.

---

## 2. The game

### 2.1 Core rules

- A shared **pool** in the center holds face-up letter tiles. Tiles are revealed
  from a face-down bag one at a time.
- At any moment a player may **claim a new word** built entirely from unclaimed
  pool letters.
- A player may **steal** an existing word (their own or an opponent's) by using
  **all** of that word's letters plus **one or more** pool letters, rearranged
  into a new, longer valid word.
- Claimed words sit in front of the owning player as a row of tiles.
- The game ends when the bag is empty and no further moves are being made (exact
  end trigger is an open question, see Section 9).

### 2.2 Minimum word length and scoring

Per the reference UI:

- Minimum word length: **4 letters**.
- Score per word = **length − 3**. So 4 letters = 1 point, 5 = 2, 6 = 3, and so
  on.
- When a word is stolen, its points move to the new owner (the old word ceases
  to exist).
- Final score is the sum of the points of the words a player owns at game end.

These values are the defaults and should be configurable in game settings so we
can support house variants (for example a 3-letter minimum) later.

### 2.3 The strict steal rule

"Strict classic" means a steal must be a genuine rearrangement, not just an
inflection or affix of the stolen word. We enforce it as follows:

A steal from word **A** to word **B** is legal only if all of these hold:

1. **B** is a valid dictionary word (see Section 4).
2. **B** uses every letter of **A**, plus at least one additional pool letter
   (so `count(B) > count(A)` as letter multisets, and `A ⊆ B`).
3. **A** does **not** appear as a contiguous substring of **B**. This rejects
   plain extensions such as CAT→CATS, ART→PART, and CAT→SCAT, while allowing
   real rearrangements such as CARE→RACER or STALE→SLATE + extra.

Rule 3 is the standard "you must actually move the letters around" enforcement.
It is a good approximation, not a perfect same-root detector: it cannot catch
same-root steals that happen to reorder letters. That gap is intentionally
covered by the manual challenge system below rather than by a fuzzy stemmer.

### 2.4 Challenges and overrides (first iteration)

Because dictionaries disagree and the strict rule is an approximation, players
can dispute a word. This is a first-iteration feature, not a later add-on.

- Any word (a fresh claim or a steal) can be **challenged**.
- A challenge opens a small modal showing the disputed word, a short discussion
  area, and a vote.
- In multiplayer, resolution is by **majority vote**; ties resolve to
  **Invalid** (matching the reference UI: "Majority voted Invalid (2-1). The
  letters return to the center.").
- If a word is ruled invalid, its tiles return to the center pool and any
  points are reversed.
- Against the computer (Phase 1), the human is the arbiter: they can manually
  mark a bot steal or word as acceptable or not, and can accept or reject a
  challenge on their own word. Automatic dictionary validation still runs
  underneath, so the challenge layer is an override, not the only check.

### 2.5 The bot opponent

- Difficulty ships at a single **medium** level first, tuned to feel like a
  decent human rather than an oracle.
- Difficulty is expressed through two knobs: a **reaction delay** (how long
  after a legal move becomes available before the bot takes it) and **search
  depth** (how hard it looks for steals versus simple claims).
- The bot draws from a **restricted, common-word vocabulary** for the words it
  plays, even though the full word list is used for validating human words. This
  keeps it from winning on obscure words a person would never know.
- The bot both makes moves and can be the target of the human's steals and
  challenges.

---

## 3. Input model

Two interchangeable ways to compose a word, available together from Phase 1:

- **Typing.** A bottom input bar ("Type a word...") where the player types the
  full word and submits. The engine figures out whether it is a valid claim
  from the pool or a steal of an existing word, and from which source.
- **Tapping / clicking.** The player taps pool tiles (and tiles of an existing
  word being stolen) to assemble the target word visually, then confirms.

Both paths resolve to the same engine action, so a word is accepted only if it
satisfies the rules regardless of how it was entered. On desktop, tapping is
mouse-click plus keyboard; on mobile it is touch.

---

## 4. Word list and validation

- A **bundled offline word list** is the source of truth for validity. No
  network lookups at play time. Candidate list is ENABLE (open, common default);
  TWL/NASPA and SOWPODS/Collins are alternatives to decide on (Section 9).
- The list is preprocessed into an **anagram index**: a map from a sorted-letter
  key to the set of words with those letters. This makes "what words can these
  letters form" and steal-finding fast.
- The bot's playable vocabulary is a **subset** of the validation list, filtered
  to common words (for example by a frequency threshold).
- Proper nouns, hyphenated words, and abbreviations are excluded (assuming the
  chosen list already excludes them).

---

## 5. User experience and interface

Mobile-first, dark warm theme matching the reference screenshots.

### 5.1 Screen layout (in-game)

- **Top bar:** a mode/status badge (for example TUTORIAL), the room or game
  label (for example #DEMO), a player count, and contextual actions (Skip during
  the tutorial).
- **Center pool:** a labeled panel ("CENTER POOL") holding the face-up tiles as
  cream squares with dark serif letters.
- **Player rows:** one row per player, each with a colored dot, name, a trophy
  icon with the current score, and that player's claimed words shown as tile
  runs. Empty rows read "No words yet."
- **Input bar:** pinned to the bottom, a text field ("Type a word...") with a
  send button. Tapping tiles fills the same pending word.

### 5.2 Challenge modal

A centered overlay with a warning icon and "CHALLENGE!" heading, the disputed
word rendered as tiles, a discussion thread, a per-player vote list showing
each player's state (waiting / VALID / INVALID), and large VALID / INVALID
buttons. On resolution, a banner explains the outcome and what happened to the
tiles.

### 5.3 Tutorial

- Runs automatically on a player's **first ever session**, detected via local
  storage; skippable at any time and replayable from a menu.
- Scripted, step-by-step: how tiles flip, how scoring works (with the
  4/5/6-letter examples from the screenshots), how to claim, how to steal, and
  how challenges resolve.
- Uses a canned demo game with sample opponents so the player sees a steal and a
  challenge play out without needing live opponents.

### 5.4 Visual style

- Background: warm dark brown. Tiles: cream with near-black serif letters.
- Player accent colors from a fixed palette (red, blue, teal, and more).
- Accent yellow for tutorial and challenge highlights; green/red for
  valid/invalid actions.
- Animation for tile flips, word claims, and steals so moves are legible.

---

## 6. Practice mode (later phase)

A solo mode focused on training and word discovery, not competition.

- Play solo at your own pace.
- A **hint / research button** reveals possible words, in two modes:
  - **Hypothetical:** given any word the player types, show all longer words
    that can be made from its letters plus extras, grouped by number of added
    letters (+1, +2, +3, ...), in the style of the `snatch-search` tool at
    filosophy.org.
  - **From the pool:** given the current center pool and words on the board,
    show all legal claims and steals actually available right now.
- This mode reuses the same anagram index and steal-legality logic as the
  engine, so hints and gameplay never disagree.

---

## 7. Architecture

- **Language/stack:** TypeScript throughout. A framework-free core engine plus a
  web UI. Front-end framework to be confirmed (Section 9); the engine is
  independent of that choice.
- **Engine module:** pure functions and state for the pool, claims, steals,
  strict-rule validation, scoring, and challenge resolution. No DOM, no network.
- **Bot module:** consumes the engine and the restricted vocabulary; emits moves
  with configurable timing and depth.
- **UI layer:** renders engine state, handles typing and tapping, tutorial, and
  the challenge modal.
- **Online later:** a Node WebSocket server (snatch-it's room model) imports the
  same engine and authoritatively resolves moves, broadcasting state to clients.
  Nothing in the engine is rewritten for online play.

Phase 1 is a **static, client-only** site: it works offline and needs no
server, because a single human versus a local bot needs no networking.

---

## 8. Delivery phases

**Phase 1 — Single-player vs. the bot (first release).**
Client-only. Engine, bundled word list and anagram index, strict steal rule,
medium bot with restricted vocabulary, manual challenge/override, typing and
tapping input, mobile-first themed UI, and the first-run tutorial. Scoring and
minimum length as in Section 2.2.

**Phase 2 — Local hotseat multiplayer.**
Multiple humans sharing one device take turns at the same board. Full
challenge-by-vote with majority resolution and ties-to-invalid. Reuses the
Phase 1 engine and UI.

**Phase 3 — Online realtime rooms.**
Node WebSocket server wrapping the engine. Shareable-link rooms, live sync,
in-room chat, and the multiplayer challenge/vote flow across devices.

**Phase 4 — Practice mode and anagram search.**
Solo practice with the hint/research tool described in Section 6, both
hypothetical and pool-based.

Phases can overlap where the engine work is shared, but this is the intended
order of user-visible releases.

---

## 9. Open questions

These need answers (or confirmation) before or during the relevant phase. Best
current assumption is noted where I have one.

**Rules and scoring**
1. Confirm minimum word length **4** and scoring **length − 3**, matching the
   screenshots (this differs from snatch-it's 3-letter minimum).
2. Can a player steal their **own** words? (Classic: yes. Assumed yes.)
3. When a human claims a word, is it **auto-validated** against the bundled list
   immediately, or accepted on trust and only removable via challenge (classic
   social play)? This significantly affects feel.
4. Are **blanks/wildcard** tiles in scope at all?

**Tiles and pacing**
5. Tile distribution: Scrabble-style (100 tiles), Bananagrams-style (144), or a
   custom bag? How many of each letter?
6. Who controls **flipping** the next tile, and when? Manual "flip" button,
   auto-flip on a timer, or flip-when-idle? In vs-bot, does the human flip?
7. Is there any **turn timer** or global game clock?

**End of game**
8. What ends a game: bag empty plus an idle timeout, a target score, a fixed
   time limit, or player "pass/resign"?

**Bot**
9. For medium difficulty, rough target: how often should the bot win against an
   average player? Any word categories it should avoid entirely?
10. Should the bot ever **challenge** the human, or only the human challenge the
    bot in Phase 1?

**Word list**
11. Final choice of list: ENABLE (assumed default), TWL/NASPA, or SOWPODS/
    Collins? Any custom additions/removals?

**Look and tech**
12. Should we match the attached screenshots' exact look, or treat them as
    direction to reinterpret?
13. Front-end framework preference (React, Svelte, or vanilla TS)? Any deploy
    target (static host, etc.)?
14. Sound effects / haptics in scope for Phase 1?
15. Any accessibility requirements to design in from the start (screen reader,
    color-blind-safe player colors, font scaling)?

**Later phases**
16. For online play (Phase 3): anonymous rooms only, or accounts and history?
17. For practice (Phase 4): should the hint tool be usable inside a real game
    (as a training aid) or strictly limited to practice mode?
