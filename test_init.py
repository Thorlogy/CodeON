import urllib.request
import json

url = 'http://localhost:1999/rest/init'
data = {
    "data": {
        "cmd": "init",
        "DeviceType": "Computer",
        "OS": "Mac OS X",
        "CountryCode": "ZZ",
        "ScreenSize": "[1792,998]",
        "Browser": "CHROME15/150.0.0.0"
    },
    "log": []
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        resp_data = response.read().decode('utf-8')
        resp_json = json.loads(resp_data)
        
        robots = resp_json.get('server', {}).get('robots', [])
        print(json.dumps(robots, indent=2))
except Exception as e:
    print("Error:", e)
