import UMAMI from "@/constants/umami";

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
 * WHY IT TAGS RATHER THAN DROPS. The hook can cancel a send outright, and that
 * is the end state rather than the first step. Dropping traffic nobody has
 * measured would correct a number without knowing by how much, and would hide a
 * false positive on real players instead of surfacing it. So every payload is
 * still sent, carrying a `tag` that names the signals which fired, and the
 * dashboard can split on it. Read the split, confirm no reader is caught, then
 * return null here for the cases that are confirmed.
 *
 * THE SIGNALS, STRONGEST FIRST.
 * `swgl` is a software WebGL renderer (SwiftShader, llvmpipe, Mesa offscreen).
 * A headless browser with no GPU renders through one, and presenting a
 * plausible renderer string instead needs real hardware behind it, so this is
 * the costliest one to defeat.
 * `webdriver` is `navigator.webdriver`, which Puppeteer and Playwright set
 * unless they are patched. Trivial to hide, free to check, so it is kept for
 * the ones that did not bother.
 * `nochrome` and `noplugins` are inconsistencies rather than detections: a user
 * agent claiming Chrome desktop while `window.chrome` or the plugin list is
 * missing. Weak alone, useful in combination, which is why the tag lists every
 * signal that fired rather than a single verdict.
 *
 * It is evaluated ONCE per page and memoised. Building a WebGL context on every
 * pageview would cost a real reader more than the measurement is worth, and the
 * context is handed back immediately through `WEBGL_lose_context` rather than
 * left for the collector.
 *
 * Every probe is wrapped, and so is the hook itself. A detection that throws
 * must never stop a payload from being sent: on any failure the payload goes
 * out untouched, because losing analytics is worse than failing to label it.
 *
 * Written as a string because it has to run BEFORE the deferred tracker reads
 * the global, exactly like the session-id fetch patch beside it. It is inline
 * and synchronous for that reason, and deliberately small.
 */
export const BOT_SIGNALS_SCRIPT = `(function(){
var W=window;
if(W.${UMAMI.BEFORE_SEND_GLOBAL})return;
var cached=null;
function ua(){try{return navigator.userAgent||""}catch(e){return ""}}
function signals(){
if(cached)return cached;
var out=[],u=ua();
try{if(navigator.webdriver===true)out.push("webdriver")}catch(e){}
try{
var c=document.createElement("canvas");
var gl=c.getContext("webgl")||c.getContext("experimental-webgl");
if(gl){
var x=gl.getExtension("WEBGL_debug_renderer_info");
var r=x?String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)||""):"";
if(/swiftshader|llvmpipe|softwarerasterizer|mesa offscreen/i.test(r))out.push("swgl");
var lose=gl.getExtension("WEBGL_lose_context");
if(lose)lose.loseContext();
}else{out.push("nogl")}
}catch(e){}
try{if(/Chrome\\//.test(u)&&!W.chrome)out.push("nochrome")}catch(e){}
try{if(/Chrome\\//.test(u)&&navigator.plugins&&navigator.plugins.length===0)out.push("noplugins")}catch(e){}
cached=out;
return out;
}
W.${UMAMI.BEFORE_SEND_GLOBAL}=function(type,payload){
try{
var s=signals();
if(s.length&&payload&&!payload.tag)payload.tag=("${UMAMI.BOT_TAG_PREFIX}"+s.join("-")).slice(0,50);
}catch(e){}
return payload;
};
})();`;
