import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { getConciseGuidedInstruction } from '../utils/guidedInstruction';

type Node = {type:unknown;props:any};
function nodes(root: any, predicate: (node:Node)=>boolean): Node[] {
  if(Array.isArray(root))return root.flatMap(child=>nodes(child,predicate));
  if(!root || typeof root!=='object')return [];
  return [...(predicate(root)?[root]:[]),...nodes(root.props?.children,predicate)];
}
function renderSteps(instruction:string, last=false) {
  const states:any[]=[];let cursor=0;let completed=0;
  const steps=[0,1].map(index=>({title:`Step ${index+1}`,instruction,ingredientsUsed:[],toolsUsed:[],timing:{elapsedMinutes:1}}));
  const recipe={id:'test',title:'Test recipe',totalTimeMinutes:2,structuredSteps:steps};
  const state={recipesById:{test:recipe},selectedMode:'Normal',hasHydrated:true,activeCookingSession:{recipeId:'test',currentStepIndex:last?1:0},
    recipeFeedbackById:{},completeRecipe:()=>{completed++;},updateCookingStep:()=>{},syncCookingStepCount:()=>{}};
  const jsx=(type:unknown,props:any)=>({type,props});
  const module={exports:{} as any};
  const compiled=ts.transpileModule(readFileSync(new URL('./RecipeDetailScreen.tsx',import.meta.url).pathname,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(compiled,{exports:module.exports,module,console,require:(name:string)=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
    if(name==='react')return {memo:(fn:any)=>fn,useMemo:(fn:any)=>fn(),useCallback:(fn:any)=>fn,useEffect:()=>{},useRef:(x:any)=>({current:x}),useState:(initial:any)=>{
      const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;
      return [states[index],(value:any)=>{states[index]=value;}];
    }};
    if(name==='react-native')return {View:'View',Text:'Text',ScrollView:'ScrollView',Pressable:'Pressable',StyleSheet:{create:(x:any)=>x,hairlineWidth:1},Animated:{Value:class {interpolate(){return 0;}}}};
    if(name==='react-native-safe-area-context')return {SafeAreaView:'SafeAreaView'};
    if(name==='@react-navigation/native')return {useRoute:()=>({params:{recipeId:'test'}}),useNavigation:()=>({setParams:()=>{},navigate:()=>{}})};
    if(name.endsWith('/useOkyoStore'))return {useOkyoStore:(selector:any)=>selector(state)};
    if(name.endsWith('/useMascotName'))return {useMascotName:()=> 'Luna'};
    if(name.endsWith('/canonicalRecipes'))return {resolveCanonicalRecipe:()=>recipe};
    if(name.endsWith('/activeCooking'))return {resolveActiveCookingStep:(steps:any[],index:number)=>steps[index]};
    if(name.endsWith('/guidedCookingSteps'))return {buildGuidedCookingSteps:()=>steps};
    if(name.endsWith('/guidedInstruction'))return {getConciseGuidedInstruction};
    if(name.endsWith('/guidedStepDensity'))return {getGuidedStepDensity:()=> 'long'};
    if(name.endsWith('/guidedCookingPreview'))return {getNextGuidedCookingPreview:()=>null};
    if(name.endsWith('/guidedCookingTime'))return {hasUsableRecipeTimingData:()=>true,getRemainingGuidedCookingMinutes:()=>2};
    if(name.endsWith('/recipeIntegrity'))return {getRecipeTiming:()=>({totalMinutes:2})};
    if(name.endsWith('/recipeImages'))return {getRecipeImageUrl:()=>null};
    if(name.endsWith('/mocks'))return {getSafeRecipeMode:()=> 'Normal'};
    return new Proxy({}, {get:()=>({})});
  }});
  return {render:()=>{cursor=0;return module.exports.RecipeStepsScreen();},completed:()=>completed};
}

test('long instructions remain complete in a single scrolling body and controls remain outside it',()=>{
  const instruction='Stir gently, then check that the center is hot. '.repeat(400).trim();
  const screen=renderSteps(instruction);
  const tree=screen.render();
  const scrolls=nodes(tree,node=>node.type==='ScrollView');
  assert.equal(scrolls.length,1,'nested scrolling must not trap the instruction');
  const text=nodes(scrolls[0],node=>node.type==='Text'&&node.props.children===instruction)[0];
  assert.ok(text,'all instruction text is rendered');
  assert.equal(text.props.numberOfLines,undefined);
  assert.equal(text.props.adjustsFontSizeToFit,undefined);
  assert.notEqual(text.props.allowFontScaling,false);
  const next=nodes(tree,node=>node.props?.accessibilityLabel==='Next cooking step')[0];
  assert.ok(next);
  assert.equal(nodes(scrolls[0],node=>node===next).length,0);
  next.props.onPress();
  const finish=nodes(screen.render(),node=>node.props?.accessibilityLabel==='Finish cooking')[0];
  assert.ok(finish);
  finish.props.onPress();assert.equal(screen.completed(),1);
  assert.ok(nodes(screen.render(),node=>node.type==='ScrollView').length>0,'completion remains scrollable');
});
