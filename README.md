# Agrams

A web version of the classic word game **Anagrams** (also known as Snatch).
Flip letters into a shared pool, build words, and steal your opponent's words by
rearranging them into longer ones.

This repository is being built in phases (see
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)). **Phase 1** is complete:
single-player against a medium computer opponent.

## Phase 1 features

- Framework-free game engine (pool, claims, strict steals, scoring, endgame
  timer) with a full event log for future replay.
- Strict "classic" steal rule: a steal must use all of a word's letters plus at
  least one more, and genuinely rearrange (no plain extensions like CAT → CATS).
- Bundled offline word list (ENABLE) for validation; the bot plays from a
  restricted common-word vocabulary so it feels human and beatable.
- Medium bot with a reaction delay and search depth.
- Type or tap to build words; manual or auto tile flipping (a setting).
- Endgame countdown that starts when the bag empties and extends on each steal.
- Manual challenge / override on any word.
- First-run tutorial, adjustable settings (min length 2–6, flip mode, timer).
- Minimalist black-and-white design with light and dark modes; distinct desktop
  and mobile layouts.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run preview    # preview the production build
npm test           # run the engine and bot unit tests
```

## Project structure

```
src/
  engine/   framework-free game core (types, bag, dictionary, steal rule, game)
  bot/      the computer opponent
  data/     loads the bundled word lists
  ui/       React app (screens, components, hooks, theme)
public/
  words/    ENABLE validation list + common-word vocabulary
docs/
  PRODUCT_SPEC.md   the living product specification
```

The engine has no DOM or network dependencies, so later phases (local hotseat,
online rooms, replay) reuse it unchanged.
