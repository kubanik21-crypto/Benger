#!/usr/bin/env python3
"""Offline check of documentation fixtures, NOT an importer. Requires Python jsonschema.
No app storage, network, Google credentials or repository writes are used.
"""
import copy, datetime as dt, hashlib, json, pathlib
from jsonschema import Draft202012Validator, FormatChecker
ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
schema = json.loads((ROOT / 'training-plan-import.schema.json').read_text())
Draft202012Validator.check_schema(schema)
formats = FormatChecker()
# jsonschema may omit date-time without optional RFC3339 dependencies. Check it
# explicitly using stdlib; the schema separately enforces the UTC/T/millisecond profile.
@formats.checks('date-time', raises=(ValueError, TypeError))
def timestamp(value):
    if not isinstance(value, str): return True
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).tzinfo is not None
validator = Draft202012Validator(schema, format_checker=formats)
assert {'date','date-time'} <= set(validator.format_checker.checkers)
catalog = json.loads((ROOT / 'training-exercise-catalog.json').read_text())
builtin = {e['id']: e for e in catalog['exercises']}
expect = json.loads((HERE / 'expected-validation.json').read_text())

def semantic_errors(p):
    errors = set()
    def unique(rows, code):
        ids = [r['id'] for r in rows]
        if len(ids) != len(set(ids)): errors.add(code)
    unique(p['sessions'], 'duplicate-session-id')

    keys=[(e['id'],e['version']) for e in p['exerciseDefinitions']]
    if len(keys)!=len(set(keys)): errors.add('duplicate-exercise-version')
    a, b = [dt.date.fromisoformat(p['block'][k]) for k in ('from', 'to')]
    weeks = ((b-dt.timedelta(days=b.weekday()))-(a-dt.timedelta(days=a.weekday()))).days//7+1
    if b<a or (b-a).days>111 or weeks!=p['block']['weekCount']: errors.add('block-range')
    if any(w>weeks for w in p['block']['deloadWeeks']): errors.add('deload-week')
    if set(p['requiredCapabilities'])-{'training-core-v1','planned-targets-v1'}: errors.add('unsupported-capability')
    definitions = {(e['id'],e['version']): e for e in p['exerciseDefinitions']}
    def exercise(ref):
        e = builtin.get(ref.get('builtinId')) if 'builtinId' in ref else definitions.get((ref['externalId'],ref['version']))
        if not e: errors.add('unknown-exercise-id'); return None
        if 'externalId' in ref and e['version']!=ref['version']: errors.add('exercise-version')
        if e['mode']!=ref['expectedMode'] or e['dumbbells']!=ref['expectedDumbbells']: errors.add('exercise-signature')
        return e
    for s in p['sessions']:
        if not a<=dt.date.fromisoformat(s['date'])<=b: errors.add('session-outside-block')
        unique(s['items'],'duplicate-item-id')
        for item in s['items']:
            e=exercise(item['exercise']); d=item['prescription']
            for alt in d['alternatives']: exercise(alt)
            if d['repsMin'] is not None and d['repsMax'] is not None and d['repsMin']>d['repsMax']: errors.add('reps-range')
            if not e: continue
            if (e['mode']=='mobility') != (s['kind']=='mobility'): errors.add('session-kind')
            if e['mode']=='mobility' and item['setKind'] is not None or e['mode']!='mobility' and item['setKind'] is None: errors.add('set-kind')
            load=d['load']
            if load is not None:
                if e['mode']=='strength' and (e['dumbbells'] not in (1,2) or load['basis']!='per-dumbbell' or load['value']>40): errors.add('unsupported-dumbbell-load')
                if e['mode']=='bodyweight' and (load['basis']!='additional-load' or load['value']>200): errors.add('unsupported-bodyweight-load')
                if e['mode'] in ('time','cardio','mobility'): errors.add('unsupported-load-mode')
            if d['cardio'] is not None and e['mode']!='cardio': errors.add('cardio-mode')
            if d['cardio'] and d['cardio']['speedKmH'] is not None and d['cardio']['paceSecondsPerKm'] is not None: errors.add('ambiguous-cardio-target')
    return errors

for name in expect['schemaValid']:
    value=json.loads((HERE/name).read_text()); errors=list(validator.iter_errors(value)); assert not errors,(name,[e.message for e in errors])
format_bad=json.loads((HERE/'valid-minimal.json').read_text());format_bad['sessions'][0]['date']='2026-02-30'
assert list(validator.iter_errors(format_bad))
format_bad=json.loads((HERE/'valid-minimal.json').read_text());format_bad['createdAt']='2026-13-28T00:00:00Z'
assert list(validator.iter_errors(format_bad))
for name in expect['schemaInvalid']:
    assert list(validator.iter_errors(json.loads((HERE/name).read_text()))),name
for name in expect['semanticValid']:
    assert not semantic_errors(json.loads((HERE/name).read_text())),name
for name, codes in expect['semanticInvalid'].items():
    actual=semantic_errors(json.loads((HERE/name).read_text())); assert set(codes)<=actual,(name,actual)

# Distinct immutable definition versions can coexist to pin older sessions.
multi=json.loads((HERE/'mobility.json').read_text()); definition=copy.deepcopy(multi['exerciseDefinitions'][0]);definition['version']=2;definition['technique']='Inna wersja opisu testowego';multi['exerciseDefinitions'].append(definition)
unit=copy.deepcopy(multi['sessions'][0]);unit['id']='mobility-002';unit['date']='2026-12-04';unit['items'][-1]['exercise']['version']=2;multi['sessions'].append(unit)
assert not list(validator.iter_errors(multi)) and not semantic_errors(multi)
multi['exerciseDefinitions'].append(copy.deepcopy(multi['exerciseDefinitions'][0]));assert 'duplicate-exercise-version' in semantic_errors(multi)

first=json.loads((HERE/'month-v1.json').read_text()); second=json.loads((HERE/'month-v2-week-update.json').read_text())
a={s['id']:s for s in first['sessions']}; b={s['id']:s for s in second['sessions']}
assert a.keys()==b.keys()
changed=[key for key in a if a[key]!=b[key]]
assert len(changed)==4 and all('2026-12-07'<=a[k]['date']<='2026-12-13' and b[k]['version']==a[k]['version']+1 for k in changed)
assert second['block']['version']==first['block']['version']+1
pub=json.loads((HERE/'sheets-publication.json').read_text()); manifest=pub['grid'][1]; chunks=pub['grid'][2:]
assert pub['tab']=='BENGER_TRAINING_PLANS' and manifest[3]=='READY' and len(chunks)==manifest[10]
assert sorted(c[11] for c in chunks)==list(range(1,len(chunks)+1))
assert all(len(c[12].encode('utf-16-le'))//2<=20000 for c in chunks)
raw=''.join(c[12] for c in sorted(chunks,key=lambda c:c[11])); assert raw==(HERE/'month-v1.json').read_text()
assert hashlib.sha256(raw.encode()).hexdigest()==manifest[13]
assert json.loads(raw)['sessions']==first['sessions'] and manifest[9]==len(first['sessions'])
# Negative transport checks: truncation and a one-character change cannot pass the original manifest.
assert len(chunks[:-1])!=manifest[10]
assert hashlib.sha256((raw+' ').encode()).hexdigest()!=manifest[13]
print(json.dumps({'schema':'Draft 2020-12; format checks on','schemaPositiveFixtures':len(expect['schemaValid']),'schemaNegativeFixtures':len(expect['schemaInvalid']),'semanticPositiveFixtures':len(expect['semanticValid']),'semanticNegativeFixtures':len(expect['semanticInvalid']),'catalogBuiltins':len(builtin),'monthlySessions':len(first['sessions']),'changedWeek2Sessions':changed,'chunks':len(chunks),'sha256Verified':True,'truncationAndTamperRejected':True,'writesToAppOrGoogle':0},ensure_ascii=False,indent=2))
