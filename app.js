const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem("buba_"+key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem("buba_"+key, JSON.stringify(value)); }
};
let characters = store.get("characters", []);
let universes = store.get("universes", []);
let stories = store.get("stories", []);
let currentStory = null;
let messages = [];
let busy = false;
let modalType = "";

function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }
function saveAll(){store.set("characters",characters);store.set("universes",universes);store.set("stories",stories);}
function updateRecent(){
  const list=$("#recentList"); list.innerHTML="";
  if(!stories.length){list.innerHTML='<div class="empty-small">Your stories will appear here.</div>';return;}
  stories.slice().reverse().slice(0,8).forEach(s=>{const b=document.createElement("button");b.className="recent-item";b.textContent=s.title||"Untitled story";b.onclick=()=>loadStory(s.id);list.append(b);});
}
function refreshSelects(){
  const cs=$("#characterSelect"),us=$("#universeSelect");
  const cval=cs.value,uval=us.value;
  cs.innerHTML='<option value="">Choose a character</option>'+characters.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  us.innerHTML='<option value="">Choose a universe</option>'+universes.map(u=>`<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("");
  cs.value=cval;us.value=uval;
}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function switchView(view){
  $$(".view").forEach(v=>v.classList.remove("active"));$("#"+view+"View").classList.add("active");
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const labels={chat:"ROLEPLAY CHAT",characters:"CHARACTERS",universes:"UNIVERSES & AUS",writing:"WRITING STUDIO"};
  $("#crumb").innerHTML=`WORKSPACE <span>/</span> ${labels[view]}`;
}
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
$("#focusBtn").onclick=()=>document.body.classList.toggle("focus");

function renderMessages(){
  const box=$("#messages");box.innerHTML="";
  messages.forEach(m=>{
    const row=document.createElement("div");row.className="message "+m.role;
    const avatar=document.createElement("div");avatar.className="message-avatar";avatar.textContent=m.role==="assistant"?"b.":"Y";
    const body=document.createElement("div");body.className="message-body";
    if(m.role==="assistant"){const label=document.createElement("div");label.className="message-label";label.textContent="BUBA";body.append(label);}
    const content=document.createElement("div");content.textContent=m.content;body.append(content);row.append(avatar,body);box.append(row);
  });
  box.scrollTop=box.scrollHeight;
}
function showWelcome(show){$("#welcome").style.display=show?"block":"none";}
function newStory(){
  currentStory={id:crypto.randomUUID(),title:"Untitled story",messages:[],memory:"",characterId:"",universeId:"",style:"Literary & descriptive",pov:"Third person"};
  messages=[];$("#storyTitle").value=currentStory.title;$("#memoryInput").value="";$("#characterSelect").value="";$("#universeSelect").value="";$("#styleSelect").value=currentStory.style;$("#povSelect").value=currentStory.pov;
  renderMessages();showWelcome(true);updateRecent();switchView("chat");
}
function persistStory(){
  if(!currentStory)return;
  currentStory.title=$("#storyTitle").value.trim()||"Untitled story";
  currentStory.messages=messages;currentStory.memory=$("#memoryInput").value;
  currentStory.characterId=$("#characterSelect").value;currentStory.universeId=$("#universeSelect").value;
  currentStory.style=$("#styleSelect").value;currentStory.pov=$("#povSelect").value;
  const idx=stories.findIndex(s=>s.id===currentStory.id);
  if(idx>=0)stories[idx]=currentStory;else stories.push(currentStory);
  saveAll();updateRecent();
}
function loadStory(id){
  const s=stories.find(x=>x.id===id);if(!s)return;
  currentStory=s;messages=s.messages||[];
  $("#storyTitle").value=s.title||"";$("#memoryInput").value=s.memory||"";
  refreshSelects();$("#characterSelect").value=s.characterId||"";$("#universeSelect").value=s.universeId||"";
  $("#styleSelect").value=s.style||"Literary & descriptive";$("#povSelect").value=s.pov||"Third person";
  renderMessages();showWelcome(!messages.length);switchView("chat");
}
$("#newChat").onclick=newStory;
$("#clearContext").onclick=()=>{if(!currentStory)return;$("#memoryInput").value="";persistStory();toast("Story memory cleared.");};
["storyTitle","memoryInput","characterSelect","universeSelect","styleSelect","povSelect"].forEach(id=>$("#"+id).addEventListener("change",persistStory));
$("#storyTitle").addEventListener("input",()=>{if(currentStory){currentStory.title=$("#storyTitle").value;persistStory();}});
function buildSystemPrompt(){
  const char=characters.find(c=>c.id===$("#characterSelect").value);
  const uni=universes.find(u=>u.id===$("#universeSelect").value);
  return `You are BUBA, a skilled collaborative roleplay partner and fiction co-writer. Write immersive, emotionally nuanced, coherent prose. Respect continuity and the user's creative direction. Do not control the user's character, decide their thoughts, feelings, dialogue or actions unless explicitly asked. Avoid rushing scenes or resolving tension too quickly. Match the requested format and style. Use sensory details and natural dialogue without repetitive purple prose.
Story title: ${$("#storyTitle").value||"Untitled"}
Writing style: ${$("#styleSelect").value}
Point of view: ${$("#povSelect").value}
${char?`Main character:\nName: ${char.name}\nPersonality: ${char.personality}\nBackstory: ${char.backstory}\nVoice / details: ${char.details}`:""}
${uni?`Universe / AU:\nName: ${uni.name}\nPremise: ${uni.premise}\nWorld rules and lore: ${uni.lore}`:""}
Persistent story memory / lore (treat as canon):
${$("#memoryInput").value||"No additional memory supplied."}
If the user adds new canon, follow it. If details conflict, prioritize the latest explicit user correction.`;
}
async function sendMessage(prefill){
  const input=$("#promptInput");const text=(prefill??input.value).trim();
  if(!text||busy)return;
  if(!currentStory)newStory();
  messages.push({role:"user",content:text});input.value="";input.style.height="auto";showWelcome(false);renderMessages();persistStory();
  busy=true;$("#sendBtn").disabled=true;
  const wait={role:"assistant",content:"…"};messages.push(wait);renderMessages();
  try{
    const payload=messages.filter(m=>m.content!=="…").slice(-24);
    const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:payload,systemPrompt:buildSystemPrompt()})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"The AI request failed.");
    messages[messages.length-1]={role:"assistant",content:data.answer||"I couldn't generate a response. Try again."};
  }catch(err){
    messages.pop();messages.push({role:"assistant",content:`I couldn't reach the AI yet.\n\n${err.message}\n\nYour message is still in this chat. Configure an API key in Settings & API, then send it again.`});
  }
  busy=false;$("#sendBtn").disabled=false;renderMessages();persistStory();
}
$("#sendBtn").onclick=()=>sendMessage();
$("#promptInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
$("#promptInput").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px";});
$$(".starter").forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));

function openModal(type){
  modalType=type;$("#modalBackdrop").classList.add("open");
  const isChar=type==="character";$("#modalEyebrow").textContent=isChar?"CHARACTER ARCHIVE":"WORLD BUILDING";
  $("#modalTitle").textContent=isChar?"Create a character":"Create a universe";
  const fields=isChar?[
    ["name","Character name","input","e.g. Seo Jiwon"],["personality","Personality","textarea","Temperament, habits, flaws, contradictions…"],["backstory","Backstory","textarea","Where they come from, what shaped them…"],["details","Voice & details","textarea","Speech patterns, appearance, relationships…"]
  ]:[
    ["name","Universe name","input","e.g. Seoul, 2032"],["premise","Premise","textarea","What is this AU about?"],["lore","World rules & lore","textarea","Setting, timeline, social rules, history…"]
  ];
  $("#modalFields").innerHTML=fields.map(([id,label,type,placeholder])=>`<div class="modal-field"><label for="entity_${id}">${label.toUpperCase()}</label>${type==="input"?`<input id="entity_${id}" name="${id}" placeholder="${placeholder}" required>`:`<textarea id="entity_${id}" name="${id}" placeholder="${placeholder}"></textarea>`}</div>`).join("");
  $("#entityForm").reset();
}
$("#addCharacter").onclick=()=>openModal("character");$("#addUniverse").onclick=()=>openModal("universe");
$("#modalClose").onclick=()=>$("#modalBackdrop").classList.remove("open");
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")$("#modalBackdrop").classList.remove("open");});
$("#entityForm").onsubmit=e=>{
  e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());data.id=crypto.randomUUID();
  if(modalType==="character")characters.push(data);else universes.push(data);
  saveAll();renderEntities();refreshSelects();$("#modalBackdrop").classList.remove("open");toast("Saved to your BUBA workspace.");
};
function renderEntities(){
  const c=$("#characterGrid"),u=$("#universeGrid");
  c.innerHTML=characters.length?characters.map(x=>`<article class="entity-card"><button class="delete-entity" data-type="character" data-id="${x.id}">×</button><div class="entity-tag">CHARACTER</div><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.personality||x.backstory||"No description yet.")}</p></article>`).join(""):'<div class="empty-card">No characters yet. Create your first character to bring the story to life.</div>';
  u.innerHTML=universes.length?universes.map(x=>`<article class="entity-card"><button class="delete-entity" data-type="universe" data-id="${x.id}">×</button><div class="entity-tag">UNIVERSE / AU</div><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.premise||x.lore||"No description yet.")}</p></article>`).join(""):'<div class="empty-card">No universes yet. Give your imagination a place to live.</div>';
  $$(".delete-entity").forEach(b=>b.onclick=()=>{if(!confirm("Delete this item?"))return;if(b.dataset.type==="character")characters=characters.filter(x=>x.id!==b.dataset.id);else universes=universes.filter(x=>x.id!==b.dataset.id);saveAll();renderEntities();refreshSelects();});
}
$("#draftText").value=store.get("draft","");
$("#chapterTitle").value=store.get("draftTitle","");
$("#draftText").addEventListener("input",()=>{store.set("draft",$("#draftText").value);updateWordCount();});
$("#chapterTitle").addEventListener("input",()=>store.set("draftTitle",$("#chapterTitle").value));
function updateWordCount(){const n=$("#draftText").value.trim().split(/\s+/).filter(Boolean).length;$("#wordCount").textContent=`${n} ${n===1?"word":"words"}`;}
$("#polishDraft").onclick=()=>{
  const draft=$("#draftText").value.trim();if(!draft){toast("Write a few lines first.");return;}
  switchView("chat");sendMessage(`Please continue or polish this draft while preserving its voice, events and characterisation. Do not summarize it. Here is the draft:\n\n${draft}`);
};
async function checkStatus(){
  try{const r=await fetch("/api/status");const d=await r.json();$("#statusDot").classList.toggle("online",d.configured);$("#statusText").textContent=d.configured?`${d.provider.toUpperCase()} connected`:`${d.provider.toUpperCase()} · API key needed`;$("#modelPill").textContent=d.configured?`AI · ${d.model}`:"AI · NOT CONNECTED";}
  catch{$("#statusText").textContent="Local server unavailable";}
}
$("#settingsBtn").onclick=()=>{
  alert("BUBA API setup:\n\n1. Open the project folder on your computer.\n2. Rename .env.example to .env.\n3. Choose AI_PROVIDER=openai, anthropic or gemini.\n4. Paste the matching API key into its variable.\n5. Run npm install, then npm start.\n6. Open http://localhost:3000\n\nNever share your API key or put it in public frontend code.");
};
newStory();renderEntities();refreshSelects();updateRecent();updateWordCount();checkStatus();