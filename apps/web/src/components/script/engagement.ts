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
  /** The pointer moved. */
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

/**
 * Which of the two independent slots a signal reports into. The values are the
 * bit each class occupies in the guard, so they index it directly.
 *
 * The split is the whole point of this file and it was measured rather than
 * reasoned: see the record below. A soft signal is trusted and still arrives
 * without anybody deciding to make it, a hard one is an input event a person
 * has to perform.
 */
enum EngagementClass {
  /** Raised by the browser as a consequence of something else. */
  Soft = 0,
  /** Performed by a person. */
  Hard = 1,
}

/** The DOM events watched, each paired with its signal and its class. */
const WATCHED: [event: string, signal: EngagementSignal, cls: EngagementClass][] =
  [
    ["pointermove", EngagementSignal.Move, EngagementClass.Soft],
    ["mousemove", EngagementSignal.Move, EngagementClass.Soft],
    ["scroll", EngagementSignal.Scroll, EngagementClass.Soft],
    ["selectionchange", EngagementSignal.Selection, EngagementClass.Soft],
    ["wheel", EngagementSignal.Wheel, EngagementClass.Hard],
    ["keydown", EngagementSignal.Key, EngagementClass.Hard],
    ["pointerdown", EngagementSignal.Click, EngagementClass.Hard],
    ["click", EngagementSignal.Click, EngagementClass.Hard],
    ["touchstart", EngagementSignal.Touch, EngagementClass.Hard],
  ];

/** The two events that fire on `document` rather than on `window`. */
const DOCUMENT_EVENTS = ["scroll", "selectionchange"];

/** Name of the custom event, and of the global holding the per-class guard. */
const EVENT_NAME = "engaged";
const GUARD_GLOBAL = "__unicumEngaged";

/** Attempts to reach a tracker that has not loaded yet, and the gap between. */
const SEND_ATTEMPTS = 50;
const SEND_RETRY_MS = 200;

/**
 * Reports the first human gesture of a page as Umami events, so the dashboard
 * can say which gestures a reader makes and which a crawler does not.
 *
 * WHY THIS EXISTS. `bot-signals` beside it asks what a visitor IS, by probing
 * the browser, and against the fleet that arrived on 2026-10-26 every one of
 * those probes failed: 1,568 sessions, 97% on one resolution, and the eight
 * tags between them caught 0.6% of it. Measured at the edge it runs real Chrome
 * with a real timezone, a real window frame and more than two cores, so there
 * is nothing left to detect in the browser. What separates it is not what it is
 * but what it DOES: readers run 2.4 to 7.2 pages a visit and 51 to 301 seconds,
 * the fleet runs 1.0 to 1.3 pages and under 30 seconds. This measures that
 * difference at the only moment a page can see it.
 *
 * WHY TWO SLOTS, WHICH IS THE WHOLE SHAPE OF THIS FILE. The first version
 * reported ONE event, on whichever gesture came first, and that is not
 * answerable. Measured over the six hours from 2026-10-27 00:20 UTC, 7,318
 * sessions whose pages per visit never left 1.02 to 1.05, so the window holds
 * the fleet and almost no readers:
 *
 *     move    316        sel     37
 *     click    21        scroll   7
 *     wheel     0        key      0        touch 0
 *
 * Two readings come out of that and both matter. The fleet DOES produce trusted
 * gestures, at about 4.8% of sessions, and they are almost entirely pointer
 * movement: India, Indonesia and Bangladesh produced `move` and nothing else,
 * Brazil 41 `move` and not one click. So a gate on "any gesture" would have
 * leaked 5% of the fleet while cleaning nothing, which is what retired it. And
 * `move` being 83% of the total is itself an artefact of firing once: a reader
 * whose cursor twitches before they click is recorded as a move and their click
 * is never seen, so those 21 clicks are not "21 people clicked", they are "21
 * people clicked without having moved the mouse first", which a person holding
 * a mouse essentially never does. The hard rate was masked by the soft one.
 *
 * So each class now has its own slot, its own guard bit and its own listeners,
 * and a page can report both. The cost is at most two events per session
 * instead of one, against a fleet that produces under 5% of either.
 *
 * WHY THESE FOUR ARE HARD AND THOSE THREE ARE NOT. `wheel`, `keydown`,
 * `pointerdown`/`click` and `touchstart` are input events: the browser raises
 * them because something was done to a device. A `scroll` is raised by position
 * restoration, an anchor jump or any programmatic scroll, and a
 * `selectionchange` by focus moving or by the DOM changing under a selection,
 * which hydration does on every page here. Both are trusted in all of those
 * cases, so neither says a person was present. `move` sits with them for the
 * reason the measurement found: it is the one gesture the fleet reliably makes.
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
 * So the gesture is reported ALONGSIDE the untouched pageview, and what the
 * dashboard says about the hard slot is what decides whether a gate is ever
 * built on it.
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
 * Each class fires at most ONCE per page and drops only its own listeners on
 * the way out, so a soft gesture never disarms the hard slot. Everything is
 * passive and capturing, so it never delays a scroll and cannot be shadowed by
 * a handler that stops propagation. The tracker is deferred, so a gesture can
 * land before `umami` exists: each send carries its own retry count rather than
 * sharing one, or the first gesture of a page could spend the whole budget and
 * leave the second unable to report.
 */
export const ENGAGEMENT_SCRIPT = `(function(){
var W=window,D=document;
if(W.${GUARD_GLOBAL}!==undefined)return;
W.${GUARD_GLOBAL}=0;
var WATCH=${JSON.stringify(WATCHED)};
var DOC=${JSON.stringify(DOCUMENT_EVENTS)};
var t0=Date.now(),bound=[];
function send(sig,ms,n){
try{
if(W.umami&&W.umami.track){W.umami.track("${EVENT_NAME}",{signal:sig,ms:ms});return}
}catch(e){}
n=n||0;
if(n<${SEND_ATTEMPTS}){try{setTimeout(function(){send(sig,ms,n+1)},${SEND_RETRY_MS})}catch(e){}}
}
function drop(cls){
var keep=[];
for(var i=0;i<bound.length;i++){
if(bound[i][3]!==cls){keep.push(bound[i]);continue}
try{bound[i][0].removeEventListener(bound[i][1],bound[i][2],true)}catch(e){}
}
bound=keep;
}
function handler(sig,cls){
var bit=1<<cls;
return function(e){
if(W.${GUARD_GLOBAL}&bit)return;
try{if(e&&e.isTrusted===false)return}catch(err){}
W.${GUARD_GLOBAL}|=bit;
drop(cls);
send(sig,Date.now()-t0);
};
}
for(var i=0;i<WATCH.length;i++){
var n=WATCH[i][0],cls=WATCH[i][2],h=handler(WATCH[i][1],cls);
var target=DOC.indexOf(n)!==-1?D:W;
bound.push([target,n,h,cls]);
try{target.addEventListener(n,h,{passive:true,capture:true})}catch(e){}
}
})();`;
