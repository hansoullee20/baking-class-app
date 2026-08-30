const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=process.env.OPS_DATA_DIR;
if(!root)throw new Error('OPS_DATA_DIR is required');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));

global.BakingBusiness=require('../business-engine.js');
require('../data-normalization.js');
const B=global.BakingBusiness,D=global.BakingData;
const rules=load('business-rules.json');
const index=load('entity-index.json');
const provenance=load('price-provenance.json');
const recipes=load('recipes.json');
const ingredients=load('ingredient-costs.json');
const schedule=load('schedule.json');
const history=load('history.json');
const sourceSync=load('source-sync.json');

B.setRules(rules);D.setIndex(index);D.setProvenance(provenance);
const coverage=D.applyEntityIndex(recipes,ingredients,schedule,history);
assert.equal(coverage.recipes.ready,coverage.recipes.total,'every recipe needs recipe_id');
assert.equal(coverage.ingredients.ready,coverage.ingredients.total,'every ingredient needs ingredient_id');
assert.equal(coverage.schedule.ready,coverage.schedule.total,'every schedule row needs class_id');
assert.equal(coverage.history.ready,coverage.history.total,'every history row needs class_id');
assert.equal(sourceSync.lastSyncSummary.recipeCount,recipes.length,'source-sync recipe count must match recipes.json');
assert.equal(index.recipes.length,recipes.length,'entity-index recipe registry must match recipes.json');
assert.equal(index.ingredients.length,ingredients.items.length,'entity-index ingredient registry must match ingredient-costs.json');

function unique(values,label){const set=new Set(values);assert.equal(set.size,values.length,label+' IDs must be unique')}
unique(recipes.map(x=>x.recipe_id),'recipe');
unique(ingredients.items.map(x=>x.ingredient_id),'ingredient');
unique(schedule.rows.map(x=>x.class_id),'schedule class');
unique(history.records.map(x=>x.class_id),'history class');

const recipeIds=new Set(recipes.map(x=>x.recipe_id));
[...schedule.rows,...history.records].forEach(r=>{if(r.recipe_id)assert.ok(recipeIds.has(r.recipe_id),'class recipe_id must resolve: '+r.recipe_id)});
const unlinked=[...new Set([...schedule.rows,...history.records].filter(r=>!B.findRecipe(r,recipes)).map(r=>r.menu||r.recipeCandidate||r.classTitle).filter(Boolean))].sort();
const declared=[...new Set((index.unresolved_recipe_links||[]).map(x=>x.menu))].sort();
assert.deepEqual(unlinked,declared,'unlinked recipe menus must be explicitly declared in entity-index');

const p=D.provenanceAudit(ingredients);
assert.equal(p.total,ingredients.items.length);
const rec=D.reconciliation(recipes,ingredients,5);
assert.equal(rec.total,recipes.length);
assert.equal(rules.dataModel.identityFile,'data/entity-index.json');
assert.equal(rules.dataModel.priceProvenanceFile,'data/price-provenance.json');
assert.equal(rules.costing.reconciliation.reviewThresholdPercent,5);

console.log(JSON.stringify({
  recipeIds:`${coverage.recipes.ready}/${coverage.recipes.total}`,
  ingredientIds:`${coverage.ingredients.ready}/${coverage.ingredients.total}`,
  scheduleIds:`${coverage.schedule.ready}/${coverage.schedule.total}`,
  historyIds:`${coverage.history.ready}/${coverage.history.total}`,
  unlinkedMenus:unlinked,
  provenanceVerified:p.verified,
  provenanceNeedsReview:p.needsReview.length,
  reconciliationComplete:rec.complete,
  reconciliationComparable:rec.comparable,
  varianceOver5Pct:rec.materialVariance.map(x=>x.name)
},null,2));
console.log('ops-data integration tests passed');
