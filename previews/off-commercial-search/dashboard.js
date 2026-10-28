import {sumNutrition} from './nutrition.js?v=3928bb31182ca57f6ec22debc759e1d19548012b';
import {goalsOn,validDate} from './goals.js?v=3928bb31182ca57f6ec22debc759e1d19548012b';
export const shiftDay=(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
const mean=rows=>rows.length?rows.reduce((a,b)=>a+b,0)/rows.length:null;
export function buildDashboard(entries,measurements,goals,end,range=7){
 if(!validDate(end)||![7,30,90].includes(range))throw new Error('Wybierz poprawną datę i zakres.');
 const start=shiftDay(end,1-range),previousStart=shiftDay(start,-range),days=new Map();
 for(const row of entries){if(row.date<start||row.date>end)continue;let day=days.get(row.date);if(!day){day={date:row.date,portions:[],meals:new Set()};days.set(row.date,day);}day.portions.push(row.nutrition);day.meals.add(row.meal);}
 const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({date:d.date,total:sumNutrition(d.portions),entries:d.portions.length,meals:d.meals.size,goal:goalsOn(goals,d.date)}));
 const averages={},attainment={};for(const key of ['kcal','protein','fat','carbs']){averages[key]=mean(daily.map(d=>d.total[key]));const matched=daily.filter(d=>d.goal?.nutrition[key]);attainment[key]={percent:mean(matched.map(d=>100*d.total[key]/d.goal.nutrition[key])),days:matched.length};}
 const weights=measurements.filter(r=>r.type==='weight'&&r.date<=end).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 // Same-day measurements are averaged before computing a calendar-day rolling trend.
 const weightDays=new Map();for(const r of weights){if(!weightDays.has(r.date))weightDays.set(r.date,[]);weightDays.get(r.date).push(r.values.kg);}
 const weightDaily=[...weightDays].map(([date,values])=>({date,kg:mean(values)}));
 const weightMean=mean(weightDaily.filter(r=>r.date>=start).map(r=>r.kg)),previousMean=mean(weightDaily.filter(r=>r.date>=previousStart&&r.date<start).map(r=>r.kg));
 const weightSeries=weightDaily.filter(r=>r.date>=start).map(r=>({date:r.date,kg:r.kg,average:mean(weightDaily.filter(w=>w.date>=shiftDay(r.date,-6)&&w.date<=r.date).map(w=>w.kg))}));
 const lastWeight=weights.at(-1)??null,lastPressure=measurements.filter(r=>r.type==='pressure'&&r.date<=end).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).at(-1)??null;
 return {start,end,range,daily,daysWithEntries:daily.length,averages,attainment,goal:goalsOn(goals,end),today:daily.find(d=>d.date===end)??null,lastWeight,lastPressure,weightMean,previousMean,weightChange:weightMean!==null&&previousMean!==null?weightMean-previousMean:null,weightSeries};
}
