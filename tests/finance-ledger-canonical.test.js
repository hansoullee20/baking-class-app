const assert=require('assert');
const F=require('../finance-ledger-canonical.js');

const rows=[
  {people:4,revenue:240000,collected:240000,outstanding:0,rent:81000,packing:0,other:0,material:39304,profit:119696,costable:true},
  {people:3,revenue:180000,collected:180000,outstanding:0,rent:81000,packing:0,other:0,material:null,profit:null,costable:false}
];
const s=F.summarizeRecords(rows);
assert.equal(s.revenue,420000);
assert.equal(s.fixedCost,162000,'known fixed costs must include classes with missing recipe cost');
assert.equal(s.materialKnown,39304);
assert.equal(s.knownCost,201304);
assert.equal(s.costableRevenue,240000,'partial profit denominator must use only cost-complete revenue');
assert.equal(s.costableProfit,119696);
assert.equal(s.complete,false);
assert.equal(s.fullProfit,null,'full profit must remain pending while any class cost is missing');
assert.equal(Math.round(s.partialMargin*10)/10,49.9);

const complete=F.summarizeRecords([rows[0]]);
assert.equal(complete.complete,true);
assert.equal(complete.fullCost,120304);
assert.equal(complete.fullProfit,119696);
assert.equal(Math.round(complete.margin*10)/10,49.9);

const empty=F.summarizeRecords([]);
assert.equal(empty.complete,true);
assert.equal(empty.fullProfit,0,'zero completed classes should display zero profit, not calculation pending');
assert.equal(empty.fullCost,0);

console.log('finance canonical tests passed');
