import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startBrowser } from './tests/browser-harness.mjs';

const SPEECH = `
  window.__speechInstances = [];
  window.SpeechRecognition = class {
    constructor() { this.results = []; window.__speechInstances.push(this); }
    start() { this.results = []; this.started = true; this.onstart?.(); }
    stop() { this.stopped = true; this.onend?.(); }
    abort() { this.aborted = true; this.onend?.(); }
  };
  // Zmienia ogon od resultIndex, ale event zawsze udostępnia całą kumulacyjną listę sesji.
  window.__speechUpdate = (resultIndex, changes, length = resultIndex + changes.length) => {
    const recognition = window.__speechInstances.at(-1);
    changes.forEach(([transcript,isFinal],offset)=> {
      recognition.results[resultIndex+offset] = Object.assign([{transcript}],{isFinal});
    });
    recognition.results.length = length;
    const results = Object.assign({length}, recognition.results);
    recognition.onresult?.({resultIndex,results});
  };
  window.__speechResult = (final, interim='') => {
    const changes = [];
    if(final) changes.push([final,true]);
    if(interim) changes.push([interim,false]);
    window.__speechUpdate(0,changes);
  };
`;
const DAY = '2026-10-25';
const transcript = 'Na śniadanie zjadłem 80 gram płatków owsianych, 250 ml mleka 2% i banana 120 gram';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(page, condition, limit = 15000) {
  const end = Date.now() + limit;
  while (Date.now() < end) { if (await page.evaluate(condition)) return; await sleep(30); }
  assert.fail('Nie spełniono warunku: ' + condition);
}
const click = (page, id) => page.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const disabled = page => page.evaluate("document.getElementById('save-meal-proposal').disabled");
const fillRow = (page, id, value) => page.evaluate(`(()=>{const input=document.querySelector('[data-item-id="${id}"] [data-amount]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input'));})()`);

function contrast(a,b) {
  const light = text => text.match(/[\d.]+/g).slice(0,3).map(Number).map(value => value/255 <= .04045 ? value/255/12.92 : ((value/255+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return (Math.max(light(a),light(b))+.05)/(Math.min(light(a),light(b))+.05);
}

test('Etap 4 — głos, wspólny parser, częściowa weryfikacja i izolowany preview', { timeout: 120000 }, async t => {
  const browser = await startBrowser({ staticPrefix: '/Benger/previews/etap-5/', previewBuild: true, mockOFF: true });
  t.after(() => browser.close());
  const a = await browser.page(browser.base, { initScript: SPEECH });
  await a.date(DAY);
  const apiRequests = () => browser.off.requests.filter(request => new URL(request.url).hostname === 'world.openfoodfacts.org');

  await t.test('mikrofon jest widoczny na pierwszym ekranie telefonu 320/390/430 px', async () => {
    for(const width of [320,360,390,430]) {
      await a.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await a.evaluate('window.scrollTo(0,0)');
      const rect=await a.evaluate("(()=>{const r=document.getElementById('voice-microphone').getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:innerHeight}})()");
      assert.ok(rect.top>=0 && rect.bottom<=rect.height,JSON.stringify({width,...rect}));
      if(process.env.BENGER_VOICE_SCREENSHOTS && width===390) {
        const {data}=await a.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(`${process.env.BENGER_VOICE_SCREENSHOTS}-first-screen.png`,Buffer.from(data,'base64'));
      }
    }
  });

  await t.test('Samsung: kumulacyjne 250 → 250 ml + mleka → dwa final daje dokładnie 250 ml mleka', async () => {
    const before = await a.saved(), requests = apiRequests().length;
    await click(a, 'voice-microphone');
    await a.evaluate("window.__speechUpdate(0,[['250',false]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250');
    await a.evaluate("window.__speechUpdate(0,[['250 ml',true],['mleka',false]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka');
    await a.evaluate("window.__speechUpdate(1,[['mleka',true]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka');
    assert.equal(await a.evaluate("document.getElementById('live-transcript').textContent"),'250 ml mleka');
    assert.equal(await a.evaluate("document.getElementById('meal-proposal').hidden"),true);
    await click(a,'voice-microphone');
    await wait(a,"document.getElementById('meal-text-form').dataset.analysisState==='complete'");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka');
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items [data-item-id]').length"),1);
    assert.equal(await a.evaluate("document.querySelector('#meal-proposal [data-amount]').value"),'250');
    assert.deepEqual(await a.saved(),before); assert.equal(apiRequests().length,requests);
  });

  await t.test('pełne śniadanie z kilku kumulacyjnych final/interim nie powtarza żadnego fragmentu', async () => {
    const sentence='Na śniadanie 80 gram płatków owsianych i 250 ml mleka 2%';
    await click(a,'voice-microphone');
    await a.evaluate("window.__speechUpdate(0,[['Na śniadanie 80',false]])");
    await a.evaluate("window.__speechUpdate(0,[['Na śniadanie 80 gram płatków owsianych',true],['i 250',false]])");
    await a.evaluate("window.__speechUpdate(1,[['i 250 ml mleka 2%',false]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),sentence);
    await a.evaluate("window.__speechUpdate(1,[['i 250 ml mleka 2%',true]])");
    await a.evaluate("window.__speechUpdate(2,[])"); // Identyczna lista bez zmian.
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),sentence);
    await click(a,'voice-microphone');
    await wait(a,"document.getElementById('meal-text-form').dataset.analysisState==='complete'");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),sentence);
    assert.deepEqual(await a.outputs('proposal'),['421','18,9','10,6','60']);
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items [data-item-id]').length"),2);
  });

  await t.test('wiele produktów oraz rzeczywiste powtórzenie 250 są zachowane', async () => {
    await click(a,'voice-microphone');
    await a.evaluate("window.__speechUpdate(0,[['250 ml mleka',true],['i banan',false]])");
    await a.evaluate("window.__speechUpdate(1,[['i banan 120 gram',true]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka i banan 120 gram');
    await click(a,'voice-microphone');
    await wait(a,"document.getElementById('meal-text-form').dataset.analysisState==='complete'");
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items [data-item-id]').length"),2);
    await click(a,'voice-microphone');
    await a.evaluate("window.__speechUpdate(0,[['250 ml mleka',true],['i 250 ml kefiru',true]])");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka i 250 ml kefiru');
    await click(a,'cancel-speech');
  });

  await t.test('koniec sesji wyświetla tylko final — także w podglądzie na żywo', async () => {
    await click(a,'voice-microphone');
    await a.evaluate("window.__speechUpdate(0,[['250 ml mleka',true],['i niedokończony produkt',false]])");
    await click(a,'voice-microphone');
    await wait(a,"document.getElementById('meal-text-form').dataset.analysisState==='complete'");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"),'250 ml mleka');
    assert.equal(await a.evaluate("document.getElementById('live-transcript').textContent"),'250 ml mleka');
  });

  await t.test('interim pokazuje tekst bez analizy, requestu ani zapisu; final czeka na zakończenie', async () => {
    const started = await a.evaluate("window.__speechInstances.filter(instance=>instance.started).length");
    await click(a, 'voice-microphone');
    assert.equal(await a.evaluate("document.getElementById('voice-entry').dataset.speechState"), 'listening');
    await a.evaluate("window.__speechResult('', '80 gram płatków')");
    assert.equal(await a.evaluate("document.getElementById('meal-text').value"), '80 gram płatków');
    assert.equal(await a.evaluate("document.getElementById('meal-proposal').hidden"), true);
    assert.equal(apiRequests().length, 0); assert.equal((await a.saved()).length, 0);
    await a.evaluate(`window.__speechResult(${JSON.stringify(transcript)})`);
    assert.equal(await a.evaluate("document.getElementById('meal-proposal').hidden"), true);
    await click(a, 'voice-microphone');
    await wait(a, "document.getElementById('meal-text-form').dataset.analysisState==='complete'");
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items [data-item-id]').length"), 3);
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items [data-ready=true]').length"), 3);
    assert.deepEqual(await a.outputs('proposal'), ['527,8', '20,22', '10,96', '87,36']);
    assert.equal(await disabled(a), false); assert.equal((await a.saved()).length, 0); assert.equal(apiRequests().length, 0);
    assert.equal(await a.evaluate("window.__speechInstances.filter(instance=>instance.started).length"), started + 1);
    assert.equal(await a.evaluate("window.__speechInstances.at(-1).onresult"), null);
  });

  await t.test('potwierdzenie zapisuje trzy snapshoty jedną operacją, reload i pamięć działają', async () => {
    await a.evaluate(`window.__writes=0;window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='benger.preview-etap-5.nutrition.v1')window.__writes++;return window.__setItem.call(this,key,value)};`);
    await a.evaluate("document.getElementById('save-meal-proposal').click();document.getElementById('save-meal-proposal').click()");
    const saved = await a.saved(); assert.equal(saved.length, 3); assert.equal(await a.evaluate('window.__writes'), 1);
    assert.deepEqual(saved.map(entry=>entry.amount), [80,250,120]); assert.ok(saved.every(entry=>entry.meal==='breakfast' && entry.date===DAY));
    assert.deepEqual(await a.outputs('total'), ['527,8', '20,22', '10,96', '87,36']);
    await wait(a, `(async()=>{const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();const choices=await repo.selectionMemory('mleko 2 procent');await repo.close();return choices.length===1})()`);
    await a.reload(); await a.date(DAY); assert.equal((await a.visible()).length, 3);
    assert.ok(await a.evaluate("document.querySelector('#recent-products [data-product-id]')"));
    const names = await a.evaluate('(async()=> (await indexedDB.databases()).map(item=>item.name))()');
    assert.ok(names.includes('BengerDB-preview-etap-5')); assert.ok(!names.includes('BengerDB'));
    assert.equal(await a.raw('benger.nutrition.v1'), null); assert.equal(await a.raw('benger.preview-etap-3.nutrition.v1'), null);
  });

  await t.test('tekst używa tej samej propozycji; ponowna jawna akceptacja wzmacnia wybór', async () => {
    await a.analyze(transcript); assert.deepEqual(await a.outputs('proposal'), ['527,8', '20,22', '10,96', '87,36']);
    await a.accept();
    await wait(a, `(async()=>{const {createProductRepository}=await import('./product-repository.js');const repo=createProductRepository();const choices=await repo.selectionMemory('mleko 2%');await repo.close();return choices[0]?.count===2})()`);
    assert.equal((await a.saved()).length, 6);
  });

  await t.test('niepewny skyr: wybór jednego wiersza zachowuje resztę i uczy dopasowania', async () => {
    const raw = JSON.parse(await readFile(new URL('./tests/fixtures/off-products.json', import.meta.url))).products[1];
    const products = ['Pilos', 'Piątnica'].map((brand,index)=>({...raw,code:index ? '123457' : '123456',product_name_pl:'Skyr waniliowy',brands_tags_pl:[brand],image_front_small_url:null}));
    await a.evaluate(`(async()=>{const {createProductCache}=await import('./product-cache.js');const {normalizeOffProduct}=await import('./product-providers/open-food-facts.js');const cache=createProductCache();await cache.putProducts(${JSON.stringify(products)}.map(normalizeOffProduct));await cache.close();})()`);
    await a.analyze('Kolacja: 80 g płatków i skyr waniliowy 150 gram i banan 120 g');
    assert.equal(await disabled(a), true);
    assert.match(await a.evaluate("document.getElementById('meal-proposal-context').textContent"), /2 z 3/);
    assert.deepEqual(await a.outputs('proposal'), ['402,8', '11,72', '5,96', '75,36']);
    const others = await a.evaluate("[...document.querySelectorAll('#meal-proposal-items .proposal-card')].filter(card=>card.dataset.itemId!=='food-2').map(card=>card.textContent)");
    assert.equal(await a.evaluate("document.querySelectorAll('[data-item-id=food-2] [data-choice-id]').length"), 2);
    await a.evaluate("document.querySelector('[data-item-id=food-2] [data-choice-id]').click()");
    await wait(a, "!document.getElementById('save-meal-proposal').disabled");
    assert.deepEqual(await a.evaluate("[...document.querySelectorAll('#meal-proposal-items .proposal-card')].filter(card=>card.dataset.itemId!=='food-2').map(card=>card.textContent)"), others);
    assert.deepEqual(await a.outputs('proposal'), ['492,8', '17,72', '8,96', '84,36']);
    await a.accept();
    assert.equal((await a.saved()).at(-2).brand, 'Pilos');
    await wait(a, `(async()=>{const {createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const x=await r.selectionMemory('skyr waniliowy');await r.close();return x.length===1})()`);
    const learned=await a.evaluate("(async()=>{const {createProductRepository}=await import('./product-repository.js');const r=createProductRepository();const x=await r.selectionMemory('skyr waniliowy');await r.close();return x[0].count})()");
    assert.equal(learned,1,'Wybór i szybki zapis nie są dwoma osobnymi wyborami.');
    assert.equal(apiRequests().length, 0);
  });

  await t.test('brak ilości i złe formaty nie zgadują porcji; poprawa jednej ilości i posiłku', async () => {
    await a.analyze('śniadanie 80 g płatków i zjadłem banana');
    assert.equal(await disabled(a), true); assert.deepEqual(await a.outputs('proposal'), ['296', '10,4', '5,6', '48']);
    for (const value of ['0','-5','abc','--5','5,5,5']) { await fillRow(a,'food-2',value); assert.equal(await disabled(a),true); }
    await fillRow(a,'food-2','120,5');
    assert.equal(await disabled(a),false);
    await a.evaluate("const meal=document.querySelector('[data-item-id=food-2] [data-meal]');meal.value='snack';meal.dispatchEvent(new Event('change'))");
    assert.match(await a.evaluate("document.getElementById('meal-proposal-context').textContent"), /Różne posiłki/);
    await a.accept();
    const added=(await a.saved()).slice(-2); assert.equal(added[0].meal,'breakfast'); assert.equal(added[1].meal,'snack'); assert.equal(added[1].amount,120.5);
  });

  await t.test('konflikt g/ml wymaga ponownego podania ilości po jawnym wyborze produktu', async () => {
    await a.analyze('200 g mleka 2% i banan 120 g'); assert.equal(await disabled(a),true);
    await a.evaluate("document.querySelector('[data-item-id=food-1] [data-choice-id]').click()");
    await wait(a,"document.querySelector('[data-item-id=food-1] [data-unit]').value==='ml'");
    assert.equal(await a.evaluate("document.querySelector('[data-item-id=food-1] [data-amount]').value"),'');
    assert.equal(await disabled(a),true); await fillRow(a,'food-1','200');
    assert.equal(await disabled(a),false); assert.deepEqual(await a.outputs('proposal'), ['206,8','8,12','4,36','36,96']);
  });

  await t.test('wyszukanie w jednym wierszu: jawna akcja, bez requestów przy pisaniu i bez starego makro', async () => {
    const before=apiRequests().length;
    await a.evaluate("const q=document.querySelector('[data-item-id=food-1] [data-query]');q.value='mleko 2%';q.dispatchEvent(new Event('input'))");
    assert.equal(await disabled(a),true); assert.equal(apiRequests().length,before);
    await a.evaluate("document.querySelector('[data-item-id=food-1] [data-search]').click()");
    await wait(a,"!document.querySelector('[data-item-id=food-1] [data-search]').disabled");
    assert.equal(apiRequests().length,before+1);
    assert.ok(await a.evaluate("document.querySelectorAll('[data-item-id=food-1] [data-choice-id]').length>0"));
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items .proposal-card').length"),2);
  });

  await t.test('offline korzysta z pamięci wyborów i cache, bez HTTP i bez utraty dziennika', async () => {
    await a.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await wait(a,'navigator.onLine===false'); const before=apiRequests().length, count=(await a.saved()).length;
    await a.analyze('skyr waniliowy Pilos 150g'); assert.equal(await disabled(a),false);
    await a.accept(); assert.equal((await a.saved()).length,count+1); assert.equal(apiRequests().length,before);
    await a.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  });

  await t.test('anulowanie, odmowa zgody, brak mowy i błąd usługi nie zapisują danych', async () => {
    const before=await a.saved();
    await click(a,'voice-microphone');
    await a.evaluate("window.__lateResult=window.__speechInstances.at(-1).onresult;window.__lateEnd=window.__speechInstances.at(-1).onend;window.__speechResult('', 'niedokończony tekst')");
    await click(a,'cancel-speech'); await a.evaluate('window.__lateEnd()');
    assert.equal(await a.evaluate("document.getElementById('voice-entry').dataset.speechState"),'cancelled');
    assert.equal(await a.evaluate("document.getElementById('meal-proposal').hidden"),true);
    for (const [error,state] of [['not-allowed','permission-denied'],['no-speech','no-speech'],['network','service-error']]) {
      await click(a,'voice-microphone'); await a.evaluate(`window.__speechInstances.at(-1).onerror({error:${JSON.stringify(error)}})`);
      assert.equal(await a.evaluate("document.getElementById('voice-entry').dataset.speechState"),state);
      assert.equal(await a.evaluate("document.getElementById('meal-text').disabled"),false);
      assert.equal(await a.evaluate("window.__speechInstances.at(-1).onresult"),null);
    }
    assert.deepEqual(await a.saved(),before);
  });

  await t.test('brak Speech API jest normalnym fallbackiem; tekst nadal działa', async () => {
    const b=await browser.page(browser.base,{initScript:"window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;"});
    assert.equal(await b.evaluate("document.getElementById('voice-microphone').disabled"),true);
    assert.match(await b.evaluate("document.getElementById('speech-status').textContent"),/Możesz wpisać posiłek/);
    await b.analyze('banan 120g'); assert.equal(await disabled(b),false);
  });

  await t.test('nie więcej niż jeden automatyczny request na pięć nowych pozycji i brak XSS', async () => {
    await a.evaluate('window.__advanceClock(65000)'); const before=apiRequests().length;
    await a.analyze('100g kurczaka i 100g ryżu i 100g oliwy i 100g ziemniaków i 100g makaronu');
    assert.equal(apiRequests().length,before+1); assert.equal(await disabled(a),true);
    assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal-items .proposal-card').length"),5);
    await a.analyze('<img src=x onerror=window.__xss=true> banan 120g');
    assert.equal(await disabled(a),true); assert.equal(await a.evaluate("document.querySelectorAll('#meal-proposal img').length"),0);
    assert.notEqual(await a.evaluate('window.__xss'),true);
  });

  await t.test('spóźniony search nie zastępuje nowej analizy ani nie zapisuje starego posiłku', async () => {
    const b=await browser.page(browser.base,{initScript:SPEECH+`
      window.__nativeFetch=window.fetch;
      window.fetch=async(...args)=>{const response=await window.__nativeFetch(...args);if(String(args[0]).includes('/cgi/search.pl')){await new Promise(resolve=>window.__releaseOff=resolve);window.__oldFetchReturned=true;}return response;};
    `});
    await b.evaluate('window.__advanceClock(180000)');
    const before=await b.saved();
    await b.evaluate("document.getElementById('meal-text').value='100 g nieznanego produktu';document.getElementById('meal-text-form').requestSubmit()");
    await wait(b,"typeof window.__releaseOff==='function'");
    await b.analyze('banan 120g');
    await b.evaluate('window.__releaseOff()');await wait(b,'window.__oldFetchReturned===true');
    assert.equal(await b.evaluate("document.querySelectorAll('#meal-proposal-items [data-item-id]').length"),1);
    assert.match(await b.evaluate("document.getElementById('meal-proposal-items').textContent"),/Banan/);
    assert.deepEqual(await b.saved(),before);
  });

  await t.test('powtórzone ID blokują cały zestaw przed zapisem, bez uszkodzenia dziennika', async () => {
    await a.analyze(transcript);const before=await a.saved();
    await a.evaluate("window.__uuid=crypto.randomUUID;Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> 'duplicate-id'})");
    await a.accept();assert.deepEqual(await a.saved(),before);assert.equal(await disabled(a),false);
    assert.match(await a.evaluate("document.getElementById('meal-text-error').textContent"),/Żadna pozycja/);
    await a.evaluate("Object.defineProperty(crypto,'randomUUID',{configurable:true,value:window.__uuid})");
  });

  await t.test('autofill bez zdarzenia nie zapisuje starej porcji ani starego produktu', async () => {
    await a.analyze('banan 120g');const before=await a.saved();
    await a.evaluate("document.querySelector('[data-item-id=food-1] [data-amount]').value='150'");
    await a.accept();assert.deepEqual(await a.saved(),before);
    assert.deepEqual(await a.outputs('proposal'),['133,5','1,65','0,45','34,2']);
    await a.accept();assert.equal((await a.saved()).at(-1).amount,150);
    await a.analyze('banan 120g');const saved=await a.saved();
    await a.evaluate("document.querySelector('[data-item-id=food-1] [data-query]').value='inny produkt'");
    await a.accept();assert.equal(await disabled(a),true);assert.deepEqual(await a.saved(),saved);
  });

  await t.test('320/390/430 i desktop 1024/1440, mikrofon 88px, kontrast, etykiety i focus', async () => {
    await a.analyze(transcript);
    for (const width of [320,360,390,430,1024,1440]) {
      await a.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<720});
      const dimensions=await a.evaluate(`(()=>{const mic=document.getElementById('voice-microphone'),s=getComputedStyle(mic);return{scroll:document.documentElement.scrollWidth,width:innerWidth,height:mic.getBoundingClientRect().height,color:s.color,background:s.backgroundColor,columns:getComputedStyle(document.querySelector('.voice-layout')).gridTemplateColumns}})()`);
      assert.ok(dimensions.scroll<=width,JSON.stringify(dimensions)); assert.ok(dimensions.height>=88); assert.ok(contrast(dimensions.color,dimensions.background)>=4.5);
      if(width>=1024)assert.equal(dimensions.columns.split(' ').length,2);
      if(process.env.BENGER_VOICE_SCREENSHOTS && [390,1440].includes(width)) {
        await a.evaluate("document.getElementById('voice-entry').scrollIntoView({block:'start'})");
        const {data}=await a.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        await writeFile(`${process.env.BENGER_VOICE_SCREENSHOTS}-${width}.png`,Buffer.from(data,'base64'));
      }
    }
    assert.equal(await a.evaluate("document.getElementById('speech-status').getAttribute('aria-live')"),'polite');
    assert.ok(await a.evaluate("document.getElementById('voice-microphone').getAttribute('aria-label')"));
    assert.ok(await a.evaluate("[...document.querySelectorAll('#meal-proposal input,#meal-proposal select')].every(field=>document.querySelector('label[for=\"'+field.id+'\"]'))"));
    await a.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await a.send('Page.bringToFront');
    await a.evaluate("document.getElementById('voice-microphone').focus()");
    assert.equal(await a.evaluate("getComputedStyle(document.getElementById('voice-microphone')).outlineStyle"),'solid');
    await a.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
    await a.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await wait(a,"document.getElementById('voice-entry').dataset.speechState==='listening'");
    await click(a,'cancel-speech');
  });

  await t.test('konsola bez wyjątków aplikacji, publiczne moduły bez 404', async () => {
    assert.deepEqual(browser.errors,[]);
    assert.deepEqual(browser.responses.filter(response=>response.url.startsWith(browser.base) && response.status>=400),[]);
  });
});

test('Speech diagnostics — surowe kumulacyjne eventy i tryby A/B/C',async t=>{
 const browser=await startBrowser({staticPrefix:'/Benger/previews/etap-5/',previewBuild:true});t.after(()=>browser.close());
 const page=await browser.page(new URL('speech-diagnostics.html',browser.base).href,{diagnostic:true,initScript:SPEECH});
 for(const mode of ['A','B','C']){
  await page.evaluate(`document.getElementById('mode').value='${mode}';document.getElementById('start').click();window.__speechUpdate(0,[['250',false]]);window.__speechUpdate(0,[['250 ml',true],['mleka',false]]);window.__speechUpdate(1,[['mleka',true]]);document.getElementById('stop').click()`);
  const report=await page.evaluate("JSON.parse(document.getElementById('report').textContent)");
  assert.equal(report.continuous,mode==='A');assert.equal(report.interimResults,mode!=='C');assert.equal(report.finalTranscript,'250 ml mleka');assert.equal(report.events.filter(e=>e.type==='result').length,3);assert.equal(report.events.find(e=>e.resultIndex===1).results[0].transcript,'250 ml');assert.equal(await page.evaluate("document.getElementById('download').disabled"),false);
 }
 assert.deepEqual(browser.errors,[]);
});

test('Etap 5 — pięć struktur bez przecinków, save/reload, alias i voice lab', {timeout:120000},async t=>{
 const browser=await startBrowser({staticPrefix:'/Benger/previews/etap-5/',previewBuild:true,mockOFF:true});t.after(()=>browser.close());
 const a=await browser.page(browser.base,{initScript:SPEECH});await a.date(DAY);
 const cases=[
 ['na śniadanie 80 gram płatków owsianych 250 mililitrów mleka 2 procent i banana 120 gram',[80,250,120],['g','ml','g']],
 ['na obiad 200 gram kurczaka 100 gram ryżu 10 gram oliwy',[200,100,10],['g','g','g']],
 ['skyr waniliowy Pilos 150 gram i mleko Łaciate dwa procent 250 mili',[150,250],['g','ml']],
 ['250 ml mleka i 250 ml kefiru',[250,250],['ml','ml']],
 ['100 gram ryżu 100 gram kurczaka',[100,100],['g','g']],
 ];
 for(const [text,amounts,units] of cases)await t.test(text,async()=>{
  await a.evaluate('window.__advanceClock(65000)');const before=browser.off.requests.filter(r=>new URL(r.url).hostname==='world.openfoodfacts.org').length;
  await a.analyze(text);
  assert.deepEqual(await a.evaluate("[...document.querySelectorAll('#meal-proposal [data-amount]')].map(input=>Number(input.value))"),amounts);
  assert.deepEqual(await a.evaluate("[...document.querySelectorAll('#meal-proposal [data-unit]')].map(input=>input.value)"),units);
  const after=browser.off.requests.filter(r=>new URL(r.url).hostname==='world.openfoodfacts.org').length;assert.ok(after-before<=1);
 });
 await t.test('mikrofon → brak przecinków → poprawa jednego wiersza → save → reload',async()=>{
  await click(a,'voice-microphone');await a.evaluate(`window.__speechResult(${JSON.stringify(cases[0][0])})`);await click(a,'voice-microphone');
  await wait(a,"document.getElementById('meal-text-form').dataset.analysisState==='complete'");
  // Poprzedni scenariusz zapełnił cache drugim mlekiem: wymagamy jawnego wyboru wariantu.
  await a.evaluate("document.querySelector('[data-item-id=food-2] [data-choice-id=milk-2-percent]')?.click()");
  const first=await a.evaluate("document.querySelector('[data-item-id=food-1]').textContent");
  await fillRow(a,'food-3','130');assert.equal(await a.evaluate("document.querySelector('[data-item-id=food-1]').textContent"),first);
  assert.equal(await disabled(a),false,await a.evaluate("document.getElementById('meal-proposal').textContent"));await a.accept();assert.equal((await a.saved()).length,3);assert.equal((await a.saved())[2].amount,130);
  await a.reload();await a.date(DAY);assert.equal((await a.visible()).length,3);
 });
 await t.test('lab pokazuje expected/tokens/intents, alias XSS jest tekstem i historia ma limit',async()=>{
  const lab=await browser.page(new URL('voice-test-lab.html',browser.base).href,{diagnostic:true,initScript:SPEECH});
  await lab.evaluate("document.getElementById('scenario').value='8';document.getElementById('raw').value='na śniadanie 80 gram płatków owsianych 250 ml mleka 2 procent i banana 120 gram';document.getElementById('analyze').click()");
  await wait(lab,"document.getElementById('verdict').textContent==='PASS'");
  const data=await lab.evaluate("JSON.parse(document.getElementById('result').textContent)");assert.equal(data.intents.length,3);assert.ok(data.tokens.length>0);assert.ok(data.normalizedTranscript.includes('2%'));
  await lab.evaluate(`document.getElementById('alias').value='<img src=x onerror=alert(1)>';document.getElementById('product-id').value='milk-2-percent';document.getElementById('save-alias').click()`);
  await wait(lab,"document.getElementById('aliases').textContent.includes('<img')");assert.equal(await lab.evaluate("document.querySelectorAll('#aliases img').length"),0);
  const result=await lab.evaluate("(async()=>{const {createProductRepository}=await import('./product-repository.js');const {createProductResolver}=await import('./product-resolver.js');const repo=createProductRepository();await repo.createAlias('moje mleko','milk-2-percent');const result=await createProductResolver({repository:repo}).resolve({query:'moje mleko'});await repo.close();return result})()");assert.equal(result.reason,'explicit-user-alias');
  await lab.evaluate("(async()=>{const {recordAnalysis}=await import('./analysis-history.js');for(let i=0;i<25;i++)recordAnalysis({rawTranscript:'banan',normalizedTranscript:'banan',intents:[{}]},1)})()");
  await lab.evaluate("document.getElementById('raw').value='banan';document.getElementById('analyze').click()");await wait(lab,"JSON.parse(document.getElementById('history').textContent).length===20");
  assert.equal((await lab.evaluate("JSON.parse(document.getElementById('history').textContent)")).length,20);
  await click(lab,'clear');assert.deepEqual(await lab.evaluate("JSON.parse(document.getElementById('history').textContent)"),[]);
  assert.equal((await a.saved()).length,3);assert.deepEqual(browser.errors,[]);
 });
});
