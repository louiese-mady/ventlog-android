(() => {
  'use strict';
  const KEY='ventlog-free-entries-v1';
  const SHARE_KEY='ventlog-last-handoff-entry';
  const IS_APK=!!window.VentlogAndroid?.perform;
  function nativeRoute(action,values={}){
    if(!IS_APK)return;
    try{window.VentlogAndroid.perform(action,JSON.stringify(values));}
    catch(error){toast('Android feature unavailable. Try again.');}
  }

  const $=id=>document.getElementById(id);
  const all=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate=date=>new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(date));
  const simpleDate=date=>{const d=new Date(date);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const words=s=>(String(s||'').trim().match(/\S+/g)||[]).length;
  const uid=()=>globalThis.crypto?.randomUUID?.()||`rant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const topicsRules={
    'Work / career':/\b(work|job|boss|salary|employ|manager|interview|office|promotion|career|company|colleague|coworker|client|internship|trabaho|appl(y|ication)|unemployed)\b/i,
    'Money':/\b(money|cash|rent|loan|debt|pay|financial|budget|bills?|peso|expensive|income|fund|saving|utang|gastos|pera|bayad)\b/i,
    'Relationships':/\b(partner|boyfriend|girlfriend|relationship|breakup|dating|love|crush|ex|romantic|jowa|kaibigan)\b/i,
    'Family':/\b(family|mom|mother|dad|father|parent|sister|brother|sibling|child|uncle|aunt|cousin|anak|nanay|tatay|pamilya)\b/i,
    'School':/\b(school|college|university|class|teacher|professor|exam|grades?|thesis|homework|student|study|graduat|research|aral)\b/i,
    'Health / rest':/\b(health|sick|sleep|tired|insomnia|headache|hospital|doctor|rest|exhausted|fatigue|medical|pagod|pahinga)\b/i,
    'Technology':/\b(app|code|coding|program|developer|computer|laptop|phone|software|website|ai|bug|server|tech|gadget)\b/i,
    'Future / decisions':/\b(future|decision|choose|choice|plan|next step|uncertain|afraid|worry|dream|goal|direction|what if)\b/i
  };
  let entries=[];
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(raw))entries=raw.filter(x=>x&&typeof x==='object'&&typeof x.text==='string').slice(0,5000);}catch{}
  let rating=3, intent='perspective', draftId=null, selectedId=null, recognition=null, activeSpeech=false, toastTimer=null;
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(entries));return true;}catch(e){toast('Device storage full or blocked. Export a backup before adding more.');return false;}}
  function toast(message){const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},4000);}
  function go(name){if(name!=='compose'&&activeSpeech)stopVoice();for(const p of all('.page'))p.classList.toggle('active',p.id===`page-${name}`);for(const b of all('.bottom-nav button'))b.classList.toggle('active',b.dataset.go===name);if(name==='home')renderHome();if(name==='patterns')renderPatterns();if(name==='journal')renderJournal();window.scrollTo({top:0,behavior:'instant'});}
  const sorted=()=>entries.slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  function renderHome(){
    $('today-label').textContent=new Intl.DateTimeFormat('en-PH',{month:'short',day:'numeric'}).format(new Date());
    $('home-total').textContent=entries.length;
    const seven=Date.now()-7*86400000;
    $('home-week').textContent=entries.filter(e=>new Date(e.createdAt).getTime()>=seven).length;
    $('home-pending').textContent=entries.filter(e=>!String(e.reply||'').trim()).length;
    const last=sorted()[0];
    $('home-recent').innerHTML=last?`<button class="recent-home" style="width:100%;border:0;background:none;padding:0;color:inherit;text-align:left" data-open="${esc(last.id)}"><span class="recent-date">${esc(formatDate(last.createdAt))}</span><strong>${esc(last.title||autoTitle(last.text))}</strong><p>${esc(last.text)}</p></button>`:'Your first rant can be as messy as it needs to be.';
  }
  function autoTitle(text){const t=String(text).trim().replace(/\s+/g,' ');return t.length>48?t.slice(0,48).replace(/\s+\S*$/,'')+'…':(t||'Untitled rant');}
  function suggestTopics(text){return Object.entries(topicsRules).filter(([,re])=>re.test(text)).map(([label])=>label).slice(0,6);}
  function readComposer(){const body=$('rant-body').value.trim();if(!body){toast('Write something or use the voice button first.');return null;}
    if(body.length>30000){toast('Keep this entry under 30,000 characters.');return null;}
    const manual=$('topic-input').value.split(',').map(x=>x.trim().slice(0,32)).filter(Boolean).slice(0,8);
    return {title:$('rant-title').value.trim().slice(0,90)||autoTitle(body),text:body,mood:$('mood-select').value,intensity:rating,topics:manual.length?Array.from(new Set(manual)):suggestTopics(body),topicsSource:manual.length?'manual':'keyword',intent};}
  function saveComposer(){const data=readComposer();if(!data)return null;
    const old=draftId?entries.find(e=>e.id===draftId):null;
    if(old)Object.assign(old,data,{updatedAt:new Date().toISOString()});
    else {const now=new Date().toISOString();const fresh={id:uid(),createdAt:now,updatedAt:now,reply:'',...data};entries.push(fresh);draftId=fresh.id;}
    if(!persist())return null;
    return entries.find(e=>e.id===draftId);
  }
  function resetComposer(){if(activeSpeech)stopVoice();draftId=null;$('rant-title').value='';$('rant-body').value='';$('topic-input').value='';$('mood-select').value='Mixed';rating=3;intent='perspective';syncComposer();}
  function syncComposer(){all('[data-rating]').forEach(b=>b.classList.toggle('picked',Number(b.dataset.rating)===rating));$('rating-label').textContent=`${rating} / 5`;all('[data-intent]').forEach(b=>b.classList.toggle('picked',b.dataset.intent===intent));$('words-live').textContent=`${words($('rant-body').value)} words`;}
  function openEntry(id){const e=entries.find(x=>x.id===id);if(!e)return;selectedId=e.id;
    $('detail-heading').textContent=e.title||autoTitle(e.text);$('detail-body').textContent=e.text;
    $('detail-meta').innerHTML=`<span>${esc(formatDate(e.createdAt))}</span><span class="meta-bubble">${esc(e.mood||'Mixed')}</span><span class="meta-bubble">Intensity ${Math.max(1,Math.min(5,Number(e.intensity)||3))}/5</span>${(e.topics||[]).slice(0,5).map(t=>`<span class="meta-bubble">${esc(t)}</span>`).join('')}`;
    $('reply-body').value=e.reply||'';$('reply-status').textContent=e.reply?'Saved with this rant':'Not added yet';$('prompt-preview').hidden=true;
    go('detail');}
  function saveReply(){const e=entries.find(x=>x.id===selectedId);if(!e)return;const response=$('reply-body').value.trim();if(response.length>60000){toast('Reply is too long. Please shorten it.');return;}
    e.reply=response;e.updatedAt=new Date().toISOString();if(persist()){$('reply-status').textContent=response?'Saved with this rant':'Not added yet';toast('Response saved alongside your rant.');}}
  function chatPrompt(e){const instruction={listen:'Please listen with empathy. Reflect what you understand and ask at most one useful question. Do not give unsolicited solutions.',perspective:'Please respond warmly, give a grounded perspective, and offer practical advice without minimizing my feelings.',plan:'Help me identify what I can control, suggest 2–4 practical next steps, and avoid overwhelming me.'}[e.intent]||'Give me a grounded perspective.';
    return `I'm using a private personal journal to reflect on something. Please respond naturally, without diagnosing my emotions or pretending certainty. ${instruction}\n\nHere is my journal entry:\n\n${e.text}`;}
  async function copyText(text){if(IS_APK){nativeRoute('copy',{text});return true;}try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}
    try{const temp=document.createElement('textarea');temp.value=text;temp.style.position='fixed';temp.style.opacity='0';document.body.append(temp);temp.select();const ok=document.execCommand('copy');temp.remove();return ok;}catch{return false;}}
  function txtContent(e){return `VENTLOG — PRIVATE JOURNAL\n${'='.repeat(29)}\nTitle: ${e.title}\nDate: ${formatDate(e.createdAt)}\nFeeling: ${e.mood}\nIntensity (self-rated): ${e.intensity}/5\nTopics: ${(e.topics||[]).join(', ')||'None'}\n\nMY RANT\n${'-'.repeat(20)}\n${e.text}\n\nCHATGPT RESPONSE\n${'-'.repeat(20)}\n${e.reply||'(No reply saved yet)'}\n\nSaved with Ventlog Free.\n`;}
  function filename(e){const date=simpleDate(e.createdAt);const clean=String(e.title||'rant').normalize('NFKD').replace(/[^a-zA-Z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,45);return `ventlog-${date}-${clean||'rant'}.txt`;}
  function downloadFile(data,name,type){if(IS_APK){nativeRoute('save',{name,text:data});return;}const blob=new Blob([data],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function shareNotes(){const e=entries.find(x=>x.id===selectedId);if(!e)return;
    const text=txtContent(e);if(IS_APK){nativeRoute('share',{text});return;}const f=new File([text],filename(e),{type:'text/plain'});
    if(navigator.share){try{if(navigator.canShare?.({files:[f]})){await navigator.share({title:e.title,files:[f]});return;}await navigator.share({title:e.title,text});return;}catch(error){if(error?.name==='AbortError')return;}}
    if(await copyText(text))toast('Notes text copied! Paste it into your notes app.');else {downloadFile(text,filename(e),'text/plain');toast('Downloaded a .txt file to open in your notes app.');}
  }
  function renderJournal(){const q=$('journal-search').value.toLowerCase().trim();const matched=sorted().filter(e=>[e.title,e.text,e.reply,e.mood,...(e.topics||[])].join(' ').toLowerCase().includes(q));
    $('journal-list').innerHTML=matched.length?matched.map(e=>`<button class="journal-entry" data-open="${esc(e.id)}" type="button"><div class="entry-top"><span>${esc(formatDate(e.createdAt))}</span><span class="mood-chip">${esc(e.mood||'Mixed')}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.text)}</p><div class="entry-bottom"><span class="tiny-pill">${e.reply?'✓ Reply saved':'○ Needs reply'}</span><span>${esc(String(e.intensity||3))}/5 &nbsp;→</span></div></button>`).join(''):`<div class="empty-card">${q?'No matching rants. Try a different word.':'Nothing saved yet. Your journal starts whenever you’re ready.'}</div>`;}
  function bucket(items){const m=new Map();for(const t of items){if(!t)continue;const name=String(t);m.set(name,(m.get(name)||0)+1);}return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));}
  function barRows(id,items){const element=$(id),data=bucket(items).slice(0,6);if(!data.length){element.innerHTML='<p class="no-data">Not enough entries yet. Your patterns will appear here.</p>';return;}
    const max=data[0][1];element.innerHTML=data.map(([label,count])=>`<div class="stat-row"><div class="stat-row-header"><span>${esc(label)}</span><strong>${count}</strong></div><div class="stat-track"><div class="stat-fill" style="width:${Math.round(count/max*100)}%"></div></div></div>`).join('');}
  function renderPatterns(){const latest=entries;
    $('p-total').textContent=latest.length;$('p-words').textContent=latest.reduce((sum,e)=>sum+words(e.text),0).toLocaleString();
    $('p-days').textContent=new Set(latest.map(e=>simpleDate(e.createdAt))).size;
    $('p-intensity').textContent=latest.length?(latest.reduce((sum,e)=>sum+(Number(e.intensity)||3),0)/latest.length).toFixed(1):'—';
    const dates=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d;});
    const byDay=dates.map(d=>latest.filter(e=>simpleDate(e.createdAt)===simpleDate(d)));
    const counts=byDay.map(e=>e.length),maxCount=Math.max(...counts,1);
    $('activity-chart').innerHTML=dates.map((d,i)=>`<div class="day-cell" title="${counts[i]} entries on ${esc(d.toDateString())}"><div class="column-wrap"><div class="column-bar" style="height:${counts[i]?Math.max(7,counts[i]/maxCount*100):0}%"></div></div><small>${esc(d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,2))}</small></div>`).join('');
    $('intensity-chart').innerHTML=dates.map((d,i)=>{const items=byDay[i];const avg=items.length?items.reduce((s,e)=>s+(Number(e.intensity)||3),0)/items.length:0;return `<div class="day-cell" title="${items.length?avg.toFixed(1)+'/5':'No entries'} on ${esc(d.toDateString())}"><div class="column-wrap"><div class="column-bar purple" style="height:${avg?avg/5*100:0}%"></div></div><small>${esc(d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,2))}</small></div>`;}).join('');
    barRows('topics-chart',latest.flatMap(e=>e.topics||[]));barRows('moods-chart',latest.map(e=>e.mood||'Mixed'));
    barRows('time-chart',latest.map(e=>{const h=new Date(e.createdAt).getHours();return h<5?'Late night':h<12?'Morning':h<18?'Afternoon':'Evening';}));
    const t=bucket(latest.flatMap(e=>e.topics||[]))[0];
    $('pattern-insight').textContent=latest.length<3?'Once you have a few entries, recurring topics and routines may become easier to spot.':t?`“${t[0]}” comes up in ${t[1]} of your ${latest.length} entries. That’s a starting point for reflection—not a verdict about how you feel.`:'Your journal is growing. Consider adding topics to make patterns easier to explore.';
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  function stopVoice(){if(recognition){try{recognition.stop();}catch{}}activeSpeech=false;$('dictate-btn').classList.remove('listening');$('mic-label').textContent='Speak';$('voice-label').textContent='Dictation stopped. Edit the text whenever you like.';}
  function toggleDictation(){if(IS_APK){nativeRoute('speech',{lang:$('speech-lang').value||'en-PH'});return;}if(activeSpeech){stopVoice();return;}
    if(!SR){toast('Live dictation is not supported here. Use your keyboard microphone or type.');return;}
    const recog=new SR();recognition=recog;recog.lang=$('speech-lang').value||'en-PH';recog.continuous=true;recog.interimResults=true;recog.maxAlternatives=1;
    const starting=$('rant-body').value.trimEnd();const prefix=starting?starting+' ':'';activeSpeech=true;
    recog.onresult=event=>{let final='',interim='';for(let i=0;i<event.results.length;i++){const r=event.results[i];const t=r[0]?.transcript||'';if(r.isFinal)final+=t+' ';else interim+=t;}$('rant-body').value=(prefix+final+interim).trimStart().slice(0,30000);syncComposer();};
    recog.onerror=event=>{const names={'not-allowed':'Microphone permission denied.',network:'Speech service is unavailable. Try your keyboard microphone.','no-speech':'No speech detected. Tap Speak and try again.'};toast(names[event.error]||'Dictation stopped. You can type instead.');};
    recog.onend=()=>{if(recognition===recog){recognition=null;activeSpeech=false;$('dictate-btn').classList.remove('listening');$('mic-label').textContent='Speak';$('voice-label').textContent='Tap to dictate more, or use your keyboard microphone.';syncComposer();}};
    try{recog.start();$('dictate-btn').classList.add('listening');$('mic-label').textContent='Stop';$('voice-label').textContent='Listening now… tap Stop when you’re finished.';}catch{activeSpeech=false;recognition=null;toast('Could not start dictation. Check microphone permissions.');}
  }
  function openShareDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('ventlog-shared-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('inbox',{keyPath:'id',autoIncrement:true});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function takeSharedText(){try{const db=await openShareDb();const received=await new Promise((resolve,reject)=>{const t=db.transaction('inbox','readwrite');const s=t.objectStore('inbox');const get=s.openCursor(null,'prev');get.onsuccess=()=>{const c=get.result;if(!c){resolve(null);return;}const value=c.value;s.delete(c.key);resolve(value);};get.onerror=()=>reject(get.error);});db.close();return received?.text||null;}catch{return null;}}
  async function processShared(){if(!location.search.includes('shared=1'))return;history.replaceState(null,'',location.pathname);
    const text=await takeSharedText();if(!text){toast('No shared text found. You can paste it manually.');return;}
    const preferred=localStorage.getItem(SHARE_KEY);
    const target=entries.find(e=>e.id===preferred)||sorted().find(e=>!e.reply);
    if(target){if(target.reply&&!confirm(`Add this shared text to “${target.title}” and replace the existing reply?`)){const copied=await copyText(text);toast(copied?'Shared reply copied; paste it where you want.':'Could not import the shared reply.');return;}
      target.reply=text;target.updatedAt=new Date().toISOString();if(persist()){openEntry(target.id);toast('Shared text saved with your rant.');}}
    else {const copied=await copyText(text);if(copied)toast('Shared text copied. Create a rant and paste it where needed.');else {resetComposer();$('rant-body').value=text;syncComposer();go('compose');toast('Shared text is in a draft; save it if you want.');}}
  }
  // Events
  all('[data-go]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.go==='compose')resetComposer();go(b.dataset.go);}));
  $('home-new').addEventListener('click',()=>{resetComposer();go('compose');});
  $('rant-body').addEventListener('input',syncComposer);
  all('[data-rating]').forEach(b=>b.addEventListener('click',()=>{rating=Number(b.dataset.rating);syncComposer();}));
  all('[data-intent]').forEach(b=>b.addEventListener('click',()=>{intent=b.dataset.intent;syncComposer();}));
  $('dictate-btn').addEventListener('click',toggleDictation);
  $('save-rant').addEventListener('click',()=>{if(activeSpeech)stopVoice();const entry=saveComposer();if(entry){openEntry(entry.id);toast('Rant saved on this device.');}});
  $('save-send').addEventListener('click',()=>{if(activeSpeech)stopVoice();const entry=saveComposer();if(entry){localStorage.setItem(SHARE_KEY,entry.id);openEntry(entry.id);toast('Saved. Copy the prompt, then open ChatGPT.');}});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-open]');if(b)openEntry(b.dataset.open);});
  $('detail-back').addEventListener('click',()=>go('journal'));
  $('save-reply').addEventListener('click',saveReply);
  $('paste-reply').addEventListener('click',async()=>{try{if(!navigator.clipboard?.readText)throw new Error('Clipboard not supported');const t=await navigator.clipboard.readText();if(!t.trim()){toast('Clipboard is empty.');return;}$('reply-body').value=t;toast('Reply pasted. Tap Save response to keep it.');}catch{toast('Long-press in the reply box and choose Paste.');$('reply-body').focus();}});
  $('copy-prompt').addEventListener('click',async()=>{const e=entries.find(x=>x.id===selectedId);if(!e)return;localStorage.setItem(SHARE_KEY,e.id);if(await copyText(chatPrompt(e)))toast('Prompt copied! Open ChatGPT, paste and send it.');else{$('prompt-preview').hidden=false;$('prompt-preview').value=chatPrompt(e);$('prompt-preview').select();toast('Select and copy the prompt below.');}});
  $('open-chatgpt').addEventListener('click',event=>{if(selectedId)localStorage.setItem(SHARE_KEY,selectedId);if(IS_APK){event.preventDefault();nativeRoute('open',{url:'https://chatgpt.com/'});}});
  $('show-prompt').addEventListener('click',()=>{const e=entries.find(x=>x.id===selectedId);if(!e)return;$('prompt-preview').hidden=!$('prompt-preview').hidden;$('prompt-preview').value=chatPrompt(e);});
  $('download-txt').addEventListener('click',()=>{const e=entries.find(x=>x.id===selectedId);if(!e)return;downloadFile(txtContent({...e,reply:$('reply-body').value}),filename(e),'text/plain;charset=utf-8');toast('Text file downloaded.');});
  $('share-notes').addEventListener('click',async()=>{const e=entries.find(x=>x.id===selectedId);if(!e)return;const text=$('reply-body').value;if(text!==e.reply){e.reply=text.trim();e.updatedAt=new Date().toISOString();persist();}await shareNotes();});
  $('delete-entry').addEventListener('click',()=>{const e=entries.find(x=>x.id===selectedId);if(!e)return;if(!confirm(`Permanently delete “${e.title}”? This cannot be undone.`))return;entries=entries.filter(x=>x.id!==e.id);persist();if(draftId===e.id)draftId=null;selectedId=null;go('journal');toast('Entry deleted.');});
  $('journal-search').addEventListener('input',renderJournal);
  $('backup-menu').addEventListener('click',()=>$('backup-dialog').showModal());
  $('export-json').addEventListener('click',()=>{downloadFile(JSON.stringify({app:'Ventlog Free',version:1,exportedAt:new Date().toISOString(),entries},null,2),`ventlog-backup-${simpleDate(new Date())}.json`,'application/json');toast('Journal backup downloaded.');});
  $('import-json').addEventListener('change',async ev=>{const f=ev.target.files?.[0];if(!f)return;try{if(f.size>8*1024*1024)throw new Error('Backup too large (8 MB max).');const data=JSON.parse(await f.text());if(data.app!=='Ventlog Free'||!Array.isArray(data.entries))throw new Error('Not a Ventlog Free backup.');const incoming=data.entries.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&typeof x.createdAt==='string').slice(0,5000);if(!confirm(`Import ${incoming.length} entries? Existing entries with the same ID will be updated.`))return;const m=new Map(entries.map(e=>[e.id,e]));for(const e of incoming)m.set(e.id,e);const prev=entries;entries=Array.from(m.values());if(!persist())entries=prev;else{toast(`${incoming.length} entries imported.`);$('backup-dialog').close();go('journal');}}catch(err){toast(err.message||'Invalid backup file.');}finally{ev.target.value='';}});
  $('delete-all').addEventListener('click',()=>{if(!confirm('Permanently delete ALL Ventlog entries on this device?'))return;if(!confirm('Last check: delete everything? Export a backup first if needed.'))return;entries=[];draftId=null;selectedId=null;persist();$('backup-dialog').close();go('home');toast('All entries deleted.');});
  // Invoked only when the Android home-screen widget opens Ventlog.
  // Keep any existing unsaved text instead of silently discarding it.
  window.ventlogWidgetStart=(mode)=>{
    if(!$('rant-body').value.trim())resetComposer();
    go('compose');
    if(mode==='voice')toggleDictation();
    else $('rant-body').focus();
  };
  window.ventlogNativeSpeechResult=(spoken)=>{
    const t=String(spoken||'').trim();if(!t)return;
    const before=$('rant-body').value.trimEnd();
    $('rant-body').value=((before?before+' ':'')+t).slice(0,30000);
    syncComposer();go('compose');toast('Transcribed. You can edit before saving.');
  };
  window.ventlogNativeSharedText=(shared)=>{
    const text=String(shared||'').trim();if(!text)return;
    const preferred=localStorage.getItem(SHARE_KEY);
    const target=entries.find(e=>e.id===preferred)||sorted().find(e=>!e.reply);
    if(target){
      if(target.reply&&!confirm('Replace the existing saved ChatGPT reply?'))return;
      target.reply=text.slice(0,60000);target.updatedAt=new Date().toISOString();
      if(persist()){openEntry(target.id);toast('Reply saved alongside your rant.');}
    }else{
      resetComposer();$('rant-body').value=text.slice(0,30000);
      syncComposer();go('compose');toast('Shared text added to a new rant draft.');
    }
  };
  if(IS_APK){$('speech-warning').textContent='Uses Android voice input where supported. Your keyboard microphone is another option.';}
  syncComposer();renderHome();
  if(!IS_APK && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
  processShared();
})();