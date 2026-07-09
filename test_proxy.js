const fs = require('fs');
const content = fs.readFileSync('OpenRobertaServer/staticResources/js/main.js', 'utf8');
console.log(content.substring(0, 1000));
