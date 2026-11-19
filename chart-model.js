const DAY=86400000;
export function chartData(input,{days=0,hidden=new Set()}={}){
 const series=input.map((s,index)=>({...s,index,points:s.values.map((value,i)=>({value,date:s.dates?.[i]??null,time:s.dates?Date.parse(s.dates[i]):i,index:i})).filter(p=>Number.isFinite(p.time)&&(p.value===null||Number.isFinite(p.value))).sort((a,b)=>a.time-b.time).slice(-1000)}));
 const dated=series.some(s=>s.dates),all=series.flatMap(s=>s.points),end=all.length?Math.max(...all.map(p=>p.time)):0,cut=dated&&days?Math.floor(end/DAY)*DAY-(days-1)*DAY:-Infinity;
 for(const s of series)s.points=s.points.filter(p=>p.time>=cut);
 const visible=series.filter(s=>!hidden.has(s.index)),valid=visible.flatMap(s=>s.points.filter(p=>p.value!==null)),times=[...new Set(valid.map(p=>p.time))].sort((a,b)=>a-b);
 const domains={};for(const axis of ['left','right']){const ss=visible.filter(s=>(s.axis??'left')===axis),values=ss.flatMap(s=>s.points.filter(p=>p.value!==null).map(p=>p.value));if(!values.length)continue;let min=Math.min(...values),max=Math.max(...values);const pad=(max-min||Math.abs(max)*.05||1)*.12;min=ss.some(s=>s.zero)?Math.min(0,min):min-pad;max+=pad;domains[axis]={min,max};}
 return {series,visible,times,dated,start:times[0]??0,end:times.at(-1)??0,domains,limited:input.some(s=>s.values.length>1000)};
}
export function chartSummary(points){const valid=points.filter(p=>Number.isFinite(p.value));if(!valid.length)return null;const values=valid.map(p=>p.value);return {count:values.length,first:values[0],last:values.at(-1),change:values.at(-1)-values[0],mean:values.reduce((a,b)=>a+b,0)/values.length,min:Math.min(...values),max:Math.max(...values)};}
export function chartSegments(points,gapDays=0){const result=[];let segment=[];for(const p of points){if(p.value===null||gapDays&&segment.length&&p.time-segment.at(-1).time>gapDays*DAY){if(segment.length)result.push(segment);segment=[];}if(p.value!==null)segment.push(p);}if(segment.length)result.push(segment);return result;}
