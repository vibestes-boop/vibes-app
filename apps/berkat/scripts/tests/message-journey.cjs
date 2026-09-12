const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), ts=require('typescript');
const {QueryClient, QueryObserver}=require('@tanstack/query-core');
const root=path.resolve(__dirname,'../..'), plain=x=>JSON.parse(JSON.stringify(x));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function load(file,mocks={}) {
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const ctx=vm.createContext({exports:{},require:name=>mocks[name]??{},Date,__DEV__:false});vm.runInContext(code,ctx);return ctx.exports;
}
function draftFixture(send=async()=>({ok:true}),upload=async()=>null){
 const slots=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useCallback:fn=>fn};
 const h=load('lib/useMessageDraft.ts',{react});
 return{render(){cursor=0;return h.useMessageDraft('Meine Frage','listing-a',send,upload);}};
}
test('a picked photo is previewed, never sent automatically; success clears the exact draft only after confirmation',async()=>{
 let resolve;const calls=[];const f=draftFixture((...args)=>{calls.push(args);return new Promise(done=>resolve=done);},async()=>'photo.jpg');
 await f.render().addPhoto();let v=f.render();assert.equal(v.photo,'photo.jpg');assert.equal(calls.length,0);
 const pending=v.onSend();v=f.render();assert.equal(v.busy,'send');assert.equal(v.draft,'Meine Frage');assert.equal(v.attached,'listing-a');
 assert.deepEqual(calls,[['Meine Frage','photo.jpg','listing-a']]);resolve({ok:true});await pending;
 v=f.render();assert.equal(v.draft,'');assert.equal(v.photo,null);assert.equal(v.attached,null);assert.equal(v.busy,null);
});
test('rapid taps and an upload during sending share a synchronous lock',async()=>{
 let resolve,calls=0,uploads=0;const f=draftFixture(()=>{calls++;return new Promise(done=>resolve=done);},async()=>{uploads++;return'photo.jpg';});
 const v=f.render(), first=v.onSend();await v.onSend();await v.addPhoto();assert.equal(calls,1);assert.equal(uploads,0);resolve({ok:true});await first;
});
for(const throws of [false,true])test(`failed ${throws?'thrown':'reported'} send retains text, photo and listing`,async()=>{
 const f=draftFixture(async()=>{if(throws)throw Error('offline');return{ok:false,message:'Nicht bestätigt'};},async()=>'photo.jpg');
 await f.render().addPhoto();await f.render().onSend();const v=f.render();assert.equal(v.draft,'Meine Frage');assert.equal(v.photo,'photo.jpg');assert.equal(v.attached,'listing-a');assert.equal(v.busy,null);assert.ok(v.notice);
});
test('cancelled and failed photo selections keep an existing attachment without sending',async()=>{
 let mode='ok',sends=0;const f=draftFixture(async()=>{sends++;return{ok:true};},async()=>{if(mode==='error')throw Error('offline');return mode==='ok'?'photo.jpg':null;});
 await f.render().addPhoto();for(const value of ['cancel','error']){mode=value;await f.render().addPhoto();const v=f.render();assert.equal(v.photo,'photo.jpg');assert.equal(v.draft,'Meine Frage');assert.equal(v.attached,'listing-a');assert.equal(v.busy,null);}assert.equal(sends,0);
});
test('uploading disables text submission; after upload the photo-only draft can be sent',async()=>{
 let resolve,calls=0;const f=draftFixture(async()=>{calls++;return{ok:true};},()=>new Promise(done=>resolve=done));
 let v=f.render();v.setDraft('');v=f.render();await v.onSend();assert.equal(calls,0);
 const upload=v.addPhoto();await f.render().onSend();assert.equal(calls,0);assert.equal(f.render().busy,'upload');resolve('photo.jpg');await upload;await f.render().onSend();assert.equal(calls,1);
});
function apiFixture(reply){
 const calls=[];const api={from(table){const q={table,filters:[]};const b={then(ok,fail){calls.push(q);return Promise.resolve().then(()=>reply(q)).then(ok,fail);}};
 for(const name of ['select','limit','retry','abortSignal','insert','order'])b[name]=(...args)=>{q[name]=args.length===1?args[0]:args;return b;};
 for(const name of ['eq','in','is','neq','or'])b[name]=(...args)=>{q.filters.push([name,...args]);return b;};
 b.single=b.maybeSingle=()=>b;return b;}};return{api,calls};
}
function queryFixture(reply,hook='useConversationWith',args=['buyer','seller']){
 const api=apiFixture(reply);let options;const effects=[],subscriptions=[];
 const h=load('lib/useDirectMessages.ts',{react:{useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},'@tanstack/react-query':{useQuery:o=>{options=o;return{};},useQueryClient:()=>({invalidateQueries(){}})},'./supabase':{supabase:api.api},'./realtime':{subscribeToTable:(...values)=>{subscriptions.push(values);return()=>{};}}});
 h[hook](...args);effects.forEach(fn=>fn());return{...api,options:{...options,queryKey:plain(options.queryKey),retry:false},subscriptions};
}
async function observe(f,check){const c=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}}),o=new QueryObserver(c,f.options),off=o.subscribe(()=>{});try{await flush();await check(o,c);}finally{off();c.clear();}}
test('a failed conversation read is an error, not a new conversation; retry can confirm absence without writing',async()=>{
 let fail=true;const f=queryFixture(()=>fail?{error:{code:'offline'}}:{data:null});await observe(f,async o=>{assert.equal(o.getCurrentResult().isError,true);assert.equal(o.getCurrentResult().data,undefined);fail=false;await o.refetch();assert.equal(o.getCurrentResult().data,null);assert.ok(f.calls.every(q=>!q.insert));});
});
test('conversation lookup uses sorted participants and account-scoped key, with abortable requests',async()=>{
 const f=queryFixture(()=>({data:{id:'conversation'}}),'useConversationWith',['z-buyer','a-seller']);await observe(f,async o=>{assert.equal(o.getCurrentResult().data,'conversation');assert.deepEqual(f.options.queryKey,['berkat','conversation','z-buyer','a-seller']);assert.deepEqual(f.calls[0].filters,[['eq','participant_1','a-seller'],['eq','participant_2','z-buyer']]);assert.ok(f.calls[0].abortSignal);assert.equal(f.calls[0].retry,false);});
});
for(const args of [[null,'seller'],['buyer','buyer'],['buyer','seller',false]])test(`unavailable conversation does not fetch: ${args}`,async()=>{
 const f=queryFixture(()=>assert.fail('unexpected request'),'useConversationWith',args);await observe(f,async()=>assert.equal(f.calls.length,0));
});
test('message history is scoped to account and conversation; newest 200 are displayed chronologically',async()=>{
 const f=queryFixture(()=>({data:[{id:'newest'},{id:'older'}]}),'useMessages',['conversation','buyer']);await observe(f,async o=>{assert.deepEqual(f.options.queryKey,['berkat','messages','buyer','conversation']);assert.deepEqual(plain(o.getCurrentResult().data),[{id:'older'},{id:'newest'}]);assert.equal(f.calls[0].limit,200);assert.deepEqual(plain(f.calls[0].order),['created_at',{ascending:false}]);assert.equal(f.subscriptions[0][1].filter,'conversation_id=eq.conversation');});
});
test('hidden history stops reads and realtime subscriptions',async()=>{
 const f=queryFixture(()=>assert.fail('unexpected request'),'useMessages',['conversation','buyer',false]);await observe(f,async()=>{assert.equal(f.calls.length,0);assert.equal(f.subscriptions.length,0);});
});
test('leaving aborts a pending history read',async()=>{
 let finish;const f=queryFixture(()=>new Promise(done=>finish=done),'useMessages',['conversation','buyer']);await observe(f,async o=>{o.destroy();assert.equal(f.calls[0].abortSignal.aborted,true);finish({data:[]});await flush();});
});
for(const thrown of [false,true])test(`failed message ${thrown?'transport':'response'} removes only its own optimistic row`,async()=>{
 let resolve,reject;const client=new QueryClient();const f=apiFixture(()=>new Promise((ok,fail)=>{resolve=ok;reject=fail;}));
 const hooks=load('lib/useDirectMessages.ts',{react:{useCallback:fn=>fn},'@tanstack/react-query':{useQueryClient:()=>client},'./supabase':{supabase:f.api}});
 const key=['berkat','messages','buyer','conversation'];client.setQueryData(key,[{id:'old'}]);const send=hooks.useSendMessage('conversation','buyer','seller');const pending=send('Text','photo.jpg','listing-a');await flush();
 client.setQueryData(key,rows=>[...rows,{id:'incoming'}]);if(thrown)reject(Error('offline'));else resolve({error:{code:'offline'}});
 assert.equal((await pending).ok,false);assert.deepEqual(plain(client.getQueryData(key)),[{id:'old'},{id:'incoming'}]);
 assert.equal(f.calls[0].insert.app,'berkat');assert.equal(f.calls[0].insert.sender_id,'buyer');assert.equal(f.calls[0].insert.listing_id,'listing-a');assert.equal(f.calls[0].insert.image_url,'photo.jpg');client.clear();
});

function screenFixture(change={}) {
 const state={user:'buyer',recipient:'seller',conversation:{data:'conversation',isPending:false,isError:false,refetch(){}},history:{data:[],isPending:false,isError:false,refetch(){}},listing:{data:{id:'listing-a',title:'Artikel'},isSuccess:true,isError:false},blocked:false,...change};
 let sends=0,reads=0;
 const jsx=(type,props,key)=>({type,props:props??{},key});
 const react={useCallback:fn=>fn,useMemo:fn=>fn(),useRef:initial=>({current:initial}),useState:initial=>[initial,()=>{}],useEffect(){}};
 const rn=new Proxy({StyleSheet:{create:x=>x,hairlineWidth:1},Platform:{OS:'ios'},useWindowDimensions:()=>({fontScale:1})},{get:(o,k)=>o[k]??k});
 const hooks={useConversationWith:()=>state.conversation,useMessages:()=>state.history,useSendMessage:()=>()=>{},useMarkMessagesRead:()=>()=>reads++};
 const screen=load('app/messages/[id].tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':rn,'expo-router':{useLocalSearchParams:()=>({id:state.recipient,listing:'listing-a'}),useFocusEffect(){},router:{}},'@react-navigation/native':{useIsFocused:()=>true},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:34})},'../../lib/session':{useSession:f=>f({userId:state.user})},'../../lib/useReducedMotion':{useReducedMotion:()=>false},'../../lib/useAuction':{useProfiles:()=>({})},'../../lib/useDirectMessages':hooks,'../../lib/useMessageDraft':{useMessageDraft:()=>({draft:'Frage',attached:'listing-a',photo:null,busy:null,onSend:()=>sends++,...state.draft})},'../../lib/useListings':{useListing:()=>state.listing,useListingsByIds:()=>({})},'../../lib/useDispute':{useDisputeWith:()=>({})},'../../lib/useSellerActions':{useMyBlocks:()=>({data:new Set(state.blocked?['seller']:[])}),useSellerActions:()=>({}),REPORT_REASONS:[]},'../../theme/tokens':{ui:{},space:{sm:8,md:12,lg:16,xl:24},radius:{},ratio:{}}});
 const route=screen.default(); const tree=route.type();
 function walk(node,predicate){if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const found=walk(child,predicate);if(found)return found;}return null;}if(predicate(node))return node;return walk(node.props?.children,predicate);}
 return{route,tree,find:label=>walk(tree,n=>n.props?.accessibilityLabel===label),sends:()=>sends,reads:()=>reads};
}
test('contact composer dispatches the draft only when history and article are ready',()=>{
 const f=screenFixture(),send=f.find('Senden');assert.equal(send.props.disabled,false);send.props.onPress();assert.equal(f.sends(),1);
});
for(const [reason,change] of [
 ['conversation error',{conversation:{isError:true,refetch(){}}}],
 ['history error',{history:{isError:true,data:[],refetch(){}}}],
 ['missing article',{listing:{data:null,isSuccess:true}}],
 ['failed article',{listing:{isError:true,refetch(){}}}],
 ['blocked seller',{blocked:true}],
 ['pending send',{draft:{busy:'send'}}],
])test(`contact composer prevents dispatch with ${reason}`,()=>{
 const f=screenFixture(change),send=f.find(change.draft?'Wird gesendet':'Senden');assert.equal(send.props.disabled,true);send.props.onPress();assert.equal(f.sends(),0);assert.equal(f.reads(),0);
});
test('account and recipient changes remount the composer; guest and self routes have no send action',()=>{
 const a=screenFixture(),b=screenFixture({user:'other-buyer'}),c=screenFixture({recipient:'other-seller'});
 assert.notEqual(a.route.key,b.route.key);assert.notEqual(a.route.key,c.route.key);
 assert.equal(screenFixture({user:null}).find('Senden'),null);assert.equal(screenFixture({recipient:'buyer'}).find('Senden'),null);
});
