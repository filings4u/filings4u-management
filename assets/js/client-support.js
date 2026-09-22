const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';

let db,user,profile,tickets=[],orders=[],threadMessages=[],filtered=[];
let toastTimer;
const SUPPORT_BUCKET='support-attachments';
const SUPPORT_ALLOWED=new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
function safeSupportFileName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-180)}
async function uploadSupportFiles(fileList,ticketId){
  const files=[...(fileList||[])]; if(!files.length)return [];
  if(files.length>5)throw new Error('You can attach up to 5 files at a time.');
  const out=[];
  for(const file of files){
    if(file.size>50*1024*1024)throw new Error(`${file.name} is larger than 50 MB.`);
    if(file.type&&!SUPPORT_ALLOWED.has(file.type))throw new Error(`${file.name} is not an allowed support file type.`);
    const path=`${user.id}/${ticketId}/${crypto.randomUUID()}-${safeSupportFileName(file.name)}`;
    const {error}=await db.storage.from(SUPPORT_BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error)throw error;
    out.push({name:file.name,bucket:SUPPORT_BUCKET,path,mime_type:file.type||'',size:file.size});
  }
  return out;
}
function supportAttachmentsHtml(items){
  const list=Array.isArray(items)?items:[]; if(!list.length)return '';
  return `<div class="support-attachments">${list.map(a=>`<div class="support-attachment"><span>${esc(a.name||'Attachment')}</span><div><button type="button" data-support-view="${esc(a.path)}" data-support-bucket="${esc(a.bucket||SUPPORT_BUCKET)}">View</button><button type="button" data-support-download="${esc(a.path)}" data-support-bucket="${esc(a.bucket||SUPPORT_BUCKET)}" data-support-name="${esc(a.name||'download')}">Download</button></div></div>`).join('')}</div>`;
}
function wireSupportAttachmentButtons(root=document){
  root.querySelectorAll('[data-support-view]').forEach(btn=>btn.onclick=async()=>{
    const {data,error}=await db.storage.from(btn.dataset.supportBucket||SUPPORT_BUCKET).createSignedUrl(btn.dataset.supportView,300);
    if(error)return toast(error.message); window.open(data.signedUrl,'_blank','noopener');
  });
  root.querySelectorAll('[data-support-download]').forEach(btn=>btn.onclick=async()=>{
    const {data,error}=await db.storage.from(btn.dataset.supportBucket||SUPPORT_BUCKET).download(btn.dataset.supportDownload);
    if(error)return toast(error.message); const url=URL.createObjectURL(data),a=document.createElement('a');
    a.href=url;a.download=btn.dataset.supportName||'download';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}

async function boot(){
  const auth=await window.filings4uRequireClient();
  if(!auth)return;

  ({db,user,profile}=auth);
  hydrateProfile();

  const [ticketResult,orderResult,threadResult]=await Promise.all([
    db.from('support_tickets')
      .select('id,ticket_id,client_id,company_name,subject,description,priority,status,assigned_agent,created_at,updated_at,tracking_number,is_after_hours,attachments')
      .eq('client_id',user.id)
      .order('updated_at',{ascending:false}),

    db.from('orders')
      .select('id,tracking_number,selected_service,company_name,order_status')
      .eq('user_id',user.id)
      .order('created_at',{ascending:false}),

    db.from('admin_tickets')
      .select('id,ticket_id,client_email,admin_responder,reply_content,created_at,sender_type,attachments')
      .eq('client_email',String(user.email||'').toLowerCase())
      .order('created_at',{ascending:true})
  ]);

  if(ticketResult.error){
    $('gate').textContent='Unable to load your support requests.';
    $('gate').style.color='#991b1b';
    return toast(ticketResult.error.message);
  }

  if(orderResult.error){
    console.warn('Related orders could not be loaded.',orderResult.error.message);
    toast('Support loaded. Related-order selection is temporarily unavailable.');
  }

  tickets=ticketResult.data||[];
  orders=orderResult.data||[];
  threadMessages=threadResult?.data||[];

  $('gate').hidden=true;
  $('app').hidden=false;

  populateOrders();
  buildStatuses();
  stats();
  filter();
}

function hydrateProfile(){
  const name=[profile.first_name,profile.last_name].filter(Boolean).join(' ')||'My Account';
  const company=profile.company_name||'filings4u client';
  const initial=(profile.first_name||profile.company_name||profile.email_address||'C')[0].toUpperCase();

  $('clientName').textContent=name;
  $('clientAvatar').textContent=initial;
  if($('clientMenuName'))$('clientMenuName').textContent=name;
  if($('clientMenuCompany'))$('clientMenuCompany').textContent=company;
  if($('clientMenuAvatar'))$('clientMenuAvatar').textContent=initial;
}

function statusClass(value){
  return String(value||'')
    .trim().toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/_/g,'-')
    .replace(/[^a-z0-9-]/g,'');
}

function stats(){
  const status=t=>String(t.status||'').toLowerCase();

  $('totalCount').textContent=tickets.length;
  $('resolvedCount').textContent=tickets.filter(t=>['resolved','closed','completed'].includes(status(t))).length;
  $('pendingCount').textContent=tickets.filter(t=>['waiting on client','awaiting response','awaiting client'].includes(status(t))).length;
  $('openCount').textContent=tickets.filter(t=>!['resolved','closed','completed'].includes(status(t))).length;
}

function buildStatuses(){
  const vals=[...new Set(tickets.map(t=>t.status).filter(Boolean))].sort();
  $('statusFilter').innerHTML='<option value="">All statuses</option>'+
    vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}

function populateOrders(){
  $('orderSelect').innerHTML='<option value="">Not order-specific</option>'+
    orders.map(o=>`<option value="${esc(o.id)}">${esc(o.tracking_number||o.selected_service||o.company_name||o.id)}</option>`).join('');
}

function filter(){
  const q=$('search').value.trim().toLowerCase();
  const s=$('statusFilter').value;

  filtered=tickets.filter(t=>{
    const hay=[t.ticket_id,t.company_name,t.subject,t.description,t.status,t.priority,t.tracking_number].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!s||t.status===s);
  });

  render();
}

function render(){
  $('ticketList').innerHTML=filtered.length?filtered.map(t=>`
    <div class="ticket-row">
      <div class="ticket-title">
        <b>${esc(t.subject||'Support request')}</b>
        <small>${esc(t.ticket_id||'Ticket')} · ${dt(t.created_at)}</small>
      </div>
      <div><span class="status-pill-page ${esc(statusClass(t.status))}">${esc(t.status||'Open')}</span></div>
      <div><span class="priority ${esc(statusClass(t.priority))}">${esc(t.priority||'Normal')}</span></div>
      <div class="ticket-meta"><span>${esc(t.assigned_agent||'Support team')}</span><small>Assigned</small></div>
      <button class="open-ticket" type="button" data-id="${esc(t.id)}">View →</button>
    </div>`).join('')
    :'<div class="empty-state">No support requests match your current filters.</div>';

  document.querySelectorAll('.open-ticket[data-id]').forEach(button=>{
    button.onclick=()=>openTicket(button.dataset.id);
  });
}

function openTicket(id){
  const t=tickets.find(x=>String(x.id)===String(id));
  if(!t)return;

  const thread=threadMessages.filter(m=>String(m.ticket_id)===String(t.ticket_id));
  $('drawerTitle').textContent=t.ticket_id||'Support request';

  const history=[
    {sender_type:'client',reply_content:t.description,created_at:t.created_at,admin_responder:'You',attachments:t.attachments||[]},
    ...thread
  ];

  $('drawerBody').innerHTML=`
    <section class="ticket-detail-card">
      <div class="ticket-detail-grid">
        <div><span>Status</span><strong>${esc(t.status||'Open')}</strong></div>
        <div><span>Priority</span><strong>${esc(t.priority||'Normal')}</strong></div>
        <div><span>Assigned to</span><strong>${esc(t.assigned_agent||'Support team')}</strong></div>
        <div><span>Updated</span><strong>${dt(t.updated_at||t.created_at)}</strong></div>
      </div>
    </section>
    <section class="ticket-detail-card">
      <h3>${esc(t.subject||'Support request')}</h3>
      <div class="support-thread">
        ${history.map(m=>`
          <article class="support-thread-message ${m.sender_type==='client'?'from-client':'from-admin'}">
            <div class="support-thread-head">
              <strong>${m.sender_type==='client'?'You':'filings4u Support'}</strong>
              <small>${dt(m.created_at)}</small>
            </div>
            <p>${esc(m.reply_content||'')}</p>
            ${supportAttachmentsHtml(m.attachments)}
          </article>`).join('')}
      </div>
    </section>
    ${!['resolved','closed','completed'].includes(String(t.status||'').toLowerCase())?`
    <section class="ticket-detail-card">
      <h3>Reply to support</h3>
      <label class="ticket-reply-label">Message
        <textarea id="clientTicketReply" rows="5" maxlength="4000" placeholder="Write your reply..."></textarea>
      </label>
      <label class="ticket-reply-label">Attachments<input id="clientTicketReplyFiles" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.doc,.docx"><small>Optional · up to 5 files · 50 MB each.</small></label>
      <div class="ticket-reply-actions">
        <button id="sendClientTicketReply" class="button button--primary" type="button">Send reply</button>
      </div>
    </section>`:''}`;

  const send=$('sendClientTicketReply');
  if(send)send.onclick=()=>sendTicketReply(t);
  wireSupportAttachmentButtons($('drawerBody'));

  $('ticketDrawer').classList.add('is-open');
  $('ticketDrawer').setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
}

async function sendTicketReply(ticket){
  const input=$('clientTicketReply');
  const message=input?.value.trim()||'';
  const fileInput=$('clientTicketReplyFiles');
  if(!message&&!fileInput?.files?.length)return toast('Write a reply or attach a file before sending.');

  const button=$('sendClientTicketReply');
  if(button)button.disabled=true;

  let attachments=[];
  try{attachments=await uploadSupportFiles(fileInput?.files,ticket.ticket_id)}
  catch(error){if(button)button.disabled=false;window.filings4uNotify?.error(error.message,'Attachment upload failed');return toast(error.message)}

  const {error}=await db.from('admin_tickets').insert({
    ticket_id:ticket.ticket_id,
    client_email:String(user.email||profile.email_address||'').toLowerCase(),
    admin_responder:'Client',
    reply_content:message||(attachments.length?'[Attachment]':''),
    internal_notes:null,
    sender_type:'client',
    attachments
  });

  if(error){
    if(button)button.disabled=false;
    window.filings4uNotify?.error(error.message,'Support message failed');
    return toast(error.message);
  }

  await refreshSupportData();
  window.filings4uNotify?.success('Your reply was sent to filings4u Support.');
  toast('Your reply was sent.');
  openTicket(ticket.id);
}

async function refreshSupportData(){
  const [tr,mr]=await Promise.all([
    db.from('support_tickets')
      .select('id,ticket_id,client_id,company_name,subject,description,priority,status,assigned_agent,created_at,updated_at,tracking_number,is_after_hours,attachments')
      .eq('client_id',user.id)
      .order('updated_at',{ascending:false}),
    db.from('admin_tickets')
      .select('id,ticket_id,client_email,admin_responder,reply_content,created_at,sender_type,attachments')
      .eq('client_email',String(user.email||'').toLowerCase())
      .order('created_at',{ascending:true})
  ]);
  if(tr.error)return toast(tr.error.message);
  tickets=tr.data||[];
  threadMessages=mr.data||[];
  buildStatuses();
  stats();
  filter();
}

function closeDrawer(){
  $('ticketDrawer').setAttribute('aria-hidden','true');
  syncOverlayLock();
}

function openModal(){
  $('ticketModal').setAttribute('aria-hidden','false');
  syncOverlayLock();
  setTimeout(()=>$('subject').focus(),100);
}

function closeModal(){
  $('ticketModal').setAttribute('aria-hidden','true');
  syncOverlayLock();
}

function syncOverlayLock(){
  const anyOpen=
    $('ticketDrawer').getAttribute('aria-hidden')==='false' ||
    $('ticketModal').getAttribute('aria-hidden')==='false';

  document.body.classList.toggle('support-overlay-open',anyOpen);
}

async function submitTicket(event){
  event.preventDefault();
  const form=event.currentTarget;

  const btn=$('submitTicket');
  btn.disabled=true;
  const old=btn.textContent;
  btn.textContent='Submitting…';

  try{
    const order=orders.find(o=>String(o.id)===String($('orderSelect').value));
    const subject=$('subject').value.trim();
    const description=$('description').value.trim();

    if(!subject||!description)throw new Error('Please complete the subject and description.');

    const ticketId='F4U-'+crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();
    const attachments=await uploadSupportFiles($('ticketAttachments')?.files,ticketId);

    const payload={
      ticket_id:ticketId,
      client_id:user.id,
      company_name:profile.company_name||order?.company_name||'Not Specified',
      subject,
      description,
      priority:$('priority').value,
      status:'open',
      assigned_agent:'Unassigned',
      email_address:(profile.email_address||user.email||'').trim().toLowerCase()||null,
      first_name:profile.first_name||null,
      last_name:profile.last_name||null,
      tracking_number:order?.tracking_number||null,
      attachments
    };

    const {data,error}=await db.from('support_tickets')
      .insert(payload)
      .select('id,ticket_id,client_id,company_name,subject,description,priority,status,assigned_agent,created_at,updated_at,tracking_number,attachments')
      .single();

    if(error)throw error;

    tickets.unshift(data);
    form?.reset();
    closeModal();
    buildStatuses();
    stats();
    filter();
    window.filings4uNotify?.success('Your support request was submitted. A confirmation will be sent to you.');
    toast('Support request submitted.');
  }catch(error){
    window.filings4uNotify?.error(error.message||'Unable to submit support request.','Support request failed');
    toast(error.message||'Unable to submit support request.');
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
}

$('newTicketButton').onclick=openModal;
document.querySelectorAll('[data-close-modal]').forEach(x=>x.onclick=closeModal);
document.querySelectorAll('[data-close-drawer]').forEach(x=>x.onclick=closeDrawer);

$('ticketForm').addEventListener('submit',submitTicket);
$('search').addEventListener('input',filter);
$('statusFilter').addEventListener('change',filter);

document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    if($('ticketModal').getAttribute('aria-hidden')==='false')closeModal();
    else if($('ticketDrawer').getAttribute('aria-hidden')==='false')closeDrawer();
  }
});

function toast(message){
  clearTimeout(toastTimer);
  $('toast').textContent=message;
  $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,2800);
}

boot();
