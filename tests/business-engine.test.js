const assert=require('assert');
const B=require('../business-engine.js');

B.setRules({
  timezone:'Asia/Seoul',
  rental:{defaultByDay:{saturday:90000,other:81000},manualClassValueHasPriority:true,hourlyHeadcountAutoModelEnabled:false},
  batching:{defaultBatchCount:1,autoScaleByStudentCount:false},
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

assert.equal(B.findRecipeByName('꾸덕브라우니',recipes).name,'브라우니','alias must resolve to canonical recipe');
assert.equal(B.findRecipeByName('밤에끌레어',recipes).name,'밤 에끌레어','spacing alias must resolve');
assert.equal(B.rent({date:'2026-09-03'},schedule),81000,'weekday default rent must be 81,000');
assert.equal(B.rent({date:'2026-09-05'},schedule),90000,'Saturday default rent must be 90,000');
assert.equal(B.rent({date:'2026-09-03',rent:73000},schedule),73000,'stored class rent must override default');
assert.equal(B.batchCount({people:8}),1,'batch count must not auto-scale with students');
assert.equal(B.batchCount({people:8,batchCount:2.5}),2.5,'explicit batch count must be respected');
assert.equal(B.costState(recipes[0]).confidence,'estimated','conditional cost must be labeled estimated');
assert.equal(B.costState(recipes[3]).usable,false,'missing cost cannot be used for profit');
assert.equal(B.costState(overlayRecipe).amount,6695,'effective overlay cost must be used');
assert.equal(B.costState(overlayRecipe).source,'overlay','overlay source must remain identifiable');
assert.equal(B.costState(overlayRecipe).confidence,'estimated','overlay conditional cost must remain estimated');
assert(!JSON.stringify(overlayRecipe).includes('__costOverlay'),'effective overlay must never persist through JSON serialization');
assert.equal(JSON.parse(JSON.stringify(overlayRecipe)).cost,null,'source recipe cost must remain null when serialized');

assert.equal(B.effectiveStatus({date:'2026-08-30',status:'확정'},new Date('2026-08-31T09:00:00+09:00')),'완료','past non-cancelled class must become completed');
assert.equal(B.effectiveStatus({date:'2026-08-30',status:'예정'},new Date('2026-08-31T09:00:00+09:00')),'완료','past planned class must become completed');
assert.equal(B.effectiveStatus({date:'2026-08-30',status:'취소'},new Date('2026-08-31T09:00:00+09:00')),'취소','cancelled class must stay cancelled');
assert.equal(B.effectiveStatus({date:'2026-08-31',status:'확정'},new Date('2026-08-31T21:00:00+09:00')),'확정','same-day class stays current until the date has passed');
assert.equal(B.effectiveStatus({date:'2026-09-01',status:'예정'},new Date('2026-08-31T09:00:00+09:00')),'예정','future class must preserve stored status');

const partialRoster=B.payment({people:4,fee:60000,participants:[{amountDue:60000,amountPaid:60000,paymentStatus:'입금완료'}]});
assert.equal(partialRoster.expected,240000,'missing roster rows must still contribute class fee to expected payment');
assert.equal(partialRoster.collected,60000);
assert.equal(partialRoster.outstanding,180000);
assert.equal(partialRoster.rate,25);
assert.equal(partialRoster.missingRosterCount,3);

const discountedFullRoster=B.payment({people:2,fee:60000,participants:[{amountDue:50000,amountPaid:50000,paymentStatus:'입금완료'},{amountDue:50000,amountPaid:0,paymentStatus:'미입금'}]});
assert.equal(discountedFullRoster.expected,100000,'full participant roster may override fee through individual amountDue');
assert.equal(discountedFullRoster.outstanding,50000);

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

const cookie=B.classFinancials({date:'2026-09-10',menu:'쿠키',people:4,fee:60000,batchCount:1,rent:81000},{recipes,schedule,source:'schedule'});
assert.equal(cookie.material,6695);
assert.equal(cookie.profit,152305);
assert.equal(cookie.costSource,'overlay');
assert.equal(cookie.confidence,'estimated');

const history=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,rent:81000},{recipes,schedule,source:'history'});
assert.equal(history.profitLabel,'현재 원가 기준 추정이익','historical modeled profit must be labeled as current-cost estimate');

const actual=B.classFinancials({date:'2026-08-10',menu:'소금빵',people:4,fee:50000,rent:81000,actualProfit:100000},{recipes,schedule,source:'history'});
assert.equal(actual.profit,100000);
assert.equal(actual.profitLabel,'실제이익');
assert.equal(actual.confidence,'actual');

console.log('business-engine tests passed');
