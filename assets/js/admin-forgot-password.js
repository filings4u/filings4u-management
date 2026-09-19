const db=window.filings4uSupabase;
const $=id=>document.getElementById(id);
let submitting=false;

function showMessage(text,type='error'){
  $('message').textContent=text;
  $('message').className=`message ${type}`;
  $('message').hidden=false;
}

function resetRedirectUrl(){
  return new URL('admin-reset-password.html',window.location.href).href;
}

$('forgotForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(submitting)return;

  const email=$('email').value.trim().toLowerCase();
  if(!email)return showMessage('Enter your email address.');

  submitting=true;
  $('submit').disabled=true;
  $('submit').textContent='Sending…';
  $('message').hidden=true;

  try{await window.F4UTurnstile.verify();
    if(!db)throw new Error('Secure account service failed to load.');

    const {error}=await db.auth.resetPasswordForEmail(email,{
      redirectTo:resetRedirectUrl()
    });

    if(error){
      if(error.status===429||/rate/i.test(error.message||'')){
        throw new Error('Too many reset requests. Please wait a few minutes and try again.');
      }
      console.warn('Password reset request error:',error.message);
    }

    showMessage('If that email is associated with a filings4u administrator account, a password-reset link has been sent. Please check your inbox and spam folder.','ok');
    $('forgotForm').reset();
  }catch(error){
    showMessage(error.message||'Unable to request a password reset right now.');
  }finally{
    submitting=false;
    $('submit').disabled=false;
    $('submit').textContent='Send reset link';
  }
});
