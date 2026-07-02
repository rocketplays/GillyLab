#!/usr/bin/env python3
"""Apply recomputed full-career box-score stats (data/_veteran_stats.json) to the
9 box-score FIGHTER_STATS fields in index.html. Updates a field ONLY when its
value actually changed (numeric compare for slpm/sapm/kd/tdLanded/subAvg, string
compare for the % fields) so formatting-only diffs and already-correct fighters
are left untouched. Bio + finRate/streak are never touched.
"""
import os, re, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
CACHE = os.path.join(ROOT, "data", "_veteran_stats.json")
NUM = ["slpm", "sapm", "kd", "tdLanded", "subAvg"]
PCT = ["strAcc", "strDef", "tdAcc", "tdDef"]

def num_eq(cur, new):
    if cur is None or new is None: return cur == new
    try: return abs(float(cur) - float(new)) < 1e-9
    except Exception: return str(cur) == str(new)

def main():
    cache = json.load(open(CACHE))
    h = open(INDEX).read()
    changed_fighters = 0; changed_fields = 0; skipped = 0
    for name, st in cache.items():
        if not st: continue
        pat = re.compile(r'("%s": \{)([^}]*)(\})' % re.escape(name))
        m = pat.search(h)
        if not m:
            skipped += 1; continue
        inner = m.group(2); orig = inner; nf = 0
        for k in NUM:
            new = st.get(k)
            if new is None: continue
            cm = re.search(r'\b%s:(null|-?[0-9.]+)' % k, inner)
            if not cm: continue
            cur = None if cm.group(1) == "null" else cm.group(1)
            if not num_eq(cur, new):
                inner = inner[:cm.start()] + "%s:%s" % (k, new) + inner[cm.end():]; nf += 1
        for k in PCT:
            new = st.get(k)
            if new is None: continue
            cm = re.search(r'%s:(null|"[^"]*")' % k, inner)
            if not cm: continue
            cur = None if cm.group(1) == "null" else cm.group(1).strip('"')
            if cur != new:
                inner = inner[:cm.start()] + '%s:"%s"' % (k, new) + inner[cm.end():]; nf += 1
        if nf:
            h = h[:m.start(2)] + inner + h[m.end(2):]
            changed_fighters += 1; changed_fields += nf
    open(INDEX, "w").write(h)
    print("fighters updated: %d | fields changed: %d | not found in FIGHTER_STATS: %d"
          % (changed_fighters, changed_fields, skipped))

if __name__ == "__main__":
    main()
