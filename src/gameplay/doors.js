// Mystery doors (rough): walk into one of these houses and you come out of a house on another island, picked at random.
// Each door is in island-local coordinates: `x,y` is the doorstep that swallows the Ducky, `exit` is where it reappears
// when it comes out of this door, and `out` is where it then walks to. `exit` sits outside the doorstep on purpose, or
// the Ducky would bounce between two doors forever.
export const DOOR_RADIUS = 46;

export const DOORS = new Map([
  // the rubber duck lighthouse; the beach umbrella blocks the sand straight in front, so the step is just left of the door
  ['home', {x:4775, y:2640, exit:{x:4730, y:2700}, out:{x:4700, y:2800}}],
  ['blossom', {x:5236, y:5385, exit:{x:5236, y:5450}, out:{x:5236, y:5560}}],   // cottage with roses, south hamlet
  ['sunset', {x:-5, y:2478, exit:{x:-5, y:2540}, out:{x:-5, y:2610}}],          // buttercream rose cottage
]);

// The server passes some slack: the client stops the Ducky the moment its own (predicted) pose reaches the step,
// so the server's copy can still be a few steps short.
export const DOOR_SLACK = 50;
export function atDoor(actor, slack = 0) {
  if (actor?.mode !== 'walking') return false;
  const door = DOORS.get(actor.islandId);
  return Boolean(door && Math.hypot(actor.x-door.x, actor.y-door.y) <= DOOR_RADIUS + slack);
}

// any other island with a door, never the one you're on
export function pickDoor(from, random = Math.random) {
  const others = [...DOORS.keys()].filter(id => id !== from);
  return others.length ? others[Math.floor(random() * others.length)] : null;
}
