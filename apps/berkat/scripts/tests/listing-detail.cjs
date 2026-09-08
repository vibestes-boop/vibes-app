const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = x => JSON.parse(JSON.stringify(x));
const flush = async () => {for(let i=0;i<80;i++)await Promise.resolve();};
function load(file,deps){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ctx=vm.createContext({exports:{},Map,require:name=>deps[name]??{}});vm.runInContext(code,ctx);return ctx.exports;}
function detail(client,result={}){return load('lib/useListingDetail.ts',{'react':{useMemo:fn=>fn()},'@tanstack/react-query':{useQueryClient:()=>client},'./useListings':{useListing:()=>result}});}
const client=()=>new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
const row=(id='a',extra={})=>({id,title:'Cached offer',women_only:false,...extra});
for(const [prefix,data] of [
 ['shop',[row()]],['category-listings',{pages:[{rows:[row('other')]},{rows:[row()]}]}],
 ['standing',{pages:[{rows:[row()]}]}],['listing-search',[row()]],
 ['saved-listings',[row()]],['listings-by-ids',new Map([['a',row()]])],
])test(`${prefix}: already loaded data is available without promoting it to detail cache`,()=>{
 const c=client();try{c.setQueryData(['berkat',prefix,'source'],data);const lib=detail(c,{isLoading:true});const state=lib.useListingDetail('a');
 assert.equal(state.data.id,'a');assert.equal(state.isPreview,true);assert.equal(state.isLoading,false);assert.equal(c.getQueryData(['berkat','listing','a']),undefined);
 }finally{c.clear();}
});
test('freshest list wins; protected version blocks older public preview',()=>{
 const c=client();try{c.setQueryData(['berkat','shop'],[row()],{updatedAt:1});c.setQueryData(['berkat','standing','seller'],[row('a',{title:'Newer'})],{updatedAt:2});
 const lib=detail(c);assert.equal(lib.cachedListingPreview(c,'a').title,'Newer');c.setQueryData(['berkat','standing','seller'],[row('a',{women_only:true})],{updatedAt:3});assert.equal(lib.cachedListingPreview(c,'a'),undefined);
 }finally{c.clear();}
});
test('unrelated or partial data and a different route cannot become the preview',()=>{
 const c=client();try{c.setQueryData(['other','shop'],[row()]);c.setQueryData(['berkat','auctions'],[row()]);c.setQueryData(['berkat','shop'],[row('b'),{id:'a'}]);const lib=detail(c,{isLoading:true});
 assert.equal(lib.useListingDetail('a').data,undefined);assert.equal(lib.useListingDetail('c').data,undefined);assert.equal(lib.useListingDetail(undefined).data,undefined);assert.equal(lib.useListingDetail('c').isLoading,true);
 }finally{c.clear();}
});
test('verified result takes precedence, including null after removal or loss of access',()=>{
 const c=client();try{c.setQueryData(['berkat','shop'],[row()]);for(const data of [null,row('a',{status:'sold'})]){
  const result=detail(c,{data,isLoading:false}).useListingDetail('a');assert.equal(result.data,data);assert.equal(result.isPreview,false);
 }}finally{c.clear();}
});
test('network failure retains read-only preview, permission failure does not',()=>{
 const c=client();try{c.setQueryData(['berkat','shop'],[row()]);const fail=detail(c,{isError:true,error:{code:'network'}}).useListingDetail('a');assert.equal(fail.isPreview,true);assert.equal(fail.isError,true);
 const denied=detail(c,{isError:true,error:{code:'42501'}}).useListingDetail('a');assert.equal(denied.data,undefined);assert.equal(denied.isPreview,false);
 }finally{c.clear();}
});
function config(request,id,enabled=true){if(arguments.length<2)id='a';let options;const calls=[];const api={from:table=>{const call={table,filters:[]};const b={then:(yes,no)=>Promise.resolve().then(()=>{calls.push(call);return request(call);}).then(yes,no)};
 for(const op of ['select','or','retry'])b[op]=v=>{call[op]=v;return b;};b.eq=(...args)=>{call.filters.push(args);return b;};b.abortSignal=signal=>{call.signal=signal;return b;};b.maybeSingle=()=>{call.single=true;return b;};return b;}};
 load('lib/useListings.ts',{'@tanstack/react-query':{useQuery:value=>{options=value;return{};}},'./supabase':{supabase:api}}).useListing(id,enabled);return {options:{...options,queryKey:plain(options.queryKey)},calls};}
async function observe(options,run){const c=client(),o=new QueryObserver(c,options),stop=o.subscribe(()=>{});try{await flush();await run(o,c);}finally{stop();c.clear();}}
test('detail query keeps cache identity and visibility boundary, signals cancellation, bounds retry',async()=>{
 const {options,calls}=config(()=>({data:row(),error:null}));assert.deepEqual(options.queryKey,['berkat','listing','a']);
 assert.equal(options.retry(0,{}),true);assert.equal(options.retry(1,{}),false);assert.equal(options.retry(0,{code:'42501'}),false);
 await observe(options,async o=>{assert.equal(o.getCurrentResult().data.id,'a');assert.equal(calls.length,1);const q=calls[0];assert.equal(q.or,'session_id.is.null,status.eq.sold');assert.deepEqual(q.filters,[['id','a']]);assert.ok(q.signal);assert.equal(q.retry,false);assert.equal(q.single,true);});
});
test('hidden or absent listing does not fetch',async()=>{
 for(const [id,enabled] of [[undefined,true],['a',false]]){const r=config(()=>({data:row()}),id,enabled);await observe(r.options,async()=>assert.equal(r.calls.length,0));}
});
test('mount/focus refetch shares ongoing request and cache refetch keeps known detail visible',async()=>{
 let release;const r=config(()=>new Promise(resolve=>{release=resolve;}));
 await observe(r.options,async o=>{const p=o.refetch({cancelRefetch:false});await flush();assert.equal(r.calls.length,1);release({data:row(),error:null});await p;
 const a=o.refetch({cancelRefetch:false}),b=o.refetch({cancelRefetch:false});await flush();assert.equal(r.calls.length,2);assert.equal(o.getCurrentResult().data.id,'a');release({data:row('a',{status:'sold'}),error:null});await Promise.all([a,b]);assert.equal(o.getCurrentResult().data.status,'sold');});
});
test('failed refetch retains verified data; retry can authoritatively remove it',async()=>{
 let mode='ok';const r=config(()=>mode==='fail'?{data:null,error:{code:'42501'}}:{data:mode==='empty'?null:row(),error:null});
 await observe(r.options,async o=>{mode='fail';await o.refetch();assert.equal(o.getCurrentResult().isError,true);assert.equal(o.getCurrentResult().data.id,'a');mode='empty';await o.refetch();assert.equal(o.getCurrentResult().data,null);});
});
test('leaving detail aborts its request',async()=>{
 let release;const r=config(()=>new Promise(resolve=>{release=resolve;}));
 await observe(r.options,async o=>{o.destroy();assert.equal(r.calls[0].signal.aborted,true);release({data:row(),error:null});await flush();});
});
