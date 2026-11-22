import {readyTexture} from './ready-texture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap} from '../src/world/island-maps.js';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
import {tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {outsideStageProps,clearedStageFlat,stageEditedIds,walkEditedPositions,removedHearth as REMOVED_HEARTH} from './campfire-stage-scope.mjs';
import {Container,ImageSource,Texture} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {attachCentreMotion} from '../src/rendering/pixi/environment/centre-motion.js';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',D='assets/world/themes/community/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),layout=read(D+'stage-layout.json');
const baseline=read('scripts/bigger-community/baseline/art.json'),stage=art.props.find(p=>p.id==='events-stage');
const bounds=p=>{const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:.5,y:1};return [p.x-w*a.x,p.y-h*a.y,p.x+w*(1-a.x),p.y+h*(1-a.y)];};
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const checked=checkTheme('community'),map=makeMap('community',{world,walk,harbor:read(D+'harbor.json'),sleepers:checked.sleepers});

test('Campfire stage is world-sized vector art, flat ink, with roof top, deep deck, cabinet sides and one contact shadow',()=>{
 assert.deepEqual(bounds(stage),layout.bounds);
 const svg=fs.readFileSync(A+stage.src,'utf8');
 assert.match(svg,/width="830" height="695" viewBox="0 0 830 695"/);
 for(const id of ['canopy-top','canopy-fascia','deck-side','shell-side','speaker-left','speaker-right','centred-stairs','backdrop'])assert(svg.includes(`id="${id}"`),id);
 assert.match(svg,/#39472d/);assert.equal((svg.match(/id="contact-shadow"/g)??[]).length,1);assert.equal(stage.shadow,false);
 for(const src of ['detail/stage.svg','detail/stage-cabinet.svg','detail/stage-approach.svg'])assert.doesNotMatch(fs.readFileSync(A+src,'utf8'),/<(?:image|linearGradient|radialGradient|filter)\b|data:|skew\(|rotate\(/i);
 assert.doesNotMatch(svg,/bubble|cloud screen/i);
 assert.equal(stage.wind,false);assert.equal(stage.sortY,1049);
 for(const id of ['stage-cabinet-w','stage-cabinet-e']){let p=art.props.find(p=>p.id===id);assert.equal(p.sortY,1126);assert.equal(p.shadow,false);}
});

test('Campfire stage canopy has 24 world units of tree clearance and the audience lawn has no trees',()=>{
 const b=layout.bounds,pad=layout.roofClearance,clear=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];
 for(const p of art.props.filter(p=>/tree/i.test(p.src))){assert(!overlaps(bounds(p),clear),p.id+' crowds the stage');if(!walkEditedPositions[p.id])assert(!overlaps(bounds(p),layout.audience),p.id+' crowds the audience');}
 for(const [id,point]of Object.entries(layout.treeMoves)){
  const [x,y]=walkEditedPositions[id]??point;
  const p=art.props.find(p=>p.id===id);assert.deepEqual([p.x,p.y],[x,y]);
  for(const w of [world,walk]){assert(!w.water.some(o=>inShape(x,y,o,40)),id+' planted on dry land');const p=map.world.props.find(p=>p.id===id);assert(p.footprint&&p.bodyFootprint,id+' traced drawing and body exclusion');}
 }
});

test('Campfire stair landing joins a 104-unit path and preserves all stage signs, lights and surrounding art',()=>{
 const approach=art.flats.find(p=>p.id==='stage-approach');assert.deepEqual([approach.x+630,approach.y],[4000,1282]);
 assert.equal(approach.width,690);assert.equal(approach.height,520);assert.match(fs.readFileSync(A+approach.src,'utf8'),/M578 0H682/);
 assert.deepEqual(art.flats,[...baseline.flats.filter(p=>!clearedStageFlat(p)),approach]);
 const original=baseline.props.filter(p=>!p.src.includes('badge-buoy')&&!REMOVED_HEARTH.includes(p.id));
 assert.deepEqual(outsideStageProps(art.props.slice(0,original.length)),outsideStageProps(original));
 for(const id of stageEditedIds){const before=original.find(p=>p.id===id),after=art.props.find(p=>p.id===id);
  assert(before&&after,id);
  if(id==='events-stage')assert.deepEqual(after,{...before,...layout.placement,scale:1,shadow:false,wind:false,sortY:1049});
  else {const [x,y]=walkEditedPositions[id]??layout.treeMoves[id]??layout.audienceMoves[id];assert.deepEqual(after,{...before,x,y});}
 }
 assert.deepEqual(world.props,art.props);assert.deepEqual(walk.props,art.props);
 assert.deepEqual(checked.problems,[]);assert.equal(checked.sleepers.length,100);
});

test('Campfire client and authority block the stage base and share clear rear and front approaches',()=>{
 assert.deepEqual(world.obstacles,walk.obstacles);
 const nav=map.nav();assert.equal(map.baseWalk.navigationCellSize,16);
 for(const p of [[4000,1175],[4000,1220],[3850,1200],[4150,1200]])assert.equal(nav.walkable(...p),false,'stage base excludes Ducky '+p);
 const rear=[4000,1080];assert(nav.walkable(...rear),'ground behind the base stays open');assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...rear).at(-1),rear);
 const approach=[4000,1336];assert(nav.walkable(...approach));assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...approach).at(-1),approach);
 for(const p of map.world.props.filter(p=>['events-stage','stage-cabinet-w','stage-cabinet-e'].includes(p.id)))assert(p.footprint&&p.bodyFootprint,p.id+' has identical shared contour obstacles');
});

test('Campfire Duckies stop outside the stage base and reach the uncovered stair approach at client and authority ticks',()=>{
 const nav=map.nav();
 for(const dt of [1/60,.05]){
  const duck={x:4000,y:1450,previousX:4000,previousY:1450,turn:0,path:[],until:0,action:0,travel:0,emoteVersion:0};
  setWalkDestination(duck,nav,4000,1250);
  for(let t=0;t<12;t+=dt){walkStep(duck,nav,dt,t,{x:0,y:0});assert(nav.walkable(duck.x,duck.y));assert(duck.y>1305,'cannot enter retained stage base');}
  setWalkDestination(duck,nav,4000,1336);
  for(let t=12;t<24;t+=dt){walkStep(duck,nav,dt,t,{x:0,y:0});assert(nav.walkable(duck.x,duck.y));}
  assert(Math.hypot(duck.x-4000,duck.y-1336)<8,'reached uncovered approach');
 }
});

test('Campfire static centre view loads and draws the stage and cabinets',async t=>{
 assert.equal(art.raster.enabled,false);
 const previousFetch=globalThis.fetch;t.after(()=>globalThis.fetch=previousFetch);
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 const textures=new Map(),released=[],objects=new Container();
 const groundPool=createGroundPool({acquire:async()=>readyTexture(),release(){}});
 let loaded;
 try{
  loaded=await loadThemeArt({...map,art:'/pixi-art/themes/community/art.json'},{groundPool,
   acquire:async src=>{const texture=new Texture({source:new ImageSource({width:16,height:16})});textures.set(src,texture);return texture;},
   release:src=>{released.push(src);textures.get(src)?.destroy(true);},
   rasterLoaderFactory:()=>{throw Error('Campfire must use static prop textures');}});
  assert.equal(loaded.rasterPool,null);
  for(const id of ['events-stage','stage-cabinet-w','stage-cabinet-e']){
   const p=loaded.props.find(p=>p.id===id);assert(p,id+' in loaded prop set');objects.addChild(p.sprite);
   assert.equal(p.sprite.parent,objects);assert.equal(p.sprite.themeArt,'community');
   assert.equal(p.sprite.texture,textures.get('/pixi-art/themes/community/'+p.src));
   assert.notEqual(p.sprite.texture,Texture.EMPTY);assert.equal(p.sprite.texture.destroyed,false);
   assert.equal(p.sprite.visible,true);assert.equal(p.sprite.renderable,true);assert.equal(p.sprite.alpha,1);
   assert.equal(p.sprite.width,p.width*(p.scale??1));assert.equal(p.sprite.height,p.height*(p.scale??1));
   assert.equal(p.shadow,null,'art supplies its own contact shadow');
   const [x,y,x1,y1]=bounds(p);
   for(const zoom of [.6,1.8])for(const [width,height]of (id==='events-stage'?[[390,844],[1400,1000],[1920,1080]]:[[1400,1000],[1920,1080]]))assert(tileInView({x,y,width:x1-x,height:y1-y},{x:4000,y:1050,zoom},width,height,1,0),id+' visible in centre view');
   assert(!loaded.groundStreams.some(s=>s.entries.some(t=>t.src.includes(p.src))),id+' needs no raster crop stream');
  }
 }finally{loaded?.destroy();groundPool.destroy();objects.destroy();}
 assert.equal(released.length,textures.size);assert.equal(new Set(released).size,textures.size);
 assert([...textures.values()].every(t=>t.destroyed));
});

test('Campfire plaza has no hearth or log seats, and its static art releases its artwork',async()=>{
 const fetch=globalThis.fetch,objects=new Container();let acquired=0,released=0;
 const groundPool=createGroundPool({acquire:async()=>readyTexture(),release:()=>{}});
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 let loaded;
 try{
  loaded=await loadThemeArt({...map,art:'/pixi-art/themes/community/art.json'},{groundPool,acquire:async()=>{acquired++;return readyTexture();},release:()=>released++});
  assert.equal(loaded.props.filter(p=>REMOVED_HEARTH.includes(p.id)).length,0);
  await attachCentreMotion(loaded, objects);
  loaded.updateCentre(.2,false);loaded.updateCentre(1,true);
 }finally{loaded?.destroy();groundPool.destroy();objects.destroy();globalThis.fetch=fetch;}
 assert.equal(released,acquired);
});
