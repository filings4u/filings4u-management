(async function(){
"use strict";
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const db=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb;
const st={db:null,events:[],deadlines:[],month:new Date(new Date().getFullYear(),new Date().getMonth(),1)};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").toLowerCase().trim();
const iso=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()-d.getTimezoneOffset()/1440).toISOString().slice(0,10);
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)}
try{const a=await window.filings4uRequireAdmin?.();if(window.filings4uRequireAdmin&&!a)return}catch(e){return}
st.db=db();if(!st.db)return toast("Supabase unavailable.",true);
$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));
$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));
$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));

async function load(){
 const [a,b]=await Promise.all([
   st.db.from("calendar_events").select("*").order("event_date"),
   st.db.from("platform_operational_calendar").select("*").order("deadline_date")
 ]);
 if(a.error)toast(a.error.message,true); if(b.error)toast(b.error.message,true);
 st.events=a.data||[]; st.deadlines=b.data||[]; render();
}
function allItems(){
 return [
   ...st.events.map(x=>({source:"calendar_events",id:x.id,title:x.title,date:x.event_date,time:x.event_time,description:x.description,email:x.email_address,priority:x.priority_level||"standard"})),
   ...st.deadlines.map(x=>({source:"platform_operational_calendar",id:x.id,title:x.event_title,date:x.deadline_date,time:null,description:"Operational deadline",email:null,priority:"high"}))
 ];
}
function filtered(){
 const q=norm($("#calendarSearch").value),source=$("#sourceFilter").value,priority=$("#priorityFilter").value;
 return allItems().filter(x=>(!q||[x.title,x.description,x.email].map(norm).join(" ").includes(q))&&(!source||x.source===source)&&(!priority||norm(x.priority)===priority));
}
function renderStats(items){
 const today=iso(new Date()), start=new Date(), end=new Date();end.setDate(end.getDate()+30);
 $("#statMonth").textContent=items.filter(x=>{const d=new Date(x.date+"T12:00:00");return d.getMonth()===st.month.getMonth()&&d.getFullYear()===st.month.getFullYear()}).length;
 $("#statToday").textContent=items.filter(x=>x.date===today).length;
 $("#statUpcoming").textContent=items.filter(x=>{const d=new Date(x.date+"T12:00:00");return d>=new Date(today+"T00:00:00")&&d<=end}).length;
 $("#statPriority").textContent=items.filter(x=>["high","urgent"].includes(norm(x.priority))).length;
}
function render(){
 const items=filtered();renderStats(items);
 $("#monthTitle").textContent=st.month.toLocaleDateString("en-US",{month:"long",year:"numeric"});
 const first=new Date(st.month.getFullYear(),st.month.getMonth(),1);
 const start=new Date(first);start.setDate(1-first.getDay());
 let cells="";
 for(let i=0;i<42;i++){
   const d=new Date(start);d.setDate(start.getDate()+i);const date=iso(d),today=iso(new Date());
   const dayItems=items.filter(x=>x.date===date).slice(0,4);
   cells+=`<div class="calendar-day ${d.getMonth()!==st.month.getMonth()?"is-other":""} ${date===today?"is-today":""}" data-date="${date}">
     <div class="day-number"><span>${d.getDate()}</span></div>
     ${dayItems.map(x=>`<button class="calendar-item ${x.source==="platform_operational_calendar"?"deadline":""} ${norm(x.priority)}" data-source="${x.source}" data-id="${x.id}">${esc(x.title)}</button>`).join("")}
   </div>`;
 }
 $("#calendarGrid").innerHTML=cells;
 const today=iso(new Date());
 const agenda=items.filter(x=>x.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
 $("#agendaList").innerHTML=agenda.length?agenda.map(x=>`<article class="agenda-item" data-source="${x.source}" data-id="${x.id}"><strong>${esc(x.title)}</strong><span>${new Date(x.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}${x.time?" · "+String(x.time).slice(0,5):""} · ${x.source==="calendar_events"?"Event":"Deadline"}</span></article>`).join(""):'<div class="agenda-empty">No upcoming calendar items.</div>';
 $$(".calendar-item,.agenda-item").forEach(el=>el.onclick=()=>openExisting(el.dataset.source,el.dataset.id));
 $$(".calendar-day").forEach(el=>el.ondblclick=()=>openNew(el.dataset.date));
}
function setDeleteEvent(id,source){const b=$("#deleteEventButton");if(!b)return;b.hidden=!(id&&source==="calendar_events");b.onclick=(id&&source==="calendar_events")?()=>deleteEvent(id):null;}
async function deleteEvent(id){const x=st.events.find(e=>String(e.id)===String(id));if(!x)return;const ok=await window.filings4uDialog.confirm(`Delete event “${x.title}”?`,{title:"Delete calendar event",confirmText:"Delete event"});if(!ok)return;const r=await st.db.from("calendar_events").delete().eq("id",id);if(r.error)return toast(r.error.message,true);$("#eventModal").hidden=true;await load();toast("Calendar event deleted.")}
function openNew(date=""){setDeleteEvent(null,null);
 $("#eventModalTitle").textContent="New event";$("#eventId").value="";$("#eventSource").value="calendar_events";$("#eventTitle").value="";$("#eventDate").value=date||iso(new Date());$("#eventTime").value="09:00";$("#eventDescription").value="";$("#eventPriority").value="standard";$("#eventEmail").value="";$("#eventModal").hidden=false;
}
function openExisting(source,id){setDeleteEvent(id,source);
 if(source==="platform_operational_calendar"){toast("Operational deadlines are read-only here. Edit the originating compliance workflow.");return}
 const x=st.events.find(e=>String(e.id)===String(id));if(!x)return;
 $("#eventModalTitle").textContent="Edit event";$("#eventId").value=x.id;$("#eventSource").value=source;$("#eventTitle").value=x.title||"";$("#eventDate").value=x.event_date||"";$("#eventTime").value=String(x.event_time||"09:00").slice(0,5);$("#eventDescription").value=x.description||"";$("#eventPriority").value=x.priority_level||"standard";$("#eventEmail").value=x.email_address||"";$("#eventModal").hidden=false;
}
$("#eventForm").onsubmit=async e=>{e.preventDefault();const id=$("#eventId").value,p={title:$("#eventTitle").value.trim(),event_date:$("#eventDate").value,event_time:$("#eventTime").value||"09:00",description:$("#eventDescription").value.trim()||null,priority_level:$("#eventPriority").value,email_address:$("#eventEmail").value.trim()||null};const r=id?await st.db.from("calendar_events").update(p).eq("id",id):await st.db.from("calendar_events").insert(p);if(r.error)return toast(r.error.message,true);$("#eventModal").hidden=true;await load();toast(id?"Event updated.":"Event created.")};
$$("[data-close-event]").forEach(x=>x.onclick=()=>$("#eventModal").hidden=true);
$("#newEventTop").onclick=()=>openNew();$("#newEventButton").onclick=()=>openNew();$("#refreshCalendar").onclick=load;$("#todayButton").onclick=()=>{const n=new Date();st.month=new Date(n.getFullYear(),n.getMonth(),1);render()};$("#prevMonth").onclick=()=>{st.month=new Date(st.month.getFullYear(),st.month.getMonth()-1,1);render()};$("#nextMonth").onclick=()=>{st.month=new Date(st.month.getFullYear(),st.month.getMonth()+1,1);render()};$("#calendarSearch").oninput=render;$("#sourceFilter").onchange=render;$("#priorityFilter").onchange=render;$("#calendarSearchTrigger").onclick=()=>$("#calendarSearch").focus();
await load();
})();