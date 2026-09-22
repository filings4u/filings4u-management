(function(){
'use strict';

const db=window.filings4uAdminSupabase||window.filings4uSupabase||window.supabaseClient;
const $=id=>document.getElementById(id);
const TIMEOUT_MS=10*60*1000;

function msg(text,type='error'){window.filings4uNotify?.[type==='ok'||type==='success'?'success':'error']?.(text);
  const el=$('message');
  if(!el)return;
  el.textContent=text;
  el.className='message '+type;
  el.hidden=false;
}

function activityKey(userId){return 'f4u:session:last_activity:'+userId}
function resetActivityForUser(userId){
  if(!userId)return;
  try{localStorage.setItem(activityKey(userId),String(Date.now()));}catch(_){}
}
function sessionIsStale(userId){
  if(!userId)return true;
  try{
    const last=Number(localStorage.getItem(activityKey(userId))||0);
    return !last || Date.now()-last>=TIMEOUT_MS;
  }catch(_){return true}
}
function clearActivity(userId){
  if(!userId)return;
  try{localStorage.removeItem(activityKey(userId));}catch(_){}
}

function nextPage(){
  const p=new URLSearchParams(location.search);
  const raw=p.get('returnTo')||p.get('next')||'admin-dashboard.html';
  if(raw.includes('://')||raw.startsWith('//')||raw.startsWith('/'))return 'admin-dashboard.html';
  if(!/^admin-[a-z0-9 _-]+\.html(?:[?#].*)?$/i.test(raw))return 'admin-dashboard.html';
  if(/^admin-(login|forgot-password|reset-password)\.html/i.test(raw))return 'admin-dashboard.html';
  return raw;
}

async function verifyCurrentSession(){
  if(!db)return null;
  const {data:{session}}=await db.auth.getSession();
  if(!session?.user?.id)return null;

  if(sessionIsStale(session.user.id)){
    clearActivity(session.user.id);
    try{await db.auth.signOut({scope:'local'});}catch(_){}
    return null;
  }

  const {data,error}=await db.functions.invoke('admin-auth-check',{
    body:{action:'verify'},
    headers:{Authorization:'Bearer '+session.access_token}
  });
  if(error||data?.ok!==true)return null;
  return {session,admin:data.admin};
}

(async()=>{
  if(!db){
    msg('The secure sign-in service could not load. Refresh the page and try again.');
    return;
  }
  const p=new URLSearchParams(location.search);
  if(p.get('reason')==='admin_required')msg('That account is not an active filings4u administrator.');
  if(p.get('reason')==='session_timeout')msg('Your secure session became inactive for 10 minutes. Please sign in again to continue.','ok');
  if(p.get('reason')==='session_expired')msg('Please sign in to access the Administration portal.','ok');
  if(p.get('reason')==='login_required')msg('Please sign in to access the Administration portal.','ok');
  if(p.get('reason')==='signed_out')msg('You have been signed out securely.','ok');
  try{
    const current=await verifyCurrentSession();
    if(current){
      msg('Already signed in. Redirecting…','ok');
      location.replace(nextPage());
    }
  }catch(e){
    console.error('[filings4u admin login bootstrap]',e);
  }
})();

$('loginForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const submit=$('submit');
  submit.disabled=true;
  if($('message'))$('message').hidden=true;

  try{
    await window.F4UTurnstile.verify();
    if(!db)throw new Error('The secure sign-in service is unavailable.');

    const email=$('email').value.trim();
    const password=$('password').value;
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!data?.session?.access_token)throw new Error('A secure session was not created.');

    const {data:check,error:checkError}=await db.functions.invoke('admin-auth-check',{
      body:{action:'verify'},
      headers:{Authorization:'Bearer '+data.session.access_token}
    });

    if(checkError||check?.ok!==true){
      try{await db.auth.signOut({scope:'local'});}catch(_){}
      const reason=check?.error||checkError?.message||'verification_failed';
      throw new Error(reason==='admin_required'
        ?'This account is not an active filings4u administrator.'
        :'Administrator access could not be verified: '+reason);
    }

    resetActivityForUser(data.user?.id || data.session?.user?.id);
    await window.filings4uAuditEvent?.('login',{source:'admin'});
    msg('Sign in successful. Opening management…','ok');
    location.replace(nextPage());
  }catch(error){
    console.error('[filings4u admin sign in]',error);
    msg(error?.message||'Unable to sign in.');
  }finally{
    submit.disabled=false;
  }
});

$('togglePassword')?.addEventListener('click',()=>{
  const input=$('password');
  input.type=input.type==='password'?'text':'password';
  $('togglePassword').textContent=input.type==='password'?'Show':'Hide';
});

$('signOutExisting')?.addEventListener('click',async()=>{
  if(db){
    const {data:{session}}=await db.auth.getSession().catch(()=>({data:{session:null}}));
    clearActivity(session?.user?.id);
    await window.filings4uAuditEvent?.('logout',{source:'admin'});
    await db.auth.signOut({scope:'local'});
  }
  msg('Admin session signed out.','ok');
});
})();
