// Records "is this a valid root/steal?" feedback. Writes to Supabase when
// configured; otherwise keeps entries in localStorage so nothing is lost.

import { SUPABASE_URL, SUPABASE_ANON_KEY, FEEDBACK_TABLE } from "./supabaseConfig";

export type FeedbackKind = "feedback" | "challenge";

export interface FeedbackRecord {
  original: string;
  created: string;
  okay: boolean;
  note?: string;
  /** "feedback" (the form) or "challenge" (an in-game challenge). */
  kind?: FeedbackKind;
}

interface Payload {
  original_word: string;
  new_word: string;
  is_okay: boolean;
  note: string | null;
  source: string;
  kind: FeedbackKind;
}

function toPayload(rec: FeedbackRecord): Payload {
  return {
    original_word: rec.original.trim().toUpperCase(),
    new_word: rec.created.trim().toUpperCase(),
    is_okay: rec.okay,
    note: rec.note?.trim() || null,
    source: "web",
    kind: rec.kind ?? "feedback",
  };
}

function saveLocally(payload: Payload): void {
  try {
    const key = "agrams:feedback";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({ ...payload, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* ignore unavailable storage */
  }
}

export async function recordFeedback(
  rec: FeedbackRecord,
): Promise<{ ok: boolean; message: string }> {
  const payload = toPayload(rec);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    saveLocally(payload);
    return { ok: true, message: "Saved (offline). Supabase not connected yet." };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${FEEDBACK_TABLE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      saveLocally(payload);
      return { ok: false, message: `Could not save to Supabase (${res.status}).` };
    }
    return { ok: true, message: "Thanks — feedback recorded." };
  } catch {
    saveLocally(payload);
    return { ok: false, message: "Network error; saved locally instead." };
  }
}
