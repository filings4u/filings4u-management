(function(){
'use strict';
const SITE_KEY='0x4AAAAAADP2ITOhCvv9QbYf';
const VERIFY_URL='https://lrbimrlbskjweynxlgas.supabase.co/functions/v1/turnstile-verify';
const ACTIONS={
  'admin-login.html':'admin_login',
  'customer-login.html':'client_login',
  'forgot-password.html':'client_forgot',
  'reset-password.html':'client_reset',
  'admin-forgot-password.html':'admin_forgot',
  'admin-reset-password.html':'admin_reset'
};
let widgetId=null,token='',readyResolve;
const ready=new Promise(r=>readyResolve=r);
function page(){return (location.pathname.split('/').pop()||'').toLowerCase()}
function action(){return ACTIONS[page()]||document.body?.dataset?.turnstileAction||''}
function form(){return document.querySelector('form')}
function showError(text){
  const m=document.getElementById('message');
  if(m){m.textContent=text;m.className='message error';m.hidden=false;return}
  let e=document.querySelector('.turnstile-inline-error');
  if(!e){e=document.createElement('div');e.className='turnstile-inline-error';e.setAttribute('role','alert');const f=form();f?.prepend(e)}
  e.textContent=text;
}
function reset(){token='';if(window.turnstile&&widgetId!==null){try{window.turnstile.reset(widgetId)}catch(_){}}}
function render(){
  const f=form(),a=action(); if(!f||!a||!window.turnstile)return;
  let host=f.querySelector('.f4u-turnstile');
  if(!host){host=document.createElement('div');host.className='f4u-turnstile';const submit=f.querySelector('[type="submit"]');submit?f.insertBefore(host,submit):f.appendChild(host)}
  widgetId=window.turnstile.render(host,{
    sitekey:SITE_KEY,action:a,theme:'auto',size:'flexible',
    callback:t=>{token=t;readyResolve?.(true)},
    'expired-callback':()=>{token='';},
    'error-callback':()=>{token='';showError('Security verification could not load. Refresh the page and try again.');}
  });
}
async function verify(){
  const a=action(); if(!a)return true;
  if(!token)throw new Error('Please complete the security verification.');
  const r=await fetch(VERIFY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:a})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.ok!==true){reset();throw new Error('Security verification failed. Please try again.');}
  reset();
  return true;
}
window.F4UTurnstile={verify,reset,getToken:()=>token,ready};
function load(){
  if(window.turnstile){render();return}
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.defer=true;s.onload=render;s.onerror=()=>showError('Security verification could not load. Refresh the page and try again.');document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
