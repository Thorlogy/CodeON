import urllib.request
import json

try:
    req2 = urllib.request.Request('http://localhost:1999/rest/admin/setRobot', data=b'{"cmd":"setRobot","robot":"rcx"}', headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req2) as r2:
        res2 = json.loads(r2.read().decode())
        print(json.dumps(res2, indent=2))
except Exception as e:
    print("ERROR:", e)
