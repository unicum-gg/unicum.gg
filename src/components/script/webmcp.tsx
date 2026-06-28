import { TOOL_DEFS } from "@/services/mcp/tools";

type SerializedDef = {
  name: string;
  description: string;
  inputSchema: (typeof TOOL_DEFS)[number]["inputSchema"];
  path: string;
};

export function WebMcp() {
  const defs: SerializedDef[] = TOOL_DEFS.map(
    ({ name, description, inputSchema, path }) => ({
      name,
      description,
      inputSchema,
      path,
    }),
  );

  // Inlined so the script runs at parse time, before React hydrates.
  // Using two patterns: W3C (document.modelContext.registerTool) and the
  // older Chrome EPP draft (navigator.modelContext.provideContext).
  const script = `(function(){
var defs=${JSON.stringify(defs)};
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
function register(){
  var tools=defs.map(function(d){
    return{
      name:d.name,description:d.description,inputSchema:d.inputSchema,
      annotations:{readOnlyHint:true},
      execute:function(i){return fetch(buildPath(d.path,i)).then(function(r){return r.json();});}
    };
  });
  var nav=typeof navigator!=='undefined'&&navigator.modelContext;
  var doc=typeof document!=='undefined'&&document.modelContext;
  if(nav&&nav.provideContext)try{nav.provideContext(tools);}catch(e){}
  if(doc&&doc.registerTool)tools.forEach(function(t){try{doc.registerTool(t);}catch(e){}});
}
if(typeof document!=='undefined'&&document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',register);
else register();
})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
