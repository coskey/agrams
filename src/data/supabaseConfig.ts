// Supabase connection for word-feedback recording.
// Project: orchids-crimson-river (psuntcdcmhfwkofiyhjm).
// The anon key is a public, client-side key by design; row-level security on the
// word_feedback table allows anonymous INSERT only (no read), so it is safe to
// ship in the browser bundle.
export const SUPABASE_URL = "https://psuntcdcmhfwkofiyhjm.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzdW50Y2RjbWhmd2tvZml5aGptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUwMjYsImV4cCI6MjA5ODQxMTAyNn0.V4_Xnm7ECgG4pjBVamL4IqSUEOQWh4o2NWuG0nlQQlI";
export const FEEDBACK_TABLE = "word_feedback";
