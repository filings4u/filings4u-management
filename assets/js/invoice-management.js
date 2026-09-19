(async function(){
"use strict";
const $=id=>document.getElementById(id);
const qsa=s=>Array.from(document.querySelectorAll(s));
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v)||0);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate=v=>v?new Date(v+(String(v).length===10?"T12:00:00":"")).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—";
const fmtDateTime=v=>v?new Date(v).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—";

let db,user,profile;
let clients=[],contacts=[],orders=[],people=[],lines=[],payments=[];
let invoiceId=null,currentInvoice=null,dirty=false;

function toast(msg){
  $("toast").textContent=msg;$("toast").hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").hidden=true,3200);
}
function getDb(){return window.filings4uSupabase||window.supabaseClient||window.filings4uDb}
async function invokeEdge(name,body){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error("Administrator session expired.");
  const {data,error}=await db.functions.invoke(name,{body,headers:{Authorization:`Bearer ${session.access_token}`}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}
function setDirty(v=true){dirty=v;$("modeSubtext").textContent=v?(invoiceId?"Unsaved changes":"Unsaved invoice"):(invoiceId?"All changes saved":"Ready")}
function currentClient(){return people.find(c=>c._key===$("clientId").value)||null}
function currentOrder(){return orders.find(o=>String(o.id)===String($("orderId").value))}
function clientName(c){return c?.company_name&&c.company_name!=="Not Specified"?c.company_name:[c?.first_name,c?.last_name].filter(Boolean).join(" ")||c?.email_address||"Customer"}
function address(c){return [c?.street_address,[c?.city,c?.state,c?.zip_code].filter(Boolean).join(", ")].filter(Boolean).join(" · ")||"—"}

async function boot(){
  try{
    const auth=await window.filings4uRequireAdmin?.();
    if(window.filings4uRequireAdmin&&!auth)return;
    if(auth){({db,user,profile}=auth)}
  }catch(e){return}
  db=db||getDb();
  if(!db)return toast("Supabase client is unavailable.");

  $("managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));
  $("managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));
  $("managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));

  bind();
  await loadReferenceData();
  const p=new URLSearchParams(location.search);
  if(p.get("invoice")) await loadInvoice(p.get("invoice"));
  else{
    resetNew();
    if(p.get("order")) prefillOrder(p.get("order"));
    else prefillPersonFromParams(p);
  }
}

async function loadReferenceData(){
  const [c,r,o]=await Promise.all([
    db.from("client_profiles").select("id,first_name,last_name,email_address,company_name,phone_number,street_address,city,state,zip_code,stripe_customer_id").order("company_name",{ascending:true}),
    db.from("crm_contacts").select("id,contact_type,lifecycle_stage,status,client_profile_id,first_name,last_name,email_address,company_name,phone_number,street_address,city,state,zip_code").eq("status","active").order("company_name",{ascending:true}),
    db.from("orders").select("id,user_id,tracking_number,first_name,last_name,phone_number,company_name,email_address,selected_service,service_key,plan_tier,total_amount,total_paid_amount,service_fee,government_fee,addons_total,order_status,payment_status,stripe_customer_id,paid_at").order("created_at",{ascending:false})
  ]);
  if(c.error)toast(c.error.message); else clients=c.data||[];
  if(r.error)toast(r.error.message); else contacts=r.data||[];
  if(o.error)toast(o.error.message); else orders=o.data||[];
  buildPeople();
}


function norm(v){return String(v||"").trim().toLowerCase()}
function isPaidOrder(o){return norm(o.payment_status)==="paid"||Number(o.total_paid_amount)>0||!!o.paid_at}
function buildPeople(){
  const map=new Map(),seenEmails=new Set();
  const paidEmails=new Set(orders.filter(isPaidOrder).map(o=>norm(o.email_address)).filter(Boolean));
  clients.forEach(c=>{const e=norm(c.email_address);map.set(`profile:${c.id}`,{...c,_key:`profile:${c.id}`,_kind:"Customer",_client_profile_id:c.id});if(e)seenEmails.add(e)});
  contacts.forEach(c=>{const e=norm(c.email_address),kind=(c.client_profile_id||paidEmails.has(e)||norm(c.lifecycle_stage)==="customer"||norm(c.contact_type)==="customer")?"Customer":"Prospect";if(c.client_profile_id&&clients.some(x=>x.id===c.client_profile_id))return;map.set(`crm:${c.id}`,{...c,_key:`crm:${c.id}`,_kind:kind,_client_profile_id:c.client_profile_id||null});if(e)seenEmails.add(e)});
  orders.filter(isPaidOrder).forEach(o=>{const e=norm(o.email_address);if(!e||seenEmails.has(e))return;map.set(`order:${e}`,{...o,_key:`order:${e}`,_kind:"Customer",_client_profile_id:o.user_id||null});seenEmails.add(e)});
  people=[...map.values()].sort((a,b)=>a._kind===b._kind?clientName(a).localeCompare(clientName(b)):a._kind.localeCompare(b._kind));
  $("clientId").innerHTML='<option value="">Select a customer or prospect</option>'+people.map(c=>`<option value="${esc(c._key)}">${esc(c._kind)} — ${esc(clientName(c))}${c.email_address?` (${esc(c.email_address)})`:""}</option>`).join("");
}
function findPersonForInvoice(x){
  if(x.client_profile_id){const p=people.find(c=>c._client_profile_id===x.client_profile_id);if(p)return p}
  const e=norm(x.client_email);return people.find(c=>norm(c.email_address)===e)||null;
}

function resetNew(){
  invoiceId=null;currentInvoice=null;payments=[];lines=[];
  $("invoiceManagementForm").reset();
  $("invoiceStatus").value="draft";$("paymentStatus").value="unpaid";$("discountType").value="amount";
  $("discountValue").value="0";$("taxRate").value="0";$("shipping").value="0";$("amountPaid").value="0";
  $("partialPaymentsEnabled").value="true";$("minimumPartialPercent").value="25";$("reminderEnabled").value="true";
  const d=new Date();d.setDate(d.getDate()+15);$("dueDate").value=d.toISOString().slice(0,10);
  addLine({description:"",quantity:1,unit_price:0});
  $("pageTitle").textContent="Create Invoice";$("modeLabel").textContent="New invoice";$("previewInvoiceNumber").textContent="New invoice";$("recordActions").hidden=true;$("paymentsCard").hidden=true;
  updateMetadata();syncOrderOptions();calculate();setDirty(false);
}

async function loadInvoice(id){
  const [inv,pay]=await Promise.all([
    db.from("invoices").select("*,invoice_line_items(*)").eq("id",id).maybeSingle(),
    db.from("invoice_payments").select("*").eq("invoice_id",id).order("created_at",{ascending:false})
  ]);
  if(inv.error||!inv.data){toast(inv.error?.message||"Invoice not found.");resetNew();return}
  currentInvoice=inv.data;invoiceId=inv.data.id;payments=pay.data||[];
  const x=currentInvoice;
  $("pageTitle").textContent=`Manage ${x.invoice_number||"Invoice"}`;
  $("modeLabel").textContent=x.invoice_number||"Invoice";
  $("previewInvoiceNumber").textContent=x.invoice_number||"Invoice";
  $("recordActions").hidden=false;$("paymentsCard").hidden=false;
  const invoicePerson=findPersonForInvoice(x);$("clientId").value=invoicePerson?invoicePerson._key:"";syncClient(false);
  $("clientEmail").value=x.client_email||"";
  $("orderId").value=x.order_id||"";$("trackingNumber").value=x.tracking_number||"";
  $("dueDate").value=x.due_date||"";$("invoiceStatus").value=x.status||"draft";$("paymentStatus").value=x.payment_status||"unpaid";
  $("discountType").value=x.discount_type||"amount";$("discountValue").value=x.discount_value??x.discount_amount??0;
  $("taxRate").value=x.tax_rate||0;$("shipping").value=x.shipping_amount||0;$("amountPaid").value=x.amount_paid||0;
  $("paymentTerms").value=x.payment_terms||"";$("paymentUrl").value=x.payment_url||"";$("customerNotes").value=x.customer_notes||"";
  $("partialPaymentsEnabled").value=String(x.partial_payments_enabled!==false);$("minimumPartialPercent").value=x.minimum_partial_percent??25;$("reminderEnabled").value=String(x.reminder_enabled!==false);
  lines=[];(x.invoice_line_items||[]).sort((a,b)=>a.line_number-b.line_number).forEach(l=>lines.push({id:crypto.randomUUID(),description:l.description||"",quantity:Number(l.quantity)||1,unit_price:Number(l.unit_price)||0}));
  if(!lines.length)lines.push({id:crypto.randomUUID(),description:x.line_item_description||"",quantity:1,unit_price:Number(x.subtotal_amount||x.total_amount||0)});
  renderLines();renderPayments();updateMetadata();calculate();setDirty(false);
}

function syncOrderOptions(){
  const c=currentClient();
  const matched=c?orders.filter(o=>(c._client_profile_id&&String(o.user_id||"")===String(c._client_profile_id))||(o.email_address&&c.email_address&&norm(o.email_address)===norm(c.email_address))):orders;
  const selected=$("orderId").value;
  $("orderId").innerHTML='<option value="">No related order</option>'+matched.map(o=>`<option value="${esc(o.id)}">${esc(o.tracking_number||o.selected_service||o.id)} — ${esc(o.selected_service||"Service")}</option>`).join("");
  if(matched.some(o=>String(o.id)===String(selected)))$("orderId").value=selected;
}
function syncClient(mark=true){
  const c=currentClient();$("clientEmail").value=c?.email_address||$("clientEmail").value||"";syncOrderOptions();
  $("customerSummary").hidden=!c;
  if(c)$("customerSummary").innerHTML=`<strong>${esc(clientName(c))}</strong>${esc(c.email_address||"")} · ${esc(c.phone_number||"No phone")}<br>${esc(address(c))}`;
  if(mark)setDirty();calculate();
}
function syncOrder(mark=true){
  const o=currentOrder();if(o)$("trackingNumber").value=o.tracking_number||"";
  if(mark)setDirty();calculate();
}

function prefillPersonFromParams(p){
  let person=null;
  if(p.get("client"))person=people.find(x=>x._key===`profile:${p.get("client")}`||x._client_profile_id===p.get("client"));
  else if(p.get("contact"))person=people.find(x=>x._key===`crm:${p.get("contact")}`);
  else if(p.get("email")){const e=norm(p.get("email"));person=people.find(x=>norm(x.email_address)===e)}
  if(!person)return;
  $("clientId").value=person._key;syncClient(false);$("clientEmail").value=person.email_address||"";calculate();
}

function prefillOrder(id){
  const o=orders.find(x=>String(x.id)===String(id));if(!o)return toast("The requested order could not be found.");
  const c=people.find(x=>(x._client_profile_id&&String(x._client_profile_id)===String(o.user_id||""))||(x.email_address&&o.email_address&&norm(x.email_address)===norm(o.email_address)));
  if(c){$("clientId").value=c._key;syncClient(false)}
  $("orderId").value=o.id;syncOrder(false);$("clientEmail").value=o.email_address||c?.email_address||"";
  lines=[];
  const service=o.selected_service||o.service_key||"filings4u service";
  if(Number(o.service_fee)>0)lines.push({id:crypto.randomUUID(),description:service,quantity:1,unit_price:Number(o.service_fee)});
  if(Number(o.government_fee)>0)lines.push({id:crypto.randomUUID(),description:"Government / filing fee",quantity:1,unit_price:Number(o.government_fee)});
  if(Number(o.addons_total)>0)lines.push({id:crypto.randomUUID(),description:"Selected add-ons / upsells",quantity:1,unit_price:Number(o.addons_total)});
  if(!lines.length)lines.push({id:crypto.randomUUID(),description:service,quantity:1,unit_price:Number(o.total_amount||o.total_paid_amount||0)});
  if(o.payment_status==="paid"){$("paymentStatus").value="paid";$("invoiceStatus").value="paid";$("amountPaid").value=Number(o.total_paid_amount||o.total_amount||0)}
  $("paymentTerms").value=o.payment_status==="paid"?"Paid with order":"Due within 15 days";
  $("customerNotes").value=`Created from order ${o.tracking_number||o.id}.`;
  renderLines();calculate();setDirty();
}

function addLine(item={description:"",quantity:1,unit_price:0}){lines.push({id:crypto.randomUUID(),description:item.description||"",quantity:Number(item.quantity)||1,unit_price:Number(item.unit_price)||0});renderLines();setDirty()}
function renderLines(){
  $("lineItems").innerHTML=lines.map(l=>`<div class="line-item" data-line="${l.id}">
    <input class="line-desc" value="${esc(l.description)}" placeholder="Service or fee description">
    <input class="line-qty" type="number" min="0.01" step="0.01" value="${l.quantity}">
    <input class="line-price" type="number" step="0.01" value="${l.unit_price}">
    <div class="line-total">${money(l.quantity*l.unit_price)}</div>
    <button class="remove-line" type="button" aria-label="Remove line">×</button>
  </div>`).join("");
  qsa("[data-line]").forEach(row=>{
    const l=lines.find(x=>x.id===row.dataset.line);
    row.querySelector(".line-desc").oninput=e=>{l.description=e.target.value;setDirty();calculate()};
    row.querySelector(".line-qty").oninput=e=>{l.quantity=Number(e.target.value)||0;row.querySelector(".line-total").textContent=money(l.quantity*l.unit_price);setDirty();calculate()};
    row.querySelector(".line-price").oninput=e=>{l.unit_price=Number(e.target.value)||0;row.querySelector(".line-total").textContent=money(l.quantity*l.unit_price);setDirty();calculate()};
    row.querySelector(".remove-line").onclick=()=>{if(lines.length===1)return toast("An invoice needs at least one line item.");lines=lines.filter(x=>x.id!==l.id);renderLines();setDirty();calculate()};
  });
  calculate();
}
function totals(){
  const subtotal=lines.reduce((s,l)=>s+(Number(l.quantity)||0)*(Number(l.unit_price)||0),0);
  const discountType=$("discountType").value||"amount";let discountValue=Math.max(0,Number($("discountValue").value)||0);let discount=0;
  if(discountType==="percent"){discountValue=Math.min(100,discountValue);discount=Math.max(0,subtotal)*(discountValue/100)}else discount=Math.min(discountValue,Math.max(0,subtotal));
  const taxable=Math.max(0,subtotal-discount),rate=Math.max(0,Number($("taxRate").value)||0),tax=taxable*(rate/100),shipping=Math.max(0,Number($("shipping").value)||0),total=Math.max(0,taxable+tax+shipping),amountPaid=Math.min(Math.max(0,Number($("amountPaid").value)||0),total),balance=Math.max(0,total-amountPaid);
  return{subtotal,discountType,discountValue,discount,tax,shipping,total,amountPaid,balance,rate};
}
function calculate(){
  const t=totals();$("calcSubtotal").textContent=money(t.subtotal);$("calcDiscount").textContent="− "+money(t.discount);$("calcTax").textContent=money(t.tax);$("calcShipping").textContent=money(t.shipping);$("calcTotal").textContent=money(t.total);$("calcPaid").textContent="− "+money(t.amountPaid);$("calcBalance").textContent=money(t.balance);
  if(t.total>0&&t.amountPaid>=t.total){$("paymentStatus").value="paid";if($("invoiceStatus").value!=="void")$("invoiceStatus").value="paid"}else if(t.amountPaid>0&&$("paymentStatus").value!=="refunded")$("paymentStatus").value="partially_paid";
  renderPreview();
}
function renderPreview(){
  const c=currentClient();$("previewCustomerName").textContent=clientName(c);$("previewCustomerEmail").textContent=$("clientEmail").value||"—";$("previewCustomerAddress").textContent=address(c);$("previewDueDate").textContent=fmtDate($("dueDate").value);$("previewTerms").textContent=$("paymentTerms").value||"—";$("previewNote").textContent=$("customerNotes").value||"Customer notes will appear here.";
  $("previewLines").innerHTML=lines.length?lines.map(l=>`<div class="preview-line"><span>${esc(l.description||"Untitled line item")}</span><span>${l.quantity}</span><span>${money(l.quantity*l.unit_price)}</span></div>`).join(""):'<div class="preview-empty">No line items.</div>';
}
function validate(){
  if(!$("clientId").value)return "Select a customer or prospect.";
  if(!$("clientEmail").value.trim())return "Billing email is required.";
  if(!$("dueDate").value)return "Due date is required.";
  if(!lines.length||lines.some(l=>!String(l.description).trim()||Number(l.quantity)<=0||!Number.isFinite(Number(l.unit_price))))return "Complete every invoice line item.";
  const paymentUrl=$("paymentUrl").value.trim();if(paymentUrl){try{new URL(paymentUrl)}catch{return "Enter a valid payment URL."}}
  return "";
}
async function saveInvoice(forceDraft=false){
  const error=validate();if(error)return toast(error);
  const t=totals(),status=forceDraft?"draft":$("invoiceStatus").value;
  const c=currentClient(),o=currentOrder();
  const payload={
    document_type:"invoice",client_email:$("clientEmail").value.trim().toLowerCase(),client_profile_id:c?._client_profile_id||null,
    order_id:$("orderId").value||null,tracking_number:$("trackingNumber").value.trim()||null,
    line_item_description:lines[0].description.trim(),due_date:$("dueDate").value,status,currency:$("currency").value,
    subtotal_amount:t.subtotal,discount_amount:t.discount,discount_type:t.discountType,discount_value:t.discountValue,tax_rate:t.rate,tax_amount:t.tax,
    shipping_amount:t.shipping,total_amount:t.total,amount_paid:t.amountPaid,balance_due:t.balance,payment_status:$("paymentStatus").value,payment_url:$("paymentUrl").value.trim()||null,
    customer_notes:$("customerNotes").value.trim()||null,payment_terms:$("paymentTerms").value.trim()||null,
    partial_payments_enabled:$("partialPaymentsEnabled").value==="true",minimum_partial_percent:Number($("minimumPartialPercent").value)||25,
    reminder_enabled:$("reminderEnabled").value==="true",stripe_customer_id:c?.stripe_customer_id||o?.stripe_customer_id||currentInvoice?.stripe_customer_id||null,
    updated_at:new Date().toISOString()
  };
  if(user?.id)payload.created_by=currentInvoice?.created_by||user.id;
  const buttons=[$("saveInvoiceButton"),$("saveInvoiceTop"),$("saveDraftButton")];buttons.forEach(b=>b.disabled=true);
  try{
    let id=invoiceId,newRecord=false;
    if(id){
      const r=await db.from("invoices").update(payload).eq("id",id);if(r.error)throw r.error;
      const d=await db.from("invoice_line_items").delete().eq("invoice_id",id);if(d.error)throw d.error;
    }else{
      payload.token_hash=crypto.randomUUID()+crypto.randomUUID();
      const r=await db.from("invoices").insert(payload).select("id").single();if(r.error)throw r.error;
      id=r.data.id;newRecord=true;
    }
    const rows=lines.map((l,i)=>({invoice_id:id,line_number:i+1,description:l.description.trim(),quantity:Number(l.quantity),unit_price:Number(l.unit_price),line_total:Number(l.quantity)*Number(l.unit_price),updated_at:new Date().toISOString()}));
    const li=await db.from("invoice_line_items").insert(rows);if(li.error){if(newRecord)await db.from("invoices").delete().eq("id",id);throw li.error}
    // Generate/reuse the secure checkout URL immediately after every successful save.
    // This does NOT email the customer; Send to client portal remains a separate action.
    try{
      const linkResult=await invokeEdge("admin-invoice-management",{action:"payment_link",id});
      if(linkResult?.payment_url){
        $("paymentUrl").value=linkResult.payment_url;
        payload.payment_url=linkResult.payment_url;
      }
    }catch(linkError){
      console.error("[Invoice payment link]",linkError);
      toast("Invoice saved, but the payment link could not be generated.");
    }
    toast(forceDraft?"Draft saved.":"Invoice saved — payment link ready.");
    history.replaceState({}, "", `admin-invoice-management.html?invoice=${encodeURIComponent(id)}`);
    await loadInvoice(id);
  }catch(e){toast(e.message||"Unable to save invoice.")}
  finally{buttons.forEach(b=>b.disabled=false)}
}
function renderPayments(){
  $("paymentHistory").innerHTML=payments.length?payments.map(p=>`<div class="payment-row"><div><strong>${money(p.amount)}</strong><span>${esc(p.payment_intent_id)}</span></div><span>${esc(p.payment_type)} · ${esc(p.status)}</span><span>${esc(fmtDateTime(p.paid_at||p.created_at))}</span></div>`).join(""):'<div class="preview-empty">No invoice payments recorded.</div>';
}
function updateMetadata(){
  const x=currentInvoice||{};$("metaInvoiceId").textContent=x.id||"Not saved";$("metaCreated").textContent=fmtDateTime(x.created_at);$("metaSent").textContent=fmtDateTime(x.sent_at);$("metaViewed").textContent=fmtDateTime(x.last_viewed_at||x.first_viewed_at);$("metaViewCount").textContent=x.view_count||0;$("metaReminder").textContent=fmtDateTime(x.last_reminder_sent_at);
}
async function sendInvoice(){
  if(!invoiceId)return toast("Save the invoice before sending it.");
  if(dirty){
    toast("Save your changes before sending the invoice.");
    return;
  }
  const button=$("sendInvoiceButton");
  const old=button?.textContent||"Send to client portal";
  if(button){button.disabled=true;button.textContent="Sending…";}
  try{
    const result=await invokeEdge("send-invoice-checkout",{invoice_id:invoiceId});
    if(result?.payment_url)$("paymentUrl").value=result.payment_url;
    toast(`Invoice sent to ${currentInvoice?.client_email||"customer"}.`);
    await loadInvoice(invoiceId);
  }catch(e){
    toast(e.message||"Unable to send invoice.");
  }finally{
    if(button){button.disabled=false;button.textContent=old;}
  }
}
async function markPaid(){
  if(!invoiceId)return toast("Save the invoice first.");
  const t=totals(),now=new Date().toISOString();
  const r=await db.from("invoices").update({status:"paid",payment_status:"paid",amount_paid:t.total,balance_due:0,paid_at:now,last_payment_at:now,updated_at:now}).eq("id",invoiceId);
  if(r.error)return toast(r.error.message);
  if(currentInvoice?.client_profile_id&&currentInvoice?.invoice_number)await db.from("client_invoices").update({payment_status:"Paid"}).eq("invoice_code",currentInvoice.invoice_number).eq("client_id",currentInvoice.client_profile_id);
  toast("Invoice marked paid.");await loadInvoice(invoiceId);
}
function printInvoice(){
  const t=totals(),c=currentClient(),w=window.open("about:blank","_blank");if(!w)return toast("Allow popups to print this invoice.");
  const invoiceNo=currentInvoice?.invoice_number||"Draft Invoice",logoUrl=new URL("images/logo.png",location.href).href;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoiceNo)}</title><style>body{font-family:Arial;color:#13213a;padding:42px}.top{display:flex;justify-content:space-between;border-bottom:4px solid #10b981;padding-bottom:20px}.logo{width:130px}.meta{text-align:right}table{width:100%;border-collapse:collapse;margin-top:25px}th{background:#0a1f44;color:white;text-align:left;padding:10px}td{padding:10px;border-bottom:1px solid #e5eaf0}.num{text-align:right}.totals{width:340px;margin:25px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{border-top:2px solid #0a1f44;font-size:20px;font-weight:bold}.bill{margin-top:28px}.notes{margin-top:30px;background:#f8fafc;padding:16px}@media print{body{padding:20px}}</style></head><body><div class="top"><div><img class="logo" src="${logoUrl}"><div><strong>filings4u, LLC</strong><br><small>A Subsidiary of Roseland Companies, LLC</small></div></div><div class="meta"><h1>INVOICE</h1><strong>${esc(invoiceNo)}</strong><br><small>Due ${esc(fmtDate($("dueDate").value))}</small></div></div><div class="bill"><strong>Bill to: ${esc(clientName(c))}</strong><br>${esc($("clientEmail").value)}<br>${esc(address(c))}</div><table><thead><tr><th>Description</th><th>Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${esc(l.description)}</td><td>${l.quantity}</td><td class="num">${money(l.unit_price)}</td><td class="num">${money(l.quantity*l.unit_price)}</td></tr>`).join("")}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div><span>Discount</span><strong>− ${money(t.discount)}</strong></div><div><span>Tax</span><strong>${money(t.tax)}</strong></div><div><span>Shipping</span><strong>${money(t.shipping)}</strong></div><div><span>Total</span><strong>${money(t.total)}</strong></div><div><span>Paid</span><strong>− ${money(t.amountPaid)}</strong></div><div class="grand"><span>Balance due</span><strong>${money(t.balance)}</strong></div></div>${$("customerNotes").value?`<div class="notes"><strong>Notes</strong><p>${esc($("customerNotes").value)}</p></div>`:""}</body></html>`);
  w.document.close();setTimeout(()=>{w.focus();w.print()},450);
}
function openPreview(){
  const clone=document.querySelector(".live-preview-card").cloneNode(true);$("modalPreviewBody").innerHTML="";const wrap=document.createElement("div");wrap.className="invoice-print-preview";wrap.appendChild(clone);$("modalPreviewBody").appendChild(wrap);$("invoicePreviewModal").hidden=false;
}
function bind(){
  $("clientId").onchange=()=>syncClient(true);$("orderId").onchange=()=>syncOrder(true);$("addLineButton").onclick=()=>addLine();
  ["clientEmail","trackingNumber","dueDate","discountValue","taxRate","shipping","amountPaid","paymentTerms","paymentUrl","customerNotes","minimumPartialPercent"].forEach(id=>$(id).addEventListener("input",()=>{setDirty();calculate()}));
  ["discountType","invoiceStatus","paymentStatus","currency","partialPaymentsEnabled","reminderEnabled"].forEach(id=>$(id).addEventListener("change",()=>{setDirty();calculate()}));
  $("saveInvoiceButton").onclick=()=>saveInvoice(false);$("saveInvoiceTop").onclick=()=>saveInvoice(false);$("saveDraftButton").onclick=()=>saveInvoice(true);
  $("previewInvoiceTop").onclick=openPreview;$("invoiceLookupTrigger").onclick=()=>$("clientId").focus();
  $("sendInvoiceButton").onclick=sendInvoice;$("markPaidButton").onclick=markPaid;$("printInvoiceButton").onclick=printInvoice;
  qsa("[data-close-preview]").forEach(x=>x.onclick=()=>$("invoicePreviewModal").hidden=true);
  window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
}
boot();
})();