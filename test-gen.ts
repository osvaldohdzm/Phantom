import { generateHTML } from './src/app/(secops)/tools/exposure/html-template';

const html = generateHTML({ hosts: [], vulnerabilities: [] }, { title: 'Test', date: '2023' }, '/* vis.js */');
const fs = require('fs');
fs.writeFileSync('test.html', html);
