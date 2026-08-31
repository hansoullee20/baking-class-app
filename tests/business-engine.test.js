const assert=require('assert');
const B=require('../business-engine.js');

B.setRules({
  timezone:'Asia/Seoul',
  rental:{defaultByDay:{saturday:90000,other:81000},manualClassValueHasPriority:true,hourlyHeadcountAutoModelEnabled:false},
  batching:{mode:'recipe_per_student',defaultBatchPerStudent:1,defaultBatchCount:1,autoScaleByStudentCount:true,perStudentByRecipe:{},extraBatchByRecipe:{}},
  recipeMatching:{aliases:{'꾸덕브라우니':'브라우니','밤에끌레어':'밤 에끌레어'}},
  costing:{costStatuses:{'확정':{usableForEstimate:true,confidence:'confirmed'},'조건부':{usableForEstimate:true,confidence:'estimated'},'부분원가':{usableForEstimate:false,confidence:'incomplete'},'미산정':{usableForEstimate:false,confidence:'incomplete'}}}
});

const overlayRecipe={name:'쿠키',recipe_id:'r017',cost:null,cost_status:'미산정'};
Object.defineProperty(overlayRecipe,'__costOverlay',{value:{apply:true,cost:6695,cost_status:'조건부'},enumerable:false,configurable:true});
const recipes=[
  {name:'브라우니',cost:4752,cost_status:'조건부'},
  {name:'밤 에끌레어',cost:9826,cost_status:'조건부',cost_range:{min:9725,max:9826}},
  {name:'소금빵',cost:3931,cost_status:'확정'},
  {name:'미완료',cost:null,cost_status:'미산정'},
  overlayRecipe
];
const schedule={settings:{weekdayRent:81000,satRent:90000}};

assert.equal(B.findRecipeByName('꾸덕브라우니',recipes).name,'브라우니');
assert.equal(B.findRecipeByName('밤에끌레어',recipes).name,'밤 에끌레어');
assert.equal(B.rent({date:'2026-09-03'},schedule),81000);
assert.equal(B.rent({date:'2026-09-05'},schedule),90000);
assert.equal(B.rent({date:'2026-09-03',rent:73000},schedule),73000);
assert.equal(B.batchCount({people:8}),8,'every recipe serving scales one-to-one with students');
assert.equal(B.batchCount({people:8,batchCount:2.5}),8,'legacy batchCount must not override per-student costing');
assert.equal(B.batchCount({people:4},{name:'소금빵'}),4);
assert.equal(B.batchCount({people:4,batchCount:2,batchMode:'manual'},{name:'소금빵'}),2,'manual override remains available for exceptions');
assert.equal(B.costState(recipes[0]).confidence,'estimated');
assert.equal(B.costState(recipes[3]).usable,false);
assert.equal(B.costState(overlayRecipe).amount,6695);
assert.equal(B.costState(overlayRecipe).source,'overlay');
assert(!JSON.stringify(overlayRecipe).includes('__costOverlay'));

assert.equal(B.effectiveStatus({date:'2026-08-30',status:'확정'},new Date('2026-08-31T09:00:00+09:00')),'완료');
assert.equal(B.effectiveStatus({date:'2026-08-30',status:'취소'},new Date('2026-08-31T09:00:00+09:00')),'취소');
assert.equal(B.effectiveStatus({date:'2026-08-31',status:'확정'},new Date('2026-08-31T21:00:00+09:00')),'확정');

const partialRoster=B.payment({people:4,fee:60000,participants:[{amountDue:60000,amountPaid:60000,paymentStatus:'입금완료'}]});
assert.equal(partialRoster.expected,240000);
assert.equal(partialRoster.collected,60000);
assert.equal(partialRoster.outstanding,180000);

const eclair=B.classFinancials({date:'2026-09-03',menu:'밤 에끌레어',people:4,fee:60000,batchCount:1,rent:81000,packing:0,other:0},{recipes,schedule,source:'schedule'});
assert.equal(eclair.revenue,240000);
assert.equal(eclair.batchCount,4);
assert.equal(eclair.material,39304,'9,826 × 4 students');
assert.equal(eclair.profit,119696);
assert.equal(eclair.estimatedProfitMin,119696);
assert.equal(eclair.estimatedProfitMax,120100);
assert.equal(eclair.profitLabel,'예상이익');

const brownie=B.classFinancials({date:'2026-08-31',menu:'꾸덕브라우니',people:5,fee:50000,batchCount:1,rent:81000},{recipes,schedule,source:'schedule'});
assert.equal(brownie.recipe.name,'브라우니');
assert.equal(brownie.batchCount,5);
assert.equal(brownie.material,23760,'4,752 × 5 students');
assert.equal(brownie.profit,145240);

const cookie=B.classFinancials({date:'2026-09-10',menu:'쿠키',people:4,fee:60000,batchCount:1,rent:81000},{recipes,schedule,source:'schedule'});
assert.equal(cookie.material,26780,'6,695 × 4 students');
assert.equal(cookie.profit,132220);
assert.equal(cookie.costSource,'overlay');

const salt=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,batchCount:1,rent:81000},{recipes,schedule,source:'history'});
assert.equal(salt.batchCount,4);
assert.equal(salt.batchMode,'per_student');
assert.equal(salt.batchPerStudent,1);
assert.equal(salt.material,15724);
assert.equal(salt.profit,103276);
assert.equal(salt.profitLabel,'현재 원가 기준 추정이익');

const actual=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,rent:81000,actualProfit:100000},{recipes,schedule,source:'history'});
assert.equal(actual.profit,100000);
assert.equal(actual.profitLabel,'실제이익');
assert.equal(actual.confidence,'actual');

console.log('business-engine tests passed');
