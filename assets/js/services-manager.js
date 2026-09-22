(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const getDb=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb||null;
const state={db:null,services:[],configs:[],filtered:[],current:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").trim().toLowerCase();
const yn=v=>v?"Yes":"No";
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
function val(v){return v===null||v===undefined||v===""?"—":String(v)}
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return;const u=a?.user;if(u){const email=u.email||"Admin account",meta=u.app_metadata||{},name=meta.display_name||meta.name||email.split("@")[0];$$("[data-admin-name]").forEach(x=>x.textContent=name);$$("[data-admin-email]").forEach(x=>x.textContent=email);$$("[data-admin-initials]").forEach(x=>x.textContent=name.split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase())}}catch(e){console.error(e)}
state.db=getDb();if(!state.db){toast("Supabase client is unavailable.",true);return}
$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));
const pb=$("#managementProfileButton"),pm=$("#managementProfileMenu");pb?.addEventListener("click",e=>{e.stopPropagation();pm.hidden=!pm.hidden});document.addEventListener("click",()=>{if(pm)pm.hidden=true});$("#managementSignOut")?.addEventListener("click",async()=>{await window.filings4uSignOut?.()});
async function load(){
 const [s,c]=await Promise.all([
  state.db.from("wizard_v2_services").select("service_key,service_title,category,service_type,requires_jurisdiction,requires_authorization,form_key,is_active,sort_order,government_fee_mode,government_fee_key,fixed_government_fee").order("sort_order"),
  state.db.from("catalog_wizard_configs").select("service_key,welcome_title,welcome_message,application_label,addons_label,authorization_label,summary_label,checkout_label,show_addons,show_summary,require_contact_capture,allow_save_resume,allow_back_navigation,checkout_enabled,success_redirect_url,config")
 ]);
 if(s.error){toast(s.error.message,true);console.error(s.error);return}
 state.services=s.data||[];state.configs=c.error?[]:(c.data||[]);
 const cm=new Map(state.configs.map(x=>[x.service_key,x]));state.services.forEach(x=>x._config=cm.get(x.service_key)||null);
 $("#statTotal").textContent=state.services.length;$("#statActive").textContent=state.services.filter(x=>x.is_active).length;$("#statForms").textContent=state.services.filter(x=>x.form_key).length;$("#statJurisdiction").textContent=state.services.filter(x=>x.requires_jurisdiction).length;
 const cf=$("#categoryFilter"),keep=cf.value,cats=[...new Set(state.services.map(x=>x.category).filter(Boolean))].sort();cf.innerHTML='<option value="">All categories</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join("");cf.value=keep;filter()
}
function filter(){
 const q=norm($("#serviceSearch").value),cat=$("#categoryFilter").value,active=$("#activeFilter").value,sort=$("#serviceSort").value;
 state.filtered=state.services.filter(s=>{const hay=[s.service_title,s.service_key,s.category,s.service_type,s.form_key].map(norm).join(" ");return(!q||hay.includes(q))&&(!cat||s.category===cat)&&(!active||(active==="active"?s.is_active:!s.is_active))});
 state.filtered.sort((a,b)=>sort==="title"?String(a.service_title||"").localeCompare(String(b.service_title||"")):sort==="category"?String(a.category||"").localeCompare(String(b.category||"")):(Number(a.sort_order)||0)-(Number(b.sort_order)||0));render()
}
function render(){
 $("#serviceTableBody").innerHTML=state.filtered.length?state.filtered.map(s=>`<tr data-key="${esc(s.service_key)}"><td><div class="service-name"><span>◈</span><div><strong>${esc(s.service_title)}</strong><small>${esc(s.service_key)}</small></div></div></td><td>${esc(val(s.category))}</td><td>${esc(val(s.service_type))}</td><td>${esc(val(s.form_key))}</td><td>${s.requires_jurisdiction?"Jurisdiction · ":""}${s.requires_authorization?"Authorization":"Standard"}</td><td><span class="status-pill ${s.is_active?"green":"gray"}">${s.is_active?"Active":"Inactive"}</span></td><td>›</td></tr>`).join(""):'<tr><td colspan="7"><div class="service-empty">No services match these filters.</div></td></tr>';
 $$("tr[data-key]").forEach(r=>r.addEventListener("click",()=>openRecord(r.dataset.key)));$("#serviceResultCount").textContent=`${state.filtered.length} services`
}
["serviceSearch","categoryFilter","activeFilter","serviceSort"].forEach(id=>$("#"+id)?.addEventListener(id==="serviceSearch"?"input":"change",filter));$("#refreshServices")?.addEventListener("click",load);$("#serviceSearchTrigger")?.addEventListener("click",()=>$("#serviceSearch").focus());
function openRecord(key){const s=state.services.find(x=>x.service_key===key);if(!s)return;state.current=s;$("#servicesListView").hidden=true;$("#serviceRecordView").hidden=false;history.replaceState(null,"",`admin-services.html?service=${encodeURIComponent(key)}`);renderRecord();scrollTo(0,0)}
function dl(obj){return Object.entries(obj).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(val(v))}</dd></div>`).join("")}
function renderRecord(){
 const s=state.current,c=s._config||{};$("#recordTitle").textContent=s.service_title||"Service";$("#recordKey").textContent=s.service_key;$("#recordMeta").textContent=[s.category,s.service_type].filter(Boolean).join(" · ")||"Catalog service";$("#recordStatus").textContent=s.is_active?"Active":"Inactive";$("#recordStatus").className="status-pill "+(s.is_active?"green":"gray");$("#recordForm").textContent=s.form_key||"Not linked";$("#recordJurisdiction").textContent=yn(s.requires_jurisdiction);$("#recordAuthorization").textContent=yn(s.requires_authorization);$("#recordSort").textContent=val(s.sort_order);
 $("#serviceDetails").innerHTML=dl({"Service title":s.service_title,"Service key":s.service_key,"Category":s.category,"Service type":s.service_type,"Form key":s.form_key,"Sort order":s.sort_order});
 $("#requirementList").innerHTML=[["Active service",s.is_active],["Jurisdiction step",s.requires_jurisdiction],["Authorization step",s.requires_authorization],["Application form",!!s.form_key]].map(([k,v])=>`<div class="requirement-item"><strong>${k}</strong><span>${v?"Enabled":"Not enabled"}</span></div>`).join("");
 $("#wizardConfig").innerHTML=[["Welcome title",c.welcome_title],["Application label",c.application_label],["Add-ons",c.show_addons?"Shown":"Hidden"],["Summary",c.show_summary?"Shown":"Hidden"],["Contact capture",yn(c.require_contact_capture)],["Save & resume",yn(c.allow_save_resume)],["Back navigation",yn(c.allow_back_navigation)],["Checkout",yn(c.checkout_enabled)],["Success redirect",c.success_redirect_url]].map(([k,v])=>`<div class="config-item"><strong>${esc(k)}</strong><span>${esc(val(v))}</span></div>`).join("");
 $("#feeDetails").innerHTML=dl({"Fee mode":s.government_fee_mode,"Fee key":s.government_fee_key,"Fixed government fee":s.fixed_government_fee})
}
$$("[data-tab]").forEach(b=>b.addEventListener("click",()=>{$$("[data-tab]").forEach(x=>x.classList.toggle("is-active",x===b));$$("[data-panel]").forEach(x=>x.classList.toggle("is-active",x.dataset.panel===b.dataset.tab))}));
$("#serviceBack")?.addEventListener("click",()=>{$("#serviceRecordView").hidden=true;$("#servicesListView").hidden=false;history.replaceState(null,"","admin-services.html");state.current=null});
$("#openWizardManager")?.addEventListener("click",()=>{if(state.current)location.href=`admin-management.html#wizard?service=${encodeURIComponent(state.current.service_key)}`});
function modal(newMode=false){const f=$("#serviceForm");f.reset();$("#serviceModalTitle").textContent=newMode?"New service":"Edit service";f.dataset.mode=newMode?"new":"edit";if(!newMode&&state.current){Object.keys(f.elements).forEach?.(()=>{});["service_title","service_key","category","service_type","form_key","sort_order","government_fee_mode","government_fee_key","fixed_government_fee"].forEach(k=>{if(f.elements[k])f.elements[k].value=state.current[k]??""});["is_active","requires_jurisdiction","requires_authorization"].forEach(k=>f.elements[k].checked=!!state.current[k]);f.elements.service_key.readOnly=true}else{f.elements.service_key.readOnly=false;f.elements.is_active.checked=true}$("#serviceModal").hidden=false}
$("#editServiceButton")?.addEventListener("click",()=>modal(false));$("#newServiceButton")?.addEventListener("click",()=>modal(true));$("#newServiceTop")?.addEventListener("click",()=>modal(true));$$("[data-close-modal]").forEach(x=>x.addEventListener("click",()=>$("#serviceModal").hidden=true));
$("#serviceForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=Object.fromEntries(new FormData(f));d.sort_order=Number(d.sort_order)||0;d.fixed_government_fee=d.fixed_government_fee===""?null:Number(d.fixed_government_fee);d.is_active=f.elements.is_active.checked;d.requires_jurisdiction=f.elements.requires_jurisdiction.checked;d.requires_authorization=f.elements.requires_authorization.checked;const mode=f.dataset.mode;let r;if(mode==="new")r=await state.db.from("wizard_v2_services").insert(d);else{delete d.service_key;r=await state.db.from("wizard_v2_services").update(d).eq("service_key",state.current.service_key)}if(r.error)return toast(r.error.message,true);$("#serviceModal").hidden=true;toast(mode==="new"?"Service created.":"Service updated.");await load();if(mode!=="new"){state.current=state.services.find(x=>x.service_key===state.current.service_key);renderRecord()}});
await load();const initial=new URLSearchParams(location.search).get("service");if(initial)openRecord(initial);
})();