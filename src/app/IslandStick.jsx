import {useEffect, useRef, useState} from 'react';

// Phone control for walking: a thumb stick (push a little to walk, to the rim to run).
// Movement is 8-way like the keyboard, so the stick snaps to the nearest of 8 directions.
const RADIUS = 40;      // how far the knob travels from the centre, px
const DEAD = 10;        // a touch this close to the centre does not move the Ducky
const RUN = .85;        // past this share of the radius the Ducky runs

function direction(dx, dy) {
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return {x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a))};
}

export default function IslandStick({island, show}) {
  const base = useRef(null);
  const active = useRef(null);
  const [knob, setKnob] = useState({x: 0, y: 0, run: false});
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  function release() {
    active.current = null;
    setKnob({x: 0, y: 0, run: false});
    island.current?.stick(0, 0, false);
  }
  useEffect(() => {if (!show && active.current !== null) release();}, [show]);   // eslint-disable-line react-hooks/exhaustive-deps

  function move(event) {
    if (active.current !== event.pointerId) return;
    const r = base.current.getBoundingClientRect();
    let dx = event.clientX - (r.left + r.width / 2), dy = event.clientY - (r.top + r.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {dx *= RADIUS / length; dy *= RADIUS / length;}
    const run = length >= RADIUS * RUN;
    setKnob({x: dx, y: dy, run});
    const d = length < DEAD ? {x: 0, y: 0} : direction(dx, dy);
    island.current?.stick(d.x, d.y, run);
  }

  if (!touch || !show) return null;
  return <div className="pixi-stick" ref={base} role="group" aria-label="Walk: drag to move, drag to the edge to run" data-run={knob.run || undefined}
      onPointerDown={event => {
        event.preventDefault();
        active.current = event.pointerId;
        try {event.currentTarget.setPointerCapture(event.pointerId);} catch { /* the finger is already gone */ }
        move(event);
      }}
      onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
      <span className="pixi-stick-knob" style={{translate: `${knob.x}px ${knob.y}px`}} data-moving={knob.x || knob.y ? '' : undefined} aria-hidden="true"/>
    </div>;
}
