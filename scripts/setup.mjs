import {existsSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'backend/.env');
if(existsSync(file)){console.log('backend/.env already exists. No configuration was changed.');process.exit(0);}
let text=readFileSync(path.join(root,'backend/.env.example'),'utf8');
text=text.replace('CHANGE_AUTH_SECRET',randomBytes(48).toString('hex')).replace('CHANGE_QR_SECRET',randomBytes(48).toString('hex'));
writeFileSync(file,text,{mode:0o600});
console.log('Created backend/.env with independent random signing secrets. Set MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, and optional DEMO_PASSWORD before continuing.');
