const $=id=>document.getElementById(id);
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const datetime=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';

let db,user,profile,invoices=[],clients=[],orders=[],currentInvoice=null,lines=[];
let editId=null;

async function boot(){
  const auth=await window.filings4uRequireAdmin(); if(!auth)return;
  ({db,user,profile}=auth);
  $('gate').hidden=true;$('app').hidden=false;
  await loadReferenceData();
  await loadInvoices();
  if(new URLSearchParams(location.search).get('new')==='1'){
    setTimeout(()=>openComposer(),0);
    history.replaceState({},'',location.pathname);
  }
}


function handleIncomingReference(){
  const params=new URLSearchParams(location.search);
  const invoiceId=params.get('invoice');
  const orderId=params.get('order');

  if(invoiceId){
    const invoice=invoices.find(i=>String(i.id)===String(invoiceId));
    if(invoice)openDrawer(invoice.id);
    else toast('The requested invoice could not be found.');
    return;
  }

  if(orderId){
    openComposerForOrder(orderId);
  }
}
function openComposerForOrder(orderId){
  const order=orders.find(o=>String(o.id)===String(orderId));
  if(!order)return toast('The requested order could not be found.');

  const client=clients.find(c=>
    String(c.id)===String(order.user_id||'') ||
    (c.email_address&&order.email_address&&c.email_address.toLowerCase()===order.email_address.toLowerCase())
  );
  if(!client)return toast('This order must be linked to a client before an invoice can be created.');

  resetComposer();
  $('clientId').value=client.id;
  syncClient();
  $('orderId').value=order.id;
  syncOrder();
  $('clientEmail').value=order.email_address||client.email_address||'';
  $('trackingNumber').value=order.tracking_number||'';

  lines=[];
  $('lineItems').innerHTML='';
  const serviceName=order.selected_service||order.service_key||'filings4u service';
  const serviceFee=Number(order.service_fee||0);
  const governmentFee=Number(order.government_fee||0);
  const addons=Number(order.addons_total||0);

  if(serviceFee>0)addLine({description:serviceName,quantity:1,unit_price:serviceFee});
  if(governmentFee>0)addLine({description:'Government / filing fee',quantity:1,unit_price:governmentFee});
  if(addons>0)addLine({description:'Selected add-ons / upsells',quantity:1,unit_price:addons});
  if(!lines.length)addLine({description:serviceName,quantity:1,unit_price:Number(order.total_amount||order.total_paid_amount||0)});

  if(order.payment_status==='paid'){
    if([...$('paymentStatus').options].some(o=>o.value==='paid'))$('paymentStatus').value='paid';
    if([...$('invoiceStatus').options].some(o=>o.value==='paid'))$('invoiceStatus').value='paid';
  }

  $('paymentTerms').value=order.payment_status==='paid'?'Paid with order':'Due within 15 days';
  $('customerNotes').value=`Created from order ${order.tracking_number||order.id}.`;
  $('composerTitle').textContent=`Create invoice · ${order.tracking_number||'Order'}`;
  showOverlay('invoiceComposer');
  calculate();
}

async function loadReferenceData(){
  const [c,o]=await Promise.all([
    db.from('client_profiles').select('id,first_name,last_name,email_address,company_name,phone_number,street_address,city,state,zip_code').order('company_name',{ascending:true}),
    db.from('orders').select('id,user_id,tracking_number,company_name,email_address,selected_service,service_key,plan_tier,total_amount,total_paid_amount,service_fee,government_fee,addons_total,order_status,payment_status').order('created_at',{ascending:false})
  ]);
  if(c.error)toast(c.error.message); else clients=c.data||[];
  if(o.error)toast(o.error.message); else orders=o.data||[];
  $('clientId').innerHTML='<option value="">Select a client</option>'+clients.map(c=>`<option value="${esc(c.id)}">${esc(c.company_name||[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email_address)} — ${esc(c.email_address||'')}</option>`).join('');
}

async function loadInvoices(){
  const {data,error}=await db.from('invoices').select('*,invoice_line_items(*)').order('created_at',{ascending:false});
  if(error){toast(error.message);return}
  invoices=data||[];buildFilters();stats();filterInvoices();
}
function clientFor(inv){return clients.find(c=>c.id===inv.client_profile_id)}
function stats(){
  const today=new Date().toISOString().slice(0,10);
  const outstanding=invoices.filter(i=>!['paid','void','cancelled'].includes(i.status)&&i.payment_status!=='paid').reduce((s,i)=>s+Math.max(0,Number(i.balance_due??(Number(i.total_amount||0)-Number(i.amount_paid||0)))),0);
  const overdue=invoices.filter(i=>i.due_date<today&&i.payment_status!=='paid'&&!['void','cancelled'].includes(i.status)).reduce((s,i)=>s+Math.max(0,Number(i.balance_due??(Number(i.total_amount||0)-Number(i.amount_paid||0)))),0);
  const paid=invoices.reduce((s,i)=>s+Math.max(0,Number(i.amount_paid||0)),0);
  $('statOutstanding').textContent=money(outstanding);$('statOverdue').textContent=money(overdue);$('statPaid').textContent=money(paid);$('statDraft').textContent=invoices.filter(i=>i.status==='draft').length;
}
function buildFilters(){
  const statuses=[...new Set(invoices.map(i=>i.status).filter(Boolean))].sort();
  const payments=[...new Set(invoices.map(i=>i.payment_status).filter(Boolean))].sort();
  $('statusFilter').innerHTML='<option value="">All invoice statuses</option>'+statuses.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  $('paymentFilter').innerHTML='<option value="">All payment statuses</option>'+payments.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
function filterInvoices(){
  const q=$('invoiceSearch').value.trim().toLowerCase(),s=$('statusFilter').value,p=$('paymentFilter').value;
  const filtered=invoices.filter(i=>{
    const c=clientFor(i);const hay=[i.invoice_number,i.client_email,i.tracking_number,c?.company_name,c?.first_name,c?.last_name].join(' ').toLowerCase();
    return (!q||hay.includes(q))&&(!s||i.status===s)&&(!p||i.payment_status===p);
  });
  $('invoiceRows').innerHTML=filtered.length?filtered.map(i=>{
    const c=clientFor(i);const cname=c?.company_name||[c?.first_name,c?.last_name].filter(Boolean).join(' ')||i.client_email;
    return `<tr><td><strong>${esc(i.invoice_number||'Draft')}</strong><div class="client-cell"><small>${esc(i.tracking_number||'')}</small></div></td><td class="client-cell">${esc(cname||'Client')}<small>${esc(i.client_email)}</small></td><td>${datetime(i.created_at)}</td><td>${date(i.due_date)}</td><td><span class="pill ${esc(i.status)}">${esc(i.status)}</span></td><td><span class="pill ${esc(i.payment_status)}">${esc(i.payment_status)}</span></td><td class="money">${money(i.total_amount)}</td><td><button class="row-action" data-open="${esc(i.id)}">Open →</button></td></tr>`;
  }).join(''):'<tr><td colspan="8" class="empty-state">No invoices match your filters.</td></tr>';
  $('invoiceCount').textContent=`${filtered.length} invoice${filtered.length===1?'':'s'}`;
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openDrawer(b.dataset.open));
}

function resetComposer(){
  editId=null;currentInvoice=null;lines=[];$('invoiceForm').reset();
  $('invoiceStatus').value='draft';$('paymentStatus').value='unpaid';$('discountType').value='amount';$('discountValue').value='0';$('taxRate').value='0';$('shipping').value='0';$('amountPaid').value='0';
  $('clientEmail').value='';$('trackingNumber').value='';$('orderId').innerHTML='<option value="">No related order</option>';
  const d=new Date();d.setDate(d.getDate()+15);$('dueDate').value=d.toISOString().slice(0,10);
  addLine({description:'',quantity:1,unit_price:0});$('composerTitle').textContent='Create invoice';calculate();
}
function openComposer(invoice=null){
  resetComposer();
  if(invoice){
    editId=invoice.id;currentInvoice=invoice;$('composerTitle').textContent=`Edit ${invoice.invoice_number||'invoice'}`;
    $('clientId').value=invoice.client_profile_id||'';syncClient();
    setTimeout(()=>{$('orderId').value=invoice.order_id||'';syncOrder()},0);
    $('clientEmail').value=invoice.client_email||'';$('trackingNumber').value=invoice.tracking_number||'';$('dueDate').value=invoice.due_date||'';
    $('invoiceStatus').value=invoice.status||'draft';$('paymentStatus').value=invoice.payment_status||'unpaid';$('discountType').value=invoice.discount_type||'amount';$('discountValue').value=invoice.discount_value??invoice.discount_amount??0;$('taxRate').value=invoice.tax_rate||0;$('shipping').value=invoice.shipping_amount||0;$('amountPaid').value=invoice.amount_paid||0;$('paymentTerms').value=invoice.payment_terms||'';$('paymentUrl').value=invoice.payment_url||'';$('customerNotes').value=invoice.customer_notes||'';
    lines=[];$('lineItems').innerHTML='';(invoice.invoice_line_items||[]).sort((a,b)=>a.line_number-b.line_number).forEach(addLine);if(!lines.length)addLine({description:invoice.line_item_description||'',quantity:1,unit_price:invoice.subtotal_amount||invoice.total_amount||0});
  }
  showOverlay('invoiceComposer');calculate();
}
function addLine(item={description:'',quantity:1,unit_price:0}){
  const id=crypto.randomUUID();lines.push({id,description:item.description||'',quantity:Number(item.quantity)||1,unit_price:Number(item.unit_price)||0});
  renderLines();
}
function renderLines(){
  $('lineItems').innerHTML=lines.map((l,idx)=>`<div class="line-item" data-line="${l.id}">
    <input class="line-desc" value="${esc(l.description)}" placeholder="Service or fee description">
    <input class="line-qty" type="number" min="0.01" step="0.01" value="${l.quantity}">
    <input class="line-price" type="number" step="0.01" value="${l.unit_price}" title="Use a negative amount to subtract a credit or adjustment">
    <div class="line-total">${money(l.quantity*l.unit_price)}</div>
    <button class="remove-line" type="button" title="Remove line">×</button>
  </div>`).join('');
  document.querySelectorAll('[data-line]').forEach(row=>{
    const l=lines.find(x=>x.id===row.dataset.line);
    row.querySelector('.line-desc').oninput=e=>{l.description=e.target.value};
    row.querySelector('.line-qty').oninput=e=>{l.quantity=Number(e.target.value)||0;calculate();renderLineTotal(row,l)};
    row.querySelector('.line-price').oninput=e=>{l.unit_price=Number(e.target.value)||0;calculate();renderLineTotal(row,l)};
    row.querySelector('.remove-line').onclick=()=>{if(lines.length===1)return toast('An invoice needs at least one line item.');lines=lines.filter(x=>x.id!==l.id);renderLines();calculate()};
  });
  calculate();
}
function renderLineTotal(row,l){row.querySelector('.line-total').textContent=money(l.quantity*l.unit_price)}
function totals(){
  const subtotal=lines.reduce((s,l)=>s+(Number(l.quantity)||0)*(Number(l.unit_price)||0),0);
  const discountType=$('discountType').value||'amount';
  let discountValue=Math.max(0,Number($('discountValue').value)||0);
  const discountBase=Math.max(0,subtotal);
  let discount=0;
  if(discountType==='percent'){
    discountValue=Math.min(discountValue,100);
    discount=discountBase*(discountValue/100);
  }else if(discountType==='amount'){
    discount=Math.min(discountValue,discountBase);
  }
  const taxable=Math.max(0,subtotal-discount);
  const rate=Math.max(0,Number($('taxRate').value)||0);
  const tax=taxable*(rate/100);
  const shipping=Math.max(0,Number($('shipping').value)||0);
  const total=Math.max(0,taxable+tax+shipping);
  const amountPaid=Math.min(Math.max(0,Number($('amountPaid').value)||0),total);
  const balance=Math.max(0,total-amountPaid);
  return{subtotal,discountType,discountValue,discount,tax,shipping,total,amountPaid,balance,rate};
}
function calculate(){
  const t=totals();
  $('calcSubtotal').textContent=money(t.subtotal);
  $('calcDiscount').textContent='− '+money(t.discount);
  $('calcTax').textContent=money(t.tax);
  $('calcShipping').textContent=money(t.shipping);
  $('calcTotal').textContent=money(t.total);
  $('calcPaid').textContent='− '+money(t.amountPaid);
  $('calcBalance').textContent=money(t.balance);
  if(t.total>0&&t.amountPaid>=t.total)$('paymentStatus').value='paid';
  else if(t.amountPaid>0)$('paymentStatus').value='partially_paid';
  else if(['paid','partially_paid'].includes($('paymentStatus').value))$('paymentStatus').value='unpaid';
}
function syncClient(){
  const c=clients.find(c=>c.id===$('clientId').value);$('clientEmail').value=c?.email_address||'';
  const clientOrders=orders.filter(o=>o.user_id===c?.id || (o.email_address&&c?.email_address&&o.email_address.toLowerCase()===c.email_address.toLowerCase()));
  $('orderId').innerHTML='<option value="">No related order</option>'+clientOrders.map(o=>`<option value="${esc(o.id)}">${esc(o.tracking_number||o.selected_service||o.id)} — ${esc(o.selected_service||'Service')}</option>`).join('');
  $('trackingNumber').value='';
}
function syncOrder(){const o=orders.find(o=>o.id===$('orderId').value);$('trackingNumber').value=o?.tracking_number||''}

async function saveInvoice(forceDraft=false){
  syncLinesFromDom();
  if(!$('clientId').value)return toast('Select a client.');
  if(!$('clientEmail').value)return toast('Client email is required.');
  if(!$('dueDate').value)return toast('Due date is required.');
  if(!lines.length||lines.some(l=>!l.description.trim()||l.quantity<=0||!Number.isFinite(Number(l.unit_price))))return toast('Complete every invoice line item.');
  const paymentUrl=$('paymentUrl').value.trim();
  if(paymentUrl){
    try{new URL(paymentUrl);}catch{return toast('Enter a valid payment URL.');}
  }
  const t=totals();const status=forceDraft?'draft':$('invoiceStatus').value;
  const payload={
    document_type:'invoice',client_email:$('clientEmail').value.trim().toLowerCase(),client_profile_id:$('clientId').value,
    order_id:$('orderId').value||null,tracking_number:$('trackingNumber').value||null,line_item_description:lines[0].description,
    due_date:$('dueDate').value,status,currency:'USD',subtotal_amount:t.subtotal,discount_amount:t.discount,discount_type:(t.discountType==='percent'?'percent':'amount'),discount_value:t.discountValue,tax_rate:t.rate,tax_amount:t.tax,
    shipping_amount:t.shipping,total_amount:t.total,amount_paid:t.amountPaid,balance_due:t.balance,payment_status:$('paymentStatus').value,payment_url:paymentUrl||null,
    customer_notes:$('customerNotes').value.trim()||null,payment_terms:$('paymentTerms').value.trim()||null,created_by:user.id,updated_at:new Date().toISOString()
  };
  const btn=forceDraft?$('saveDraft'):$('saveInvoice');const old=btn.textContent;btn.disabled=true;btn.textContent='Saving…';
  let invoiceId=editId,newRecord=false;
  try{
    if(editId){
      const {error}=await db.from('invoices').update(payload).eq('id',editId);if(error)throw error;
      const {error:delError}=await db.from('invoice_line_items').delete().eq('invoice_id',editId);if(delError)throw delError;
    }else{
      payload.token_hash=crypto.randomUUID()+crypto.randomUUID();
      const {data,error}=await db.from('invoices').insert(payload).select('id').single();if(error)throw error;
      invoiceId=data.id;newRecord=true;
    }
    const rows=lines.map((l,i)=>({invoice_id:invoiceId,line_number:i+1,description:l.description.trim(),quantity:l.quantity,unit_price:l.unit_price,line_total:l.quantity*l.unit_price}));
    const {error:lineError}=await db.from('invoice_line_items').insert(rows);if(lineError)throw lineError;
    closeAll();toast(forceDraft?'Draft saved.':'Invoice saved.');await loadInvoices();
  }catch(error){
    if(newRecord&&invoiceId) await db.from('invoices').delete().eq('id',invoiceId);
    toast(error.message||'Unable to save invoice.');
  }finally{btn.disabled=false;btn.textContent=old}
}
function syncLinesFromDom(){
  document.querySelectorAll('[data-line]').forEach(row=>{const l=lines.find(x=>x.id===row.dataset.line);if(l){l.description=row.querySelector('.line-desc').value;l.quantity=Number(row.querySelector('.line-qty').value)||0;l.unit_price=Number(row.querySelector('.line-price').value)||0}})
}

async function openDrawer(id){
  const inv=invoices.find(i=>i.id===id);if(!inv)return;currentInvoice=inv;
  const c=clientFor(inv);const name=c?.company_name||[c?.first_name,c?.last_name].filter(Boolean).join(' ')||inv.client_email;
  $('drawerInvoiceNumber').textContent=inv.invoice_number||'Invoice';
  const lines=(inv.invoice_line_items||[]).sort((a,b)=>a.line_number-b.line_number);
  $('drawerContent').innerHTML=`
    <div class="drawer-actions">
      <button data-action="edit">Edit invoice</button>
      <button data-action="print">Print / Save PDF</button>
      ${inv.status!=='paid'&&inv.status!=='void'?'<button class="send" data-action="send">Send to client portal</button>':''}
      ${inv.payment_status!=='paid'?'<button data-action="paid">Mark paid</button>':''}
      ${inv.status==='draft'?'<button class="danger" data-action="delete">Delete draft</button>':''}
      ${safePaymentLink(inv.payment_url)}
    </div>
    <article class="invoice-preview">
      <div class="invoice-preview-top"><div><img src="images/logo2.png" alt="filings4u"><small>A Subsidiary of Roseland Companies, LLC</small></div><div><h3>${esc(inv.invoice_number||'Invoice')}</h3><small>Due ${date(inv.due_date)}</small></div></div>
      <div class="invoice-client"><div><span>Bill to</span><strong>${esc(name)}</strong><small>${esc(inv.client_email)}</small></div><div><span>Invoice status</span><strong>${esc(inv.status)}</strong><small>${esc(inv.payment_status)}</small></div></div>
      <div class="preview-lines">${lines.map(l=>`<div class="preview-line"><span>${esc(l.description)}</span><span>${l.quantity}</span><span class="unit">${money(l.unit_price)}</span><strong>${money(l.line_total)}</strong></div>`).join('')}</div>
      <div class="preview-total"><div><span>Subtotal</span><strong>${money(inv.subtotal_amount)}</strong></div>${Number(inv.discount_amount)?`<div><span>Discount</span><strong>− ${money(inv.discount_amount)}</strong></div>`:''}${Number(inv.tax_amount)?`<div><span>Tax (${Number(inv.tax_rate)}%)</span><strong>${money(inv.tax_amount)}</strong></div>`:''}${Number(inv.shipping_amount)?`<div><span>Shipping</span><strong>${money(inv.shipping_amount)}</strong></div>`:''}<div><span>Invoice total</span><strong>${money(inv.total_amount)}</strong></div>${Number(inv.amount_paid||0)>0?`<div><span>Payment received / deposit</span><strong>− ${money(inv.amount_paid)}</strong></div>`:''}<div class="grand"><span>Balance due</span><strong>${money(inv.balance_due??Math.max(0,Number(inv.total_amount||0)-Number(inv.amount_paid||0)))}</strong></div></div>
    </article>
    <div class="detail-card">
      <div class="detail-row"><div><span>Tracking number</span><strong>${esc(inv.tracking_number||'—')}</strong></div><div><span>Created</span><strong>${datetime(inv.created_at)}</strong></div></div>
      <div class="detail-row"><div><span>Payment terms</span><strong>${esc(inv.payment_terms||'—')}</strong></div><div><span>Sent</span><strong>${inv.sent_at?datetime(inv.sent_at):'Not sent'}</strong></div></div>
      ${inv.customer_notes?`<div class="detail-row"><div><span>Customer notes</span><strong>${esc(inv.customer_notes)}</strong></div><div><span>Paid</span><strong>${inv.paid_at?datetime(inv.paid_at):'—'}</strong></div></div>`:''}
    </div>`;
  $('drawerContent').querySelector('[data-action="edit"]')?.addEventListener('click',()=>{closeAll();openComposer(inv)});
  $('drawerContent').querySelector('[data-action="print"]')?.addEventListener('click',()=>printInvoice(inv));
  $('drawerContent').querySelector('[data-action="send"]')?.addEventListener('click',()=>sendInvoice(inv));
  $('drawerContent').querySelector('[data-action="paid"]')?.addEventListener('click',()=>markPaid(inv));
  $('drawerContent').querySelector('[data-action="delete"]')?.addEventListener('click',()=>deleteDraft(inv));
  showOverlay('invoiceDrawer');
}

function safePaymentLink(url){
  if(!url)return '';
  try{
    const parsed=new URL(url,location.href);
    return `<a href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">Open payment link</a>`;
  }catch{
    return '';
  }
}

async function sendInvoice(inv){
  if(!inv.client_profile_id)return toast('This invoice is not linked to a client profile.');
  const lines=(inv.invoice_line_items||[]).sort((a,b)=>a.line_number-b.line_number).map(l=>({description:l.description,quantity:Number(l.quantity),unit_price:Number(l.unit_price),line_total:Number(l.line_total)}));
  const mirror={invoice_code:inv.invoice_number,client_id:inv.client_profile_id,email_address:String(inv.client_email||'').trim().toLowerCase(),subtotal:inv.subtotal_amount,tax_percentage:inv.tax_rate,grand_total:inv.total_amount,payment_status:inv.payment_status==='paid'?'Paid':inv.payment_status==='partially_paid'?'Partial':'Unpaid',due_date:inv.due_date,itemized_lines:lines};
  try{
    const {data:existing,error:lookupError}=await db.from('client_invoices').select('invoice_id').eq('invoice_code',inv.invoice_number).eq('client_id',inv.client_profile_id).maybeSingle();
    if(lookupError)throw lookupError;
    if(existing){const {error}=await db.from('client_invoices').update(mirror).eq('invoice_id',existing.invoice_id);if(error)throw error;}
    else {const {error}=await db.from('client_invoices').insert(mirror);if(error)throw error;}
    const {error:updateError}=await db.from('invoices').update({status:'sent',sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',inv.id);if(updateError)throw updateError;
    toast('Invoice delivered to the client billing flow.');closeAll();await loadInvoices();
  }catch(e){toast(e.message||'Unable to send invoice.')}
}
async function markPaid(inv){
  try{const now=new Date().toISOString();const total=Number(inv.total_amount||0);const {error}=await db.from('invoices').update({status:'paid',payment_status:'paid',amount_paid:total,balance_due:0,paid_at:now,updated_at:now}).eq('id',inv.id);if(error)throw error;
    await db.from('client_invoices').update({payment_status:'Paid'}).eq('invoice_code',inv.invoice_number).eq('client_id',inv.client_profile_id);
    toast('Invoice marked paid.');closeAll();await loadInvoices();
  }catch(e){toast(e.message||'Unable to update payment status.')}
}
async function deleteDraft(inv){
  if(!(await window.filings4uDialog.confirm(`Delete draft ${inv.invoice_number||'invoice'}?`,{title:'Delete invoice draft',confirmText:'Delete draft'})))return;
  const {error}=await db.from('invoices').delete().eq('id',inv.id).eq('status','draft');if(error)return toast(error.message);
  toast('Draft deleted.');closeAll();await loadInvoices();
}
function printInvoice(inv){
  const c=clientFor(inv);
  const name=c?.company_name||[c?.first_name,c?.last_name].filter(Boolean).join(' ')||inv.client_email;
  const ls=(inv.invoice_line_items||[]).sort((a,b)=>a.line_number-b.line_number);

  // Do not use noopener/noreferrer here. Some browsers return null from window.open
  // when those features are passed, which made the Print / Save PDF button appear dead.
  const w=window.open('about:blank','_blank');
  if(!w)return toast('Your browser blocked the invoice window. Allow popups for this site and try again.');

  const logoUrl=new URL('images/logo.png',window.location.href).href;
  const invoiceHtml=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoice_number||'Invoice')}</title><style>
  body{font-family:Arial,sans-serif;color:#13213a;margin:0;padding:42px;background:#fff}
  .top{display:flex;justify-content:space-between;border-bottom:4px solid #10b981;padding-bottom:20px}
  .logo{width:130px;max-height:70px;object-fit:contain}
  .navy{color:#0a1f44}.meta{text-align:right}
  .bill{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:30px 0}
  small{color:#64748b}table{width:100%;border-collapse:collapse}
  th{text-align:left;background:#0a1f44;color:#fff;padding:10px}
  td{padding:11px 10px;border-bottom:1px solid #e5eaf0}.num{text-align:right}
  .totals{width:340px;margin:24px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:7px 0}
  .grand{border-top:2px solid #0a1f44;font-size:20px;font-weight:bold}
  .notes{margin-top:35px;padding:18px;background:#f8fafc}
  .foot{margin-top:40px;border-top:1px solid #e5eaf0;padding-top:15px;color:#64748b;font-size:12px}
  @media print{body{padding:20px}.no-print{display:none!important}}
  </style></head><body>
  <div class="top"><div><img class="logo" src="${logoUrl}" alt="filings4u"><div><strong>filings4u, LLC</strong><br><small>A Subsidiary of Roseland Companies, LLC</small></div></div><div class="meta"><h1 class="navy">INVOICE</h1><strong>${esc(inv.invoice_number||'')}</strong><br><small>Issued ${datetime(inv.created_at)} · Due ${date(inv.due_date)}</small></div></div>
  <div class="bill"><div><small>BILL TO</small><h3>${esc(name)}</h3><div>${esc(inv.client_email)}</div>${c?.street_address?`<div>${esc(c.street_address)}<br>${esc([c.city,c.state,c.zip_code].filter(Boolean).join(', '))}</div>`:''}</div><div><small>REFERENCE</small><h3>${esc(inv.tracking_number||'filings4u services')}</h3><div>${esc(inv.payment_terms||'Due by stated due date')}</div></div></div>
  <table><thead><tr><th>Description</th><th>Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${ls.map(l=>`<tr><td>${esc(l.description)}</td><td>${l.quantity}</td><td class="num">${money(l.unit_price)}</td><td class="num">${money(l.line_total)}</td></tr>`).join('')}</tbody></table>
  <div class="totals"><div><span>Subtotal</span><strong>${money(inv.subtotal_amount)}</strong></div><div><span>Discount</span><strong>− ${money(inv.discount_amount)}</strong></div><div><span>Tax</span><strong>${money(inv.tax_amount)}</strong></div><div><span>Shipping</span><strong>${money(inv.shipping_amount)}</strong></div><div><span>Invoice total</span><strong>${money(inv.total_amount)}</strong></div><div><span>Payment received / deposit</span><strong>− ${money(inv.amount_paid||0)}</strong></div><div class="grand"><span>Balance due</span><strong>${money(inv.balance_due??Math.max(0,Number(inv.total_amount||0)-Number(inv.amount_paid||0)))}</strong></div></div>
  ${inv.customer_notes?`<div class="notes"><strong>Notes</strong><p>${esc(inv.customer_notes)}</p></div>`:''}${inv.payment_url?`<div class="notes"><strong>Payment link</strong><p>${esc(inv.payment_url)}</p></div>`:''}
  <div class="foot">Thank you for choosing filings4u. This invoice was generated from the secure filings4u Administration system.</div>
  </body></html>`;

  w.document.open();
  w.document.write(invoiceHtml);
  w.document.close();

  const triggerPrint=()=>{
    try{
      w.focus();
      w.print();
    }catch(e){
      console.error('Invoice print failed:',e);
      toast('The invoice opened, but the print dialog could not start automatically. Use Ctrl+P or Cmd+P in the invoice window.');
    }
  };

  if(w.document.readyState==='complete'){
    setTimeout(triggerPrint,350);
  }else{
    w.addEventListener('load',()=>setTimeout(triggerPrint,350),{once:true});
    setTimeout(()=>{
      if(!w.closed)triggerPrint();
    },1200);
  }
}
function showOverlay(id){
  const target=$(id);
  if(!target)return;
  $('invoiceShade').hidden=false;
  target.setAttribute('aria-hidden','false');
  document.body.classList.add('invoice-overlay-open');
  const closer=id==='invoiceDrawer'?'closeDrawer':'closeComposer';
  $(closer)?.focus();
}
function closeAll(){
  $('invoiceShade').hidden=true;
  $('invoiceDrawer').setAttribute('aria-hidden','true');
  $('invoiceComposer').setAttribute('aria-hidden','true');
  document.body.classList.remove('invoice-overlay-open');
}
function toast(m){$('toast').textContent=m;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3000)}

$('newInvoice').onclick=()=>openComposer();$('closeComposer').onclick=closeAll;$('closeDrawer').onclick=closeAll;$('invoiceShade').onclick=closeAll;
$('addLine').onclick=()=>addLine();$('clientId').onchange=syncClient;$('orderId').onchange=syncOrder;
['discountValue','taxRate','shipping','amountPaid'].forEach(id=>$(id).addEventListener('input',calculate));$('discountType').addEventListener('change',calculate);
$('invoiceForm').onsubmit=e=>{e.preventDefault();saveInvoice(false)};$('saveDraft').onclick=()=>saveInvoice(true);
$('invoiceSearch').oninput=filterInvoices;$('statusFilter').onchange=filterInvoices;$('paymentFilter').onchange=filterInvoices;
$('clearFilters').onclick=()=>{$('invoiceSearch').value='';$('statusFilter').value='';$('paymentFilter').value='';filterInvoices()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
boot();