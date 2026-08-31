const assert=require('assert');
const fs=require('fs');
const ui=fs.readFileSync('operations-ui.js','utf8');
const ops=fs.readFileSync('class-ops-canonical.js','utf8');
const planner=fs.readFileSync('management-planner.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert(!ui.includes('toISOString()'),'operations UI must not use UTC ISO conversion for local month boundaries');
assert(ui.includes('monthEnd'),'operations UI must define explicit local month boundary handling');
assert(ui.includes('B.effectiveStatus'),'operations UI must use canonical effective class status');
assert(ops.includes('B.classFinancials'),'class operations must use canonical financial engine');
assert(ops.includes('B.payment'),'class operations must use canonical payment engine');
assert(!ops.includes('function classCosts'),'legacy independent class-cost helper must not return');
assert(!ops.includes('rentForDay'),'legacy independent rent helper must not return');
assert(planner.includes('B.classFinancials'),'month planner must use canonical financial engine for scenario profit');
assert(planner.includes('B.payment'),'calendar attendee panel must use canonical payment engine');
assert(planner.includes('B.effectiveStatus'),'planner/calendar must use canonical effective class status');
assert(planner.includes('localStorage'),'draft planning must remain separate from schedule until explicitly applied');
assert(planner.includes("mark('schedule')"),'explicit draft apply must use normal schedule persistence flow');
assert(html.includes('id="planner"'),'month planner page must exist');
assert(html.includes('id="plannerHost"'),'month planner render host must exist');
assert(html.includes('id="calendarClassDetail"'),'calendar attendee/payment detail panel must exist');

const order=['app.js','business-engine.js','data-normalization.js','class-ops-canonical.js','business-engine-adapter.js','operations-ui.js','management-planner.js'].map(x=>html.indexOf(x));
assert(order.every(x=>x>=0),'all canonical runtime modules must be loaded');
for(let i=1;i<order.length;i++)assert(order[i]>order[i-1],`runtime script order invalid at position ${i}`);

console.log('runtime architecture tests passed');
