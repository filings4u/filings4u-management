(async function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const getDb=()=>window.filings4uSupabase||window.supabaseClient||window.filings4uDb||null;
const st={db:null,items:[],filtered:[],current:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=v=>String(v||"").trim().toLowerCase();
const fmt=v=>v?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v)):"—";
const slugify=v=>String(v||"").toLowerCase().trim().replace(/['’]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120);
function toast(m,e=false){const x=document.createElement("div");x.className="toast"+(e?" error":"");x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3200)}

try{
 const a=await window.filings4uRequireAdmin?.();
 if(window.filings4uRequireAdmin&&!a)return;
 const u=a?.user;
 if(u){
   const email=u.email||"Admin account";
   const name=u.app_metadata?.display_name||u.app_metadata?.name||email.split("@")[0];
   $$("[data-admin-name]").forEach(x=>x.textContent=name);
   $$("[data-admin-email]").forEach(x=>x.textContent=email);
   $$("[data-admin-initials]").forEach(x=>x.textContent=name.split(/\s+/).slice(0,2).map(v=>v[0]).join("").toUpperCase());
 }
}catch(e){console.error(e)}

st.db=getDb();
if(!st.db){toast("Supabase client is unavailable.",true);return}

$("#managementMobileToggle")?.addEventListener("click",()=>document.body.classList.toggle("mobile-nav-open"));
$("#managementSidebarBackdrop")?.addEventListener("click",()=>document.body.classList.remove("mobile-nav-open"));
$("#managementDesktopToggle")?.addEventListener("click",()=>document.body.classList.toggle("sidebar-collapsed"));
const pb=$("#managementProfileButton"),pm=$("#managementProfileMenu");
pb?.addEventListener("click",e=>{e.stopPropagation();pm.hidden=!pm.hidden});
document.addEventListener("click",()=>{if(pm)pm.hidden=true});
$("#managementSignOut")?.addEventListener("click",async()=>{await st.db.auth.signOut();location.href="admin-login.html"});

async function load(){
 const r=await st.db.from("filings4u_knowledge").select("*").order("sort_order",{ascending:true}).order("updated_at",{ascending:false});
 if(r.error){console.error(r.error);toast(r.error.message,true);return}
 st.items=r.data||[];
 renderStats();
 applyFilters();
}

function renderStats(){
 const cats=new Set(st.items.map(x=>x.category).filter(Boolean));
 $("#statTotal").textContent=st.items.length;
 $("#statPublished").textContent=st.items.filter(x=>norm(x.status)==="published").length;
 $("#statDraft").textContent=st.items.filter(x=>norm(x.status)!=="published").length;
 $("#statCategories").textContent=cats.size;
 $("#categoryFilter").innerHTML='<option value="">All categories</option>'+[...cats].sort().map(x=>`<option>${esc(x)}</option>`).join("");
 const types=[...new Set(st.items.map(x=>x.content_type).filter(Boolean))].sort();
 $("#typeFilter").innerHTML='<option value="">All types</option>'+types.map(x=>`<option>${esc(x)}</option>`).join("");
 const statuses=[...new Set(st.items.map(x=>x.status).filter(Boolean))];
 $("#statusFilter").innerHTML='<option value="">All statuses</option>'+statuses.map(x=>`<option>${esc(x)}</option>`).join("");
}

function applyFilters(){
 const q=norm($("#knowledgeSearch").value),cat=$("#categoryFilter").value,type=$("#typeFilter").value,status=$("#statusFilter").value,sort=$("#knowledgeSort").value;
 st.filtered=st.items.filter(x=>{
   const hay=[x.title,x.slug,x.summary,x.category,x.subcategory,x.content_type].map(norm).join(" ");
   return(!q||hay.includes(q))&&(!cat||x.category===cat)&&(!type||x.content_type===type)&&(!status||x.status===status);
 });
 st.filtered.sort((a,b)=>{
   if(sort==="title")return String(a.title||"").localeCompare(String(b.title||""));
   if(sort==="updated")return new Date(b.updated_at||0)-new Date(a.updated_at||0);
   return Number(a.sort_order||0)-Number(b.sort_order||0);
 });
 render();
}

function render(){
 $("#knowledgeTableBody").innerHTML=st.filtered.length?st.filtered.map(x=>`
 <tr data-id="${esc(x.id)}">
   <td><div class="resource-cell"><span>▧</span><div><strong>${esc(x.title||"Untitled resource")}</strong><small>${esc(x.summary||x.slug||"")}</small></div></div></td>
   <td>${esc(x.category||"—")}</td>
   <td>${esc(x.content_type||"Guide")}</td>
   <td>${Number(x.sort_order||0)}</td>
   <td><span class="status-pill ${norm(x.status)==="published"?"green":"yellow"}">${esc(x.status||"draft")}</span></td>
   <td>${fmt(x.updated_at)}</td>
   <td>›</td>
 </tr>`).join(""):'<tr><td colspan="7"><div class="knowledge-empty">No Knowledge Center resources match these filters.</div></td></tr>';
 $$("tr[data-id]").forEach(r=>r.addEventListener("click",()=>openEditor(r.dataset.id)));
 $("#knowledgeResultCount").textContent=`${st.filtered.length} resources`;
}

function syncSeo(){
 const title=$("#knowledgeSeoTitle").value||$("#knowledgeTitle").value||"Resource title";
 const slug=$("#knowledgeSlug").value;
 $("#seoTitlePreview").textContent=title;
 $("#seoUrlPreview").textContent=`filings4u.com/knowledge-center.html?slug=${slug}`;
 $("#seoDescPreview").textContent=$("#knowledgeSeoDescription").value||$("#knowledgeSummary").value||"Add a meta description.";
}

function setImage(url){
 $("#knowledgeImage").value=url||"";
 const img=$("#knowledgeImagePreview"),empty=$("#knowledgeImageEmpty");
 if(url){img.src=url;img.hidden=false;empty.hidden=true}else{img.removeAttribute("src");img.hidden=true;empty.hidden=false}
}

function openEditor(id){
 const x=st.items.find(y=>String(y.id)===String(id)); if(!x)return;
 st.current=x;
 $("#knowledgeListView").hidden=true; $("#knowledgeEditor").hidden=false;
 $("#knowledgeTitle").value=x.title||"";
 $("#knowledgeSlug").value=x.slug||"";
 $("#knowledgeSummary").value=x.summary||"";
 $("#knowledgeContent").innerHTML=x.content||"";
 $("#knowledgeStatus").value=x.status||"draft";
 $("#knowledgeCategory").value=x.category||"";
 $("#knowledgeSubcategory").value=x.subcategory||"";
 $("#knowledgeType").value=x.content_type||"Guide";
 $("#knowledgeOrder").value=x.sort_order??0;
 $("#knowledgeFeatured").checked=!!x.is_featured;
 $("#knowledgeSeoTitle").value=x.seo_title||"";
 $("#knowledgeSeoDescription").value=x.seo_description||"";
 setImage(x.featured_image_url||"");
 $("#saveState").textContent=x.status||"draft";$("#saveState").className="save-state";
 syncSeo();
 history.replaceState(null,"",`admin-knowledge.html?resource=${encodeURIComponent(id)}`);
 window.scrollTo({top:0,behavior:"smooth"});
}

$("#knowledgeBack")?.addEventListener("click",()=>{$("#knowledgeEditor").hidden=true;$("#knowledgeListView").hidden=false;st.current=null;history.replaceState(null,"","admin-knowledge.html")});
["knowledgeSearch"].forEach(id=>$("#"+id)?.addEventListener("input",applyFilters));
["categoryFilter","typeFilter","statusFilter","knowledgeSort"].forEach(id=>$("#"+id)?.addEventListener("change",applyFilters));
$("#refreshKnowledge")?.addEventListener("click",load);
$("#knowledgeSearchTrigger")?.addEventListener("click",()=>$("#knowledgeSearch").focus());
["knowledgeTitle","knowledgeSlug","knowledgeSummary","knowledgeSeoTitle","knowledgeSeoDescription"].forEach(id=>$("#"+id)?.addEventListener("input",syncSeo));

let slugTouched=false;
$("#knowledgeSlug")?.addEventListener("input",()=>{slugTouched=true;$("#knowledgeSlug").value=slugify($("#knowledgeSlug").value)});
$("#knowledgeTitle")?.addEventListener("input",()=>{if(!slugTouched&&st.current&&(!st.current.slug||$("#knowledgeSlug").value===st.current.slug))$("#knowledgeSlug").value=slugify($("#knowledgeTitle").value);syncSeo()});

$("#richToolbar")?.addEventListener("click",async e=>{
 const b=e.target.closest("button");if(!b)return;
 e.preventDefault();$("#knowledgeContent").focus();
 if(b.dataset.block){document.execCommand("formatBlock",false,b.dataset.block);return}
 if(b.dataset.cmd==="createLink"){const url=await window.filings4uDialog.prompt("Enter the link URL.",{title:"Add knowledge link",label:"URL",placeholder:"https://"});if(url)document.execCommand("createLink",false,url);return}
 document.execCommand(b.dataset.cmd,false,null);
});

function openNew(){
 $("#newKnowledgeForm").reset();
 const title=$("#newKnowledgeForm [name=title]"),slug=$("#newKnowledgeForm [name=slug]");
 title.oninput=()=>{slug.value=slugify(title.value)};
 $("#newKnowledgeModal").hidden=false;
 setTimeout(()=>title.focus(),0);
}
$("#newKnowledgeTop")?.addEventListener("click",openNew);
$("#newKnowledgeButton")?.addEventListener("click",openNew);
$$("[data-close-new]").forEach(x=>x.addEventListener("click",()=>$("#newKnowledgeModal").hidden=true));

$("#newKnowledgeForm")?.addEventListener("submit",async e=>{
 e.preventDefault();
 const d=Object.fromEntries(new FormData(e.currentTarget));
 const payload={
   title:d.title.trim(),
   slug:slugify(d.slug||d.title),
   category:d.category?.trim()||null,
   content_type:d.content_type||"Guide",
   status:"draft",
   sort_order:(Math.max(0,...st.items.map(x=>Number(x.sort_order||0)))+10),
   summary:null,
   content:null,
   is_featured:false
 };
 const r=await st.db.from("filings4u_knowledge").insert(payload).select("*").single();
 if(r.error)return toast(r.error.message,true);
 $("#newKnowledgeModal").hidden=true;
 await load();openEditor(r.data.id);toast("Knowledge resource created.");
});

async function save(publish=false){
 if(!st.current)return;
 const payload={
   title:$("#knowledgeTitle").value.trim(),
   slug:slugify($("#knowledgeSlug").value||$("#knowledgeTitle").value),
   summary:$("#knowledgeSummary").value.trim()||null,
   content:$("#knowledgeContent").innerHTML.trim()||null,
   category:$("#knowledgeCategory").value.trim()||null,
   subcategory:$("#knowledgeSubcategory").value.trim()||null,
   content_type:$("#knowledgeType").value,
   featured_image_url:$("#knowledgeImage").value||null,
   status:publish?"published":$("#knowledgeStatus").value,
   sort_order:Number($("#knowledgeOrder").value)||0,
   is_featured:$("#knowledgeFeatured").checked,
   seo_title:$("#knowledgeSeoTitle").value.trim()||null,
   seo_description:$("#knowledgeSeoDescription").value.trim()||null,
   published_at:publish?(st.current.published_at||new Date().toISOString()):st.current.published_at,
   updated_at:new Date().toISOString()
 };
 $("#saveState").textContent=publish?"Publishing…":"Saving…";
 const r=await st.db.from("filings4u_knowledge").update(payload).eq("id",st.current.id).select("*").single();
 if(r.error){$("#saveState").textContent="Error";$("#saveState").className="save-state error";return toast(r.error.message,true)}
 st.current=r.data;$("#saveState").textContent=publish?"Published":"Saved";$("#saveState").className="save-state success";await load();openEditor(r.data.id);toast(publish?"Resource published.":"Resource saved.");
}
$("#saveKnowledge")?.addEventListener("click",()=>save(false));
$("#publishKnowledge")?.addEventListener("click",()=>save(true));
$("#previewKnowledge")?.addEventListener("click",()=>window.open(`https://filings4u.com/knowledge-center.html?slug=${encodeURIComponent($("#knowledgeSlug").value)}`,"_blank","noopener"));

async function uploadImage(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))return toast("Use PNG, JPG or WEBP images.",true);
 if(file.size>8*1024*1024)return toast("Image must be 8 MB or smaller.",true);
 const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-");
 const path=`knowledge/${st.current?.id||"new"}/${Date.now()}-${safe}`;
 const btn=$("#chooseKnowledgeImage");btn.disabled=true;btn.textContent="Uploading…";
 try{
   const up=await st.db.storage.from("filings4u-content").upload(path,file,{contentType:file.type,upsert:false});
   if(up.error)throw up.error;
   const {data}=st.db.storage.from("filings4u-content").getPublicUrl(path);
   setImage(data.publicUrl);toast("Image uploaded.");
 }catch(err){console.error(err);toast(err.message||"Image upload failed.",true)}
 finally{btn.disabled=false;btn.textContent="Choose image"}
}
$("#chooseKnowledgeImage")?.addEventListener("click",()=>$("#knowledgeImageFile").click());
$("#knowledgeImageDrop")?.addEventListener("click",()=>$("#knowledgeImageFile").click());
$("#knowledgeImageFile")?.addEventListener("change",e=>uploadImage(e.target.files?.[0]));
$("#knowledgeImageDrop")?.addEventListener("dragover",e=>{e.preventDefault();e.currentTarget.classList.add("dragging")});
$("#knowledgeImageDrop")?.addEventListener("dragleave",e=>e.currentTarget.classList.remove("dragging"));
$("#knowledgeImageDrop")?.addEventListener("drop",e=>{e.preventDefault();e.currentTarget.classList.remove("dragging");uploadImage(e.dataTransfer.files?.[0])});

await load();
const initial=new URLSearchParams(location.search).get("resource");
if(initial)openEditor(initial);
})();