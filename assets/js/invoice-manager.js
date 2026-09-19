(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const db=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb||null;
const st={db:null,invoices:[],payments:[],customers:[],orders:[],filtered:[],page:1,size:20,current:null,related:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").trim().toLowerCase();
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
const fmt=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v)):"—";
const fmtTime=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"—";
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
function cls(v){v=norm(v);if(/paid|succeeded|complete/.test(v))return"green";if(/failed|overdue|cancel|void|refunded/.test(v))return"red";if(/pending|partial|open|sent|draft/.test(v))return"yellow";return"blue"}
const pill=v=>`<span class="status-pill ${cls(v)}">${esc(v||"—")}</span>`;
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return;const u=a?.user||a?.session?.user;if(u){const e=u.email||"Admin account",m=u.app_metadata||{},n=m.display_name||m.name||e.split("@")[0];$$("[data-admin-name]").forEach(x=>x.textContent=n);$$("[data-admin-email]").forEach(x=>x.textContent=e);$$("[data-admin-initials]").forEach(x=>x.textContent=n.split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase())}}catch(e){console.error(e)}
st.db=db();if(!st.db){toast("Supabase client is not available.",true);return}
$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));
const pb=$("#managementProfileButton"),pm=$("#managementProfileMenu");pb?.addEventListener("click",e=>{e.stopPropagation();pm.hidden=!pm.hidden});document.addEventListener("click",()=>{if(pm)pm.hidden=true});$("#managementSignOut")?.addEventListener("click",async()=>{await st.db.auth.signOut();location.href="admin-login.html"});
async function q(table,fn){try{let x=st.db.from(table).select("*");if(fn)x=fn(x);const {data,error}=await x;if(error){console.warn(table,error);return[]}return data||[]}catch(e){console.warn(table,e);return[]}}
async function load(){
 const [invoices,payments,customers,orders]=await Promise.all([q("invoices",x=>x.order("created_at",{ascending:false}).limit(1500)),q("invoice_payments",x=>x.order("created_at",{ascending:false}).limit(1500)),q("client_profiles",x=>x.limit(1000)),q("orders",x=>x.limit(2000))]);
 st.invoices=invoices;st.payments=payments;st.customers=customers;st.orders=orders;
 const cm=new Map(customers.map(c=>[c.id,c])),om=new Map(orders.map(o=>[o.id,o]));
 invoices.forEach(i=>{i._customer=cm.get(i.client_profile_id)||null;i._order=om.get(i.order_id)||null;i._payments=payments.filter(p=>p.invoice_id===i.id);const paidByLedger=i._payments.filter(p=>norm(p.status)==="succeeded").reduce((s,p)=>s+Number(p.amount||0),0);i._paid=Number(i.amount_paid||paidByLedger||0);i._balance=Number(i.balance_due!=null?i.balance_due:Math.max(0,Number(i.total_amount||0)-i._paid))});
 const total=invoices.reduce((s,i)=>s+Number(i.total_amount||0),0),collected=invoices.reduce((s,i)=>s+i._paid,0),outstanding=invoices.reduce((s,i)=>s+i._balance,0),today=new Date().toISOString().slice(0,10),overdue=invoices.filter(i=>i.due_date&&i.due_date<today&&i._balance>0).length;
 $("#statTotalInvoiced").textContent=money(total);$("#statCollected").textContent=money(collected);$("#statOutstanding").textContent=money(outstanding);$("#statOverdue").textContent=overdue;
 populateFilters();filter();
}
function populateFilters(){const sf=$("#invoiceStatusFilter"),pf=$("#paymentStatusFilter"),sv=sf.value,pv=pf.value,status=[...new Set(st.invoices.map(i=>i.status).filter(Boolean))].sort(),pay=[...new Set(st.invoices.map(i=>i.payment_status).filter(Boolean))].sort();sf.innerHTML='<option value="">All invoice statuses</option>'+status.map(x=>`<option>${esc(x)}</option>`).join("");pf.innerHTML='<option value="">All payment statuses</option>'+pay.map(x=>`<option>${esc(x)}</option>`).join("");sf.value=sv;pf.value=pv}
function customerName(i){const c=i._customer,o=i._order;return c?[c.first_name,c.last_name].filter(Boolean).join(" ")||c.company_name||c.email_address:o?[o.first_name,o.last_name].filter(Boolean).join(" ")||o.company_name||o.email_address:i.client_email}
function filter(){
 const term=norm($("#invoiceSearch").value),status=$("#invoiceStatusFilter").value,pay=$("#paymentStatusFilter").value,sort=$("#invoiceSort").value;
 st.filtered=st.invoices.filter(i=>{const hay=[i.invoice_number,i.client_email,customerName(i),i.tracking_number,i._order?.tracking_number,i.line_item_description].map(norm).join(" ");return(!term||hay.includes(term))&&(!status||i.status===status)&&(!pay||i.payment_status===pay)});
 st.filtered.sort((a,b)=>sort==="due"?String(a.due_date||"9999").localeCompare(String(b.due_date||"9999")):sort==="amount"?Number(b.total_amount||0)-Number(a.total_amount||0):sort==="balance"?b._balance-a._balance:new Date(b.created_at||0)-new Date(a.created_at||0));renderTable();
}
function renderTable(){
 const start=(st.page-1)*st.size,rows=st.filtered.slice(start,start+st.size),pages=Math.max(1,Math.ceil(st.filtered.length/st.size));
 $("#invoiceTableBody").innerHTML=rows.length?rows.map(i=>`<tr data-id="${i.id}"><td><div class="invoice-cell"><span class="invoice-cell-icon">$</span><div><strong>${esc(i.invoice_number||"Invoice")}</strong><small>${esc(i.tracking_number||i.id.slice(0,8))}</small></div></div></td><td><strong>${esc(customerName(i)||"—")}</strong><br><small>${esc(i.client_email||"")}</small></td><td>${pill(i.status)}</td><td>${pill(i.payment_status)}</td><td>${money(i.total_amount)}</td><td>${money(i._balance)}</td><td>${fmt(i.due_date)}</td><td>›</td></tr>`).join(""):'<tr><td colspan="8"><div class="invoice-empty">No invoices match these filters.</div></td></tr>';
 $$("tr[data-id]").forEach(r=>r.addEventListener("click",()=>openInvoice(r.dataset.id)));$("#invoiceResultCount").textContent=`${st.filtered.length} invoices`;$("#invoicePageLabel").textContent=`Page ${st.page} of ${pages}`;$("#invoicePrev").disabled=st.page<=1;$("#invoiceNext").disabled=st.page>=pages;
}
["invoiceSearch","invoiceStatusFilter","paymentStatusFilter","invoiceSort"].forEach(id=>$("#"+id)?.addEventListener(id==="invoiceSearch"?"input":"change",()=>{st.page=1;filter()}));$("#invoicePrev")?.addEventListener("click",()=>{if(st.page>1){st.page--;renderTable()}});$("#invoiceNext")?.addEventListener("click",()=>{if(st.page*st.size<st.filtered.length){st.page++;renderTable()}});$("#refreshInvoices")?.addEventListener("click",load);$("#invoiceSearchTrigger")?.addEventListener("click",()=>$("#invoiceSearch").focus());
document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement?.tagName||"")){e.preventDefault();$("#invoiceSearch").focus()}});
async function related(i){const [items,payments]=await Promise.all([q("invoice_line_items",x=>x.eq("invoice_id",i.id).order("line_number")),q("invoice_payments",x=>x.eq("invoice_id",i.id).order("created_at",{ascending:false}))]);return{items,payments}}
async function openInvoice(id){
 if(!id)return;
 location.href=`admin-invoice-management.html?invoice=${encodeURIComponent(id)}`;
}
const dl=o=>Object.entries(o).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v??"—")}</dd></div>`).join("");
function renderRelated(){
 const r=st.related,i=st.current;$("#tabItemCount").textContent=r.items.length;$("#tabPaymentCount").textContent=r.payments.length;
 $("#lineItemsList").innerHTML=r.items.length?r.items.map(x=>`<div class="data-row"><div><strong>${esc(x.description)}</strong><small>Line ${x.line_number}</small></div><div>${x.quantity}</div><div>${money(x.unit_price)}</div><div>${money(x.line_total)}</div><span></span></div>`).join(""):'<div class="invoice-empty">No line items found.</div>';
 $("#paymentsList").innerHTML=r.payments.length?r.payments.map(p=>`<div class="data-row"><div><strong>${esc(p.payment_intent_id||"Payment")}</strong><small>${fmtTime(p.paid_at||p.created_at)}</small></div><div>${pill(p.status)}</div><div>${esc(p.payment_type||"—")}</div><div>${money(p.amount)}</div><span></span></div>`).join(""):'<div class="invoice-empty">No payments recorded.</div>';
 const acts=[...r.payments.map(p=>({icon:"$",title:`Payment ${p.status}`,text:`${money(p.amount)} · ${p.payment_type||"payment"}`,when:p.paid_at||p.created_at})),...(i.sent_at?[{icon:"→",title:"Invoice sent",text:"Invoice delivered to customer",when:i.sent_at}]:[]),...(i.paid_at?[{icon:"✓",title:"Invoice paid",text:`Paid ${money(i.amount_paid||i.total_amount)}`,when:i.paid_at}]:[])].sort((a,b)=>new Date(b.when)-new Date(a.when));
 const html=acts.length?acts.map(a=>`<div class="activity-item"><span>${a.icon}</span><div><strong>${esc(a.title)}</strong><p>${esc(a.text)}</p></div><time>${fmtTime(a.when)}</time></div>`).join(""):'<div class="invoice-empty">No payment activity found.</div>';$("#overviewPaymentActivity").innerHTML=html;$("#invoiceActivityList").innerHTML=html;
}
function setTab(t){$$("[data-tab]").forEach(b=>b.classList.toggle("is-active",b.dataset.tab===t));$$("[data-panel]").forEach(p=>p.classList.toggle("is-active",p.dataset.panel===t))}
$$("[data-tab]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));$("#invoiceBackButton")?.addEventListener("click",()=>{$("#invoiceRecordView").hidden=true;$("#invoiceListView").hidden=false;history.replaceState(null,"","admin-invoices.html")});
$("#openCustomerButton")?.addEventListener("click",()=>{if(st.current?.client_profile_id)location.href=`admin-customers.html?client=${encodeURIComponent(st.current.client_profile_id)}`;else toast("This invoice is not linked to a customer profile.",true)});$("#openOrderButton")?.addEventListener("click",()=>{if(st.current?.order_id)location.href=`admin-orders.html?order=${encodeURIComponent(st.current.order_id)}`;else toast("This invoice is not linked to an order.",true)});
function openEdit(){
 const id=st.current?.id;
 if(!id)return toast("Invoice record could not be found.",true);
 location.href=`admin-invoice-management.html?invoice=${encodeURIComponent(id)}`;
}
$("#editInvoiceButton")?.addEventListener("click",openEdit);
$$("[data-edit-invoice]").forEach(x=>x.addEventListener("click",openEdit));
function openNew(){location.href="admin-invoice-management.html"}$("#newInvoiceTop")?.addEventListener("click",openNew);$("#newInvoiceButton")?.addEventListener("click",openNew);
const initial=new URLSearchParams(location.search).get("invoice");if(initial){location.replace(`admin-invoice-management.html?invoice=${encodeURIComponent(initial)}`);return}await load();
})();