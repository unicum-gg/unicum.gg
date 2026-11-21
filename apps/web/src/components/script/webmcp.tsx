/**
 * Offers this site's API to a browser-side agent as callable tools.
 *
 * Registers on both `navigator.modelContext` (Chrome's EPP) and
 * `document.modelContext` (the W3C shape) to cover both implementations.
 *
 * **The catalogue is fetched, not carried.** It used to be serialised into this
 * script, which put 102,419 octets on every page of the site in every language,
 * 48% of the lightest page, counted twice because Next repeats a
 * server-rendered script inside the RSC payload beside the markup. The same
 * bytes then sat in every ISR entry, around 283 MB of a 4 GiB store holding one
 * catalogue ~2,761 times. `/api/mcp/tools.json` is that catalogue at one
 * address: the browser fetches it once and reuses it for the whole visit, and
 * the edge holds one copy for the whole site.
 *
 * What that costs is the one thing the inline version bought: registration is
 * no longer complete at parse time. The request STARTS at parse time, before
 * React hydrates, so the gap is a single round trip onto a cached file rather
 * than a wait on the page. An agent reads a page before it acts on it, so tools
 * that arrive a round trip later are tools that arrive in time; a page that is
 * half catalogue is a cost every reader pays whether an agent is there or not.
 */
export function WebMcp() {
  // Inlined so the fetch is issued at parse time rather than after hydration.
  const script = `(function(){
function buildPath(tpl,args){
  var p=tpl,q={};
  Object.keys(args).forEach(function(k){
    var v=args[k];if(v==null)return;
    if(p.indexOf('{'+k+'}')!==-1)p=p.replace('{'+k+'}',encodeURIComponent(String(v)));
    else q[k]=String(v);
  });
  var s=new URLSearchParams(q).toString();
  return'/api'+p+(s?'?'+s:'');
}
function register(defs){
  var nav=typeof navigator!=='undefined'&&navigator.modelContext;
  var doc=typeof document!=='undefined'&&document.modelContext;
  // Nothing to register into: no agent is listening, so the catalogue is not
  // worth asking for. Checked before the fetch for that reason.
  if(!nav&&!doc)return;
  defs.forEach(function(d){
    var t={
      name:d.name,description:d.description,inputSchema:d.inputSchema,
      annotations:{readOnlyHint:true},
      execute:function(i){return fetch(buildPath(d.path,i)).then(function(r){return r.json();});}
    };
    if(nav&&nav.registerTool)try{nav.registerTool(t);}catch(e){}
    if(doc&&doc.registerTool)try{doc.registerTool(t);}catch(e){}
  });
}
function start(){
  var nav=typeof navigator!=='undefined'&&navigator.modelContext;
  var doc=typeof document!=='undefined'&&document.modelContext;
  if(!nav&&!doc)return;
  fetch('/api/mcp/tools.json').then(function(r){return r.json();}).then(register).catch(function(){});
}
if(typeof document!=='undefined'&&document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',start);
else start();
})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
