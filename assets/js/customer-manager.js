(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const db=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb||null;
const st={db:null,customers:[],orders:[],filtered:[],page:1,size:20,current:null,related:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").trim().toLowerCase();
const nm=c=>[c.first_name,c.last_name].filter(Boolean).join(" ").trim()||c.company_name||c.email_address||"Customer";
const initials=c=>(`${c.first_name?.[0]||""}${c.last_name?.[0]||""}`||String(c.company_name||"CU").slice(0,2)).toUpperCase();
const money=v=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v||0));
const fmt=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v)):"—";
const fmtTime=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"—";
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return;const u=a?.user||a?.session?.user;if(u){const e=u.email||"Admin account",m=u.app_metadata||{},n=m.display_name||m.name||e.split("@")[0];$$("[data-admin-name]").forEach(x=>x.textContent=n);$$("[data-admin-email]").forEach(x=>x.textContent=e);$$("[data-admin-initials]").forEach(x=>x.textContent=n.split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase())}}catch(e){console.error(e)}
st.db=db();if(!st.db){toast("Supabase client is not available.",true);return}
$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));
$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));
const pb=$("#managementProfileButton"),pm=$("#managementProfileMenu");pb?.addEventListener("click",e=>{e.stopPropagation();pm.hidden=!pm.hidden});document.addEventListener("click",()=>{if(pm)pm.hidden=true});
$("#managementSignOut")?.addEventListener("click",async()=>{await st.db.auth.signOut();location.href="admin-login.html"});
async function q(table,fn){try{let x=st.db.from(table).select("*");if(fn)x=fn(x);const {data,error}=await x;if(error){console.warn(table,error);return[]}return data||[]}catch(e){console.warn(table,e);return[]}}
async function load(){
 const [profiles,contacts,orders]=await Promise.all([
  q("client_profiles",x=>x.order("updated_at",{ascending:false}).limit(1000)),
  q("crm_contacts",x=>x.limit(2000)),
  q("orders",x=>x.order("created_at",{ascending:false}).limit(2000))
 ]);
 const customers=[],seenEmails=new Set();
 const isPurchase=o=>norm(o.payment_status)==="paid"||Number(o.total_paid_amount)>0||!!o.paid_at;
 const paidOrders=orders.filter(isPurchase),paidEmails=new Set(paidOrders.map(o=>norm(o.email_address)).filter(Boolean)),paidUsers=new Set(paidOrders.map(o=>o.user_id).filter(Boolean));
 // Existing portal profiles remain customer records. CRM-only contacts become customers only after a purchase.
 profiles.forEach(p=>{const e=norm(p.email_address);customers.push({...p,_source:"profile",_record_id:p.id});if(e)seenEmails.add(e)});
 contacts.filter(c=>paidEmails.has(norm(c.email_address))||(c.client_profile_id&&paidUsers.has(c.client_profile_id))).forEach(c=>{
  const e=norm(c.email_address);if(e&&seenEmails.has(e))return;
  customers.push({...c,id:`crm:${c.id}`,_record_id:c.id,_source:"crm",updated_at:c.updated_at||c.created_at});if(e)seenEmails.add(e);
 });
 const orderByEmail=new Map();
 paidOrders.forEach(o=>{const e=norm(o.email_address);if(!e||seenEmails.has(e)||orderByEmail.has(e))return;orderByEmail.set(e,o)});
 orderByEmail.forEach((o,e)=>{customers.push({
  id:`order:${e}`,_record_id:null,_source:"order",first_name:o.first_name||"",last_name:o.last_name||"",email_address:e,
  phone_number:o.phone_number||"",company_name:o.company_name||"",state:o.jurisdiction_state||"",tracking_number:o.tracking_number||"",
  created_at:o.created_at,updated_at:o.updated_at||o.created_at
 });seenEmails.add(e)});
 st.customers=customers;st.orders=orders;
 customers.forEach(c=>{const e=norm(c.email_address),profileId=c._source==="profile"?c._record_id:null,map=new Map();orders.filter(o=>(profileId&&o.user_id===profileId)||(e&&norm(o.email_address)===e)).forEach(o=>map.set(o.id,o));c._orders=[...map.values()];c._spend=c._orders.filter(o=>norm(o.payment_status)==="paid"||Number(o.total_paid_amount)>0).reduce((s,o)=>s+Number(o.total_amount||o.total_paid_amount||0),0)});
 $("#statCustomers").textContent=customers.length;$("#statOrders").textContent=orders.length;$("#statRevenue").textContent=money(orders.filter(o=>norm(o.payment_status)==="paid"||Number(o.total_paid_amount)>0).reduce((s,o)=>s+Number(o.total_amount||o.total_paid_amount||0),0));$("#statRecent").textContent=customers.filter(c=>new Date(c.updated_at||0)>Date.now()-30*86400000).length;
 const sf=$("#customerStateFilter"),cur=sf.value,states=[...new Set(customers.map(c=>String(c.state||"").toUpperCase()).filter(Boolean))].sort();sf.innerHTML='<option value="">All states</option>'+states.map(s=>`<option>${esc(s)}</option>`).join("");sf.value=cur;filter();
}
function filter(){
 const term=norm($("#customerSearch").value),state=$("#customerStateFilter").value,sort=$("#customerSort").value;
 st.filtered=st.customers.filter(c=>(!term||[nm(c),c.email_address,c.company_name,c.phone_number,c.tracking_number,c.city,c.state].map(norm).join(" ").includes(term))&&(!state||String(c.state||"").toUpperCase()===state));
 st.filtered.sort((a,b)=>sort==="name"?nm(a).localeCompare(nm(b)):sort==="company"?String(a.company_name||"").localeCompare(String(b.company_name||"")):sort==="orders"?b._orders.length-a._orders.length:sort==="spend"?b._spend-a._spend:new Date(b.updated_at||0)-new Date(a.updated_at||0));
 renderTable();
}
function renderTable(){
 const start=(st.page-1)*st.size,rows=st.filtered.slice(start,start+st.size),pages=Math.max(1,Math.ceil(st.filtered.length/st.size));
 $("#customerTableBody").innerHTML=rows.length?rows.map(c=>`<tr data-id="${c.id}"><td><div class="person"><span class="avatar">${esc(initials(c))}</span><div><strong>${esc(nm(c))}</strong><small>${esc(c.email_address||"No email")}</small></div></div></td><td><strong>${esc(c.company_name||"—")}</strong><br><small>${esc(c.phone_number||"")}</small></td><td>${esc([c.city,c.state].filter(Boolean).join(", ")||"—")}</td><td>${c._orders.length}</td><td class="customer-money">${money(c._spend)}</td><td>${fmt(c.updated_at)}</td><td>›</td></tr>`).join(""):'<tr><td colspan="7"><div class="customer-empty">No customers match these filters.</div></td></tr>';
 $$("tr[data-id]").forEach(r=>r.addEventListener("click",()=>openCustomer(r.dataset.id)));$("#customerResultCount").textContent=`${st.filtered.length} customers`;$("#customerPageLabel").textContent=`Page ${st.page} of ${pages}`;$("#customerPrev").disabled=st.page<=1;$("#customerNext").disabled=st.page>=pages;
}
["customerSearch","customerStateFilter","customerSort"].forEach(id=>$("#"+id)?.addEventListener(id==="customerSearch"?"input":"change",()=>{st.page=1;filter()}));$("#customerPrev")?.addEventListener("click",()=>{if(st.page>1){st.page--;renderTable()}});$("#customerNext")?.addEventListener("click",()=>{if(st.page*st.size<st.filtered.length){st.page++;renderTable()}});$("#refreshCustomers")?.addEventListener("click",load);$("#customerSearchTrigger")?.addEventListener("click",()=>$("#customerSearch").focus());
document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement?.tagName||"")){e.preventDefault();$("#customerSearch").focus()}});
async function related(c){
 const e=norm(c.email_address),u=c._source==="profile"?c._record_id:null;
 const [apps,entities,vault,invoices,comp,support,projects,docs,notes]=await Promise.all([
  u?q("applications",x=>x.eq("user_id",u).order("created_at",{ascending:false})):Promise.resolve([]),
  u?q("client_entities",x=>x.eq("user_id",u).order("created_at",{ascending:false})):Promise.resolve([]),
  e?q("client_vault",x=>x.eq("target_client_email",e).order("created_at",{ascending:false})):Promise.resolve([]),
  u?q("invoices",x=>x.or(`client_profile_id.eq.${u},client_email.eq.${e}`).order("created_at",{ascending:false})):e?q("invoices",x=>x.eq("client_email",e).order("created_at",{ascending:false})):Promise.resolve([]),
  e?q("client_compliance",x=>x.eq("user_email",e).order("renewal_date")):Promise.resolve([]),
  u?q("support_tickets",x=>x.or(`client_id.eq.${u},email_address.eq.${e}`).order("created_at",{ascending:false})):e?q("support_tickets",x=>x.eq("email_address",e).order("created_at",{ascending:false})):Promise.resolve([]),
  u?q("design_projects",x=>x.eq("client_profile_id",u).order("created_at",{ascending:false})):Promise.resolve([]),
  u?q("application_documents",x=>x.eq("user_id",u).order("created_at",{ascending:false})):Promise.resolve([]),
  u?q("portal_notifications",x=>x.or(`user_id.eq.${u},recipient_email.eq.${e},email_address.eq.${e}`).order("created_at",{ascending:false}).limit(100)):e?q("portal_notifications",x=>x.or(`recipient_email.eq.${e},email_address.eq.${e}`).order("created_at",{ascending:false}).limit(100)):Promise.resolve([])
 ]);return{orders:c._orders,apps,entities,vault,invoices,comp,support,projects,docs,notes}
}
async function openCustomer(id){
 const c=st.customers.find(x=>x.id===id);if(!c)return;st.current=c;$("#customerListView").hidden=true;$("#customerRecordView").hidden=false;history.replaceState(null,"",`admin-customers.html?client=${encodeURIComponent(id)}`);renderIdentity(c);setTab("overview");st.related=await related(c);renderRelated();scrollTo(0,0);
}
function renderIdentity(c){
 $("#customerRecordAvatar").textContent=initials(c);$("#customerRecordName").textContent=nm(c);$("#customerRecordCompany").textContent=c.company_name||"No company name";$("#customerRecordEmail").textContent=c.email_address||"No email";$("#customerRecordEmail").href=c.email_address?`mailto:${c.email_address}`:"#";$("#customerRecordPhone").textContent=c.phone_number||"No phone";$("#customerRecordPhone").href=c.phone_number?`tel:${c.phone_number}`:"#";$("#customerRecordLocation").textContent=[c.city,c.state,c.zip_code].filter(Boolean).join(", ")||"No address";
 const source=c._source==="profile"?"Client profile":c._source==="crm"?"CRM customer":"Unlinked order customer";
 $("#customerProfileDetails").innerHTML=dl({Email:c.email_address,Phone:c.phone_number,Company:c.company_name,Address:[c.street_address,c.city,c.state,c.zip_code].filter(Boolean).join(", "),Tracking:c.tracking_number,"Record source":source,"Last updated":fmtTime(c.updated_at)});
 $("#customerAccountDetails").innerHTML=dl({"Profile ID":c._source==="profile"?c._record_id:"Not linked","Portal email":c.email_address,"Portal account":c._source==="profile"?"Linked":"Not linked","Encryption sync":c.sync_encryption_status||"—"});
 $("#customerExternalDetails").innerHTML=dl({"Stripe customer":c.stripe_customer_id||"Not connected","Tracking number":c.tracking_number||"—"});
}
const dl=o=>Object.entries(o).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||"—")}</dd></div>`).join("");
const cls=v=>/paid|completed|active|approved|verified|succeeded/i.test(v||"")?"green":/failed|cancel|overdue|refunded/i.test(v||"")?"red":/pending|processing|submitted|new|open|awaiting|draft/i.test(v||"")?"yellow":"";
const pill=v=>`<span class="pill ${cls(v)}">${esc(v||"—")}</span>`;
const empty=m=>`<div class="customer-empty">${esc(m)}</div>`;
const row=(a,b,c,d,e,href="")=>`<div class="data-row"><div><strong>${esc(a||"—")}</strong><small>${esc(b||"")}</small></div><div>${pill(c)}</div><div>${esc(d||"—")}</div><div>${esc(e||"—")}</div>${href?`<a href="${esc(href)}">Open →</a>`:"<span></span>"}</div>`;
function renderRelated(){
 const r=st.related,c=st.current,spend=r.orders.filter(o=>norm(o.payment_status)==="paid"||Number(o.total_paid_amount)>0).reduce((s,o)=>s+Number(o.total_amount||o.total_paid_amount||0),0),openSupport=r.support.filter(x=>!["closed","resolved","completed","cancelled"].includes(norm(x.status))).length;
 $("#recordOrderCount").textContent=r.orders.length;$("#recordSpend").textContent=money(spend);$("#recordApplicationCount").textContent=r.apps.length;$("#recordSupportCount").textContent=openSupport;
 const counts={tabOrderCount:r.orders.length,tabApplicationCount:r.apps.length,tabEntityCount:r.entities.length,tabDocumentCount:r.docs.length+r.vault.length,tabInvoiceCount:r.invoices.length,tabComplianceCount:r.comp.length,tabSupportCount:r.support.length,tabProjectCount:r.projects.length};Object.entries(counts).forEach(([k,v])=>$("#"+k).textContent=v);
 $("#customerSnapshotGrid").innerHTML=[["Orders",r.orders.length],["Lifetime value",money(spend)],["Entities",r.entities.length],["Invoices",r.invoices.length],["Compliance",r.comp.length],["Projects",r.projects.length]].map(([a,b])=>`<div><small>${a}</small><strong>${b}</strong></div>`).join("");
 $("#customerOrdersList").innerHTML=r.orders.length?r.orders.map(o=>row(o.tracking_number,o.selected_service||o.service_key,o.order_status,o.payment_status,money(o.total_amount||o.total_paid_amount),`admin-orders.html?order=${o.id}`)).join(""):empty("No orders found.");
 $("#customerApplicationsList").innerHTML=r.apps.length?r.apps.map(a=>row(a.business_name,a.service_key,a.current_status,a.jurisdiction_state,fmt(a.created_at),`admin-applications.html?application=${a.id}`)).join(""):empty("No applications found.");
 $("#customerEntitiesList").innerHTML=r.entities.length?r.entities.map(e=>`<article class="entity-card">${pill(e.standing_status)}<h3>${esc(e.entity_name)}</h3><p>${esc(e.filing_description||e.service_key||"Business entity")}</p></article>`).join(""):empty("No entities found.");
 const docs=[...r.docs.map(d=>({n:d.document_title||d.file_name,k:d.document_type,t:d.created_at})),...r.vault.map(d=>({n:d.file_name,k:d.asset_vault_category,t:d.created_at}))];$("#customerDocumentsList").innerHTML=docs.length?docs.map(d=>row(d.n,d.k,"Stored","Vault",fmt(d.t))).join(""):empty("No documents found.");
 $("#customerBillingList").innerHTML=r.invoices.length?r.invoices.map(i=>row(i.invoice_number,i.line_item_description,i.status,i.payment_status,money(i.total_amount),`admin-invoices.html?invoice=${i.id}`)).join(""):empty("No invoices found.");
 $("#customerComplianceList").innerHTML=r.comp.length?r.comp.map(x=>row(x.entity_name,x.filing_type,"Active",x.state_jurisdiction,fmt(x.renewal_date))).join(""):empty("No compliance records found.");
 $("#customerSupportList").innerHTML=r.support.length?r.support.map(t=>row(t.ticket_id,t.subject,t.status,t.priority,fmt(t.created_at),`admin-support.html?ticket=${t.id}`)).join(""):empty("No support tickets found.");
 $("#customerProjectsList").innerHTML=r.projects.length?r.projects.map(p=>`<article class="entity-card">${pill(p.status)}<h3>${esc(p.title)}</h3><p>${esc(p.project_type||"Design")} project · ${esc(p.tracking_number||"")}</p></article>`).join(""):empty("No design projects found.");
 const activity=buildActivity(r);$("#customerActivityList").innerHTML=activity.length?activity.map(activityHtml).join(""):empty("No activity found.");$("#customerRecentActivity").innerHTML=activity.length?activity.slice(0,6).map(activityHtml).join(""):empty("No recent activity.");
 const open=[...r.apps.filter(a=>!["completed","approved"].includes(norm(a.current_status))).map(a=>({a:a.business_name||a.service_key,b:"Application",s:a.current_status})),...r.support.filter(t=>!["closed","resolved","completed"].includes(norm(t.status))).map(t=>({a:t.subject||t.ticket_id,b:"Support",s:t.status}))].slice(0,5);$("#customerOpenWork").innerHTML=open.length?open.map(x=>`<div class="mini-row"><div><strong>${esc(x.a)}</strong><small>${esc(x.b)}</small></div>${pill(x.s)}</div>`).join(""):empty("No open work.");
 const upcoming=r.comp.filter(x=>x.renewal_date).slice(0,5);$("#customerDeadlineList").innerHTML=upcoming.length?upcoming.map(x=>`<div class="mini-row"><div><strong>${esc(x.filing_type)}</strong><small>${esc(x.entity_name)}</small></div><span class="pill">${fmt(x.renewal_date)}</span></div>`).join(""):empty("No upcoming deadlines.");
}
function buildActivity(r){const a=[];r.orders.forEach(x=>a.push(["▤",`Order ${x.tracking_number||""}`,`${x.selected_service||x.service_key||"Service"} · ${x.order_status}`,x.updated_at||x.created_at]));r.apps.forEach(x=>a.push(["▧",x.business_name||"Application",`${x.service_key||"Filing"} · ${x.current_status}`,x.updated_at||x.created_at]));r.invoices.forEach(x=>a.push(["$",x.invoice_number||"Invoice",`${x.payment_status} · ${money(x.total_amount)}`,x.updated_at||x.created_at]));r.support.forEach(x=>a.push(["◌",x.subject||x.ticket_id,`${x.status} · ${x.priority}`,x.updated_at||x.created_at]));r.projects.forEach(x=>a.push(["✦",x.title,`${x.project_type} · ${x.status}`,x.updated_at||x.created_at]));r.notes.forEach(x=>a.push(["◉",x.title||"Notification",x.message||x.notification_type,x.created_at]));return a.filter(x=>x[3]).sort((x,y)=>new Date(y[3])-new Date(x[3]))}
const activityHtml=x=>`<div class="activity-item"><span>${x[0]}</span><div><strong>${esc(x[1])}</strong><p>${esc(x[2])}</p></div><time>${fmtTime(x[3])}</time></div>`;
function setTab(t){$$("[data-tab]").forEach(b=>b.classList.toggle("is-active",b.dataset.tab===t));$$("[data-panel]").forEach(p=>p.classList.toggle("is-active",p.dataset.panel===t))}
$$("[data-tab]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));$("#customerBackButton")?.addEventListener("click",()=>{$("#customerRecordView").hidden=true;$("#customerListView").hidden=false;history.replaceState(null,"","admin-customers.html")});$("#customerPortalButton")?.addEventListener("click",()=>{if(st.current?._source!=="profile")return toast("This customer does not have a linked portal profile.",true);open("https://portal.filings4u.com/client-dashboard.html","_blank","noopener")});
function openEdit(){const c=st.current;if(!c)return;if(c._source==="order")return toast("This customer comes from an unlinked order. Link the order to a customer account before editing the profile.",true);const f=$("#customerEditForm");["first_name","last_name","company_name","email_address","phone_number","street_address","city","state","zip_code","tracking_number"].forEach(k=>f.elements[k].value=c[k]||"");$("#customerEditModal").hidden=false}
$("#editCustomerButton")?.addEventListener("click",openEdit);$$("[data-edit-customer]").forEach(x=>x.addEventListener("click",openEdit));$$("[data-close-edit]").forEach(x=>x.addEventListener("click",()=>$("#customerEditModal").hidden=true));
$("#customerEditForm")?.addEventListener("submit",async e=>{e.preventDefault();if(!st.current)return;const raw=Object.fromEntries(new FormData(e.currentTarget));raw.email_address=norm(raw.email_address);raw.state=String(raw.state||"").toUpperCase();let table="client_profiles",id=st.current._record_id,payload=raw;if(st.current._source==="crm"){table="crm_contacts";payload={first_name:raw.first_name,last_name:raw.last_name,company_name:raw.company_name,email_address:raw.email_address,phone_number:raw.phone_number}}else payload.updated_at=new Date().toISOString();const {data,error}=await st.db.from(table).update(payload).eq("id",id).select("*").single();if(error)return toast(error.message,true);Object.assign(st.current,data,{id:st.current.id,_record_id:id,_source:st.current._source});renderIdentity(st.current);$("#customerEditModal").hidden=true;toast("Customer updated.");await load()});
function openContact(){$("#contactForm").reset();$("#contactModal").hidden=false}$("#addContactTop")?.addEventListener("click",openContact);$("#addContactButton")?.addEventListener("click",openContact);$$("[data-close-contact]").forEach(x=>x.addEventListener("click",()=>$("#contactModal").hidden=true));
$("#contactForm")?.addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));d.email_address=norm(d.email_address);d.contact_type="lead";if(d.lifecycle_stage==="customer")d.lifecycle_stage="new";d.status="active";const {data,error}=await st.db.from("crm_contacts").insert(d).select("*").single();if(error)return toast(error.message,true);$("#contactModal").hidden=true;location.href=`admin-prospects.html?prospect=${encodeURIComponent(data.id)}`});
await load();const params=new URLSearchParams(location.search),initial=params.get("client"),email=norm(params.get("email"));if(initial)openCustomer(initial);else if(email){const c=st.customers.find(x=>norm(x.email_address)===email);if(c)openCustomer(c.id)}
})();