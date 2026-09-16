#!/usr/bin/env python3
"""Read-only source probe; no credentials, no data substitutions."""
import urllib.request, json, hashlib, re
from pathlib import Path
from datetime import datetime, timezone
URLS = {
 "naboo": "https://www.mapadelterremoto.com/datos/registro.json",
 "reps_metadata": "https://www.datos.gov.co/api/views/s2ru-bqt6.json",
 "reps_occupancy": "https://prestadores.minsalud.gov.co/habilitacion/capacidad_instalada_ocupacion.aspx",
 "ops_sitrep8": "https://www.paho.org/sites/default/files/2026/09/sitrep-8-colombia-sismo-11092026.pdf",
}
out={"checked":datetime.now(timezone.utc).isoformat(),"sources":{}}
for key,url in URLS.items():
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"TableroTerremoto-Auditoria/1.0"})
  with urllib.request.urlopen(req,timeout=40) as r: raw=r.read(15_000_000)
  item={"url":url,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()}
  if key=="naboo":
   data=json.loads(raw)
   pts=data.get("puntos",[])
   item.update(keys=list(data),points=len(pts))
   rows=[p for p in pts if p.get("tipo")=="HOSPITAL"]
   item["health_points"]=len(rows);item["sample"]=[{"code":r.get("codigo"),"name":r.get("direccion")} for r in rows[:2]]
   Path("experimentos/presion_salud").mkdir(parents=True,exist_ok=True)
   Path("experimentos/presion_salud/naboo_salud.json").write_text(json.dumps({"url":url,"checked":out["checked"],"sha256":item["sha256"],"rows":[{"code":r.get("codigo"),"municipality":r.get("municipio"),"department":r.get("departamento"),"name":r.get("direccion"),"classification":r.get("severidad"),"status":r.get("estado"),"evidence_ids":list(dict.fromkeys(e.get("fuenteId") for e in r.get("evidencias",[])))} for r in rows]},ensure_ascii=False,indent=2),encoding="utf-8")
   item["pressure_mentions_count"]=sum(bool(re.search(r"ocupa|satura|camas|cierre",json.dumps(p),re.I)) for p in rows)
  elif key=="reps_metadata":
   data=json.loads(raw);item["name"]=data.get("name");item["columns"]=[c["fieldName"] for c in data.get("columns",[])];item["modified"]=data.get("rowsUpdatedAt")
  elif key=="ops_sitrep8":
   from pypdf import PdfReader
   import io
   text="\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(raw)).pages)
   item["passages"]=[text[max(0,m.start()-100):m.end()+400] for m in re.finditer(r"ocupaci|hospitalaria|camas|presi.n",text,re.I)][:20]
  else:
   txt=raw.decode("utf-8",errors="replace")
   item["login_required"]="contrase" in txt.lower()
  out["sources"][key]=item
 except Exception as e: out["sources"][key]={"url":url,"error":str(e)}
Path("experimentos/presion_salud").mkdir(parents=True,exist_ok=True)
Path("experimentos/presion_salud/fuentes_consultadas.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(out,ensure_ascii=False)[:23000])
