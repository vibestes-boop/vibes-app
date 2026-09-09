const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props, key) => ({ type, props, key });
const find = (node, type) => !node ? [] : Array.isArray(node) ? node.flatMap(n => find(n, type)) : [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
const text = n => typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : text(n?.props?.children ?? '');
function render(show, fontScale = 1) {
 const deps = {
  'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View:'View',Text:'Text',StyleSheet:{create:x=>x},useWindowDimensions:()=>({fontScale}) },
  'expo-image':{Image:'Image'}, 'lucide-react-native':{CalendarClock:'Calendar',Lock:'Lock'}, '../theme/tokens':{ui:{},radius:{},space:{}},
  '../lib/useSchedule':{formatSlot:iso=>'slot:'+iso,formatUntil:()=> 'in 2 Std'}, './BerkatMark':{BerkatMark:'Mark'}, './UpcomingStrip':{ReminderBell:'Reminder'},
 };
 const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../components/SellerScheduleCard.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const ctx=vm.createContext({exports:{},require:name=>{assert.ok(name in deps,name);return deps[name];}});vm.runInContext(code,ctx);
 return ctx.exports.SellerScheduleCard({show,hostId:'host'});
}
const plan={id:'plan-id',title:'Duftabend',scheduled_at:'2026-09-09T20:00:00Z',women_only:false,cover_url:'https://example.test/cover.png'};
test('profile reminder carries the same real schedule and owner as its displayed card',()=>{
 const tree=render(plan);const reminder=find(tree,'Reminder')[0];
 assert.deepEqual(JSON.parse(JSON.stringify(reminder.props.show)),{id:plan.id,host_id:'host',title:plan.title,scheduled_at:plan.scheduled_at});
 assert.ok(tree.props.children.includes(reminder));assert.match(text(tree),/slot:2026-09-09T20:00:00Z/);
 assert.equal(find(tree,'Image')[0].props.source.uri,plan.cover_url);
});
test('missing cover and title remain readable; large text preserves reminder identity and women-only label',()=>{
 const tree=render({...plan,title:null,cover_url:null,women_only:true},2.4);
 assert.equal(find(tree,'Image').length,0);assert.equal(find(tree,'Mark').length,1);
 assert.match(text(tree),/Berkat-Show/);assert.match(text(tree),/Nur Frauen/);
 assert.equal(find(tree,'Reminder')[0].props.show.id,'plan-id');
 assert.equal(find(tree,'Text').find(n=>n.props.accessibilityRole==='header').props.numberOfLines,undefined);
});
