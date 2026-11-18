import json
from dotenv import load_dotenv
load_dotenv()
from review import review
 
kb = json.load(open("seed/greenbrew.json", encoding="utf-8"))
tp = fp = fn = 0
for s in kb["samples"]:
    res = review(s["text"], kb, s.get("meta", {}))
    got = {f["rule_id"] for f in res["findings"]}
    exp = set(s["expected"])
    tp += len(got & exp); fp += len(got - exp); fn += len(exp - got)
    print(f'{s["name"]:<18} expected {sorted(exp)} got {sorted(got)}')
print(f"recall={tp / max(tp + fn, 1):.2f} precision={tp / max(tp + fp, 1):.2f}")