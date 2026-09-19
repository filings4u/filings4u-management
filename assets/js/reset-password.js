const db=window.filings4uSupabase;
const $=id=>document.getElementById(id);
const MIN_PASSWORD=8;
let ready=false;
let saving=false;

function showMessage(text,type='error'){
  $('message').textContent=text;
  $('message').className=`message ${type}`;
  $('message').hidden=false;
}

async function establishLinkSession(){
  if(!db)throw new Error('Secure account service failed to load.');

  const url=new URL(window.location.href);
  const tokenHash=url.searchParams.get('token_hash');
  const type=url.searchParams.get('type');

  if(tokenHash&&type){
    const allowed=new Set(['invite','recovery','signup','email']);
    if(!allowed.has(type))throw new Error('This password link type is not supported.');

    const {error}=await db.auth.verifyOtp({
      token_hash:tokenHash,
      type
    });

    if(error)throw error;

    url.searchParams.delete('token_hash');
    url.searchParams.delete('type');
    history.replaceState({},'',url.pathname+url.search+url.hash);
  }

  // detectSessionInUrl handles standard Supabase invite/recovery hash links.
  // Give it one microtask before verifying the authenticated user.
  await new Promise(resolve=>setTimeout(resolve,50));

  const {data,error}=await db.auth.getUser();
  if(error||!data?.user){
    throw new Error('This password link is invalid, expired, or has already been used.');
  }

  const user=data.user;

    const {data:profile,error:profileError}=await db
      .from('client_profiles')
      .select('id,email_address')
      .eq('id',user.id)
      .maybeSingle();

    if(profileError)throw profileError;

    if(!profile){
      await db.auth.signOut({scope:'local'});
      throw new Error('This link is not associated with a filings4u client account.');
    }

  return user;
}

async function boot(){
  try{
    const user=await establishLinkSession();
    ready=true;
    $('resetForm').hidden=false;
    $('pageText').textContent='Choose a new password for '+(user.email||'your account')+'.';
    showMessage('Secure link verified. You can now set your password.','ok');
    setTimeout(()=>$('password').focus(),100);
  }catch(error){
    console.warn('Password setup link failed:',error.message);
    $('resetForm').hidden=true;
    showMessage(error.message||'Unable to verify this password link.');
  }
}

$('resetForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!ready||saving)return;

  const password=$('password').value;
  const confirm=$('confirmPassword').value;

  if(password.length<MIN_PASSWORD){
    return showMessage(`Your password must be at least ${MIN_PASSWORD} characters.`);
  }
  if(password!==confirm){
    return showMessage('The passwords do not match.');
  }

  saving=true;
  $('submit').disabled=true;
  const old=$('submit').textContent;
  $('submit').textContent='Saving…';

  try{
    await window.F4UTurnstile.verify();
    const {error}=await db.auth.updateUser({password});
    if(error)throw error;

    showMessage('Password saved. Redirecting you to sign in…','ok');
    await db.auth.signOut({scope:'local'});
    setTimeout(()=>location.replace('customer-login.html'),700);
  }catch(error){
    showMessage(error.message||'Unable to save your password.');
  }finally{
    saving=false;
    $('submit').disabled=false;
    $('submit').textContent=old;
  }
});

document.querySelectorAll('[data-toggle]').forEach(button=>{
  button.addEventListener('click',()=>{
    const input=$(button.dataset.toggle);
    const visible=input.type==='text';
    input.type=visible?'password':'text';
    button.textContent=visible?'Show':'Hide';
    button.setAttribute('aria-label',visible?'Show password':'Hide password');
  });
});

boot();
