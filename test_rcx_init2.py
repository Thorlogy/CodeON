import urllib.request
import json

try:
    req = urllib.request.Request('http://localhost:1999/rest/data/init', data=b'{"logData":{}, "data":{}}', headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read().decode())
        print("INIT RC:", res.get('rc'))
        print("server.properties:", res.get('server.properties'))
except Exception as e:
    print("ERROR:", e)
