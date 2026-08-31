const assert=require('assert');
const fs=require('fs');
const ui=fs.readFileSync('operations-ui.js','utf8');
const ops=fs.readFileSync('class-ops-canonical.js','utf8');
const planner=fs.readFileSync('management-planner.js','utf8');
const editor=fs.readFileSync('calendar-class-editor.js','utf8');
const status=fs.readFileSync('calendar-status.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert(!ui.includes('toISOString()'),'operations UI must not use UTC ISO conversion for local month boundaries');
assert(ui.includes('monthEnd'),'operations UI must define explicit local month boundary handling');
assert(ui.includes('B.effectiveStatus'),'operations UI must use canonical effective class status');
assert(ops.includes('B.classFinancials'),'class operations must use canonical financial engine');
assert(ops.includes('B.payment'),'class operations must use canonical payment engine');
assert(!ops.includes('function classCosts'),'legacy independent class-cost helper must not return');
assert(!ops.includes('rentForDay'),'legacy independent rent helper must not return');
assert(planner.includes('B.classFinancials'),'calendar planning must use canonical financial engine for scenario profit');
assert(planner.includes('B.payment'),'calendar attendee panel must use canonical payment engine');
assert(planner.includes('B.effectiveStatus'),'calendar planning must use canonical effective class status');
assert(planner.includes('localStorage'),'draft planning must remain separate from schedule until explicitly applied');
assert(planner.includes("mark('schedule')"),'explicit draft apply must use normal schedule persistence flow');
assert(editor.includes("mark('schedule')"),'calendar class editor must use normal schedule persistence flow');
assert(editor.includes('schedule.rows.splice'),'calendar class editor must support class deletion');
assert(status.includes('B.payment'),'calendar status dots must use canonical payment state');
assert(status.includes('missingRosterCount'),'paid indicator must not ignore missing attendee rows');
assert(status.includes("key:'open'")&&status.includes("key:'full'")&&status.includes("key:'paid'"),'calendar status module must preserve open/full/paid states');
assert(html.includes('id="calendarClassDetail"'),'calendar attendee/payment detail panel must exist');
assert(!html.includes('<button data-page="schedule">'),'schedule management must not remain a visible navigation destination');
assert(!html.includes('<button data-page="planner">'),'standalone month planner must not remain a visible navigation destination');
assert(html.includes('calendar-class-editor.js'),'calendar class editor runtime must be loaded');
assert(html.includes('calendar-status.js'),'calendar status indicator runtime must be loaded');
assert(html.includes('calendar-status.css'),'calendar status indicator styling must be loaded');

const order=['app.js','business-engine.js','data-normalization.js','class-ops-canonical.js','business-engine-adapter.js','operations-ui.js','management-planner.js','calendar-class-editor.js','calendar-status.js'].map(x=>html.indexOf(x));
assert(order.every(x=>x>=0),'all canonical runtime modules must be loaded');
for(let i=1;i<order.length;i++)assert(order[i]>order[i-1],`runtime script order invalid at position ${i}`);

console.log('runtime architecture tests passed');
