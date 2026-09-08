const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const jsx = (type, props, key) => ({ type, props, key });
const find = (v, type) => !v ? [] : Array.isArray(v) ? v.flatMap(i => find(i,type)) : [...(v.type === type ? [v] : []), ...find(v.props?.children,type)];
function harness() {
 let cursor=0,dirty=false,pending=[];const slots=[];
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useCallback(fn){return fn;},
  useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>!Object.is(v,old.deps[j])))pending.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };
 return {react,render(fn,props){let tree,n=0;do{dirty=false;cursor=0;tree=fn(props);const effects=pending;pending=[];effects.forEach(fn=>fn());assert.ok(++n<15,'render settles');}while(dirty);return tree;},close(){slots.forEach(s=>s.cleanup?.());}};
}
function load(file,deps,globals={}) {
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const ctx=vm.createContext({exports:{},...globals,require:name=>deps[name]??{}});vm.runInContext(code,ctx);return ctx.exports;
}
const native={View:'View',Text:'Text',Pressable:'Tap',ActivityIndicator:'Spinner',StyleSheet:{create:s=>s,absoluteFill:{},absoluteFillObject:{}},useWindowDimensions:()=>({fontScale:1.118})};
const theme={stage:{},radius:{},space:{sm:8,lg:16,md:12}};
function stage() {
 let focused=true,reduced=false,appListener;const h=harness();
 const lib=load('components/StoryStage.tsx',{react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{...native,AppState:{currentState:'active',addEventListener(_,fn){appListener=fn;return{remove(){}};}}},
  '@react-navigation/native':{useIsFocused:()=>focused},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34})},'expo-image':{Image:'Image'},
  '../lib/useReducedMotion':{useReducedMotion:()=>reduced},'../theme/tokens':theme,'./PressFeedback':{PressFeedback:'Button'},'./StoryProgress':{StoryProgress:'Progress'}});
 const props={items:[{id:'a',media_url:'a.jpg'},{id:'b',media_url:'b.jpg'},{id:'c',media_url:'c.jpg'}],who:{username:'Studio'},onClose(){},onOpenProfile(){}};
 return{h,props,render:extra=>h.render(lib.StoryStage,{...props,...extra}),setFocus:v=>focused=v,setReduced:v=>reduced=v,background:()=>appListener('background'),foreground:()=>appListener('active')};
}
function frame(extra={}) {
 const f=stage(), parent=f.render();
 // The actual StoryFrame function uses the same mocked React object. It is
 // rendered in a fresh hook instance, just like React mounts a keyed child.
 f.h.close();
 const h=harness();Object.assign(f.h.react,h.react);
 const props={...parent.props,...extra};
 return {...f,props,render:more=>h.render(parent.type,{...props,...more}),close:()=>h.close()};
}
const button=(v,label)=>find(v,'Button').find(n=>n.props.accessibilityLabel===label);
test('story waits for display before counting time or marking seen; background pauses both',()=>{
 let seen=0;const f=frame({onSeen:()=>seen++});let v=f.render();assert.equal(find(v,'Progress')[0].props.running,false);assert.equal(seen,0);
 find(v,'Image')[0].props.onDisplay();v=f.render({active:false});assert.equal(seen,0);assert.equal(find(v,'Progress')[0].props.running,false);
 v=f.render();assert.equal(seen,1);assert.equal(find(v,'Progress')[0].props.running,true);
 button(v,'Story pausieren').props.onPress();v=f.render();assert.equal(find(v,'Progress')[0].props.running,false);
 button(v,'Story fortsetzen').props.onPress();v=f.render();assert.equal(find(v,'Progress')[0].props.running,true);
 f.setReduced(true);v=f.render();assert.equal(find(v,'Progress')[0].props.running,false);assert.ok(button(v,'Nächstes Bild'));f.close();
});
test('failed image retains navigation, retry rejects events from the previous attempt',()=>{
 const f=frame();const old=find(f.render(),'Image')[0];old.props.onError();old.props.onDisplay();let v=f.render();assert.equal(find(v,'Progress')[0].props.running,false);
 button(v,'Erneut laden').props.onPress();v=f.render();const next=find(v,'Image')[0];assert.notEqual(next.key,old.key);
 old.props.onDisplay();old.props.onError();v=f.render();assert.equal(button(v,'Erneut laden'),undefined);assert.equal(find(v,'Progress')[0].props.running,false);
 next.props.onDisplay();v=f.render();assert.equal(find(v,'Progress')[0].props.running,true);f.close();
});
test('story selection survives reorder and deletion; closing is idempotent',()=>{
 const f=stage();let closed=0,props={onClose:()=>closed++};let v=f.render(props);v.props.onNext();v=f.render(props);assert.equal(v.props.current.id,'b');
 v=f.render({...props,items:[f.props.items[2],f.props.items[0],f.props.items[1]]});assert.equal(v.props.current.id,'b');assert.equal(v.props.index,2);
 v=f.render({...props,items:[f.props.items[2],f.props.items[0]]});assert.equal(v.props.current.id,'a');v.props.onNext();v.props.onClose();assert.equal(closed,1);f.h.close();
});
test('query error keeps a retryable screen open; a resolved empty story closes once',()=>{
 const f=stage();let closed=0;const props={items:[],onClose:()=>closed++};f.render({...props,loading:true});f.render({...props,error:true});assert.equal(closed,0);
 f.render(props);f.render(props);assert.equal(closed,1);f.h.close();
});
test('focus and app state stop story playback without losing the selected image',()=>{
 const f=stage();let v=f.render();v.props.onNext();v=f.render();assert.equal(v.props.current.id,'b');
 f.background();v=f.render();assert.equal(v.props.active,false);f.foreground();f.setFocus(false);v=f.render();assert.equal(v.props.active,false);
 f.setFocus(true);v=f.render();assert.equal(v.props.active,true);assert.equal(v.props.current.id,'b');f.h.close();
});
test('native progress resumes its remaining duration and ignores cancelled or duplicate completions',()=>{
 const h=harness(),animations=[];let now=0,completed=0;
 class Value{constructor(value){this.value=value;}setValue(v){this.value=v;}}
 const Animated={Value,View:'ProgressFill',timing(value,config){const a={config,start(fn){a.finish=fn;},stop(){a.stopped=true;}};animations.push(a);return a;}};
 const lib=load('components/StoryProgress.tsx',{react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{...native,Animated,Easing:{linear:'linear'}},'../theme/tokens':theme},{performance:{now:()=>now}});
 const props={count:3,index:0,running:false,onComplete:()=>completed++};h.render(lib.StoryProgress,props);assert.equal(animations.length,0);
 h.render(lib.StoryProgress,{...props,running:true});assert.equal(animations[0].config.duration,5000);assert.equal(animations[0].config.useNativeDriver,true);
 now=1500;h.render(lib.StoryProgress,props);assert.equal(animations[0].stopped,true);animations[0].finish({finished:true});assert.equal(completed,0);
 now=9000;h.render(lib.StoryProgress,{...props,running:true});assert.equal(animations[1].config.duration,3500);
 animations[1].finish({finished:true});animations[1].finish({finished:true});assert.equal(completed,1);h.close();
});

function sheet(name) {
 const h=harness();let font=1.118,reduced=false;
 const deps={react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{...native,Modal:'Modal',TextInput:'Input',ScrollView:'Scroll',Platform:{OS:'ios'},useWindowDimensions:()=>({fontScale:font})},
  'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34})},'../theme/tokens':{...theme,ui:{}},
  './PressFeedback':{PressFeedback:'Button'},'./SheetHeader':{SheetHeader:'Header'},'./RatingStars':{RatingStars:'Rating'},
  '../lib/useReducedMotion':{useReducedMotion:()=>reduced},'../lib/useProfileEdit':{BIO_MAX:300,NAME_MAX:60},'../lib/useAuction':{formatEuro:c=>`${c/100} €`}};
 const lib=load(`components/${name}.tsx`,deps);
 return {setFont:v=>font=v,setReduced:v=>reduced=v,render:props=>h.render(lib[name],props),close:()=>h.close()};
}
test('profile font and motion changes preserve edited text and upload lock',()=>{
 const s=sheet('ProfileEditSheet');let writes=0;
 const props={visible:true,initialBio:'Bio',initialDisplayName:'Studio',busy:false,uploading:false,avatarUrl:null,bannerUrl:null,onClose(){},onSave(){writes++;}};
 let v=s.render(props);find(v,'Input')[0].props.onChangeText('Mein Studio');find(v,'Input')[1].props.onChangeText('Mein Entwurf');
 s.setFont(1.786);s.setReduced(true);v=s.render({...props,uploading:true});
 assert.deepEqual(find(v,'Input').map(n=>n.props.value),['Mein Studio','Mein Entwurf']);assert.equal(find(v,'Modal')[0].props.animationType,'none');
 const save=find(v,'Button').find(n=>n.props.onPress && n.props.disabled===true && n.props.accessibilityRole==='button' && !n.props.accessibilityLabel);assert.ok(save);assert.equal(writes,0);s.close();
});
test('review rating and comment survive a font change without being submitted',()=>{
 const s=sheet('ReviewSheet');let writes=0;const props={visible:true,initialRating:2,sellerName:'Studio',busy:false,onClose(){},onSubmit(){writes++;}};
 let v=s.render(props);find(v,'Rating')[0].props.onChange(4);find(v,'Input')[0].props.onChangeText('Lokaler Entwurf');s.setFont(1.786);v=s.render(props);
 assert.equal(find(v,'Rating')[0].props.value,4);assert.equal(find(v,'Input')[0].props.value,'Lokaler Entwurf');assert.equal(writes,0);s.close();
});
test('bid suggestion remains selected across font changes and closing never submits it',()=>{
 const s=sheet('MaxBidSheet');let writes=0,closed=0;const props={visible:true,minCents:500,currentMaxCents:null,onClose(){closed++;},onSubmit(){writes++;}};
 let v=s.render(props);find(v,'Button').find(n=>n.props.accessibilityState?.selected===false).props.onPress();s.setFont(1.786);v=s.render(props);
 assert.equal(find(v,'Input')[0].props.value,'5');assert.equal(find(v,'Button').filter(n=>n.props.accessibilityState?.selected).length,1);
 find(v,'Header')[0].props.onClose();assert.equal(closed,1);assert.equal(writes,0);s.close();
});
