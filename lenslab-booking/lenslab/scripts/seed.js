// Optional: node scripts/seed.js  → creates indexes + the 4 starter cameras (the site also does this by itself on first visit).
const fs=require('fs'),path=require('path');
for(const f of ['.env.local','.env']){const p=path.join(__dirname,'..',f);if(fs.existsSync(p))for(const l of fs.readFileSync(p,'utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')}}
require('../lib/store').db().then(async d=>{console.log('Ready. Cameras:',await d.collection('cameras').countDocuments());process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)});
