import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('dist/client');
const sw=await readFile(path.join(root,'sw.js'),'utf8');
const assets=JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const html=await readFile(path.join(root,'index.html'),'utf8');
const origin='https://pcb.example.test';
const builtManifest=JSON.parse(await readFile(path.join(root,'pcb-k.webmanifest'),'utf8'));
const basePath=builtManifest.scope==='/'?'':builtManifest.scope.replace(/\/$/,'');
const rootRoute=basePath||'/';
const rootAsset=basePath?`${basePath}/`:'/';
const pcbRoute=`${basePath}/pcb-k`;
const pcbAsset=`${basePath}/pcb-k/`;
const installV3Route=`${basePath}/install-v3`;
const installV3Asset=`${basePath}/install-v3/`;
const installRoute=`${basePath}/install-v4`;
const installAsset=`${basePath}/install-v4/`;
const withBase=(pathname)=>`${basePath}${pathname}`;
async function assetFile(asset) {
  if(asset===rootAsset||asset===rootRoute) return path.join(root,'index.html');
  if(asset===pcbAsset||asset===pcbRoute) {
    const directoryPage=path.join(root,'pcb-k/index.html');
    try { await access(directoryPage);return directoryPage; }
    catch { return path.join(root,'pcb-k.html'); }
  }
  if(asset===installV3Asset||asset===installV3Route) return path.join(root,'install-v3/index.html');
  if(asset===installAsset||asset===installRoute) return path.join(root,'install-v4/index.html');
  const relative=basePath&&asset.startsWith(basePath)?asset.slice(basePath.length):asset;
  return path.join(root,relative.replace(/^\//,''));
}

test('installable manifest and iOS metadata use the PCB wordmark',async()=>{
  const manifest=builtManifest;
  assert.equal(manifest.name,'pcb-k計算');assert.equal(manifest.short_name,'pcb-k計算');assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,rootAsset);
  assert.equal(manifest.id,rootAsset);assert.equal(new URL(manifest.start_url,origin).pathname,installAsset);
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="pcb-k計算"/);
  assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes"/);
  const manifestLinks=html.match(/<link\b[^>]*rel="manifest"[^>]*>/g);
  assert.equal(manifestLinks.length,1);
  assert.ok(manifestLinks[0].includes(`href="${withBase('/pcb-k.webmanifest')}"`));
  assert.match(manifestLinks[0],/crossorigin="use-credentials"/i);
  const embeddedApple=html.match(/<link rel="apple-touch-icon" href="data:image\/png;base64,([^"]+)"/);
  assert.ok(embeddedApple,'iOS icon must not need a separate authenticated download');
  assert.match(html,/>54\.14<\/output>/);assert.match(html,/>0\.391<\/output>/);
  assert.ok(!html.includes('Starter Project'));
  assert.match(html,/<meta property="og:image" content="https:\/\/[^\"]+\/og\.png"/);
  assert.match(html,/<meta name="twitter:image" content="https:\/\/[^\"]+\/og\.png"/);
  for(const icon of manifest.icons){
    assert.match(icon.src,/^icons\/pcb-(?:192|512|maskable)-v4\.png$/);
    const data=await readFile(path.join(root,icon.src));
    assert.equal(data.subarray(1,4).toString(),'PNG');
    const size=icon.sizes.split('x').map(Number);
    assert.equal(data.readUInt32BE(16),size[0]);assert.equal(data.readUInt32BE(20),size[1]);
  }
  const apple=await readFile(path.join(root,'icons/pcb-apple-v4.png'));assert.equal(apple.readUInt32BE(16),180);
  assert.deepEqual(Buffer.from(embeddedApple[1],'base64'),apple);
  assert.deepEqual(await readFile(path.join(root,'apple-touch-icon.png')),apple);
  const installation=await readFile(await assetFile(pcbAsset),'utf8');
  assert.match(installation,/<title>pcb-k計算<\/title>/);
  assert.ok(installation.includes(embeddedApple[1]));
});

test('every emitted runtime script and stylesheet is in the offline shell',async()=>{
  const installation=await readFile(await assetFile(pcbAsset),'utf8');
  const referenced=new Set((html+installation).match(new RegExp(`${basePath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\/assets\\/[A-Za-z0-9_.-]+\\.(?:js|css)`,'g')));
  assert.ok(referenced.size>=3);
  for(const asset of referenced) assert.ok(assets.includes(asset),`Missing ${asset}`);
  for(const asset of assets) await readFile(await assetFile(asset));
});

function harness({badRoot=false,badRoute=rootAsset}={}) {
  const handlers=new Map();const stores=new Map();let online=true;let skipped=0;
  const caches={
    open:async(name)=>{if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return{
      put:async(key,value)=>map.set(typeof key==='string'?key:key.url,value.clone()),
      match:async(key)=>map.get(typeof key==='string'?key:key.url)?.clone(),
    };},
    keys:async()=>[...stores.keys()],delete:async(name)=>stores.delete(name),
  };
  const fetch=async(request)=>{
    if(!online)throw new Error('Offline');
    const pathname=new URL(typeof request==='string'?request:request.url,origin).pathname;
    if(badRoot && pathname===badRoute)return new Response('<html>Please sign in</html>',{headers:{'content-type':'text/html'}});
    const body=await readFile(await assetFile(pathname));
    const type=[rootAsset,pcbAsset,installV3Asset,installAsset].includes(pathname)?'text/html':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':pathname.endsWith('.jpeg')?'image/jpeg':pathname.endsWith('.svg')?'image/svg+xml':'application/json';
    return new Response(body,{headers:{'content-type':type}});
  };
  const scope={location:{origin},clients:{claim:async()=>{}},skipWaiting:()=>{skipped++;},addEventListener:(name,handler)=>handlers.set(name,handler)};
  function RelativeRequest(input,options){return new Request(new URL(input,origin),options);}
  vm.runInNewContext(sw,{self:scope,caches,fetch,Request:RelativeRequest,URL,Set,Promise,Error});
  return {
    stores,handlers,setOffline:()=>{online=false;},get skipped(){return skipped;},
    install:()=>{let pending;handlers.get('install')({waitUntil:(p)=>pending=p});return pending;},
    activate:()=>{let pending;handlers.get('activate')({waitUntil:(p)=>pending=p});return pending;},
    request:async(url,mode='navigate')=>{let response=null;handlers.get('fetch')({request:{url:new URL(url,origin).href,method:'GET',mode},respondWith:(p)=>response=p});return response;},
    ready:async()=>{let pending;let response;handlers.get('message')({data:{type:'CHECK_OFFLINE'},ports:[{postMessage:(data)=>response=data}],waitUntil:(p)=>pending=p});await pending;return response;},
  };
}

test('after installation the entire app shell and its scripts remain available offline',async()=>{
  const app=harness();await app.install();await app.activate();
  assert.equal((await app.ready()).ready,true);
  app.setOffline();const response=await app.request(`${rootAsset}?source=homescreen`);
  assert.equal(response.status,200);assert.match(await response.text(),/pcb-k計算/);
  for(const route of [`${pcbRoute}?source=homescreen`,pcbAsset,`${installV3Route}?source=homescreen`,installV3Asset,`${installRoute}?source=homescreen`,installAsset]) {
    const page=await app.request(route);assert.equal(page.status,200);assert.match(await page.text(),/pcb-k計算/);
  }
  for(const asset of assets.filter(a=>![rootAsset,pcbAsset,installV3Asset,installAsset].includes(a))) assert.equal((await app.request(asset,'cors')).status,200);
  const referenceFigures=['pcb-stackup-v1',... [3,4,5].map(number=>`pcb-table-${number}-v1`)];
  for(const [asset,type] of referenceFigures.flatMap(name=>[[withBase(`/examples/${name}.svg`),'image/svg+xml'],[withBase(`/examples/${name}.png`),'image/png']])) {
    const figure=await app.request(asset,'cors');
    assert.ok(figure,'The redrawn specification must be viewable offline');
    assert.equal(figure.headers.get('content-type'),type);
    assert.deepEqual(Buffer.from(await figure.arrayBuffer()),await readFile(await assetFile(asset)));
  }
  assert.deepEqual(Array.from((await app.ready()).routes),[rootRoute,pcbRoute,installV3Route,installRoute]);
  assert.equal(await app.request(withBase('/auth/callback')),null);
  assert.equal(await app.request(`${rootAsset}?_rsc=1`,'cors'),null);
  assert.equal(await app.request(`${pcbRoute}?_rsc=1`,'cors'),null);
  assert.equal(await app.request('https://elsewhere.example/test'),null);
  assert.equal(app.skipped,0);
});

test('a sign-in page cannot be mistaken for a cached app shell',async()=>{
  for(const badRoute of [rootAsset,pcbAsset,installV3Asset,installAsset]) {
    const app=harness({badRoot:true,badRoute});await assert.rejects(app.install(),/Invalid app shell/);
    assert.equal((await app.ready()).ready,false);
  }
});
