import urllib.request
import json

try:
    req2 = urllib.request.Request('http://localhost:1999/rest/conf/setRobot', data=b'{"cmd":"setRobot","robot":"rcx"}', headers={'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req2) as r2:
        res2 = json.loads(r2.read().decode())
        print("SET ROBOT RC:", res2.get('rc'))
        print("ROBOT INFO:", list(res2.get('robot.info', {}).keys()))
        print("CONF XML:", res2.get('robot.info', {}).get('configurationStandard', 'MISSING')[:200])

except Exception as e:
    print("ERROR:", e)
