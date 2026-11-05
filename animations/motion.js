export const DURATIONS = Object.freeze({ hero: 1850, pickup: 920, conveyor: 1500, flight: 1800, customs: 1880, dispatch: 1320, delivery: 920 });
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// A deliberate ease-in at the beginning; deceleration prevents a hard final snap.
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const interval = (x, a, b) => ease((x - a) / (b - a));

// Stamp and print share the same contact translation and projected sole.
export const CUSTOMS_STAMP_CONTACT = Object.freeze({ x:-153, y:42 });
export const CUSTOMS_INK_PLANE = Object.freeze([1,.218,-1.4,.92,1094,814]);
export function customsFrame(p) {
  const shift=interval(p,.45,.57), press=interval(p,.57,.69);
  const lift=interval(p,.72,.83), rest=interval(p,.83,.99);
  const contact=CUSTOMS_STAMP_CONTACT, traverse=shift-rest;
  return {
    checks:[interval(p,.035,.16),interval(p,.175,.30),interval(p,.315,.44)],
    x:contact.x*traverse,
    y:-79*shift+(79+contact.y)*press-(73+contact.y)*lift+73*rest,
    shadowX:contact.x*traverse,
    shadowY:contact.y*traverse,
    shadow: .73-.42*shift+.43*press-.44*lift+.43*rest,
    imprint:interval(p,.69,.75),
    release:interval(p,.82,.98)
  };
}
