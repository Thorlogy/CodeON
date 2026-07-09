const fetch = require('node-fetch');

async function test() {
    const res = await fetch('http://localhost:1999/rest/admin/setRobot', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            cmd: "setRobot",
            robot: "rcx",
            extensions: {}
        })
    });
    const json = await res.json();
    console.log("configurationUsed:", json.configurationUsed);
    console.log("JSON:", JSON.stringify(json, null, 2));
}

test();
