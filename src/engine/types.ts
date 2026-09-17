// Core data types for the Agrams engine. The engine is framework-free and has no
// DOM or network dependencies so it can be reused by the bot, local hotseat, and
// (later) the online server unchanged.

export interface Tile {
  /** Stable, unique id for this physical tile within a game. */
  id: number;
  /** Uppercase A-Z letter. */
  letter: string;
}

export interface ClaimedWord {
  id: number;
  ownerId: string;
  /** The uppercase word text. */
  text: string;
  /** The tiles that spell this word, in reading order. */
  tiles: Tile[];
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
}

export type FlipMode = "manual" | "auto";

export type GameMode = "vs-computer" | "practice";

export interface GameSettings {
  /** Whether there is a computer opponent, or a solo practice game. */
  mode: GameMode;
  /** Computer difficulty, 1 (easiest) to 5 (hardest). Default 3. */
  difficultyLevel: number;
  /** Minimum word length, adjustable 2-6. Default 4. */
  minWordLength: number;
  /** How tiles are revealed. */
  flipMode: FlipMode;
  /** For auto flip: milliseconds between reveals. */
  autoFlipIntervalMs: number;
  /** Flip 4 tiles into the pool when the game starts. */
  startWithFourTiles: boolean;
  /** Endgame countdown length and steal-bonus cap, in seconds. Default 60. */
  endgameSeconds: number;
  /** Seconds added to the endgame timer on each steal. Default 15. */
  stealBonusSeconds: number;
  /** Solo practice aid: hover a word for anagrams/steals and glow hints. */
  helpMode: boolean;
}

export interface EndgameTimer {
  /** True once the bag is empty and the countdown is running. */
  active: boolean;
  /** Milliseconds left before the game ends; null before the endgame starts. */
  remainingMs: number | null;
}

export type GamePhase = "playing" | "ended";

export interface GameEventBase {
  seq: number;
}

export type GameEvent =
  | (GameEventBase & {
      type: "gameStart";
      settings: GameSettings;
      players: Player[];
    })
  | (GameEventBase & { type: "flip"; tile: Tile })
  | (GameEventBase & {
      type: "claim";
      playerId: string;
      wordId: number;
      text: string;
    })
  | (GameEventBase & {
      type: "steal";
      playerId: string;
      wordId: number;
      text: string;
      sourceWordId: number;
      sourceText: string;
      sourceOwnerId: string;
    })
  | (GameEventBase & {
      type: "challenge";
      wordId: number;
      text: string;
      /** true = word upheld as valid; false = ruled invalid and removed. */
      upheld: boolean;
    })
  | (GameEventBase & { type: "endgameStart" })
  | (GameEventBase & { type: "gameEnd"; scores: Record<string, number> });

export interface GameState {
  players: Player[];
  settings: GameSettings;
  phase: GamePhase;
  /** Face-down tiles still to be drawn (draw from the end). */
  bag: Tile[];
  /** Face-up, unclaimed tiles in the center pool. */
  pool: Tile[];
  /** All claimed words across all players. */
  words: ClaimedWord[];
  endgame: EndgameTimer;
  /** Ordered log of everything that happened, for replay and online sync. */
  events: GameEvent[];
  // Internal id counters.
  nextTileId: number;
  nextWordId: number;
  nextSeq: number;
}

/** A move a player attempts. Tiles are resolved by the engine from `text`. */
export type Move =
  | { kind: "claim"; playerId: string; text: string }
  | { kind: "steal"; playerId: string; text: string; sourceWordId: number };

export type RejectReason =
  | "GAME_OVER"
  | "TOO_SHORT"
  | "NOT_A_WORD"
  | "NOT_FORMABLE"
  | "NOT_A_STEAL"
  | "SOURCE_NOT_FOUND";

export interface AttemptSuccess {
  ok: true;
  state: GameState;
  move: Move;
}

export interface AttemptFailure {
  ok: false;
  reason: RejectReason;
  /** Human-readable explanation for the UI. */
  message: string;
}

export type AttemptResult = AttemptSuccess | AttemptFailure;
