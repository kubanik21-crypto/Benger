#!/usr/bin/env python3
"""Offline helper: recipe-package JSON v1 -> typed Sheets rows and CSV. Never calls Google."""
import argparse,csv,hashlib,json,datetime
from pathlib import Path
COLUMNS=['schema_version','package_id','record_type','status','published_at','week_from','week_to','namespace','label','recipe_count','chunk_count','chunk_index','payload_json','content_sha256']
def main():
 p=argparse.ArgumentParser();p.add_argument('input');p.add_argument('--package-id',required=True);p.add_argument('--from',dest='start',required=True);p.add_argument('--to',dest='end',required=True);p.add_argument('--output',default='publication');args=p.parse_args()
 data=json.loads(Path(args.input).read_bytes().decode('utf-8'));assert data['format']=='benger.recipe-package' and data['schemaVersion']==1 and 1<=len(data['recipes'])<=50 and data.get('label')
 assert 0<=(datetime.date.fromisoformat(args.end)-datetime.date.fromisoformat(args.start)).days<=6
 import re
 assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}',args.package_id)
 raw=json.dumps(data,ensure_ascii=False,separators=(',',':'));assert len(raw.encode('utf-8'))<=2*1024*1024
 chunks=[];part='';units=0
 for char in raw:
  size=len(char.encode('utf-16-le'))//2
  if units+size>20000:chunks.append(part);part='';units=0
  part+=char;units+=size
 if part:chunks.append(part)
 published=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
 digest=hashlib.sha256(raw.encode('utf-8')).hexdigest()
 manifest=[1,args.package_id,'MANIFEST','DRAFT',published,args.start,args.end,data['namespace'],data['label'],len(data['recipes']),len(chunks),'','',digest]
 rows=[COLUMNS,manifest]+[[1,args.package_id,'CHUNK','','','','','','','','',i+1,c,''] for i,c in enumerate(chunks)]
 out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 (out/'rows.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 with (out/'BENGER_IMPORT.csv').open('w',encoding='utf-8',newline='') as f:csv.writer(f,lineterminator="\n").writerows(rows)
 print('Prepared DRAFT. Validate JSON v1, write with RAW cell types, verify chunks/hash, then set manifest status READY last.')
if __name__=='__main__':main()
