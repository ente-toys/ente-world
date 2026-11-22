// Boss rule (16 Nov): plants, sleeping Ducks and scenery are walkable.
// Use the source asset when available: ids such as fishing-west or camp-1-focal
// do not say whether the drawing is a cottage, table or tree. Plant names may
// include their neighbouring house; furniture carrying flowers still blocks.
const NATURE = /^(?:trees?|oak|birch|willow|sapling|pine|bush(?:es)?|shrubs?|hedges?|flowers?|pots?|planters?|lupins|dais(?:y|ies)|posies|tulips?|understorey|understory|underplant|reeds?|cattails|grass|sedge|beds?|beehives?|arch(?:es)?|grove|trims?|cover|fields?|flowerpots?|edges?|la|wl)$/i;
const SOLID = /house|home|cottage|hall|lodge|studio|bakery|workshop|shop|store|stall|cafe|hut|gallery|chapel|arcade|colonnade|pavilion|gazebo|conservatory|greenhouse|dovecote|porch|shed|lighthouse|cabin|library|^lib$|school|tower|oven|annex|granary|silo|merchant|apothecary|shrine|barn|mill|kiln|boathouse|bench|seat|chair|stool|cushion|lounger|^log$|lamp|lantern|light|table|cart|sign|board|mailbox|parasol|umbrella|crate|sack|barrel|woodpile|rack|shelves|easel|book|block|toy|ball|bucket|starfish|sandcastle|speaker|^mic$|crystal|sculpture|telescope|cauldron|stage|swing|slide|fountain|campfire|canopy|stone|rock|statue|wall|ruin|gate|balustrade|headstone|pier|planks|shell|ropes|post|bleachers|bandstand|trap|cradle|picnic|kiosk|sailboat|hull|box|well|banner|scarecrow|desk|basket|bowl|watering|maypole|sled|clock|globe|boat|key|dancer|^play$/i;
export function blocks(o, source) {
  if (o.sleeper) return false;
  if (/(^|\/)benches\//.test(source?.src ?? '')) return true;
  const asset = source?.src?.split('/').at(-1).replace(/\.svg$/, '');
  const n = (!asset || /^prop-\d+$/.test(asset) ? source?.name : asset) ?? o.prop ?? o.name ?? o.id;
  if (typeof n === 'number') return o.building === true;
  if (typeof n !== 'string') return false;
  // Combat cover keeps its authored walls/stacks, including lane-cover ids.
  if (o.author === 'warzone' || /^(?:wz-.*-shell|lane-cover-)/.test(String(o.id))) return true;
  const tokens = n.split(/[-_ .]+/);
  if (tokens.some(t => NATURE.test(t)) && !/bench|table|cart|rack|easel|pot-shop$/i.test(n)) return false;
  return tokens.some(t => SOLID.test(t)) || /bench|seat/i.test(source?.name ?? '') || /(?:^|-)tea-story(?:-|$)|(?:^|-)drying-line(?:-|$)/i.test(n);
}

// Older maps have anonymous base rectangles/ellipses. Match their authored
// centre column and foot offset, rather than silently dropping a barn or bench.
export function blockerFilter(props) {
  const sources = new Map(props.map(p=>[p.id,p]));
  return o => {
    const id=o.prop??o.name??o.id;
    let source=sources.get(id);
    if(id==null){
      const x=o.x??o.poly?.reduce((n,p)=>n+p[0],0)/o.poly?.length;
      const y=o.y??o.poly?.reduce((n,p)=>n+p[1],0)/o.poly?.length;
      source=props.filter(p=>Math.abs(p.x-x)<.01&&p.y>=y&&p.y-y<=100).sort((a,b)=>a.y-b.y)[0];
    }
    return blocks(o,source);
  };
}
