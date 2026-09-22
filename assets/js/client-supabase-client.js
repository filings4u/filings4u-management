(function(){'use strict';
const URL='https://lrbimrlbskjweynxlgas.supabase.co',KEY='sb_publishable_RlmqwQM8ATOc7-ML9hvwgw_UljUEavh';
if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('Supabase JS v2 is required.');
if(!window.filings4uClientSupabase){
  window.filings4uClientSupabase=window.supabase.createClient(URL,KEY,{auth:{
    persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,
    storageKey:'filings4u-client-auth',flowType:'pkce'
  }});
}
window.filings4uSupabase=window.filings4uClientSupabase;
window.filings4uClientSignOut=async()=>{await window.filings4uAuditEvent?.('logout',{source:'client'});await window.filings4uClientSupabase.auth.signOut({scope:'local'});location.href='customer-login.html';};
})();