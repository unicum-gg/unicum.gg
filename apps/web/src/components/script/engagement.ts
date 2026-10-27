/**
 * Names of the interaction signals, interpolated into the script below so the
 * listener that reports a name and the dashboard that reads it cannot drift.
 *
 * Several DOM events share a name on purpose: `pointermove` and `mousemove` are
 * one gesture seen twice, and `pointerdown` and `click` are one press. What is
 * being measured is which KIND of gesture arrived first, not which API reported
 * it.
 */
enum EngagementSignal {
  /** The pointer moved. The strongest signal on a desktop. */
  Move = "move",
  /** The wheel turned, which fires even where the page cannot scroll. */
  Wheel = "wheel",
  /** Something scrolled. */
  Scroll = "scroll",
  /** A key went down. */
  Key = "key",
  /** A press landed. */
  Click = "click",
  /** A finger touched the screen, which is how a phone says all of the above. */
  Touch = "touch",
  /** Text was selected. */
  Selection = "sel",
}

/** The DOM events watched, paired with the signal each one reports. */
const WATCHED: [event: string, signal: EngagementSignal][] = [
  ["pointermove", EngagementSignal.Move],
  ["mousemove", EngagementSignal.Move],
  ["wheel", EngagementSignal.Wheel],
  ["scroll", EngagementSignal.Scroll],
  ["keydown", EngagementSignal.Key],
  ["pointerdown", EngagementSignal.Click],
  ["click", EngagementSignal.Click],
  ["touchstart", EngagementSignal.Touch],
  ["selectionchange", EngagementSignal.Selection],
];

/** The two events that fire on `document` rather than on `window`. */
const DOCUMENT_EVENTS = ["scroll", "selectionchange"];

/** Name of the custom event, and of the global guarding a second install. */
const EVENT_NAME = "engaged";
const GUARD_GLOBAL = "__unicumEngaged";

/**
 * Reports the first human gesture of a page as one custom Umami event, so the
 * dashboard can say which gestures a reader makes and which a crawler does not.
 *
 * WHY THIS EXISTS. `bot-signals` beside it asks what a visitor IS, by probing
 * the browser, and against the fleet that arrived on 2026-10-26 every one of
 * those probes failed: 1,568 sessions, 97% on one resolution, and the eight
 * tags between them caught 0.6% of it. Measured at the edge it runs real Chrome
 * with a real timezone, a real window frame and more than two cores, so there
 * is nothing left to detect in the browser. What separates it is not what it is
 * but what it DOES: readers run 2.4 to 7.2 pages a visit and 51 to 301 seconds,
 * the fleet runs 1.0 to 1.3 pages and 0 to 30 seconds, and Bangladesh and India
 * sit at exactly one page and zero seconds. This measures that difference at
 * the only moment a page can see it.
 *
 * WHY NOT THE STANDARD API. `navigator.userActivation.hasBeenActive` is the
 * browser's own flag for "a human has interacted", which would be one property
 * read instead of nine listeners. It reads **true on a stealth automation
 * browser on a fresh tab that has received no input at all**, measured on this
 * site on 2026-10-27. It is a known detection vector, so the tooling patches
 * it, and a feature built on it would be silently inert. The listeners were
 * measured on that same browser over 27 idle seconds and reported zero events
 * across all nine.
 *
 * WHY A CUSTOM EVENT RATHER THAN HOLDING THE PAGEVIEW BACK. Holding it is what
 * this is FOR, eventually: a pageview never sent is an event never billed, and
 * billing is the whole point, since the fleet burns about 42,000 events a day
 * against a month that has otherwise run to 75,000. But holding it means
 * cancelling the send, arming a timeout, and replaying through the very hook
 * that cancelled it, which is three ways to lose an audience without noticing.
 * So the gesture is reported ALONGSIDE the untouched pageview first. It costs
 * one event per engaged session, around 2.4% more than today, and it buys the
 * distribution this decision needs: which gestures readers make, which the
 * fleet makes, and therefore where the gate belongs.
 *
 * WHAT IT CANNOT DO, said plainly because it bounds the whole approach. A
 * gesture injected at the BROWSER level arrives with `isTrusted` true: one
 * synthetic key through the automation protocol produced a trusted `keydown`
 * and sixteen trusted `scroll` events when measured. So a fleet defeats this
 * with one line in its crawler. A gesture faked from the page's own JavaScript
 * does NOT, arriving with `isTrusted` false, which is why that is checked. This
 * is a cost asymmetry rather than a wall, and it is the right trade here for a
 * reason that has nothing to do with detection: unlike a block, somebody who
 * triggers nothing still reads the site in full. They are simply not counted.
 *
 * It fires at most ONCE per page, drops its listeners on the way out, and is
 * passive and capturing so it never delays a scroll and cannot be shadowed by
 * a handler that stops propagation. The tracker is deferred, so the gesture can
 * land before `umami` exists: the send retries on a short interval rather than
 * being lost, and gives up rather than retrying forever.
 */
export const ENGAGEMENT_SCRIPT = `(function(){
var W=window,D=document;
if(W.${GUARD_GLOBAL}!==undefined)return;
W.${GUARD_GLOBAL}=0;
var WATCH=${JSON.stringify(WATCHED)};
var DOC=${JSON.stringify(DOCUMENT_EVENTS)};
var t0=Date.now(),bound=[],tries=0;
function send(sig,ms){
try{
if(W.umami&&W.umami.track){W.umami.track("${EVENT_NAME}",{signal:sig,ms:ms});return}
}catch(e){}
if(tries++<50){try{setTimeout(function(){send(sig,ms)},200)}catch(e){}}
}
function drop(){
for(var i=0;i<bound.length;i++){
try{bound[i][0].removeEventListener(bound[i][1],bound[i][2],true)}catch(e){}
}
bound=[];
}
function handler(sig){
return function(e){
if(W.${GUARD_GLOBAL})return;
try{if(e&&e.isTrusted===false)return}catch(err){}
W.${GUARD_GLOBAL}=1;
drop();
send(sig,Date.now()-t0);
};
}
for(var i=0;i<WATCH.length;i++){
var n=WATCH[i][0],h=handler(WATCH[i][1]);
var target=DOC.indexOf(n)!==-1?D:W;
bound.push([target,n,h]);
try{target.addEventListener(n,h,{passive:true,capture:true})}catch(e){}
}
})();`;
