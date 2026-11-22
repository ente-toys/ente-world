import {build} from 'esbuild';
import {furnitureDepth,usesFurnitureDepth} from '../src/rendering/pixi/furniture-depth.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf,prepareIslandMap} from '../src/world/island-maps.js';
import {createNavigation} from '../src/world/navigation.js';
import {propBodyPadding} from '../src/world/home/prop-outline-rules.js';
import {assertReachable} from './lib/audit-reachability.mjs';
const homeBundle=await build({entryPoints:['src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const homeProps=(await import('data:text/javascript;base64,'+Buffer.from(homeBundle.outputFiles[0].text).toString('base64'))).createPlacements();
const bounds=o=>{const p=[o.poly,...(o.parts??[])].flat();return [Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0]))];};
test('furniture feet padding is small, while canopy body protection stays intact',()=>{
 assert.deepEqual(propBodyPadding({src:'/fountain-wishing.svg'}),{width:48,height:0});
 assert.deepEqual(propBodyPadding({src:'/oak.svg'}),{width:160,height:200});
 assert.deepEqual(propBodyPadding({src:'/street--lamp.svg'}),{width:48,height:0});
});
test('Home fountain has a local circuit and spawn connects north to market ground',async()=>{
 await assertReachable('home', [['west',2520,2320],['north',2820,2040],['east',3110,2280],['south',2820,2584],['north market',2820,1930],['stall customer front',2416,2090]]);
 const m=mapOf('home'),ring=[[2520,2320],[2820,2040],[3110,2280],[2820,2584]];
 for(let i=0;i<4;i++){
  const a=ring[i],b=ring[(i+1)%4],pad=128;
  const x=Math.min(a[0],b[0])-pad,y=Math.min(a[1],b[1])-pad;
  const n=createNavigation({...m.walk,origin:{x,y},width:Math.abs(a[0]-b[0])+2*pad,height:Math.abs(a[1]-b[1])+2*pad},{cellSize:16});
  const route=n.route(...a,...b);assert.ok(route.length,`ring quadrant ${i}`);
  assert.ok(Math.hypot(route.at(-1)[0]-b[0],route.at(-1)[1]-b[1])<2);
  let prev=a;for(const p of route){assert.ok(n.clearLine(prev,p));prev=p;}
 }
 assert.equal(m.nav().walkable(2820,2370),false,'fountain basin remains solid');
});
for(const id of ['home','isle-251','sunset','isle-250'])test(`${id} furniture masks stay within 30 units of visible sides`,async()=>{
 await prepareIslandMap(id);const m=mapOf(id);m.nav();let checked=0;
 for(const o of m.walk.obstacles.filter(o=>o.bodyBlock)){
  const art=m.walk.obstacles.find(a=>!a.bodyBlock&&a.prop===o.prop);if(!art)continue;
  // Canopy masks intentionally retain their original full-body clearance.
  const a=bounds(art),b=bounds(o);const p=(id==='home'?homeProps:m.world.props)?.find(p=>p.id===o.prop);
  if(p&&propBodyPadding(p).width===160)continue;
  if(o.name?.includes('body-notch'))continue;
  assert.ok(a[0]-b[0]<=30&&b[1]-a[1]<=30,`${o.prop}`);checked++;
 }
 assert.ok(checked>40,'whole-island furniture coverage');
});
test('Sunbob keeps its open plaza and has no oversized body masks',async()=>{
 await assertReachable('blossom',[['plaza west',3500,2600],['plaza east',4250,2600]]);
 assert.equal(mapOf('blossom').walk.obstacles.filter(o=>o.bodyBlock).length,0);
});


test('open furniture sides draw local and remote ducks in front, without changing canopy depth',()=>{
 const make=(src,x)=>({src,x,y:200,z:200,sortY:200,footprint:{poly:[[x-50,0],[x+50,0],[x+50,200],[x-50,200]]}});
 const props=[make('/street--lamp.svg',0),make('/oak.svg',500)];
 assert.ok(furnitureDepth(props,100,100)>200,'side duck in front of lamp');
 assert.equal(furnitureDepth(props,500,100),100,'tree canopy keeps depth');
 assert.equal(furnitureDepth(props,0,-1),-1,'north approach does not overlap art');
 assert.equal(furnitureDepth(props,1000,100),100,'distant duck keeps depth');
 assert.equal(furnitureDepth(props,100,100,900),900,'existing higher depth retained');
 assert.equal(usesFurnitureDepth('snow'),false);assert.equal(usesFurnitureDepth('bog-arena'),false);
});

test('Campfire plaza centre is open ground after the hearth was removed',async()=>{
 await prepareIslandMap('isle-250');const m=mapOf('isle-250'),n=m.nav();
 assert.ok(!m.walk.obstacles.some(o=>['campfire','log-west','log-east','log-south'].includes(o.prop)),'no hearth or log obstacles');
 assert.equal(n.walkable(4000,2600),true,'plaza centre is walkable');
 await assertReachable('isle-250',[['plaza centre',4000,2600]]);
});
test('home formerly padded 0 approach is reachable',()=>assertReachable('home',[['open approach',2534.78125,2540.40625]]));
test('isle-251 formerly padded lib-front-01 approach is reachable',()=>assertReachable('isle-251',[['open approach',2825.43515625,2885.1140625]]));
test('sunset formerly padded lamp-heart-3 approach is reachable',()=>assertReachable('sunset',[['open approach',3319.5810546875,3044.06937375]]));
test('isle-250 formerly padded campfire approach is reachable',()=>assertReachable('isle-250',[['open approach',3736.57415,2533.2980212390626]]));

test('isle-251 lib-globe has a local four-sided walking circuit',async()=>{
 await prepareIslandMap('isle-251');const m=mapOf('isle-251'),ring=[[2412,1915.7199999999998],[3037.5,2475.5424999999996],[2412,3035.365],[1786.5,2475.5424999999996]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],pad=400;
  const nav=createNavigation({...m.walk,origin:{x:Math.min(a[0],b[0])-pad,y:Math.min(a[1],b[1])-pad},width:Math.abs(a[0]-b[0])+2*pad,height:Math.abs(a[1]-b[1])+2*pad},{cellSize:16});
  const path=nav.route(...a,...b);assert.ok(path.length,'circuit quadrant '+i);
  assert.ok(Math.hypot(path.at(-1)[0]-b[0],path.at(-1)[1]-b[1])<2);
  let prev=a;for(const p of path){assert.ok(nav.clearLine(prev,p));prev=p;}
 }
});

test('sunset rosy-music-box has a local four-sided walking circuit',async()=>{
 await prepareIslandMap('sunset');const m=mapOf('sunset'),ring=[[3998.9453125,1885.92578125],[4296.90625,2384.384765625],[3998.9453125,2882.84375],[3700.984375,2384.384765625]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],pad=400;
  const nav=createNavigation({...m.walk,origin:{x:Math.min(a[0],b[0])-pad,y:Math.min(a[1],b[1])-pad},width:Math.abs(a[0]-b[0])+2*pad,height:Math.abs(a[1]-b[1])+2*pad},{cellSize:16});
  const path=nav.route(...a,...b);assert.ok(path.length,'circuit quadrant '+i);
  assert.ok(Math.hypot(path.at(-1)[0]-b[0],path.at(-1)[1]-b[1])<2);
  let prev=a;for(const p of path){assert.ok(nav.clearLine(prev,p));prev=p;}
 }
});

test('isle-250 campfire has a local four-sided walking circuit',async()=>{
 await prepareIslandMap('isle-250');const m=mapOf('isle-250'),ring=[[4000,2373.2980212390626],[4246.455859375,2536.8390225671874],[4000,2700.3800238953127],[3753.544140625,2536.8390225671874]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],pad=400;
  const nav=createNavigation({...m.walk,origin:{x:Math.min(a[0],b[0])-pad,y:Math.min(a[1],b[1])-pad},width:Math.abs(a[0]-b[0])+2*pad,height:Math.abs(a[1]-b[1])+2*pad},{cellSize:16});
  const path=nav.route(...a,...b);assert.ok(path.length,'circuit quadrant '+i);
  assert.ok(Math.hypot(path.at(-1)[0]-b[0],path.at(-1)[1]-b[1])<2);
  let prev=a;for(const p of path){assert.ok(nav.clearLine(prev,p));prev=p;}
 }
});

test('isle-250 events-stage has a local four-sided walking circuit',async()=>{
 await prepareIslandMap('isle-250');const m=mapOf('isle-250'),ring=[[4001.62109375,1096.5703125],[4420.8515625,1214.5703125],[4001.62109375,1332.5703125],[3582.390625,1214.5703125]];
 for(let i=0;i<4;i++){const a=ring[i],b=ring[(i+1)%4],pad=400;
  const nav=createNavigation({...m.walk,origin:{x:Math.min(a[0],b[0])-pad,y:Math.min(a[1],b[1])-pad},width:Math.abs(a[0]-b[0])+2*pad,height:Math.abs(a[1]-b[1])+2*pad},{cellSize:16});
  const path=nav.route(...a,...b);assert.ok(path.length,'circuit quadrant '+i);
  assert.ok(Math.hypot(path.at(-1)[0]-b[0],path.at(-1)[1]-b[1])<2);
  let prev=a;for(const p of path){assert.ok(nav.clearLine(prev,p));prev=p;}
 }
});

test('Campfire cable and stage roof leave ground open while the light-pole foot stays solid',async()=>{
 await assertReachable('isle-250',[['under suspended cable',4000,2400],['behind stage base',4000,1000]]);
 assert.equal(mapOf('isle-250').nav().walkable(3688,2420),false,'pole foot remains solid');
});
