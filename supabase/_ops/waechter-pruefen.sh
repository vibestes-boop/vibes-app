#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Prüft den Wächter auf `profiles` — den Fix gegen die Selbst-Beförderung zum
# Admin (Migration 20260822150000, Übergabe Abschnitt 73).
#
# WARUM ES DIESES SKRIPT GIBT
# Der Wächter blockt nur CLIENT-Rollen (`anon`, `authenticated`). Mit dem
# service_role-Schlüssel kommt man absichtlich durch — der Betreiber soll
# Rechte vergeben können. Der Beweis, dass er greift, braucht deshalb eine
# ECHTE ANMELDUNG, und die kann kein Assistent führen.
#
# WAS ES TUT
#   1. meldet dich an (Passwort wird unsichtbar eingelesen, nie ausgegeben)
#   2. liest deine Rechte-Spalten VORHER
#   3. versucht, dir `is_moderator` zu setzen  ← der Angriff
#   4. liest sie NACHHER
#
# ⚠️ Geprüft wird `is_moderator`, NICHT `is_admin`. Grund: Wenn du schon Admin
#    bist, wäre `is_admin: true` gar keine Änderung — der Wächter liesse es
#    durch, und der Test sagte „offen", obwohl er hält. `is_moderator` steht
#    bei dir auf `false`, die Änderung ist also echt.
#
# AUFRUF (aus dem Projektordner):
#   bash supabase/_ops/waechter-pruefen.sh
# ─────────────────────────────────────────────────────────────────────────────
set -u

cd "$(dirname "$0")/../.." || exit 1
set -a; . apps/berkat/.env; set +a
U="$EXPO_PUBLIC_SUPABASE_URL"; K="$EXPO_PUBLIC_SUPABASE_ANON_KEY"

read -r -p "E-Mail: " EM
read -r -s -p "Passwort: " PW; echo

TOK=$(curl -s -X POST "$U/auth/v1/token?grant_type=password" \
  -H "apikey: $K" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EM\",\"password\":\"$PW\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.access_token||'')}catch(e){console.log('')}})")
PW=""

if [ -z "$TOK" ]; then
  echo "❌ Anmeldung fehlgeschlagen — E-Mail oder Passwort stimmt nicht."
  exit 1
fi

ID=$(curl -s "$U/auth/v1/user" -H "apikey: $K" -H "Authorization: Bearer $TOK" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch(e){console.log('')}})")

echo
echo "── VORHER ─────────────────────────────────"
curl -s "$U/rest/v1/profiles?id=eq.$ID&select=username,is_admin,is_moderator" \
  -H "apikey: $K" -H "Authorization: Bearer $TOK"
echo
echo "── ANGRIFF: is_moderator auf true setzen ──"
CODE=$(curl -s -o /tmp/wp.json -w "%{http_code}" -X PATCH "$U/rest/v1/profiles?id=eq.$ID" \
  -H "apikey: $K" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"is_moderator":true}')
echo "HTTP $CODE"
cat /tmp/wp.json; echo
echo
echo "── NACHHER ────────────────────────────────"
curl -s "$U/rest/v1/profiles?id=eq.$ID&select=username,is_admin,is_moderator" \
  -H "apikey: $K" -H "Authorization: Bearer $TOK"
echo; echo
rm -f /tmp/wp.json; TOK=""

echo "═══════════════════════════════════════════"
echo "SO MUSS ES AUSSEHEN:"
echo "  • HTTP 4xx (403 oder 400)"
echo "  • eine Meldung mit: is_moderator darf nicht vom Client geaendert werden"
echo "  • VORHER und NACHHER zeigen beide  \"is_moderator\":false"
echo
echo "WENN STATTDESSEN HTTP 204 UND NACHHER \"is_moderator\":true STEHT,"
echo "ist der Waechter wirkungslos — dann sofort Bescheid geben."
echo "═══════════════════════════════════════════"
