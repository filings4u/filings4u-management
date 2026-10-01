(function(){
'use strict';
const STATUSES=['Submitted','Under Review','Processing','Filed','Approved','Completed','On Hold','Rejected','Cancelled'];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';
const statusClass=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,'-').replace(/_/g,'-').replace(/[^a-z0-9-]/g,'');
let db,user,session,apps=[],orders=[],events=[],filtered=[],active=null,toastTimer;

async function boot(){
  const auth=await window.filings4uRequireAdmin();
  if(!auth)return;
  ({db,user,session}=auth);
  $('workflowNewStatus').innerHTML=STATUSES.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('workflowStatusFilter').innerHTML='<option value="">All statuses</option>'+STATUSES.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  await load();
}

async function load(){
  $('workflowTableBody').innerHTML='<tr><td colspan="7"><div class="workflow-empty">Loading filing workflow…</div></td></tr>';
  const [a,o,e]=await Promise.all([
    db.from('applications').select('id,business_name,current_status,is_active,created_at,updated_at,order_id,user_id,tracking_number,service_key,plan_tier,jurisdiction_state').order('updated_at',{ascending:false}),
    db.from('orders').select('id,user_id,tracking_number,first_name,last_name,email_address,company_name,selected_service,service_key,order_status,created_at'),
    db.from('filing_workflow_events').select('id,application_id,order_id,user_id,from_status,to_status,public_note,internal_note,changed_by_email,notify_customer,email_status,email_error,created_at').order('created_at',{ascending:false})
  ]);
  if(a.error)return fail(a.error.message);if(o.error)return fail(o.error.message);if(e.error)return fail(e.error.message);
  apps=a.data||[];orders=o.data||[];events=e.data||[];
  renderStats();filter();if(active){active=apps.find(x=>x.id===active.id)||null;if(active)renderDrawer();}
}
function fail(message){$('workflowTableBody').innerHTML=`<tr><td colspan="7"><div class="workflow-empty">${esc(message)}</div></td></tr>`;toast(message)}
function orderFor(app){return orders.find(o=>o.id===app.order_id)||null}
function customerName(order,app){return [order?.first_name,order?.last_name].filter(Boolean).join(' ')||order?.company_name||app.business_name||'Customer'}
function serviceName(order,app){return order?.selected_service||app.service_key||'Filing service'}
function latestEvent(appId){return events.find(e=>e.application_id===appId)||null}
function history(appId){return events.filter(e=>e.application_id===appId)}
function renderStats(){
  $('statActive').textContent=apps.filter(a=>!['Completed','Cancelled','Rejected'].includes(a.current_status)).length;
  $('statProcessing').textContent=apps.filter(a=>['Under Review','Processing'].includes(a.current_status)).length;
  $('statFiled').textContent=apps.filter(a=>a.current_status==='Filed').length;
  $('statCompleted').textContent=apps.filter(a=>a.current_status==='Completed').length;
}
function filter(){
  const q=$('workflowSearch').value.trim().toLowerCase(),status=$('workflowStatusFilter').value,sort=$('workflowSort').value;
  filtered=apps.filter(app=>{const o=orderFor(app);const hay=[app.business_name,app.tracking_number,app.service_key,app.jurisdiction_state,app.current_status,o?.first_name,o?.last_name,o?.email_address,o?.company_name,o?.selected_service,o?.tracking_number].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!status||app.current_status===status)});
  filtered.sort((a,b)=>{const ao=orderFor(a),bo=orderFor(b);if(sort==='oldest')return new Date(a.updated_at||a.created_at)-new Date(b.updated_at||b.created_at);if(sort==='customer')return customerName(ao,a).localeCompare(customerName(bo,b));if(sort==='status')return String(a.current_status).localeCompare(String(b.current_status));return new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)});
  render();
}
function render(){
  $('workflowResultCount').textContent=`${filtered.length} filing${filtered.length===1?'':'s'}`;
  $('workflowTableBody').innerHTML=filtered.length?filtered.map(app=>{const o=orderFor(app),last=latestEvent(app.id);return`<tr><td><b>${esc(app.business_name||o?.company_name||'Filing application')}</b><small>${esc(app.tracking_number||o?.tracking_number||'No tracking number')}</small></td><td><b>${esc(customerName(o,app))}</b><small>${esc(o?.email_address||'No email')}</small></td><td><b>${esc(serviceName(o,app))}</b><small>${esc(app.plan_tier||'')}</small></td><td>${esc(app.jurisdiction_state||'—')}</td><td><span class="workflow-status ${esc(statusClass(app.current_status))}">${esc(app.current_status||'Submitted')}</span></td><td>${esc(dt(last?.created_at||app.updated_at||app.created_at))}</td><td><button class="workflow-open" data-id="${esc(app.id)}" type="button">Manage</button></td></tr>`}).join(''):'<tr><td colspan="7"><div class="workflow-empty">No filing records match these filters.</div></td></tr>';
  document.querySelectorAll('.workflow-open[data-id]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.id));
}
function openDrawer(id){active=apps.find(a=>a.id===id);if(!active)return;renderDrawer();$('workflowDrawer').setAttribute('aria-hidden','false');document.body.classList.add('workflow-drawer-open');setTimeout(()=>$('workflowNewStatus').focus(),150)}
function renderDrawer(){
  const o=orderFor(active),h=history(active.id);
  $('workflowDrawerTitle').textContent=active.business_name||o?.company_name||'Filing';
  $('workflowDrawerMeta').textContent=[serviceName(o,active),active.jurisdiction_state,active.tracking_number||o?.tracking_number].filter(Boolean).join(' · ');
  $('workflowCurrentStatus').textContent=active.current_status||'Submitted';$('workflowCustomer').textContent=customerName(o,active);$('workflowService').textContent=serviceName(o,active);$('workflowTracking').textContent=active.tracking_number||o?.tracking_number||'—';
  $('workflowNewStatus').value=STATUSES.includes(active.current_status)?active.current_status:'Submitted';$('workflowPublicNote').value='';$('workflowInternalNote').value='';$('workflowNotify').checked=true;
  $('workflowHistory').innerHTML=h.length?h.map(e=>`<div class="workflow-event"><h4>${esc(e.from_status||'Created')} → ${esc(e.to_status)}${e.notify_customer?`<span class="workflow-email ${esc(e.email_status)}">Email ${esc(e.email_status)}</span>`:''}</h4>${e.public_note?`<p>${esc(e.public_note)}</p>`:''}${e.internal_note?`<p><strong>Internal:</strong> ${esc(e.internal_note)}</p>`:''}<small>${esc(dt(e.created_at))}${e.changed_by_email?' · '+esc(e.changed_by_email):''}${e.email_error?' · '+esc(e.email_error):''}</small></div>`).join(''):'<div class="workflow-empty">No status changes have been recorded yet.</div>';
}
async function save(event){
  event.preventDefault();if(!active)return;
  const btn=$('workflowSave'),old=btn.textContent;btn.disabled=true;btn.textContent='Updating…';
  try{
    const {data:{session:current}}=await db.auth.getSession();if(!current?.access_token)throw new Error('Your admin session expired. Please sign in again.');
    const {data,error}=await db.functions.invoke('filing-workflow-status',{body:{applicationId:active.id,status:$('workflowNewStatus').value,publicNote:$('workflowPublicNote').value,internalNote:$('workflowInternalNote').value,notifyCustomer:$('workflowNotify').checked},headers:{Authorization:'Bearer '+current.access_token}});
    if(error)throw error;if(data?.ok!==true)throw new Error(data?.error||'Workflow update failed.');
    toast(data.emailStatus==='sent'?'Status updated. Customer portal and email notification sent.':data.emailStatus==='failed'?'Status updated and portal notification created, but the email failed.':'Status updated successfully.');
    await load();
  }catch(err){toast(err?.message||'Could not update the filing workflow.');}
  finally{btn.disabled=false;btn.textContent=old;}
}
function closeDrawer(){$('workflowDrawer').setAttribute('aria-hidden','true');document.body.classList.remove('workflow-drawer-open');active=null}
function toast(message){clearTimeout(toastTimer);$('workflowToast').textContent=message;$('workflowToast').hidden=false;toastTimer=setTimeout(()=>$('workflowToast').hidden=true,4200)}
$('workflowSearch').addEventListener('input',filter);$('workflowStatusFilter').addEventListener('change',filter);$('workflowSort').addEventListener('change',filter);$('refreshWorkflow').onclick=load;$('workflowUpdateForm').addEventListener('submit',save);$('workflowClose').onclick=closeDrawer;$('workflowDrawerBackdrop').onclick=closeDrawer;$('workflowSearchTrigger').onclick=()=>{$('workflowSearch').focus();$('workflowSearch').select()};document.addEventListener('keydown',e=>{if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement?.tagName||'')){e.preventDefault();$('workflowSearch').focus()}if(e.key==='Escape'&&$('workflowDrawer').getAttribute('aria-hidden')==='false')closeDrawer()});
boot();
})();
