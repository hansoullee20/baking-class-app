const assert=require('assert');
const B=require('../business-engine.js');

B.setRules({
  rental:{defaultByDay:{saturday:90000,other:81000},manualClassValueHasPriority:true,hourlyHeadcountAutoModelEnabled:false},
  batching:{defaultBatchCount:1,autoScaleByStudentCount:false},
  recipeMatching:{aliases:{'꾸덕브라우니':'브라우니','밤에끌레어':'밤 에끌레어'}},
  costing:{costStatuses:{'확정':{usableForEstimate:true,confidence:'confirmed'},'조건부':{usableForEstimate:true,confidence:'estimated'},'부분원가':{usableForEstimate:false,confidence:'incomplete'},'미산정':{usableForEstimate:false,confidence:'incomplete'}}}
});

const recipes=[
  {name:'브라우니',cost:4752,cost_status:'조건부'},
  {name:'밤 에끌레어',cost:9826,cost_status:'조건부',cost_range:{min:9725,max:9826}},
  {name:'소금빵',cost:3931,cost_status:'확정'},
  {name:'미완료',cost:null,cost_status:'미산정'}
];
const schedule={settings:{weekdayRent:81000,satRent:90000}};

assert.equal(B.findRecipeByName('꾸덕브라우니',recipes).name,'브라우니','alias must resolve to canonical recipe');
assert.equal(B.findRecipeByName('밤에끌레어',recipes).name,'밤 에끌레어','spacing alias must resolve');
assert.equal(B.rent({date:'2026-09-03'},schedule),81000,'weekday default rent must be 81,000');
assert.equal(B.rent({date:'2026-09-05'},schedule),90000,'Saturday default rent must be 90,000');
assert.equal(B.rent({date:'2026-09-03',rent:73000},schedule),73000,'stored class rent must override default');
assert.equal(B.batchCount({people:8}),1,'batch count must not auto-scale with students');
assert.equal(B.batchCount({people:8,batchCount:2.5}),2.5,'explicit batch count must be respected');
assert.equal(B.costState(recipes[0]).confidence,'estimated','conditional cost must be labeled estimated');
assert.equal(B.costState(recipes[3]).usable,false,'missing cost cannot be used for profit');

const eclair=B.classFinancials({date:'2026-09-03',menu:'밤 에끌레어',people:4,fee:60000,batchCount:1,rent:81000,packing:0,other:0},{recipes,schedule,source:'schedule'});
assert.equal(eclair.revenue,240000);
assert.equal(eclair.material,9826);
assert.equal(eclair.rent,81000);
assert.equal(eclair.profit,149174);
assert.equal(eclair.estimatedProfitMin,149174,'highest material cost gives minimum profit');
assert.equal(eclair.estimatedProfitMax,149275,'lowest material cost gives maximum profit');
assert.equal(eclair.confidence,'estimated');
assert.equal(eclair.profitLabel,'예상이익');

const brownie=B.classFinancials({date:'2026-08-31',menu:'꾸덕브라우니',people:5,fee:50000,batchCount:1,rent:81000},{recipes,schedule,source:'schedule'});
assert.equal(brownie.recipe.name,'브라우니');
assert.equal(brownie.profit,164248);

const history=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,rent:81000},{recipes,schedule,source:'history'});
assert.equal(history.profitLabel,'현재 원가 기준 추정이익','historical modeled profit must be labeled as current-cost estimate');

const actual=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,rent:81000,actualProfit:100000},{recipes,schedule,source:'history'});
assert.equal(actual.profit,100000);
assert.equal(actual.profitLabel,'실제이익');
assert.equal(actual.confidence,'actual');

console.log('business-engine tests passed');
