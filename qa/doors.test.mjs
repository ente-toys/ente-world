import test from 'node:test';
import assert from 'node:assert/strict';
import {addPlayer, makeRoom} from './room-harness.mjs';
import {atDoor, DOORS, DOOR_RADIUS, pickDoor} from '../src/gameplay/doors.js';
import {mapOf, prepareIslandMap} from '../src/world/island-maps.js';

function knock(room, player, islandId=player.actor.islandId, seq=++player.seq) {
  room.webSocketMessage(player.socket,JSON.stringify({type:'door',islandId,seq}));
  assert.equal(JSON.parse(player.socket.last).self.ack,seq);
}

test('every mystery door is reachable, and its way out is clear of the doorstep', async () => {
  for (const [id, door] of DOORS) {
    await prepareIslandMap(id);
    const map=mapOf(id), nav=map.nav();
    assert.ok(nav.walkable(door.x,door.y),id+' doorstep');
    assert.ok(nav.walkable(door.exit.x,door.exit.y),id+' exit');
    assert.ok(nav.walkable(door.out.x,door.out.y),id+' way out');
    assert.ok(nav.clearLine([door.exit.x,door.exit.y],[door.out.x,door.out.y]),id+' straight walk out');
    assert.ok(atDoor({mode:'walking',islandId:id,x:door.x,y:door.y}),id);
    assert.ok(!atDoor({mode:'walking',islandId:id,...door.exit}),id+' exit must not swallow the Ducky again');
    assert.ok(Math.hypot(door.out.x-door.x,door.out.y-door.y)>DOOR_RADIUS+60,id+' walking out re-arms the door');
    assert.ok(nav.route(map.HARBOR.land.x,map.HARBOR.land.y,door.x,door.y).length,id+' route from the harbour');
  }
});

test('pickDoor never sends you back to the island you are on', () => {
  for (const from of DOORS.keys()) for (let i=0;i<20;i++) {
    const to=pickDoor(from);
    assert.ok(DOORS.has(to)); assert.notEqual(to,from);
  }
});

test('the server still lets you in when its copy of the Ducky is a step short of the door', async () => {
  const room=await makeRoom({transactional:true});
  const door=DOORS.get('home'), p=addPlayer(room,1,{islandId:'home',x:4745.1,y:2686.1});   // measured short stop
  knock(room,p);
  assert.notEqual(p.actor.islandId,'home');
});

test('a door moves the Ducky to another island for free and saves where it came out', async () => {
  const room=await makeRoom({transactional:true});
  const door=DOORS.get('home'), p=addPlayer(room,1,{islandId:'home',x:door.x,y:door.y});
  room.sql.exec('INSERT INTO karma_balances VALUES(?,?)',p.account,2);
  knock(room,p);
  const to=p.actor.islandId;
  assert.notEqual(to,'home');
  assert.ok(DOORS.has(to));
  assert.deepEqual({x:p.actor.x,y:p.actor.y},DOORS.get(to).exit);
  assert.equal(room.karma.balance(p.account),2);
  const row=room.sql.exec('SELECT pose FROM room_checkpoints WHERE account=?',p.account).toArray()[0];
  assert.equal(JSON.parse(row.pose).islandId,to);
});

test('a door does nothing unless you are standing on its doorstep', async () => {
  const room=await makeRoom({transactional:true});
  const door=DOORS.get('home'), p=addPlayer(room,1,{islandId:'home',x:door.out.x,y:door.out.y});
  knock(room,p);
  assert.equal(p.actor.islandId,'home');
  assert.match(p.socket.notes.findLast(note => note.type==='travel-notice').text,/Walk up to the door/);
});
