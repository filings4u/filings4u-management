(function(){
'use strict';
if(window.__filings4uUiReady)return;window.__filings4uUiReady=true;
const css=`
.f4u-toast-stack{position:fixed;right:22px;top:22px;z-index:2147483000;display:grid;gap:10px;width:min(390px,calc(100vw - 32px))}.f4u-toast{background:#fff;border:1px solid #dbe4ee;border-left:5px solid #0a1f44;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.18);padding:15px 16px;display:flex;gap:12px;align-items:flex-start;animation:f4uin .18s ease}.f4u-toast.success{border-left-color:#10b981}.f4u-toast.error{border-left-color:#dc2626}.f4u-toast.warning{border-left-color:#d97706}.f4u-toast__icon{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#eef3f8;color:#0a1f44;font-weight:900;flex:0 0 auto}.f4u-toast.success .f4u-toast__icon{background:#ecfdf5;color:#047857}.f4u-toast.error .f4u-toast__icon{background:#fef2f2;color:#b91c1c}.f4u-toast.warning .f4u-toast__icon{background:#fff7ed;color:#c2410c}.f4u-toast__copy strong{display:block;color:#0a1f44;font:800 14px/1.25 Arial,sans-serif;margin:0 0 3px}.f4u-toast__copy span{display:block;color:#475569;font:500 13px/1.45 Arial,sans-serif}.f4u-dialog[hidden]{display:none!important}.f4u-dialog{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:20px}.f4u-dialog__shade{position:absolute;inset:0;background:rgba(2,12,27,.62);backdrop-filter:blur(3px)}.f4u-dialog__card{position:relative;width:min(520px,100%);background:#fff;border:1px solid #dbe4ee;border-radius:20px;box-shadow:0 28px 80px rgba(2,12,27,.28);overflow:hidden}.f4u-dialog__brand{padding:20px 24px 17px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between}.f4u-dialog__brand img{width:126px;height:auto}.f4u-dialog__brand span{font:800 10px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#10b981}.f4u-dialog__body{padding:26px}.f4u-dialog__body h2{margin:0 0 9px;color:#0a1f44;font:800 23px/1.25 Arial,sans-serif}.f4u-dialog__body p{margin:0;color:#475569;font:500 14px/1.6 Arial,sans-serif}.f4u-dialog__field{margin-top:18px}.f4u-dialog__field label{display:block;margin-bottom:7px;color:#334155;font:700 12px Arial,sans-serif}.f4u-dialog__field input,.f4u-dialog__field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:12px 13px;font:500 14px Arial,sans-serif;color:#0f172a;background:#fff}.f4u-dialog__actions{padding:0 26px 26px;display:flex;justify-content:flex-end;gap:10px}.f4u-dialog__actions button{border-radius:10px;padding:11px 16px;font:800 13px Arial,sans-serif;cursor:pointer}.f4u-dialog__cancel{border:1px solid #cbd5e1;background:#fff;color:#334155}.f4u-dialog__confirm{border:1px solid #10b981;background:#10b981;color:#fff}@keyframes f4uin{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
let stack=document.querySelector('.f4u-toast-stack');if(!stack){stack=document.createElement('div');stack.className='f4u-toast-stack';stack.setAttribute('aria-live','polite');document.body.appendChild(stack)}
function notify(message,type='info',title){const n=document.createElement('div');n.className='f4u-toast '+type;const icon=type==='success'?'✓':type==='error'?'!':type==='warning'?'!':'i';const heading=title||(type==='success'?'Success':type==='error'?'Something went wrong':type==='warning'?'Attention':'filings4u');n.innerHTML=`<div class="f4u-toast__icon">${icon}</div><div class="f4u-toast__copy"><strong></strong><span></span></div>`;n.querySelector('strong').textContent=heading;n.querySelector('span').textContent=String(message||'');stack.appendChild(n);setTimeout(()=>n.remove(),4200);return n}
window.filings4uNotify={show:notify,success:(m,t)=>notify(m,'success',t),error:(m,t)=>notify(m,'error',t),warning:(m,t)=>notify(m,'warning',t),info:(m,t)=>notify(m,'info',t)};
function ensureDialog(){let r=document.querySelector('.f4u-dialog');if(r)return r;r=document.createElement('div');r.className='f4u-dialog';r.hidden=true;r.setAttribute('aria-hidden','true');r.innerHTML=`<div class="f4u-dialog__shade" data-f4u-cancel></div><div class="f4u-dialog__card" role="dialog" aria-modal="true" aria-labelledby="f4uDialogTitle"><div class="f4u-dialog__brand"><img src="https://lrbimrlbskjweynxlgas.supabase.co/storage/v1/object/public/public-assets/logo.png" alt="filings4u"><span>Secure portal</span></div><div class="f4u-dialog__body"><h2 id="f4uDialogTitle"></h2><p id="f4uDialogMessage"></p><div class="f4u-dialog__field" hidden><label id="f4uDialogLabel"></label><input id="f4uDialogInput"><select id="f4uDialogSelect" hidden></select></div></div><div class="f4u-dialog__actions"><button class="f4u-dialog__cancel" data-f4u-cancel>Cancel</button><button class="f4u-dialog__confirm">Continue</button></div></div>`;document.body.appendChild(r);return r}
let resolver=null;function closeDialog(value){const r=ensureDialog();r.hidden=true;r.setAttribute('aria-hidden','true');document.body.style.removeProperty('overflow');if(resolver){const f=resolver;resolver=null;f(value)}}
function dialog(message,opts={}){const r=ensureDialog(),type=opts.type||'alert',field=r.querySelector('.f4u-dialog__field'),input=r.querySelector('#f4uDialogInput'),select=r.querySelector('#f4uDialogSelect'),cancel=r.querySelector('.f4u-dialog__cancel'),ok=r.querySelector('.f4u-dialog__confirm');r.querySelector('#f4uDialogTitle').textContent=opts.title||'filings4u';r.querySelector('#f4uDialogMessage').textContent=String(message||'');cancel.hidden=type==='alert';cancel.textContent=opts.cancelText||'Cancel';ok.textContent=opts.confirmText||(type==='alert'?'Okay':'Continue');field.hidden=type!=='prompt';input.hidden=false;select.hidden=true;if(type==='prompt'){r.querySelector('#f4uDialogLabel').textContent=opts.label||'Value';if(Array.isArray(opts.options)&&opts.options.length){input.hidden=true;select.hidden=false;select.innerHTML='';opts.options.forEach(o=>{const op=document.createElement('option');op.value=String(o.value??o);op.textContent=String(o.label??o);select.appendChild(op)});select.value=opts.value||''}else{input.value=opts.value||'';input.placeholder=opts.placeholder||''}}r.hidden=false;r.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';requestAnimationFrame(()=>((type==='prompt'?(select.hidden?input:select):ok)).focus());return new Promise(resolve=>{resolver=resolve;ok.onclick=()=>closeDialog(type==='prompt'?(select.hidden?input.value:select.value):true);r.querySelectorAll('[data-f4u-cancel]').forEach(x=>x.onclick=()=>closeDialog(type==='confirm'?false:null));input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ok.click()}}})}
if(!window.filings4uDialog)window.filings4uDialog={alert:(m,o={})=>dialog(m,{...o,type:'alert'}),confirm:(m,o={})=>dialog(m,{...o,type:'confirm'}),prompt:(m,o={})=>dialog(m,{...o,type:'prompt'})};
window.alert=function(m){window.filings4uDialog.alert(String(m??''),{title:'filings4u notice'});};
window.filings4uAuditEvent=async function(event,extra={}){try{const db=window.filings4uSupabase||window.filings4uClientSupabase||window.supabaseClient||window.filings4uDb;if(!db?.auth||!db?.functions)return false;const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return false;const {error}=await db.functions.invoke('portal-audit-event',{body:{event,source:extra.source||'portal',path:extra.path||location.pathname},headers:{Authorization:'Bearer '+session.access_token}});if(error)throw error;return true}catch(e){console.warn('[filings4u audit event]',e);return false}};

// Convert legacy page toasts into the shared branded notification surface.
// This lets older managers keep their local toast() calls while users see one consistent UI.
const legacyToastState=new WeakMap();
function legacyToastType(el,message){
  const cls=String(el?.className||'').toLowerCase(),m=String(message||'').toLowerCase();
  if(/error|danger|failed|failure/.test(cls)||/(could not|unable to|failed|error|expired|invalid|blocked|not authorized|permission denied)/.test(m))return 'error';
  if(/warning|warn/.test(cls)||/(attention|required|already|temporarily|unavailable)/.test(m))return 'warning';
  if(/success|ok/.test(cls)||/(saved|sent|submitted|uploaded|updated|created|deleted|removed|completed|paid|published|approved|restored|copied|downloaded)/.test(m))return 'success';
  return 'info';
}
function surfaceLegacyToast(el){
  if(!el||el.classList?.contains('f4u-toast'))return;
  const message=String(el.textContent||'').trim();
  if(!message||el.hidden)return;
  const prev=legacyToastState.get(el),now=Date.now();
  if(prev&&prev.message===message&&now-prev.time<1800)return;
  legacyToastState.set(el,{message,time:now});
  notify(message,legacyToastType(el,message));
  try{el.hidden=true}catch(_){ }
}
const legacyToastObserver=new MutationObserver(records=>{
  for(const r of records){
    if(r.type==='childList'){
      if(r.target?.matches?.('.toast'))surfaceLegacyToast(r.target);
      r.addedNodes?.forEach(n=>{
        if(n.nodeType!==1)return;
        if(n.matches?.('.toast'))surfaceLegacyToast(n);
        n.querySelectorAll?.('.toast').forEach(surfaceLegacyToast);
      });
    }else if(r.type==='attributes'&&r.target?.matches?.('.toast'))surfaceLegacyToast(r.target);
    else if(r.type==='characterData')surfaceLegacyToast(r.target?.parentElement?.closest?.('.toast'));
  }
});
legacyToastObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','style']});
document.querySelectorAll('.toast').forEach(surfaceLegacyToast);

// One audited sign-out path for every admin page, including older manager pages.
if(!window.filings4uSignOut)window.filings4uSignOut=async function(){
  const db=window.filings4uSupabase||window.filings4uAdminSupabase||window.supabaseClient||window.filings4uDb;
  try{await window.filings4uAuditEvent?.('logout',{source:'admin',path:location.pathname})}catch(_){ }
  try{await db?.auth?.signOut?.({scope:'local'})}catch(e){console.warn('[filings4u sign out]',e)}
  location.href='admin-login.html';
};

window.addEventListener('unhandledrejection',e=>{const m=e?.reason?.message||String(e?.reason||'Unexpected request failure.');if(m&&!/AbortError/i.test(m))window.filings4uNotify.error(m)});
})();
