"""Validate a CEPAL II accounting file without changing the original inventory."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cepal import evaluate

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input', type=Path, default=Path('data/evaluacion_cepal.json'))
    ap.add_argument('--out', type=Path)
    args = ap.parse_args()
    result = evaluate(json.loads(args.input.read_text(encoding='utf-8')))
    if args.out:
        args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'accepted': len(result['records']),
                      'excluded': len(result['issues']), 'deduplicated': result['deduplicated']}))
    sys.exit(1 if result['issues'] else 0)
