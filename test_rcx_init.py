import urllib.request
import json

try:
    req = urllib.request.Request('http://localhost:1999/rest/data/init', data=b'{"cmd":"init","logData":{"robot":"rcx"}, "data":{"robot":"rcx"}}', headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read().decode())
        print("INIT RC:", res.get('rc'))
        print("CONF XML:", res.get('confXML', 'MISSING')[:200])
except Exception as e:
    print("ERROR:", e)
