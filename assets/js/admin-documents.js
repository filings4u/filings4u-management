const db=window.filings4uSupabase;
const BUCKET='customer-documents';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dt=v=>v?new Date(v).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—';
let clients=[],documents=[],toastTimer;

async function boot(){
  const auth=await window.filings4uRequireAdmin();
  if(!auth)return;
  $('gate').hidden=true;
  $('app').hidden=false;
  bind();
  await load();
}

function bind(){
  $('openUpload').addEventListener('click',openUpload);
  $('refresh').addEventListener('click',load);
  $('clear').addEventListener('click',()=>{$('q').value='';$('category').value='';$('customer').value='';render();});
  $('q').addEventListener('input',render);
  $('category').addEventListener('change',render);
  $('customer').addEventListener('change',render);
  $('uploadForm').addEventListener('submit',uploadDocument);
  $('documentFile').addEventListener('change',showSelectedFile);
  document.querySelectorAll('[data-close-upload]').forEach(x=>x.addEventListener('click',closeUpload));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('uploadModal').hidden)closeUpload();});
}

async function load(){
  setBusy($('refresh'),true,'Refreshing…');
  const [c,d]=await Promise.all([
    db.from('client_profiles').select('id,email_address,first_name,last_name,company_name').order('company_name',{ascending:true}),
    db.from('customer_documents').select('id,client_profile_id,title,category,description,original_file_name,bucket_id,storage_path,mime_type,file_size_bytes,is_visible,created_at,updated_at,client_profiles(email_address,first_name,last_name,company_name)').order('created_at',{ascending:false})
  ]);
  setBusy($('refresh'),false,'Refresh');
  if(c.error)return toast(c.error.message,'error');
  if(d.error)return toast(d.error.message,'error');
  clients=c.data||[];
  documents=d.data||[];
  populateCustomerSelectors();
  populateCategories();
  render();
}

function clientLabel(c){
  const person=[c?.first_name,c?.last_name].filter(Boolean).join(' ');
  return c?.company_name&&c.company_name!=='Not Specified'?`${c.company_name}${person?` — ${person}`:''}`:(person||c?.email_address||'Customer');
}

function populateCustomerSelectors(){
  const options=clients.map(c=>`<option value="${esc(c.id)}">${esc(clientLabel(c))} · ${esc(c.email_address||'')}</option>`).join('');
  const current=$('customer').value;
  $('customer').innerHTML='<option value="">All customers</option>'+options;
  if(clients.some(c=>c.id===current))$('customer').value=current;
  $('uploadCustomer').innerHTML='<option value="">Select customer…</option>'+options;
}

function populateCategories(){
  const current=$('category').value;
  const categories=[...new Set(documents.map(d=>d.category).filter(Boolean))].sort();
  $('category').innerHTML='<option value="">All categories</option>'+categories.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(categories.includes(current))$('category').value=current;
}

function filtered(){
  const q=$('q').value.trim().toLowerCase();
  const category=$('category').value;
  const clientId=$('customer').value;
  return documents.filter(d=>{
    const c=d.client_profiles||{};
    const hay=[d.title,d.original_file_name,d.category,d.description,c.company_name,c.first_name,c.last_name,c.email_address].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!category||d.category===category)&&(!clientId||d.client_profile_id===clientId);
  });
}

function render(){
  const list=filtered();
  const monthAgo=Date.now()-30*86400000;
  $('stats').innerHTML=[
    ['Delivered documents',documents.length,'All secure customer PDFs'],
    ['Customers with files',new Set(documents.map(d=>d.client_profile_id)).size,'Unique customer accounts'],
    ['Added last 30 days',documents.filter(d=>new Date(d.created_at).getTime()>=monthAgo).length,'Recent uploads'],
    ['Visible to customers',documents.filter(d=>d.is_visible).length,'Available in portal']
  ].map(([a,b,c])=>`<article class="stat"><span>${esc(a)}</span><strong>${b}</strong><small>${esc(c)}</small></article>`).join('');

  $('rows').innerHTML=list.length?list.map(d=>{
    const c=d.client_profiles||{};
    return `<tr>
      <td><div class="doc-cell"><span class="pdf-badge">PDF</span><div><b>${esc(d.title)}</b><small>${esc(d.original_file_name)}</small>${d.description?`<small>${esc(d.description)}</small>`:''}</div></div></td>
      <td><b>${esc(clientLabel(c))}</b><small>${esc(c.email_address||'')}</small></td>
      <td><span class="category-pill">${esc(d.category||'General')}</span></td>
      <td>${esc(formatSize(d.file_size_bytes))}</td>
      <td>${esc(dt(d.created_at))}</td>
      <td><button class="visibility-pill ${d.is_visible?'is-visible':'is-hidden'}" data-toggle="${esc(d.id)}" type="button">${d.is_visible?'Visible':'Hidden'}</button></td>
      <td><div class="row-actions"><button type="button" data-view="${esc(d.id)}">View</button><button type="button" data-download="${esc(d.id)}">Download</button><button class="danger" type="button" data-delete="${esc(d.id)}">Delete</button></div></td>
    </tr>`;
  }).join(''):'<tr><td colspan="7" class="empty">No customer documents match these filters.</td></tr>';

  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openFile(b.dataset.view,false,b));
  document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>openFile(b.dataset.download,true,b));
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggleVisibility(b.dataset.toggle,b));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteDocument(b.dataset.delete,b));
}

function openUpload(){
  $('uploadForm').reset();
  $('documentCategory').value='General';
  $('documentVisibility').value='true';
  $('selectedFile').hidden=true;
  $('uploadProgress').hidden=true;
  $('uploadModal').hidden=false;
  document.body.classList.add('modal-open');
  setTimeout(()=>$('uploadCustomer').focus(),20);
}
function closeUpload(){
  if($('uploadSubmit').disabled)return;
  $('uploadModal').hidden=true;
  document.body.classList.remove('modal-open');
}

function showSelectedFile(){
  const file=$('documentFile').files?.[0];
  if(!file){$('selectedFile').hidden=true;return;}
  $('selectedFile').textContent=`${file.name} · ${formatSize(file.size)}`;
  $('selectedFile').hidden=false;
  if(!$('documentTitle').value.trim())$('documentTitle').value=file.name.replace(/\.pdf$/i,'').replace(/[-_]+/g,' ');
}

async function uploadDocument(e){
  e.preventDefault();
  const clientId=$('uploadCustomer').value;
  const title=$('documentTitle').value.trim();
  const category=$('documentCategory').value;
  const description=$('documentDescription').value.trim()||null;
  const visible=$('documentVisibility').value==='true';
  const file=$('documentFile').files?.[0];

  if(!clientId||!title||!file)return toast('Select a customer, enter a title, and choose a PDF.','error');
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return toast('Customer documents must be uploaded as an actual PDF file.','error');
  if(file.size>50*1024*1024)return toast('The PDF exceeds the 50 MB maximum.','error');

  const safeBase=slug(title).slice(0,70)||'document';
  const storagePath=`${clientId}/${crypto.randomUUID()}-${safeBase}.pdf`;
  setBusy($('uploadSubmit'),true,'Uploading…');
  $('uploadProgress').hidden=false;

  try{
    const up=await db.storage.from(BUCKET).upload(storagePath,file,{contentType:'application/pdf',cacheControl:'3600',upsert:false});
    if(up.error)throw up.error;

    const ins=await db.from('customer_documents').insert({
      client_profile_id:clientId,title,category,description,
      original_file_name:file.name,bucket_id:BUCKET,storage_path:storagePath,
      mime_type:'application/pdf',file_size_bytes:file.size,is_visible:visible
    }).select('id').single();

    if(ins.error){
      await db.storage.from(BUCKET).remove([storagePath]);
      throw ins.error;
    }

    closeUploadForce();
    toast('Document uploaded to the customer portal.','success');
    await load();
  }catch(error){
    toast(error.message||'Unable to upload the document.','error');
  }finally{
    setBusy($('uploadSubmit'),false,'Upload to customer');
    $('uploadProgress').hidden=true;
  }
}

function closeUploadForce(){
  $('uploadModal').hidden=true;
  document.body.classList.remove('modal-open');
}

async function openFile(id,download,button){
  const d=documents.find(x=>x.id===id); if(!d)return;
  setBusy(button,true,download?'Preparing…':'Opening…');
  try{
    const options=download?{download:pdfFilename(d.title)}:undefined;
    const {data,error}=await db.storage.from(d.bucket_id||BUCKET).createSignedUrl(d.storage_path,120,options);
    if(error)throw error;
    if(!data?.signedUrl)throw new Error('Secure document link could not be created.');
    if(download){
      const a=document.createElement('a');a.href=data.signedUrl;a.download=pdfFilename(d.title);a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
    }else window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }catch(error){toast(error.message||'Unable to open document.','error');}
  finally{setBusy(button,false,download?'Download':'View');}
}

async function toggleVisibility(id,button){
  const d=documents.find(x=>x.id===id);if(!d)return;
  setBusy(button,true,'Saving…');
  const {error}=await db.from('customer_documents').update({is_visible:!d.is_visible,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){setBusy(button,false,d.is_visible?'Visible':'Hidden');return toast(error.message,'error');}
  d.is_visible=!d.is_visible;render();toast(d.is_visible?'Document is now visible to the customer.':'Document hidden from the customer.','success');
}

async function deleteDocument(id,button){
  const d=documents.find(x=>x.id===id);if(!d)return;
  if(!(await window.filings4uDialog.confirm(`Delete “${d.title}”? This removes the PDF from the customer portal and storage.`,{title:'Delete document',confirmText:'Delete document'})))return;
  setBusy(button,true,'Deleting…');
  try{
    const rm=await db.storage.from(d.bucket_id||BUCKET).remove([d.storage_path]);
    if(rm.error)throw rm.error;
    const del=await db.from('customer_documents').delete().eq('id',id);
    if(del.error)throw del.error;
    documents=documents.filter(x=>x.id!==id);populateCategories();render();toast('Document deleted.','success');
  }catch(error){toast(error.message||'Unable to delete document.','error');setBusy(button,false,'Delete');}
}

function slug(v){return String(v||'').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase();}
function pdfFilename(v){return `${String(v||'document').replace(/[\\/:*?"<>|]+/g,'-').trim()||'document'}.pdf`;}
function formatSize(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;}
function setBusy(button,busy,text){if(!button)return;button.disabled=busy;button.textContent=text;}
function toast(message,type='info'){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').className=`toast ${type}`;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}

boot();
