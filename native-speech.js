// Adapts Android's snapshot results to the existing Web Speech-shaped adapter.
export function createNativeRecognition(bridge){
 let sequence=0;
 return class NativeRecognition{
  constructor(){this.active=false;this.listener=null;this.id=null;}
  async start(){
   if(this.active)return;this.active=true;const id=this.id=`speech-${Date.now()}-${++sequence}`;
   try{
    this.listener=await bridge.addListener('speech',event=>{
     if(!this.active||event.sessionId!==id)return;
     if(event.type==='start')this.onstart?.({});
     if(event.type==='result'){
      const result=[{transcript:event.text??'',confidence:0}];result.isFinal=event.final===true;
      this.onresult?.({resultIndex:0,results:[result]});
     }
     if(event.type==='error')this.onerror?.({error:event.error??'network'});
     if(event.type==='end'){this.active=false;this.clear();this.onend?.({});}
    });
    if(!this.active){this.clear();return;}
    await bridge.startSpeech({sessionId:id,language:this.lang??'pl-PL',interim:this.interimResults!==false});
   }catch(error){if(!this.active)return;this.active=false;this.clear();this.onerror?.({error:error.code==='permission-denied'?'not-allowed':error.code==='aborted'?'aborted':'network'});}
  }
  clear(){const listener=this.listener;this.listener=null;void listener?.remove().catch(()=>{});}
  stop(){if(this.active)void bridge.stopSpeech({sessionId:this.id,abort:false}).catch(()=>this.onerror?.({error:'network'}));}
  abort(){const id=this.id;this.active=false;this.clear();if(id)void bridge.stopSpeech({sessionId:id,abort:true}).catch(()=>{});}
 };
}
export function installNativeSpeech(bridge,scope=globalThis){scope.SpeechRecognition=createNativeRecognition(bridge);}
