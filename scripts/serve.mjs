import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { businessPath, serveBusiness } from './udemy-business.mjs';

const root = resolve('out');
const port = Number(process.env.PORT ?? 3000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
if (!existsSync(resolve(root,'index.html'))) {
  console.error('Build the application first with npm run build.');
  process.exit(1);
}

createServer(async (request, response) => {
  if(request.url?.split('?')[0]===businessPath){
    await serveBusiness(request,response,port);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {Allow:'GET, HEAD'}).end();
    return;
  }
  let path;
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    path = resolve(root, '.' + pathname);
    if (path !== root && !path.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
  } catch {
    response.writeHead(400).end();
    return;
  }

  let status = 200;
  try {
    if ((await stat(path)).isDirectory()) path = resolve(path,'index.html');
    if (!(await stat(path)).isFile()) throw new Error('File unavailable');
  } catch {
    path = resolve(root,'404.html');
    status = 404;
  }
  response.writeHead(status,{
    'Content-Type':request.headers.rsc==='1'&&extname(path)==='.txt'
      ? 'text/x-component; charset=utf-8'
      : types[extname(path)] ?? 'application/octet-stream',
    'X-Content-Type-Options':'nosniff',
  });
  if (request.method === 'HEAD') response.end();
  else createReadStream(path).on('error',()=>response.end()).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log('AI Career OS production preview at http://127.0.0.1:'+port));
