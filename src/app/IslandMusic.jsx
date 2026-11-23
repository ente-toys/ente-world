import {useEffect, useRef, useState} from 'react';
import './island-music.css';

const tracks = [
  ['then','Then','Vishnu'], ['sublime','Sublime','Ashil'],
  ['love','Love','Vishnu'], ['love-reprise','Love (Reprise)','Vishnu'],
  ['home','Home','aspizu'], ['sunday','Sunday','Vishnu'],
  ['get-better','Get Better','Luke Iggy'], ['discovery','Discovery','Vinay Krishnan'],
];
const defaultTrack = tracks.findIndex(([id]) => id === 'get-better');
const trackUrl = index => `https://music.ente.com/tracks/${tracks[index][0]}.mp3`;

export default function IslandMusic({island}) {
  const host = useRef(null), audio = useRef(null), spectrum = useRef(null);
  const graph = useRef(null), request = useRef(0);
  const [track,setTrack] = useState(defaultTrack);
  const [state,setState] = useState('idle');
  const [volume,setVolume] = useState(.35);
  const active = state === 'playing' || state === 'loading';

  useEffect(() => {
    const player = audio.current;
    player.src = trackUrl(defaultTrack);
    player.volume = .35;
    return () => {
      request.current++;
      if (!graph.current) return;
      player.pause();
      player.removeAttribute('src');
      player.load();
      graph.current.context.close().catch(() => {});
      graph.current = null;
    };
  }, []);

  useEffect(() => {
    function clear() {
      document.removeEventListener('click', interact);
      document.removeEventListener('keydown', interact);
    }
    function interact(event) {
      clear();
      if (!event.target.closest?.('.pixi-music')) start(true);
    }
    document.addEventListener('click', interact);
    document.addEventListener('keydown', interact);
    start(true).then(started => {if (started) clear();});
    return clear;
  }, []);

  useEffect(() => {
    const page = host.current.parentElement;
    const controls = [...page.querySelectorAll('.pixi-top-left,.pixi-live,.pixi-profile-button,.pixi-karma-counter')];
    if (!controls.length || typeof ResizeObserver === 'undefined') return;
    const element = host.current;
    function place() {
      element.style.marginTop = '';
      element.style.right = '';
      const leftDockRight = page.querySelector('.pixi-top-left')?.getBoundingClientRect().right ?? 0;
      const bounds = controls.map(control => control.getBoundingClientRect()).sort((a,b) => b.left-a.left);
      for (const hud of bounds) {
        const player = element.getBoundingClientRect();
        if (hud.left >= player.right || hud.right <= player.left || hud.top >= player.bottom || hud.bottom <= player.top) continue;
        // 8px between top-row items, the same gap as the logo and help button
        if (hud.left-player.width-8 >= leftDockRight+8) {
          element.style.right = `${window.innerWidth-hud.left+8}px`;
        } else {
          element.style.right = '';
          element.style.marginTop = `${(parseFloat(element.style.marginTop)||0)+hud.bottom-player.top+12}px`;
        }
      }
    }
    const observer = new ResizeObserver(place);
    controls.forEach(control => observer.observe(control));
    window.addEventListener('resize',place);
    return () => {observer.disconnect();window.removeEventListener('resize',place);};
  });

  useEffect(() => {
    // a click or tap anywhere outside the player closes the open panel
    function outside(event) {
      const options = host.current?.querySelector('details');
      if (options?.open && !host.current.contains(event.target)) options.open = false;
    }
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, []);

  useEffect(() => {
    const bars = [...spectrum.current.children];
    if (state !== 'playing') {
      for (const bar of bars) bar.style.transform = 'scaleY(.04)';
      return;
    }
    let frame, last = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const {analyser} = graph.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    function draw(time) {
      if (time-last > (reduced ? 400 : 50)) {
        analyser.getByteFrequencyData(data);
        bars.forEach((bar,i) => {
          const bin = Math.floor((i/bars.length)**1.6 * (data.length-1));
          bar.style.transform = `scaleY(${Math.max(.04,data[bin]/255)})`;
        });
        last = time;
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  async function start(automatic = false) {
    const id = ++request.current;
    if (!automatic) setState('loading');
    try {
      if (!graph.current) {
        const context = new AudioContext(), analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = .8;
        context.createMediaElementSource(audio.current).connect(analyser);
        analyser.connect(context.destination);
        graph.current = {context,analyser};
      }
      await graph.current.context.resume();
      if (id !== request.current) return;
      setState('loading');
      await audio.current.play();
      if (id === request.current) {
        setState('playing');
        return true;
      }
    } catch (error) {
      if (id === request.current) setState(automatic && error.name === 'NotAllowedError' ? 'idle' : 'error');
    }
  }

  function pause() {
    request.current++;
    audio.current.pause();
    setState('paused');
  }

  function choose(index) {
    pause();
    const next = (index+tracks.length)%tracks.length;
    setTrack(next);
    audio.current.src = trackUrl(next);
    start();
  }

  const [title,artist] = [tracks[track][1],tracks[track][2]];
  const note = state === 'error' ? 'Could not load. Press play to retry.' : state === 'loading' ? 'Loading…' : artist;
  const playIcon = active
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.5"/><rect x="13.5" y="5" width="4" height="14" rx="1.5"/></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1.2 1.2 0 0 0 1.8 1l10-6.4a1.2 1.2 0 0 0 0-2l-10-6.4A1.2 1.2 0 0 0 8 5.6Z"/></svg>;
  const togglePlay = active ? pause : () => start();

  return <section ref={host} className="pixi-music" aria-label="Ente music player"
    onPointerDown={() => island.current?.stopInput()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') host.current.querySelector('details').open = false;
    }}>
    <button className="pixi-music-play" onClick={togglePlay} aria-label={active ? 'Pause music' : 'Play music'}>{playIcon}</button>
    <div className="pixi-music-spectrum" ref={spectrum} role="img" aria-label="Live music frequency spectrum">
      {Array.from({length:12},(_,i) => <span key={i}/>)}
    </div>
    {/* status sits inside the pill, in place of the bars, so it never covers the live card under it */}
    <span className="pixi-music-status" role="status" data-tone={state === 'error' ? 'error' : undefined}>
      {state === 'error' ? <><span aria-hidden="true">No music</span><span className="pixi-sr">Could not load music. Press Play to retry.</span></>
        : state === 'loading' ? <><span aria-hidden="true">Loading…</span><span className="pixi-sr">Loading music</span></> : null}
    </span>
    <details className="pixi-music-options" onToggle={event => {
      // the pill can sit left of the other buttons; keep the open panel on screen
      const menu = event.currentTarget.querySelector('.pixi-music-menu');
      menu.style.right = '';
      if (!event.currentTarget.open) return;
      // measured from the pill, not the menu's own box: it is mid-animation
      const pill = host.current.getBoundingClientRect(), width = menu.offsetWidth, bottom = pill.bottom+12+menu.offsetHeight;
      let right = pill.right;
      // slide left of the mini-map when the panel would run over it (only if it still fits on screen)
      const map = host.current.parentElement.querySelector('.pixi-world-map')?.getBoundingClientRect();
      if (map?.width && bottom > map.top && right > map.left && map.left-12-width >= 16) right = map.left-12;
      right = Math.max(right, 16+width);
      if (right !== pill.right) menu.style.right = `${pill.right-right}px`;
    }}>
      <summary aria-label="Music options"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/></svg></summary>
      <div className="pixi-music-menu">
        <div className="pixi-music-now">
          <div className="pixi-music-cover" data-on={state === 'playing' || undefined} aria-hidden="true"><i/><i/><i/></div>
          <div className="pixi-music-title"><strong>{title}</strong><span data-tone={state === 'error' ? 'error' : undefined}>{note}</span></div>
        </div>
        <div className="pixi-music-controls">
          <button className="pixi-music-skip" aria-label="Previous song" onClick={() => choose(track-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="2.6" height="12" rx="1.2"/><path d="M19 7.1v9.8a1 1 0 0 1-1.6.8l-7.3-4.9a1 1 0 0 1 0-1.6l7.3-4.9A1 1 0 0 1 19 7.1Z"/></svg></button>
          <button className="pixi-music-big" onClick={togglePlay} aria-label={active ? 'Pause music' : 'Play music'}>{playIcon}</button>
          <button className="pixi-music-skip" aria-label="Next song" onClick={() => choose(track+1)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.4" y="6" width="2.6" height="12" rx="1.2"/><path d="M5 7.1v9.8a1 1 0 0 0 1.6.8l7.3-4.9a1 1 0 0 0 0-1.6L6.6 6.3A1 1 0 0 0 5 7.1Z"/></svg></button>
        </div>
        <label className="pixi-music-volume">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3l4.3-3.6a.8.8 0 0 1 1.3.6v11a.8.8 0 0 1-1.3.6L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/>{volume > 0 && <path className="pixi-music-wave" d="M16 9.2a4 4 0 0 1 0 5.6"/>}{volume > .5 && <path className="pixi-music-wave" d="M18.6 6.8a7.4 7.4 0 0 1 0 10.4"/>}</svg>
          <input type="range" aria-label="Music volume" min="0" max="1" step=".01" value={volume} style={{'--v':`${volume*100}%`}}
            onChange={event => {const v = Number(event.target.value); audio.current.volume = v; setVolume(v);}}/>
        </label>
        <ol className="pixi-music-list" aria-label="Songs">
          {tracks.map((song,i) => <li key={song[0]}>
            <button aria-current={i === track || undefined} onClick={() => i === track ? togglePlay() : choose(i)}>
              <span className="pixi-music-row-title">{song[1]}</span><span className="pixi-music-row-artist">{song[2]}</span>
            </button>
          </li>)}
        </ol>
        <a href="https://music.ente.com/" target="_blank" rel="noreferrer">More on Ente Music <span aria-hidden="true">↗</span></a>
      </div>
    </details>
    <audio ref={audio} src={trackUrl(defaultTrack)} loop={track === defaultTrack} crossOrigin="anonymous" preload="none"
      onEnded={track === defaultTrack ? undefined : () => choose(track+1)} onError={() => {request.current++;setState('error');}}
      onWaiting={() => {if(!audio.current.paused)setState('loading');}}
      onPlaying={() => setState('playing')}/>
  </section>;
}
