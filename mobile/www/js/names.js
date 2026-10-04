// Fighter-name matching shared by every screen.
//
// WHY THIS EXISTS: a fighter's display name is NOT a stable identity. ESPN
// ("Roberto Soldić", "Natalia Silva", "Rafael Dos Anjos", "King Green"), the odds
// feed and our own card ("Roberto Soldic", "Natália Silva", "Rafael dos Anjos",
// "Bobby Green") spell the same person differently, and a pick is saved under the
// name on the card AT PICK TIME. Comparing names with === made every one of those
// fights silently fail: UFC 332 showed BOTH fighters as losers in two bouts (the
// winner string matched neither side) and four saved picks vanished from Pick'em.
// The website already compared loosely (index.html pkNameEq); the app did not.
//
// Rules: never use === on a display name. Resolve a name to a SIDE of one bout
// (side()) or match two bouts as pairs (samePair()). Both are safe to use because
// they only ever compare a name against the two fighters of a single bout, so a
// shared surname elsewhere on the card ("Natalia Silva" / "Karine Silva") can't
// cross-match.
(function(){
  var SUFFIX = /\b(jr|sr|iv|iii|ii|v)\b/g;
  // accents stripped, lower-cased, suffix + punctuation dropped: "Soldić" -> "soldic",
  // "Dos Anjos" == "dos Anjos", "Raul Rosas Jr." == "Raul Rosas"
  function norm(s){
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(SUFFIX, ' ').replace(/[^a-z0-9]+/g, '');
  }
  function last(s){
    var t = String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(SUFFIX, ' ').replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
    return t.length ? t[t.length - 1] : '';
  }
  // Which fighter of THIS bout is `name`? 1 / 2 / 0 (neither, or ambiguous).
  // Full normalized name first; then surname, but only when exactly one fighter
  // in the bout has that surname (covers a rename like "Bobby Green" -> "King Green").
  function side(name, f1, f2){
    var n = norm(name), n1 = norm(f1), n2 = norm(f2);
    if (!n) return 0;
    if (n === n1 && n !== n2) return 1;
    if (n === n2 && n !== n1) return 2;
    var l = last(name), l1 = last(f1), l2 = last(f2);
    if (l.length >= 3) {
      if (l === l1 && l !== l2) return 1;
      if (l === l2 && l !== l1) return 2;
    }
    return 0;
  }
  // Is (a1,a2) the same pairing as (b1,b2), in either order?
  function samePair(a1, a2, b1, b2){
    var s1 = side(a1, b1, b2), s2 = side(a2, b1, b2);
    return !!s1 && !!s2 && s1 !== s2;
  }
  window.GL_NAMES = { norm: norm, last: last, side: side, samePair: samePair };
})();
