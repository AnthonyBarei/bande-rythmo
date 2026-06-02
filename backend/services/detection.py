"""Phonetic sign classifier for the détection layer (BR pro).

Mirror of `frontend/src/detection.js`. Live aid only — persisted `signs`
in the words JSON always win; this is called to fill the gap when none.

Sign families (French détection-doublage convention):
- labiale   B, P, M     — lip closure
- semi      W            — semi-vowel labial
- fricative F, V         — labio-dental friction
- arrondie  O, U, OU, Œ  — rounded "cul-de-poule"
- ouverte   A, E, I, Y…  — open vowels (off by default — rest state)
"""

_LABIALE = set("bpm")
_SEMI = set("w")
_FRICATIVE = set("fv")
_ARRONDIE = set("ouœ")
_OUVERTE = set("aàâeéèêiîy")


def classify_char(ch: str):
    if not ch:
        return None
    c = ch.lower()
    if c in _LABIALE:
        return "labiale"
    if c in _SEMI:
        return "semi"
    if c in _FRICATIVE:
        return "fricative"
    if c in _ARRONDIE:
        return "arrondie"
    if c in _OUVERTE:
        return "ouverte"
    return None
