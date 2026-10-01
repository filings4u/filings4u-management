const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const dtm=v=>v?new Date(v).toLocaleString():'—';

let db,user,profile,applications=[],tracking=[],workflowEvents=[],legacy=[],filtered=[];
let toastTimer;

async function boot(){
  const auth=await window.filings4uRequireClient();
  if(!auth)return;

  ({db,user,profile}=auth);
  hydrateProfile();

  const email=(profile.email_address||user.email||'').trim().toLowerCase();

  const [appsResult,legacyResult]=await Promise.all([
    db.from('applications')
      .select('id,business_name,current_status,is_active,created_at,order_id,tracking_number,service_key,plan_tier,jurisdiction_state,updated_at')
      .eq('user_id',user.id)
      .order('updated_at',{ascending:false}),

    email
      ?db.from('user_filings')
        .select('id,company_name,plan_service_tier,is_completed,created_at,status,irs_submission_id,schedule_1_url')
        .eq('customer_email',email)
        .order('created_at',{ascending:false})
      :Promise.resolve({data:[],error:null})
  ]);

  if(appsResult.error){
    $('gate').textContent='Unable to load your filing activity.';
    $('gate').style.color='#991b1b';
    return toast(appsResult.error.message);
  }

  applications=appsResult.data||[];
  legacy=legacyResult.error?[]:(legacyResult.data||[]);

  if(legacyResult.error){
    console.warn('Legacy filing records could not be loaded.',legacyResult.error.message);
    toast('Current filings loaded. Some previous records are unavailable.');
  }

  const appIds=applications.map(a=>a.id);
  if(appIds.length){
    const [trackingResult,workflowResult]=await Promise.all([
      db.from('application_tracking')
        .select('id,application_id,step_order,title,is_completed,completed_at,created_at')
        .in('application_id',appIds)
        .order('step_order',{ascending:true}),
      db.from('filing_workflow_events')
        .select('id,application_id,from_status,to_status,public_note,created_at')
        .in('application_id',appIds)
        .order('created_at',{ascending:false})
    ]);

    if(trackingResult.error){
      console.warn('Application milestones could not be loaded.',trackingResult.error.message);
      tracking=[];
      toast('Filings loaded, but detailed milestone tracking is temporarily unavailable.');
    }else{
      tracking=trackingResult.data||[];
    }
    if(workflowResult.error){
      console.warn('Filing workflow history could not be loaded.',workflowResult.error.message);
      workflowEvents=[];
    }else{
      workflowEvents=workflowResult.data||[];
    }
  }

  $('gate').hidden=true;
  $('app').hidden=false;
  buildStatusFilter();
  renderStats();
  applyFilters();
  renderCompleted();
  renderLegacy();
  const requested=new URLSearchParams(location.search).get('filing');
  if(requested&&applications.some(a=>a.id===requested))openFiling(requested);
}

function hydrateProfile(){
  const name=[profile.first_name,profile.last_name].filter(Boolean).join(' ')||'My Account';
  const company=profile.company_name||'filings4u client';
  const initial=(profile.first_name||profile.company_name||profile.email_address||'C').charAt(0).toUpperCase();

  $('clientName').textContent=name;
  $('clientAvatar').textContent=initial;
  if($('clientMenuName'))$('clientMenuName').textContent=name;
  if($('clientMenuCompany'))$('clientMenuCompany').textContent=company;
  if($('clientMenuAvatar'))$('clientMenuAvatar').textContent=initial;
}

function eventsFor(appId){
  return workflowEvents.filter(e=>e.application_id===appId);
}

function stepsFor(appId){
  return tracking
    .filter(t=>t.application_id===appId)
    .sort((a,b)=>(a.step_order||0)-(b.step_order||0));
}

function progressFor(app){
  const steps=stepsFor(app.id);

  if(!steps.length){
    if((app.current_status||'').toLowerCase()==='completed')return 100;
    return app.is_active===false?100:15;
  }

  return Math.round((steps.filter(s=>s.is_completed).length/steps.length)*100);
}

function terminalStatus(app){
  const s=String(app?.current_status||'').trim().toLowerCase().replace(/_/g,' ');
  return ['completed','complete','finished','cancelled','canceled','rejected'].includes(s)||app?.is_active===false;
}

function completedStatus(app){
  const s=String(app?.current_status||'').trim().toLowerCase().replace(/_/g,' ');
  return ['completed','complete','finished'].includes(s);
}

function activeApplications(){
  return applications.filter(a=>!terminalStatus(a));
}

function completedApplications(){
  return applications.filter(completedStatus);
}

function renderStats(){
  const active=activeApplications();
  const completed=completedApplications();
  const attention=active.filter(a=>
    ['waiting','pending','error','failed','needs attention','needs_attention','on hold','on_hold']
      .includes((a.current_status||'').toLowerCase())
  );

  $('totalFilings').textContent=applications.length;
  $('activeFilings').textContent=active.length;
  $('completedFilings').textContent=completed.length;
  $('attentionFilings').textContent=attention.length;
}
function buildStatusFilter(){
  const statuses=[...new Set(activeApplications().map(a=>a.current_status).filter(Boolean))].sort();

  $('statusFilter').innerHTML='<option value="">All active statuses</option>'+
    statuses.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
}
function applyFilters(){
  const q=$('search').value.trim().toLowerCase();
  const status=$('statusFilter').value;

  filtered=activeApplications().filter(a=>{
    const hay=[a.business_name,a.service_key,a.tracking_number,a.plan_tier,a.jurisdiction_state,a.current_status].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!status||a.current_status===status);
  });

  renderFilings();
}
function statusClass(value){
  return String(value||'')
    .trim().toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/_/g,'-')
    .replace(/[^a-z0-9-]/g,'');
}

function renderFilings(){
  $('filingsList').innerHTML=filtered.length?filtered.map(app=>{
    const progress=progressFor(app);
    const steps=stepsFor(app.id);
    const complete=steps.filter(s=>s.is_completed).length;

    return `<article class="filing-card">
      <div class="filing-main">
        <h3>${esc(app.business_name||app.service_key||'Filing application')}</h3>
        <div class="filing-meta">
          <span>${esc(app.service_key||'Service')}</span>
          <span>${esc(app.plan_tier||'Plan not specified')}</span>
          <span>${esc(app.jurisdiction_state||'Jurisdiction not specified')}</span>
          <span>${esc(app.tracking_number||'No tracking number')}</span>
        </div>
        <div class="progress-block">
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="progress-label">
            <span>${steps.length?`${complete} of ${steps.length} steps complete`:'Status tracking'}</span>
            <strong>${progress}%</strong>
          </div>
        </div>
      </div>
      <div class="filing-status">
        <span class="status-pill-page ${esc(statusClass(app.current_status))}">${esc(app.current_status||'Pending')}</span>
        <button class="open-filing" type="button" data-id="${esc(app.id)}">View →</button>
      </div>
    </article>`;
  }).join(''):'<div class="empty-state">No filings match your current filters.</div>';

  document.querySelectorAll('.open-filing[data-id]').forEach(btn=>{
    btn.onclick=()=>openFiling(btn.dataset.id);
  });
}

function openFiling(id){
  const app=applications.find(a=>a.id===id);
  if(!app)return;

  const steps=stepsFor(id);

  $('drawerTitle').textContent=app.business_name||app.service_key||'Application';
  $('drawerBody').innerHTML=`
    <section class="detail-section">
      <h3>Application summary</h3>
      <div class="detail-grid">
        ${detail('Status',app.current_status)}
        ${detail('Tracking number',app.tracking_number)}
        ${detail('Service',app.service_key)}
        ${detail('Plan',app.plan_tier)}
        ${detail('Jurisdiction',app.jurisdiction_state)}
        ${detail('Active',app.is_active===false?'No':'Yes')}
        ${detail('Created',dtm(app.created_at))}
        ${detail('Last updated',dtm(app.updated_at))}
      </div>
    </section>

    <section class="detail-section">
      <h3>Processing timeline</h3>
      ${steps.length?`<div class="timeline">${steps.map(step=>`
        <div class="timeline-step ${step.is_completed?'done':''}">
          <span class="timeline-dot">${step.is_completed?'✓':esc(step.step_order||'•')}</span>
          <div>
            <b>${esc(step.title||'Processing step')}</b>
            <small>${step.is_completed?`Completed ${dtm(step.completed_at)}`:'Pending'}</small>
          </div>
        </div>`).join('')}</div>`:'<div class="empty-state">No detailed processing milestones have been added yet.</div>'}
    </section>
    <section class="detail-section">
      <h3>Status history</h3>
      ${eventsFor(id).length?`<div class="timeline">${eventsFor(id).map(event=>`
        <div class="timeline-step done">
          <span class="timeline-dot">✓</span>
          <div>
            <b>${esc(event.to_status||'Status update')}</b>
            ${event.public_note?`<small>${esc(event.public_note)}</small>`:''}
            <small>${dtm(event.created_at)}</small>
          </div>
        </div>`).join('')}</div>`:'<div class="empty-state">No workflow status history has been recorded yet.</div>'}
    </section>`;

  $('drawer').setAttribute('aria-hidden','false');
  document.body.classList.add('filing-drawer-open');
  $('closeDrawer').focus();
}

function detail(label,value){
  return `<div class="detail"><span>${esc(label)}</span><b>${esc(value===null||value===undefined||value===''?'—':value)}</b></div>`;
}

function safeHttpUrl(value){
  if(!value)return null;
  try{
    const url=new URL(String(value));
    return ['http:','https:'].includes(url.protocol)?url.href:null;
  }catch{
    return null;
  }
}

function renderCompleted(){
  const completed=completedApplications().sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at));
  const section=$('completedSection');
  if(!section)return;
  section.hidden=!completed.length;
  if(!completed.length){$('completedList').innerHTML='';return;}

  $('completedList').innerHTML=completed.map(app=>`
    <div class="legacy-row completed-row">
      <div>
        <b>${esc(app.business_name||app.service_key||'Completed filing')}</b>
        <small>${esc(app.service_key||'Service')} · ${esc(app.tracking_number||'No tracking number')}</small>
      </div>
      <div><span class="status-pill-page completed">Completed</span></div>
      <div><small>Finished ${dt(app.updated_at||app.created_at)}</small></div>
      <div class="completed-actions">
        <button class="open-filing" type="button" data-completed-id="${esc(app.id)}">View history →</button>
        ${entityProducingService(app.service_key)?'<a class="open-filing history-link" href="client-entities.html">Entity →</a>':''}
        <a class="open-filing history-link" href="client-documents.html">Documents →</a>
      </div>
    </div>`).join('');

  document.querySelectorAll('[data-completed-id]').forEach(btn=>btn.onclick=()=>openFiling(btn.dataset.completedId));
}

function entityProducingService(service){
  return ['llc-formation','series-llc','corporation','corporations','nonprofit-organization','nonprofits','sole-proprietorship','dba-registration','foreign-qualification','llc-reinstatement','dissolution','entity-dissolution']
    .includes(String(service||'').trim().toLowerCase());
}

function renderLegacy(){
  if(!legacy.length){
    $('legacySection').hidden=true;
    return;
  }

  $('legacySection').hidden=false;
  $('legacyList').innerHTML=legacy.map(f=>{
    const documentUrl=safeHttpUrl(f.schedule_1_url);
    return `<div class="legacy-row">
      <div>
        <b>${esc(f.company_name||'Previous filing')}</b>
        <small>${esc(f.plan_service_tier||'')} · ${dt(f.created_at)}</small>
      </div>
      <div><span class="status-pill-page ${esc(statusClass(f.status))}">${esc(f.status||'Pending')}</span></div>
      <div><small>${f.irs_submission_id?'IRS submission '+esc(f.irs_submission_id):'Legacy record'}</small></div>
      <div>${documentUrl?`<a class="open-filing" href="${esc(documentUrl)}" target="_blank" rel="noopener noreferrer">Document</a>`:''}</div>
    </div>`;
  }).join('');
}

function closeDrawer(){
  $('drawer').setAttribute('aria-hidden','true');
  document.body.classList.remove('filing-drawer-open');
}

function toast(message){
  clearTimeout(toastTimer);
  $('toast').textContent=message;
  $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,2600);
}

$('search').addEventListener('input',applyFilters);
$('statusFilter').addEventListener('change',applyFilters);
$('closeDrawer').onclick=closeDrawer;
$('drawerBackdrop').onclick=closeDrawer;

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('drawer').getAttribute('aria-hidden')==='false')closeDrawer();
});

boot();
