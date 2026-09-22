const db=window.filings4uSupabase;
let tickets=[],replies=[],after=[],tab='active',active=null;
let currentAdminUser=null;

const $=x=>document.getElementById(x);
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const dt=x=>x?new Date(x).toLocaleString():'—';
const badge=x=>`<span class="badge ${esc(String(x||'').replace(/\s+/g,'-'))}">${esc(x)}</span>`;

async function boot(){
  const auth=await window.filings4uRequireAdmin();
  if(!auth)return;

  currentAdminUser=auth.user;
  $('gate').hidden=true;
  $('app').hidden=false;
  await load();
}

function deny(x){
  $('gate').textContent=x;
  $('gate').style.color='#991b1b';
}

async function load(){
  const rs=await Promise.all([
    db.from('support_tickets').select('*').order('updated_at',{ascending:false}),
    db.from('admin_tickets').select('*').order('created_at',{ascending:false}),
    db.from('after_hours_tickets').select('*').order('created_at',{ascending:false})
  ]);

  const failed=rs.find(x=>x.error);
  if(failed)return deny(failed.error.message);

  [tickets,replies,after]=rs.map(x=>x.data||[]);
  buildFilters();
  render();

  if(active){
    const fresh=tickets.find(x=>String(x.id)===String(active.id));
    if(fresh)openTicket(fresh.id);
    else close();
  }
}

function buildFilters(){
  const list=tab==='active'?tickets.filter(t=>!t.is_after_hours):tickets.filter(t=>t.is_after_hours);
  const statuses=[...new Set(list.map(x=>x.status).filter(Boolean))].sort();
  const priorities=[...new Set(tickets.map(x=>x.priority).filter(Boolean))].sort();

  $('status').innerHTML='<option value="">All statuses</option>'+
    statuses.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('priority').innerHTML='<option value="">All priorities</option>'+
    priorities.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('priority').disabled=tab!=='active';
}

function filtered(){
  const q=$('q').value.trim().toLowerCase();
  const s=$('status').value;
  const p=$('priority').value;
  const list=tab==='active'?tickets.filter(t=>!t.is_after_hours):tickets.filter(t=>t.is_after_hours);

  return list.filter(t=>{
    const hay=[
      t.ticket_id,t.first_name,t.last_name,t.email_address,t.company_name,
      t.tracking_number,t.subject,t.ticket_message,t.description
    ].join(' ').toLowerCase();

    return hay.includes(q)&&
      (!s||t.status===s)&&
      (tab!=='active'||!p||t.priority===p);
  });
}

function render(){
  const closed=new Set(['Closed','Resolved']);
  const open=tickets.filter(t=>!closed.has(t.status)).length;
  const urgent=tickets.filter(t=>['High','Urgent'].includes(t.priority)&&!closed.has(t.status)).length;
  const unassigned=tickets.filter(t=>(!t.assigned_agent||String(t.assigned_agent).toLowerCase()==='unassigned')&&!closed.has(t.status)).length;

  $('stats').innerHTML=[
    ['Support tickets',tickets.length],
    ['Open queue',open],
    ['High / urgent',urgent],
    ['Unassigned',unassigned]
  ].map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');

  const list=filtered();

  $('rows').innerHTML=list.length?list.map(t=>{
    if(tab==='active'){
      return `<tr>
        <td><b>${esc(t.ticket_id)}</b><small>${esc(t.tracking_number)}</small></td>
        <td><b>${esc([t.first_name,t.last_name].filter(Boolean).join(' '))}</b><small>${esc(t.email_address)}</small><small>${esc(t.company_name)}</small></td>
        <td>${esc(t.subject)}</td>
        <td>${badge(t.priority)}</td>
        <td>${badge(t.status)}</td>
        <td>${esc(t.assigned_agent)}</td>
        <td>${dt(t.updated_at||t.created_at)}</td>
        <td><button class="openTicket" data-id="${esc(t.id)}">Open</button></td>
      </tr>`;
    }

    return `<tr>
      <td><b>${esc(t.ticket_id)}</b><small>${esc(t.tracking_number)}</small></td>
      <td><b>${esc([t.first_name,t.last_name].filter(Boolean).join(' '))}</b><small>${esc(t.email_address)}</small></td>
      <td>${esc(t.subject||String(t.description||'').slice(0,70))}</td>
      <td>${badge(t.priority)}</td>
      <td>${badge(t.status)}</td>
      <td>${esc(t.assigned_agent||'Unassigned')}</td>
      <td>${dt(t.updated_at||t.created_at)}</td>
      <td><button class="openTicket" data-id="${esc(t.id)}">Open</button></td>
    </tr>`;
  }).join('')
  :'<tr><td colspan="8" class="empty">No tickets match these filters.</td></tr>';

  document.querySelectorAll('.openTicket').forEach(b=>{
    b.onclick=()=>openTicket(b.dataset.id);
  });
}

function box(t,a){
  return `<section class="box"><h3>${esc(t)}</h3><div class="grid">${
    a.map(x=>`<div class="item"><b>${esc(x[0])}</b>${esc(x[1])}</div>`).join('')
  }</div></section>`;
}

function openTicket(id){
  active=tickets.find(x=>String(x.id)===String(id));
  if(!active)return toast('Support ticket could not be found.');

  const t=active;
  const rs=replies.filter(r=>r.ticket_id===t.ticket_id);

  $('drawerTitle').textContent=t.ticket_id||'Support case';

  $('detail').innerHTML=`
    <section class="box">
      <h3>Case controls</h3>
      <div class="editor">
        <select id="editStatus">
          ${['Open','In Progress','Waiting on Client','Resolved','Closed'].map(x=>`<option value="${x}" ${x===t.status?'selected':''}>${x}</option>`).join('')}
        </select>
        <select id="editPriority">
          ${['Low','Medium','High','Urgent'].map(x=>`<option value="${x}" ${x===t.priority?'selected':''}>${x}</option>`).join('')}
        </select>
        <input id="editAgent" value="${esc(t.assigned_agent||'')}" placeholder="Assigned agent">
        <button id="saveCase" class="primary" type="button">Save</button>
      </div>
    </section>

    ${box('Client & order',[
      ['Client',[t.first_name,t.last_name].filter(Boolean).join(' ')],
      ['Email',t.email_address],
      ['Phone',t.phone_number],
      ['Company',t.company_name],
      ['Tracking',t.tracking_number],
      ['Stripe customer',t.stripe_customer_id]
    ])}

    <section class="box">
      <h3>${esc(t.subject||'Support request')}</h3>
      <div class="message">${esc(t.description||t.ticket_message||'')}</div>
    </section>

    <section class="box">
      <h3>Response history</h3>
      <div class="history">
        ${rs.length?rs.map(r=>`<div class="response">
          <div class="response-head"><b>${esc(r.sender_type==='client'?'Client':(r.admin_responder||'filings4u Support'))}</b><small>${dt(r.created_at)}</small></div>
          ${r.reply_content?`<div>${esc(r.reply_content)}</div>`:''}
          ${r.internal_notes?`<div class="internal-note"><b>Internal note</b>${esc(r.internal_notes)}</div>`:''}
        </div>`).join(''):'<div class="empty">No responses yet.</div>'}
      </div>
    </section>

    <section class="box">
      <h3>Add response</h3>
      <div class="reply">
        <label>Response to client<textarea id="replyText" placeholder="Write a response to the client"></textarea></label>
        <label>Internal note<textarea id="noteText" placeholder="Internal note (optional)"></textarea></label>
        <div class="reply-actions">
          <small>Enter sends · Shift+Enter adds a new line</small>
          <button id="sendReply" class="primary" type="button">Save response</button>
        </div>
      </div>
    </section>`;

  $('saveCase').onclick=saveCase;
  $('sendReply').onclick=saveReply;

  $('replyText').addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      saveReply();
    }
  });

  $('shade').hidden=false;
  $('drawer').classList.add('open');
  $('drawer').setAttribute('aria-hidden','false');
  document.body.classList.add('drawer-open');
  $('close').focus();
}

async function saveCase(){
  if(!active)return;

  const patch={
    status:$('editStatus').value,
    priority:$('editPriority').value,
    assigned_agent:$('editAgent').value.trim()||'Unassigned',
    updated_at:new Date().toISOString()
  };

  const {data,error}=await db.from('support_tickets')
    .update(patch)
    .eq('id',active.id)
    .select()
    .single();

  if(error){window.filings4uNotify?.error(error.message,'Support update failed');return toast(error.message);}

  const i=tickets.findIndex(x=>x.id===data.id);
  if(i>=0)tickets[i]=data;
  active=data;

  render();
  openTicket(data.id);
  window.filings4uNotify?.success('Support case updated.');
  toast('Support case updated.');
}

async function saveReply(){
  if(!active)return;

  const reply_content=$('replyText').value.trim();
  const internal_notes=$('noteText').value.trim();

  if(!reply_content&&!internal_notes){
    return toast('Enter a response or internal note.');
  }

  if(!currentAdminUser){
    return toast('Administrator session is unavailable. Please sign in again.');
  }

  $('sendReply').disabled=true;

  const {data,error}=await db.from('admin_tickets')
    .insert({
      ticket_id:active.ticket_id,
      client_email:active.email_address,
      admin_responder:currentAdminUser.email,
      reply_content:reply_content||'',
      internal_notes:internal_notes||null,
      sender_type:'admin'
    })
    .select()
    .single();

  $('sendReply').disabled=false;

  if(error)return toast(error.message);

  replies.unshift(data);
  openTicket(active.id);
  window.filings4uNotify?.success(reply_content?'Reply sent to the client.':'Internal note saved.');
  toast(reply_content?'Reply sent to client.':'Internal note saved.');
}

function close(){
  $('drawer').classList.remove('open');
  $('drawer').setAttribute('aria-hidden','true');
  $('shade').hidden=true;
  document.body.classList.remove('drawer-open');
}

function toast(x){
  $('toast').textContent=x;
  $('toast').hidden=false;
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>$('toast').hidden=true,2600);
}

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  tab=b.dataset.tab;
  $('status').value='';
  $('priority').value='';
  buildFilters();
  render();
});

['q','status','priority'].forEach(x=>{
  $(x).addEventListener(x==='q'?'input':'change',render);
});

$('clear').onclick=()=>{
  $('q').value='';
  $('status').value='';
  $('priority').value='';
  render();
};

$('refresh').onclick=load;
$('close').onclick=close;
$('shade').onclick=close;

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('drawer').classList.contains('open'))close();
});

document.getElementById('signOut')?.addEventListener('click',window.filings4uSignOut);

boot();
