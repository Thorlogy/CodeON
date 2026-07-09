const http = require('http');

const data = JSON.stringify({
    cmd: "loadT",
    name: "beginner",
    owner: "Roberta",
    robot: "rcx"
});

const req = http.request('http://localhost:1999/rest/toolbox', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, '\nBODY:', body.substring(0, 1000)));
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
