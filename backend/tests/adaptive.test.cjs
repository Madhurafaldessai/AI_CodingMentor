const test=require('node:test');
const assert=require('node:assert/strict');
const {updateConceptMastery,getPace,chooseNextChallenge,learnerSummary}=require('../.test-output/lib/adaptive.js');
const {calculateXp,getLevel,getGardenStage}=require('../.test-output/lib/xp.js');
test('mastery uses first try, hinted pass, and failure targets with EMA',()=>{
 assert.equal(updateConceptMastery(undefined,true,1,[]),58);
 assert.equal(updateConceptMastery(50,true,1,[1]),58.1);
 assert.equal(updateConceptMastery(50,false,1,[]),44);
});
test('pace is derived from the latest attempts',()=>{
 const fast=Array.from({length:5},(_,i)=>({challengeId:String(i),passed:true,hintsUsed:[],attempts:1,timeSpentSec:40,expectedTimeSec:100,errorCategories:[]}));
 assert.equal(getPace(fast),'fast');
 assert.equal(getPace([{challengeId:'x',passed:false,hintsUsed:[1,2,3],attempts:2,timeSpentSec:100,errorCategories:[]}]),'needs_support');
});
test('next challenge targets a weak concept and skips solved challenges',()=>{
 const items=[{id:'strings',difficulty:1,conceptTags:['strings']},{id:'loops',difficulty:2,conceptTags:['loops']}];
 assert.equal(chooseNextChallenge(items,{strings:20,loops:80},[],'steady').id,'strings');
 assert.equal(chooseNextChallenge(items,{strings:20,loops:80},['strings'],'steady').id,'loops');
});
test('learner summary stays compact',()=>{
 const summary=learnerSummary({experience:'beginner',pace:'steady',style:'visual',mastery:{strings:20,loops:30,variables:80},errors:['syntax']});
 assert.ok(summary.split(/\s+/).length<150);assert.match(summary,/strings, loops, variables/);
});
test('XP deductions, level, and plant stage follow the product rules',()=>{
 assert.equal(calculateXp(40,[1,2]),35);assert.equal(calculateXp(40,[4,4,4]),4);
 assert.equal(getLevel(200),3);assert.equal(getGardenStage(5),'bud');assert.equal(getGardenStage(7),'bloom');
});
