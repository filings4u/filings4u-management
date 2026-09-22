/**
 * filings4u admin protected-page guard
 * Every admin page requires a valid Supabase session + active admin authorization.
 * After 10 minutes of inactivity, the next protected-page access/action requires login again.
 */
(function(){
'use strict';

const root=document.documentElement;
const TIMEOUT_MS=10*60*1000;
root.classList.add('f4u-auth-pending');

const db=()=>window.filings4uAdminSupabase||window.filings4uSupabase||window.supabaseClient||null;
const target=()=> (location.pathname.split('/').pop()||'admin-management.html')+location.search+location.hash;

function loginUrl(reason){
  let u='admin-login.html?returnTo='+encodeURIComponent(target());
  if(reason)u+='&reason='+encodeURIComponent(reason);
  return u;
}
function deny(reason){
  root.classList.remove('f4u-auth-ready');
  root.classList.add('f4u-auth-pending');
  location.replace(loginUrl(reason||'login_required'));
  return null;
}
function reveal(){
  root.classList.remove('f4u-auth-pending');
  root.classList.add('f4u-auth-ready');
}
async function staleSession(client,userId){
  const security=window.filings4uSessionSecurity;
  const stale=security?.isExpired ? security.isExpired(userId,TIMEOUT_MS) : true;
  if(!stale)return false;
  security?.clearForUser?.(userId);
  try{await window.filings4uAuditEvent?.('session_timeout',{source:'admin',path:location.pathname});}catch(_){}
  try{await client.auth.signOut({scope:'local'});}catch(_){}
  return true;
}

async function verifyAdmin(){
  const client=db();
  if(!client)return deny('auth_unavailable');

  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError||!session?.access_token||!session?.user?.id)return deny('login_required');

  // Do not reveal an admin page if the prior activity is older than 10 minutes.
  if(await staleSession(client,session.user.id))return deny('session_timeout');

  const {data,error}=await client.functions.invoke('admin-auth-check',{
    body:{action:'verify'},
    headers:{Authorization:'Bearer '+session.access_token}
  });

  if(error||data?.ok!==true){
    try{await client.auth.signOut({scope:'local'});}catch(_){}
    return deny(data?.error||'admin_required');
  }

  window.filings4uSessionSecurity?.start({
    db:client,
    user:session.user,
    portal:'admin',
    loginPage:'admin-login.html',
    timeoutMs:TIMEOUT_MS
  });

  reveal();
  return {
    db:client,
    supabase:client,
    user:session.user,
    session,
    adminProfile:data.admin,
    isAdmin:true
  };
}

let ready;
window.filings4uRequireAdmin=function(){
  if(!ready)ready=verifyAdmin();
  return ready;
};
window.filings4uAdminReady=window.filings4uRequireAdmin();

const client=db();
if(client?.auth?.onAuthStateChange){
  client.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT')deny('session_expired');
  });
}
})();
