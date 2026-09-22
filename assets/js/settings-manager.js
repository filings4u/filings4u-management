(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const getDb=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb;
const st={db:null,global:null,schedules:[],schedule:null,pools:[],pool:null};
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return}catch(e){return}
st.db=getDb();if(!st.db)return toast("Supabase unavailable.",true);

$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));
$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));
$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));

$$("[data-settings-tab]").forEach(btn=>btn.onclick=()=>{
  $$("[data-settings-tab]").forEach(x=>x.classList.toggle("is-active",x===btn));
  $$("[data-settings-panel]").forEach(x=>x.classList.toggle("is-active",x.dataset.settingsPanel===btn.dataset.settingsTab));
});

async function loadGlobal(){
  const r=await st.db.from("global_platform_settings").select("*").eq("id",1).maybeSingle();
  if(r.error){toast(r.error.message,true);return}
  st.global=r.data||{};
  $("#websiteOperatingMode").value=st.global.website_operating_mode||"production";
  $("#maintenanceMode").checked=!!st.global.maintenance_mode_interlock_active;
  $("#websiteAnnouncement").value=st.global.website_announcement||"";
  $("#clientPortalEnabled").checked=st.global.client_portal_enabled!==false;
  $("#clientPortalShowOrders").checked=st.global.client_portal_show_orders!==false;
  $("#clientPortalShowSupport").checked=st.global.client_portal_show_support!==false;
  $("#clientPortalAnnouncement").value=st.global.client_portal_announcement||"";
  $("#starterFee").value=Number(st.global.starter_base_processing_fee||0).toFixed(2);
  $("#premiumFee").value=Number(st.global.premium_suite_processing_fee||0).toFixed(2);
  $("#stateDisbursementFee").value=Number(st.global.state_disbursement_baseline_fee||0).toFixed(2);
  $("#stripeWebhookUrl").value=st.global.stripe_webhook_receiver_url||"";
  $("#transactionalEmailUrl").value=st.global.transactional_email_endpoint_url||"";
}
async function saveGlobal(){
  const payload={
    website_operating_mode:$("#websiteOperatingMode").value,
    maintenance_mode_interlock_active:$("#maintenanceMode").checked,
    website_announcement:$("#websiteAnnouncement").value.trim()||null,
    client_portal_enabled:$("#clientPortalEnabled").checked,
    client_portal_show_orders:$("#clientPortalShowOrders").checked,
    client_portal_show_support:$("#clientPortalShowSupport").checked,
    client_portal_announcement:$("#clientPortalAnnouncement").value.trim()||null,
    starter_base_processing_fee:Number($("#starterFee").value)||0,
    premium_suite_processing_fee:Number($("#premiumFee").value)||0,
    state_disbursement_baseline_fee:Number($("#stateDisbursementFee").value)||0,
    stripe_webhook_receiver_url:$("#stripeWebhookUrl").value.trim()||null,
    transactional_email_endpoint_url:$("#transactionalEmailUrl").value.trim()||null,
    updated_at:new Date().toISOString()
  };
  const r=await st.db.from("global_platform_settings").update(payload).eq("id",1);
  if(r.error)return toast(r.error.message,true);
  toast("Platform settings saved.");
  await loadGlobal();
}
async function loadScheduling(){
  const r=await st.db.from("scheduling_settings").select("*").order("id");
  if(r.error){toast(r.error.message,true);return}
  st.schedules=r.data||[];
  $("#schedulingRecordPicker").innerHTML=st.schedules.length?st.schedules.map((x,i)=>`<button type="button" data-schedule-id="${x.id}" class="${i===0?"is-active":""}">${x.id}</button>`).join(""):'<span>No scheduling settings records found.</span>';
  $$("[data-schedule-id]").forEach(b=>b.onclick=()=>selectSchedule(b.dataset.scheduleId));
  if(st.schedules.length)selectSchedule(st.schedules[0].id);
}
function selectSchedule(id){
  st.schedule=st.schedules.find(x=>String(x.id)===String(id));if(!st.schedule)return;
  $$("[data-schedule-id]").forEach(b=>b.classList.toggle("is-active",String(b.dataset.scheduleId)===String(id)));
  $("#openingTime").value=String(st.schedule.opening_time||"08:00").slice(0,5);
  $("#closingTime").value=String(st.schedule.closing_time||"17:00").slice(0,5);
  $("#bufferMinutes").value=st.schedule.buffer_minutes??30;
  $("#blockedSlots").value=JSON.stringify(st.schedule.blocked_date_slots||{},null,2);
}
async function saveScheduling(){
  if(!st.schedule)return;
  let blocked={};
  try{blocked=JSON.parse($("#blockedSlots").value||"{}")}catch(e){return toast("Blocked date slots must contain valid JSON.",true)}
  const r=await st.db.from("scheduling_settings").update({
    opening_time:$("#openingTime").value||"08:00",
    closing_time:$("#closingTime").value||"17:00",
    buffer_minutes:Number($("#bufferMinutes").value)||0,
    blocked_date_slots:blocked,
    updated_at:new Date().toISOString()
  }).eq("id",st.schedule.id);
  if(r.error)return toast(r.error.message,true);
  toast("Scheduling settings saved.");await loadScheduling();
}
async function loadPools(){
  const r=await st.db.from("random_pool_settings").select("*").order("pool_type");
  if(r.error){toast(r.error.message,true);return}
  st.pools=r.data||[];
  $("#randomPoolPicker").innerHTML=st.pools.length?st.pools.map(x=>`<option value="${x.id}">${x.pool_type}${x.dot_agency?" · "+x.dot_agency:""}</option>`).join(""):'<option value="">No pools found</option>';
  $("#randomPoolPicker").onchange=()=>selectPool($("#randomPoolPicker").value);
  if(st.pools.length)selectPool(st.pools[0].id);
}
function selectPool(id){
  st.pool=st.pools.find(x=>String(x.id)===String(id));if(!st.pool)return;
  $("#randomPoolPicker").value=st.pool.id;
  $("#poolType").value=st.pool.pool_type||"";
  $("#dotAgency").value=st.pool.dot_agency||"";
  $("#drugRate").value=st.pool.drug_rate??50;
  $("#alcoholRate").value=st.pool.alcohol_rate??10;
  $("#selectionFrequency").value=st.pool.selection_frequency||"quarterly";
  $("#randomPoolActive").checked=st.pool.active!==false;
}
async function savePool(){
  if(!st.pool)return;
  const r=await st.db.from("random_pool_settings").update({
    pool_type:$("#poolType").value.trim(),
    dot_agency:$("#dotAgency").value.trim()||null,
    drug_rate:Number($("#drugRate").value)||0,
    alcohol_rate:Number($("#alcoholRate").value)||0,
    selection_frequency:$("#selectionFrequency").value,
    active:$("#randomPoolActive").checked,
    updated_at:new Date().toISOString()
  }).eq("id",st.pool.id);
  if(r.error)return toast(r.error.message,true);
  toast("Random pool settings saved.");await loadPools();
}
async function loadAll(){await Promise.all([loadGlobal(),loadScheduling(),loadPools()])}
$("#saveSettings").onclick=saveGlobal;$("#saveSettingsTop").onclick=saveGlobal;$("#refreshSettings").onclick=loadAll;$("#saveScheduling").onclick=saveScheduling;$("#saveRandomPool").onclick=savePool;$("#refreshRandomPool").onclick=loadPools;$("#settingsSearchTrigger").onclick=async()=>{const q=await window.filings4uDialog.prompt("Search settings",{title:"Find settings",label:"Search",placeholder:"Billing, security, scheduling…"});if(!q)return;const term=q.toLowerCase();const btn=$$("[data-settings-tab]").find(b=>b.textContent.toLowerCase().includes(term));if(btn)btn.click();else toast("No matching settings section found.")};
await loadAll();
})();