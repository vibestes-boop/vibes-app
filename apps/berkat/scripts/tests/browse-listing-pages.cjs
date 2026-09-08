// Local HTTP-shaped fixtures, real InfiniteQueryObserver, no backend mutations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { QueryClient, InfiniteQueryObserver } = require('@tanstack/query-core');
const root = path.resolve(__dirname, '../..');
const plain = x => JSON.parse(JSON.stringify(x));
const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const price = row => row.status === 'scheduled' ? row.start_price_cents : row.buy_now_cents;
// Independent timestamp comparison keeps the backend's six fractional digits.
const time = value => BigInt(Date.parse(value)) * 1000n + BigInt((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3,6));
const cmp = (a,b) => a === b ? 0 : a < b ? -1 : 1;
const ordered = (rows, sort='neu') => rows.slice().sort((a,b) =>
  (sort === 'neu' ? 0 : (price(a)-price(b)) * (sort === 'guenstig' ? 1 : -1)) || cmp(time(b.created_at), time(a.created_at)) || cmp(b.id,a.id));
function split(value) {
  let depth=0, quote=false, escape=false, start=0, result=[];
  for (let i=0;i<value.length;i++) {
    const c=value[i];
    if(escape) { escape=false; continue; }
    if(quote && c==='\\') { escape=true; continue; }
    if(c==='"') quote=!quote;
    if(quote) continue;
    if(c==='(') depth++;
    if(c===')') depth--;
    if(c===',' && depth===0) {result.push(value.slice(start,i));start=i+1;}
  }
  assert.equal(depth,0); assert.equal(quote,false);
  return [...result,value.slice(start)];
}
function match(row, logic) {
  for(const kind of ['and','or']) if(logic.startsWith(kind+'(')) {
    assert.ok(logic.endsWith(')'));
    const children=split(logic.slice(kind.length+1,-1));
    return kind==='and' ? children.every(x=>match(row,x)) : children.some(x=>match(row,x));
  }
  const parts=logic.match(/^([a-z_]+)\.(eq|lt|gt|imatch)\.(.*)$/s); assert.ok(parts,logic);
  let [,col,op,value]=parts;
  if(value.startsWith('"')) value=JSON.parse(value);
  if(op==='imatch') return row[col]!=null && new RegExp(value,'i').test(row[col]);
  let actual=row[col];
  if(col==='created_at') { actual=time(actual); value=time(value); }
  else if(col.endsWith('_cents')) value=Number(value);
  return op==='eq' ? actual===value : op==='lt' ? actual<value : actual>value;
}
function response(rows, call) {
  let result=rows.filter(row=>call.filters.every(([op,col,v,extra])=>
    op==='is' ? row[col]===v : op==='eq' ? row[col]===v : op==='in' ? v.includes(row[col]) :
    op==='not' ? row[col]!==extra : op==='lte' ? row[col]<=v : new RegExp(extra,'i').test(row[col]??'')));
  if(call.select.includes('!inner')) result=result.filter(row=>row.show!==null);
  if(call.or) result=result.filter(row=>match(row,call.or));
  result.sort((a,b)=> {for(const [col,{ascending}] of call.orders) {
    const d=col==='created_at'?cmp(time(a[col]),time(b[col])):cmp(a[col],b[col]);
    if(d) return ascending?d:-d;
  } return 0;});
  return {data:result.slice(0,call.limit),error:null};
}
function load(request, capturedResult={}, debounce) {
  let config;
  const api={from:table=>{
    const call={table,filters:[],orders:[]};
    const builder={then:(yes,no)=>Promise.resolve().then(()=>request(call)).then(yes,no)};
    for(const op of ['is','eq','not','in','lte','filter']) builder[op]=(...args)=>{call.filters.push([op,...args]);return builder;};
    for(const op of ['select','or','limit','retry']) builder[op]=value=>{call[op]=value;return builder;};
    builder.order=(...args)=>{call.orders.push(args);return builder;};
    builder.abortSignal=signal=>{call.signal=signal;return builder;};
    return builder;
  }};
  const deps={react:{useMemo:fn=>fn()},'@tanstack/react-query':{useInfiniteQuery:value=>{config=value;return capturedResult;}},
    './supabase':{supabase:api},'./useSellerSearch':{useDebounced:debounce??(value=>value)},
    './useListings':{LISTING_COLUMNS:'id,show:scheduled_lives!planned_for(scheduled_at,title,status)',listingPrice:row=>({cents:price(row)})}};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'lib/useBrowseListingPages.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context=vm.createContext({exports:{},require:name=>deps[name]});vm.runInContext(code,context);
  return {...context.exports,options:(filters={},enabled=true,scope)=>{context.exports.useBrowseListingPages(filters,enabled,scope);return {...config,queryKey:plain(config.queryKey)};}};
}
const rows = count => Array.from({length:count},(_,i)=>({
  id:`00000000-0000-4000-8000-${String(10000-i).padStart(12,'0')}`,session_id:null,
  status:i%3===0?'scheduled':'listed',show:i%3===0?{status:'scheduled'}:null,
  created_at:`2026-09-08T14:00:00.${String(500000-Math.floor(i/2)).padStart(6,'0')}+00:00`,
  buy_now_cents:i%3===0?99000:500+((i*17)%23)*100,start_price_cents:500+((i*17)%23)*100,
  title:`Offer ${i}`,size:i===94?'One Size':'M',city:i===94?'Zürich':'Berlin',category:i%2?'child':'parent',condition:'neu',
}));
async function observe(config, run) {
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  const observer=new InfiniteQueryObserver(client,config),stop=observer.subscribe(()=>{});
  try {await flush();await run(observer,client);} finally {stop();client.clear();}
}
for(const count of [0,1,30,31,60,65,95]) for(const sort of ['neu','guenstig','teuer']) test(`${count} mixed offers / ${sort}: complete stable pages`,async()=>{
  const all=rows(count),calls=[];const lib=load(call=>{calls.push(call);return response(all,call);});
  await observe(lib.options({sort}),async observer=>{
    while(observer.getCurrentResult().hasNextPage) await observer.fetchNextPage({cancelRefetch:false});
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),ordered(all,sort));
    assert.equal(calls.length,2*Math.max(1,Math.ceil(count/30)));
    for(const call of calls) {assert.equal(call.limit,31);assert.equal(call.retry,false);assert.ok(call.signal);}
  });
});
test('parent/child, text, size, city, condition and price apply before first-page limits',async()=>{
  const all=rows(95),calls=[],lib=load(call=>{calls.push(call);return response(all,call);});
  const result=await lib.fetchBrowsePage({slugs:['child','parent'],query:'Offer',size:'one',city:'zÜR',condition:'neu',maxPrice:3000},null,new AbortController().signal);
  assert.deepEqual(plain(result.rows),[all[94]]);
  for(const call of calls) assert.deepEqual(plain(call.filters.find(f=>f[0]==='in')),['in','category',['child','parent']]);
  assert.equal(calls[0].filters.find(f=>f[0]==='lte')[1],'buy_now_cents');
  assert.equal(calls[1].filters.find(f=>f[0]==='lte')[1],'start_price_cents');
});
test('search literal cannot inject logic or become a wildcard; cursor AND search both apply',async()=>{
  const needle='100% * (x),"a"\\ b.[z]$';const all=rows(95).map(row=>({...row,title:needle}));
  all[70].title='non-matching';const lib=load(call=>response(all,call));
  await observe(lib.options({query:needle}),async observer=>{
    while(observer.getCurrentResult().hasNextPage) await observer.fetchNextPage({cancelRefetch:false});
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),ordered(all.filter(r=>r.title===needle)));
  });
});
test('scheduled without a visible plan and listed without fixed price are excluded before paging',async()=>{
  const all=rows(95);all.filter(r=>r.status==='scheduled').slice(0,20).forEach(row=>row.show=null);
  all[1].buy_now_cents=null;
  const calls=[],lib=load(call=>{calls.push(call);return response(all,call);});
  await observe(lib.options(),async observer=>{
    while(observer.getCurrentResult().hasNextPage) await observer.fetchNextPage({cancelRefetch:false});
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),ordered(all.filter(row=>row.status==='scheduled'?row.show!==null:row.buy_now_cents!==null)));
  });
  assert.ok(calls.filter(c=>c.filters.some(f=>f[2]==='scheduled')).every(c=>c.select.includes('!planned_for!inner(')));
});
test('only show executes one branch and uses its start price even with an optional buy-now price',async()=>{
  const all=rows(95),calls=[],lib=load(call=>{calls.push(call);return response(all,call);});
  await observe(lib.options({onlyShow:true,sort:'guenstig'}),async observer=>{
    while(observer.getCurrentResult().hasNextPage) await observer.fetchNextPage({cancelRefetch:false});
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),ordered(all.filter(r=>r.status==='scheduled'),'guenstig'));
  });assert.equal(calls.length,2);
});
test('mixed timezone strings, exact microseconds and equal timestamps match database order',()=>{
  const lib=load(()=>({data:[]}));const all=rows(4);
  all[0].created_at='2026-09-08T16:00:00.500009+02:00';all[1].created_at='2026-09-08T14:00:00.500008Z';
  all[2].created_at='2026-09-08T14:00:00.500009+00:00';all[3].created_at='2026-09-08T14:00:00.501Z';
  assert.deepEqual(all.slice().sort((a,b)=>lib.compareBrowseListings(a,b,'neu')),ordered(all));
});
test('next-page branch failure retains whole loaded page; retry and shrink refresh recover',async()=>{
  let all=rows(95),fail=false,calls=0;const lib=load(call=>{calls++;return fail&&call.filters.some(f=>f[2]==='scheduled')?{data:null,error:{code:'42501'}}:response(all,call);});
  await observe(lib.options(),async observer=>{
    const initial=plain(observer.getCurrentResult().data.listings);fail=true;
    await observer.fetchNextPage({cancelRefetch:false});assert.equal(observer.getCurrentResult().isFetchNextPageError,true);
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),initial);
    fail=false;await observer.fetchNextPage({cancelRefetch:false});assert.equal(observer.getCurrentResult().data.listings.length,60);
    fail=true;await observer.refetch();assert.equal(observer.getCurrentResult().isRefetchError,true);assert.equal(observer.getCurrentResult().data.listings.length,60);
    fail=false;all=rows(1);let before=calls;await observer.refetch();assert.equal(calls-before,2);assert.equal(observer.getCurrentResult().data.listings.length,1);assert.equal(observer.getCurrentResult().hasNextPage,false);
  });
});
test('empty categories/hidden screen disabled; canonical filters isolate cache from legacy arrays',()=>{
  const lib=load(()=>({data:[]}));assert.equal(lib.options({},false).enabled,false);assert.equal(lib.options({slugs:[]}).enabled,false);
  assert.deepEqual(lib.options({slugs:['b','a','a'],query:' x '}).queryKey,lib.options({slugs:['a','b'],query:'x'}).queryKey);
  assert.deepEqual(lib.options({},true,'category-listings').queryKey.slice(0,3),['berkat','category-listings','pages']);
  for(const filter of [{query:'new'},{sort:'teuer'},{city:'B'},{size:'M'},{condition:'neu'},{maxPrice:1000},{onlyShow:true},{slugs:['a']}]) assert.notDeepEqual(lib.options(filter).queryKey,lib.options().queryKey);
});
test('debouncing disables stale query and hides old cards, errors and load-more action',()=>{
  const lib=load(()=>({data:[]}),{data:{listings:rows(1)},isError:true,isFetchNextPageError:true,hasNextPage:true},()=>JSON.stringify({query:'old'}));
  const result=lib.useBrowseListingPages({query:'new'});
  assert.equal(result.data,undefined);assert.equal(result.isError,false);assert.equal(result.isFetchNextPageError,false);assert.equal(result.hasNextPage,false);assert.equal(result.isLoading,true);
  assert.equal(lib.options({query:'new'}).enabled,false);
});
test('shared next-page calls do not duplicate requests; unmount aborts both streams',async()=>{
  const all=rows(95);let pending=[],defer=false,calls=0;const lib=load(call=>{calls++;return defer?new Promise(resolve=>pending.push({call,resolve})):response(all,call);});
  await observe(lib.options(),async observer=>{
    defer=true;const a=observer.fetchNextPage({cancelRefetch:false}),b=observer.fetchNextPage({cancelRefetch:false});await flush();assert.equal(calls,4);
    for(const p of pending) p.resolve(response(all,p.call));await Promise.all([a,b]);assert.equal(observer.getCurrentResult().data.listings.length,60);
    pending=[];observer.fetchNextPage({cancelRefetch:false});await flush();observer.destroy();assert.equal(pending.length,2);assert.ok(pending.every(p=>p.call.signal.aborted));
    for(const p of pending) p.resolve(response(all,p.call));
  });
});
test('retry is bounded, dedup guards cross-page changes and invalidation prefix still matches',async()=>{
  const lib=load(call=>response(rows(31),call));const config=lib.options();
  assert.equal(config.retry(0,{code:'network'}),true);assert.equal(config.retry(1,{code:'network'}),false);assert.equal(config.retry(0,{code:'42501'}),false);
  assert.equal(config.select({pages:[{rows:rows(2)},{rows:rows(3)}],pageParams:[null,null]}).listings.length,3);
  await observe(config,async (observer,client)=>{await client.invalidateQueries({queryKey:['berkat','shop'],refetchType:'none'});assert.equal(client.getQueryState(config.queryKey).isInvalidated,true);});
});

test('changing filters aborts previous request and a late reply cannot replace new results',async()=>{
  const all=rows(95);let pending=[];
  const lib=load(call=>call.or?.includes('Offer 94')?response(all,call):new Promise(resolve=>pending.push({call,resolve})));
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  const observer=new InfiniteQueryObserver(client,lib.options()),stop=observer.subscribe(()=>{});
  try{
    await flush();assert.equal(pending.length,2);
    observer.setOptions(lib.options({query:'Offer 94'}));await flush();
    assert.ok(pending.every(p=>p.call.signal.aborted));
    assert.equal(observer.getCurrentResult().data.listings.length,1);
    for(const p of pending)p.resolve(response(all,p.call));await flush();
    assert.deepEqual(plain(observer.getCurrentResult().data.listings),[all[94]]);
  }finally{stop();client.clear();}
});

test('category hook gates both content queries by focus and keeps its live query cancellable',async()=>{
  let calls=[],showsConfig,browseArgs,signal;
  const builder={};for(const op of ['select','eq','in','order','limit','retry'])builder[op]=(...args)=>{calls.push([op,...args]);return builder;};
  builder.abortSignal=value=>{signal=value;return builder;};builder.then=(yes,no)=>Promise.resolve({data:[],error:null}).then(yes,no);
  const deps={react:{useMemo:fn=>fn()},'@tanstack/react-query':{useQuery:config=>{showsConfig=config;return{};}},'./supabase':{supabase:{from:()=>builder}},'./useBrowseListingPages':{useBrowseListingPages:(...args)=>{browseArgs=args;return{};}}};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'lib/useCategories.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context=vm.createContext({exports:{},require:name=>deps[name]});vm.runInContext(code,context);
  context.exports.useCategoryContent(['parent','child'],false);
  assert.equal(showsConfig.enabled,false);assert.equal(browseArgs[1],false);assert.equal(browseArgs[2],'category-listings');
  context.exports.useCategoryContent(['parent','child'],true);assert.equal(showsConfig.enabled,true);
  const controller=new AbortController();await showsConfig.queryFn({signal:controller.signal});assert.equal(signal,controller.signal);
  assert.deepEqual(plain(calls.find(c=>c[0]==='retry')),['retry',false]);assert.equal(showsConfig.retry(1,{}),false);
  context.exports.useCategoryContent([],true);assert.equal(showsConfig.enabled,false);
});
