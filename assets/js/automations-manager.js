(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s)),getDb=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb;
const st={db:null,rows:[],filtered:[],eventCount:0};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").trim().toLowerCase();
const pretty=v=>String(v||"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return}catch(e){return}
st.db=getDb();if(!st.db)return toast("Supabase unavailable.",true);
$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));

async function load(){
 const [rules,emailEvents,stripeEvents,wizardEvents]=await Promise.all([
   st.db.from("management_automations").select("*").order("updated_at",{ascending:false}),
   st.db.from("portal_email_events").select("id",{count:"exact",head:true}),
   st.db.from("stripe_webhook_events").select("id",{count:"exact",head:true}),
   st.db.from("wizard_v2_webhook_events").select("id",{count:"exact",head:true})
 ]);
 if(rules.error){
   $("#automationList").innerHTML='<div class="automation-empty">Run management-automations-integrations.sql once to create the automation configuration table.</div>';
   ["statTotal","statActive","statPaused"].forEach(id=>$("#"+id).textContent="0");
 }else{
   st.rows=rules.data||[];
 }
 st.eventCount=(emailEvents.count||0)+(stripeEvents.count||0)+(wizardEvents.count||0);
 $("#statEvents").textContent=st.eventCount;
 renderStats();apply();
}
function renderStats(){
 const cats=[...new Set(st.rows.map(x=>x.category).filter(Boolean))].sort();
 $("#automationCategory").innerHTML='<option value="">All categories</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join("");
 $("#statTotal").textContent=st.rows.length;
 $("#statActive").textContent=st.rows.filter(x=>x.is_enabled).length;
 $("#statPaused").textContent=st.rows.filter(x=>!x.is_enabled).length;
}
function apply(){
 const q=norm($("#automationSearch").value),cat=$("#automationCategory").value,state=$("#automationState").value;
 st.filtered=st.rows.filter(x=>(!q||[x.name,x.description,x.category,x.trigger_event,x.action_type,x.target].map(norm).join(" ").includes(q))&&(!cat||x.category===cat)&&(!state||(state==="enabled"?x.is_enabled:!x.is_enabled)));
 render();
}
function render(){
 $("#automationList").innerHTML=st.filtered.length?st.filtered.map(x=>`<article class="automation-row" data-id="${x.id}">
   <span class="automation-icon">◇</span>
   <div class="automation-copy"><strong>${esc(x.name)}</strong><p>${esc(x.description||"No description")}</p><small>${esc(x.category||"System")} · delay ${Number(x.delay_minutes||0)} min</small></div>
   <span class="flow-pill">${esc(pretty(x.trigger_event))}</span>
   <span class="flow-pill">${esc(pretty(x.action_type))}</span>
   <span class="state-pill ${x.is_enabled?"enabled":"disabled"}">${x.is_enabled?"Enabled":"Paused"}</span><time>›</time>
 </article>`).join(""):'<div class="automation-empty">No automations match these filters.</div>';
 $$(".automation-row").forEach(r=>r.onclick=()=>openAutomation(r.dataset.id));
}
function openAutomation(id){const del=$("#deleteAutomationButton");if(del){del.hidden=!id;del.onclick=id?()=>deleteAutomation(id):null;}
 const x=st.rows.find(y=>String(y.id)===String(id));
 $("#automationModalTitle").textContent=x?"Edit automation":"New automation";
 $("#automationId").value=x?.id||"";$("#automationName").value=x?.name||"";$("#automationDescription").value=x?.description||"";$("#automationEditCategory").value=x?.category||"Orders";$("#automationEnabled").value=String(x?.is_enabled??true);$("#automationTrigger").value=x?.trigger_event||"order_created";$("#automationAction").value=x?.action_type||"send_email";$("#automationDelay").value=x?.delay_minutes??0;$("#automationTarget").value=x?.target||"";$("#automationTemplate").value=x?.template_key||"";$("#automationNotes").value=x?.notes||"";$("#automationModal").hidden=false;
}
$("#automationForm").onsubmit=async e=>{e.preventDefault();const id=$("#automationId").value,p={name:$("#automationName").value.trim(),description:$("#automationDescription").value.trim()||null,category:$("#automationEditCategory").value,is_enabled:$("#automationEnabled").value==="true",trigger_event:$("#automationTrigger").value,action_type:$("#automationAction").value,delay_minutes:Number($("#automationDelay").value)||0,target:$("#automationTarget").value.trim()||null,template_key:$("#automationTemplate").value.trim()||null,notes:$("#automationNotes").value.trim()||null,updated_at:new Date().toISOString()};const r=id?await st.db.from("management_automations").update(p).eq("id",id):await st.db.from("management_automations").insert(p);if(r.error)return toast(r.error.message,true);$("#automationModal").hidden=true;await load();toast(id?"Automation updated.":"Automation created.")};
async function deleteAutomation(id){const x=st.rows?.find?.(a=>String(a.id)===String(id))||st.automations?.find?.(a=>String(a.id)===String(id));const ok=await window.filings4uDialog.confirm(`Delete automation “${x?.name||"this automation"}”?`,{title:"Delete automation",confirmText:"Delete automation"});if(!ok)return;const r=await st.db.from("management_automations").delete().eq("id",id);if(r.error)return toast(r.error.message,true);$("#automationModal").hidden=true;await load();toast("Automation deleted.")}function openNew(){openAutomation(null)}$("#newAutomationTop").onclick=openNew;$("#newAutomationButton").onclick=openNew;$$("[data-close-automation]").forEach(x=>x.onclick=()=>$("#automationModal").hidden=true);$("#automationSearch").oninput=apply;$("#automationCategory").onchange=apply;$("#automationState").onchange=apply;$("#refreshAutomations").onclick=load;$("#automationSearchTrigger").onclick=()=>$("#automationSearch").focus();await load();
})();