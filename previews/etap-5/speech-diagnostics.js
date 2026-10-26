import { createSpeechRecognitionAdapter } from './speech-recognition.js?v=9f5774d7c3515887439c933b2257ad75b148f590';
const $ = id => document.getElementById(id);
let adapter, report, started;
function render() { $('report').textContent = JSON.stringify(report,null,2); }
$('start').onclick = () => {
  adapter?.dispose();
  const mode=$('mode').value;
  report={userAgent:navigator.userAgent,platform:navigator.platform,language:'pl-PL',continuous:mode==='A',interimResults:mode!=='C',buildSha:document.querySelector('meta[name=benger-build]')?.content??'local',events:[],finalTranscript:'',truncated:false};
  started=performance.now();
  adapter=createSpeechRecognitionAdapter({continuous:report.continuous,interimResults:report.interimResults,
    onEvent(type,event) {
      if(report.events.length>=500){report.truncated=true;return;}
      const item={number:report.events.length+1,timestampMs:performance.now()-started,type};
      if(type==='result') {
        item.resultIndex=event.resultIndex;item.resultsLength=event.results.length;
        item.results=Array.from(event.results,(result,index)=>({index,transcript:result[0]?.transcript??'',isFinal:result.isFinal,confidence:result[0]?.confidence??null}));
      }
      if(type==='error')item.error=event.error;
      report.events.push(item);render();
    },
    onTranscript({text,final}) {report.finalTranscript=final;$('transcript').textContent=text;render();},
    onComplete(text){report.finalTranscript=text;$('transcript').textContent=text;render();},
    onState({state,message}){const busy=['listening','processing'].includes(state);$('start').disabled=busy;$('mode').disabled=busy;$('stop').disabled=!busy;$('download').disabled=busy;$('status').textContent=message;}
  });
  $('transcript').textContent='';render();adapter.start();
};
$('stop').onclick=()=>adapter?.stop();
$('download').onclick=()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`benger-speech-${report.continuous?'A':report.interimResults?'B':'C'}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('pagehide',()=>adapter?.dispose());
document.documentElement.dataset.diagnosticsReady='true';
