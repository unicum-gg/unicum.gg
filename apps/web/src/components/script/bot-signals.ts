import UMAMI from "@/constants/umami";

/**
 * Names of the headless signals, interpolated into the script below so the
 * probe that pushes a name and the list that acts on it cannot drift apart.
 */
enum BotSignal {
  /** No WebGL context could be created at all. */
  NoWebgl = "nogl",
  /** The WebGL renderer is a software rasteriser. */
  SoftwareWebgl = "swgl",
  /** `navigator.webdriver`, the automation flag itself. */
  WebDriver = "webdriver",
  /** A user agent claiming Chrome desktop with no `window.chrome`. */
  NoChrome = "nochrome",
  /** A user agent claiming Chrome desktop with an empty plugin list. */
  NoPlugins = "noplugins",
  /** The browser resolves its own timezone to UTC, GMT or an `Etc/*` zone. */
  UtcTimezone = "tzutc",
  /** Chrome desktop with no browser chrome above the viewport. */
  NoWindowFrame = "noframe",
  /** Chrome desktop reporting two logical cores or fewer. */
  FewCores = "fewcores",
}

/**
 * The signals whose payload is cancelled rather than labelled. Everything else
 * only tags, which is what keeps the question measurable.
 */
const DROP_SIGNALS: BotSignal[] = [
  BotSignal.NoWebgl,
  BotSignal.SoftwareWebgl,
  BotSignal.WebDriver,
];

/**
 * Headless-browser signals, evaluated in the page and attached to every Umami
 * payload through the tracker's `data-before-send` hook.
 *
 * WHY THIS IS NEEDED AT ALL. Umami is a client script, so a crawler that does
 * not run JavaScript never reaches it: plain HTTP scrapers and non-rendering
 * crawlers are already absent from the dashboard whatever their volume at the
 * origin, and Umami drops the user agents that announce themselves as bots on
 * its own side. What is left is the fleet that renders pages and presents
 * itself as Chrome desktop, which is the bulk of this site's traffic.
 *
 * WHAT IT DROPS AND WHY THOSE ONES. A payload carrying a `DROP_SIGNALS` signal
 * is cancelled, every other signal only labels it. The tagging shipped first
 * precisely so the list could be read off the dashboard rather than guessed,
 * and this is what it said over the 24 hours from 2026-10-22 14:17 UTC:
 *
 *     nogl        1600 visitors    1.05 pages/visit    95.0% bounce
 *     noplugins      5 visitors   10.20 pages/visit    60.0% bounce
 *     swgl           3 visitors    1.00 pages/visit   100.0% bounce
 *     no tag       291 visitors    4.09 pages/visit    83.8% bounce
 *
 * `nogl` alone was 84.7% of the visitors and 76% of the pageviews, and the two
 * populations have nothing in common. It is 100% Chrome, 99.8% United States,
 * sends no referrer at all, and walks `/eu/players/<name>/tanks` twice each
 * with no locale prefix, where the untagged traffic arrives from Google, Yandex
 * and Twitch onto locale-prefixed URLs and reads four pages a visit. Not one
 * French visitor was tagged, which is the control that decides it: a signal
 * catching real readers would have caught ours first.
 *
 * `noplugins` is NOT dropped, on that same evidence. Five visitors at ten pages
 * a visit is reader behaviour, and the signal is a weak inconsistency rather
 * than a detection, so it keeps tagging and stays answerable later.
 *
 * WHAT DROPPING COSTS. A cancelled payload cannot be reviewed afterwards, so a
 * false positive here is a real reader who silently stops being counted. The
 * case left open is a desktop browser that blocks WebGL outright, which some
 * strict fingerprint-protection modes do. That is accepted rather than
 * overlooked, for one reason: the fleet is measured at the edge, where it was
 * found in the first place, so no volume figure depends on this file. Umami
 * counts readers.
 *
 * THE SIGNALS, BY WHAT THEY ACTUALLY CAUGHT.
 * `nogl` does all of the work above, and it was missing from this list while
 * the four below were documented as the whole of it.
 * `swgl` is SwiftShader, llvmpipe or Mesa offscreen. Presenting a plausible
 * renderer string instead needs real hardware behind it, so it is the costliest
 * to defeat and it drops despite having caught three visitors.
 * `webdriver` is the automation flag rather than an inference, so it drops too.
 * It has never fired once, which says only that this fleet patches it.
 * `nochrome` and `noplugins` are inconsistencies rather than detections. Weak
 * alone, so they label and never cancel, and the tag names every signal that
 * fired rather than reducing them to one verdict.
 *
 * THE SECOND FLEET, AND WHY NONE OF THE FIVE ABOVE SEES IT. On 2026-10-26 the
 * Cloudflare managed challenge came off the site at 15:55 CET, and Umami went
 * from 218 visitors on the day before to 5,733 by 20:30. The arrivals are one
 * population: 93% on 1920x1080, 97% Windows 10, 91% declaring `en` while the
 * addresses are Brazilian, Colombian, Ecuadorian and Venezuelan, 2.8% mobile
 * against the real audience's 28%, 1.88 pages a visit against 3.0, and the most
 * read page carrying 162 of 11,574 pageviews, which is a walk of the catalogue
 * rather than a visit. It fired `noplugins` 106 times and nothing else: it has
 * hardware WebGL, keeps `navigator.webdriver` false and carries plugins.
 *
 * It is NOT a new arrival, and that is the part worth keeping. Measured at the
 * edge on the same user agent either side of the removal, its volume did not
 * move (Chrome 151 on Windows: 74,781 then 76,471 requests from the US, 14,790
 * then 14,371 from Brazil). It was always hitting us at that rate. What changed
 * is that it now receives the page instead of a 403, so it runs JavaScript and
 * reaches the tracker. The challenge was never keeping it out, it was keeping
 * it out of the dashboard, which is the worse of the two because it reads as an
 * audience we did not have.
 *
 * So `tzutc`, `noframe` and `fewcores` are three independent guesses at what
 * separates it, and all three only ever LABEL. The resolution and the user
 * agent cannot be used: 1920x1080 under Chrome on Windows is also what a real
 * reader runs, so a signal drawn on it would cost readers. These three are each
 * something a containerised fleet pays for and a desktop does not. A browser
 * resolves its own zone to an IANA city, so UTC or `Etc/*` is a container with
 * no zone set, the one case strict fingerprint-protection modes also produce.
 * A real Chrome window has a tab strip and an address bar above the viewport,
 * so `outerHeight` exceeds `innerHeight` unless the page is in fullscreen or
 * kiosk. And a machine presenting a desktop browser rarely has two cores. The
 * two that read window geometry and core counts are gated on the Chrome
 * desktop user agent like `nochrome` and `noplugins`, because on a phone
 * `outerHeight === innerHeight` is simply what a browser looks like.
 *
 * Which of them is worth dropping is a question for the dashboard, in a week,
 * the same way `nogl` was decided. Until then they cost a reader nothing.
 *
 * ONE CONSTRAINT ON ADDING MORE. The tag is truncated at 50 characters, and a
 * truncated name is worse than an absent one because it still reads as a tag.
 * What keeps it inside the cap is that a `DROP_SIGNALS` hit returns before the
 * tag is built, so the string is only ever assembled from the signals that do
 * not cancel: those five come to 45 characters with the prefix. A sixth
 * labelling signal needs a short name or the cap needs raising.
 *
 * It is evaluated ONCE per page and memoised. Building a WebGL context on every
 * pageview would cost a real reader more than the measurement is worth, and the
 * context is handed back immediately through `WEBGL_lose_context` rather than
 * left for the collector.
 *
 * Every probe is wrapped, and so is the hook itself. A detection that throws
 * must never cancel a payload: `drop` is only ever set inside the `try`, so any
 * failure leaves it false and the payload goes out untouched, because losing
 * analytics is worse than failing to label it.
 *
 * Written as a string because it has to run BEFORE the deferred tracker reads
 * the global, exactly like the session-id fetch patch beside it. It is inline
 * and synchronous for that reason, and deliberately small.
 */
export const BOT_SIGNALS_SCRIPT = `(function(){
var W=window;
if(W.${UMAMI.BEFORE_SEND_GLOBAL})return;
var DROP=${JSON.stringify(DROP_SIGNALS)};
var cached=null;
function ua(){try{return navigator.userAgent||""}catch(e){return ""}}
function signals(){
if(cached)return cached;
var out=[],u=ua();
try{if(navigator.webdriver===true)out.push("${BotSignal.WebDriver}")}catch(e){}
try{
var c=document.createElement("canvas");
var gl=c.getContext("webgl")||c.getContext("experimental-webgl");
if(gl){
var x=gl.getExtension("WEBGL_debug_renderer_info");
var r=x?String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)||""):"";
if(/swiftshader|llvmpipe|softwarerasterizer|mesa offscreen/i.test(r))out.push("${BotSignal.SoftwareWebgl}");
var lose=gl.getExtension("WEBGL_lose_context");
if(lose)lose.loseContext();
}else{out.push("${BotSignal.NoWebgl}")}
}catch(e){}
try{if(/Chrome\\//.test(u)&&!W.chrome)out.push("${BotSignal.NoChrome}")}catch(e){}
try{if(/Chrome\\//.test(u)&&navigator.plugins&&navigator.plugins.length===0)out.push("${BotSignal.NoPlugins}")}catch(e){}
try{
var tz=(W.Intl&&W.Intl.DateTimeFormat)?(W.Intl.DateTimeFormat().resolvedOptions().timeZone||""):"";
if(!tz||/^(?:utc|gmt|etc\\/)/i.test(tz))out.push("${BotSignal.UtcTimezone}");
}catch(e){}
try{if(/Chrome\\//.test(u)&&typeof W.outerHeight==="number"&&W.innerHeight>0&&W.outerHeight<=W.innerHeight)out.push("${BotSignal.NoWindowFrame}")}catch(e){}
try{if(/Chrome\\//.test(u)&&navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=2)out.push("${BotSignal.FewCores}")}catch(e){}
cached=out;
return out;
}
W.${UMAMI.BEFORE_SEND_GLOBAL}=function(type,payload){
var drop=false;
try{
var s=signals();
for(var i=0;i<s.length;i++)if(DROP.indexOf(s[i])!==-1){drop=true;break}
if(!drop&&s.length&&payload&&!payload.tag)payload.tag=("${UMAMI.BOT_TAG_PREFIX}"+s.join("-")).slice(0,50);
}catch(e){}
return drop?null:payload;
};
})();`;
