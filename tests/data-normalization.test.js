const assert=require('assert');
global.BakingBusiness=require('../business-engine.js');
require('../data-normalization.js');
const D=global.BakingData;

D.setIndex({
  recipes:[{recipe_id:'r1',name:'브라우니'}],
  recipe_aliases:[{alias:'꾸덕브라우니',recipe_id:'r1'}],
  ingredients:[{ingredient_id:'i1',name:'버터'},{ingredient_id:'i2',name:'베이킹파우더'}],
  classes:{schedule:[{class_id:'c1',legacy_id:'legacy-1',recipe_id:'r1'}],history:[{class_id:'c2',date:'2026-08-01',time:'10:00',menu:'브라우니',recipe_id:'r1'}]}
});
D.setProvenance({
  default_generic_policy:{source_type:'coupang_lowest'},
  status_mapping:[{status_prefix:'쿠팡최저가',source_type:'coupang_lowest',verification_status:'verified_from_cost_master'}],
  specific_product_overrides:[{ingredient_name:'버터',source_type:'specified_product',verification_status:'product_details_needed'}],
  specific_name_alias_guard:{do_not_collapse_without_exact_price:['앵커버터','필라델피아 크림치즈']}
});

const recipes=[{name:'브라우니',cost:1000,cost_status:'조건부',ingredients:[{name:'버터',amount:50,unit:'g'},{name:'베이킹파우더',amount:5,unit:'g'}]}];
const ingredients={items:[{name:'버터',unit_cost:1000,status:'임시'},{name:'베이킹파우더',unit_cost:200,status:'쿠팡최저가'}]};
const schedule={rows:[{id:'legacy-1',menu:'꾸덕브라우니',date:'2026-09-01',time:'10:00'}]};
const history={records:[{menu:'브라우니',date:'2026-08-01',time:'10:00'}]};
const coverage=D.applyEntityIndex(recipes,ingredients,schedule,history);
assert.equal(recipes[0].recipe_id,'r1');
assert.equal(ingredients.items[0].ingredient_id,'i1');
assert.equal(schedule.rows[0].class_id,'c1');
assert.equal(schedule.rows[0].recipe_id,'r1');
assert.equal(history.records[0].class_id,'c2');
assert.equal(coverage.schedule.ready,1);

const p=D.provenanceAudit(ingredients);
assert.ok(p.needsReview.includes('버터'),'specified butter without product details must remain reviewable');
assert.ok(!p.needsReview.includes('베이킹파우더'),'verified Coupang generic item should be accepted');

const quote=D.recipeCalculatedCost(recipes[0],ingredients);
assert.equal(quote.complete,true);
assert.equal(Math.round(quote.calculated),510);
assert.equal(Math.round(quote.variance),490);
assert.ok(quote.variancePct>90);

const guarded=D.recipeCalculatedCost({name:'테스트',cost:500,cost_status:'조건부',ingredients:[{name:'앵커버터',amount:20,unit:'g'}]},ingredients);
assert.equal(guarded.complete,false);
assert.equal(guarded.missing[0].state,'specific-price-missing');

console.log('data-normalization tests passed');
