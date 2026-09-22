(async function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const body=document.body;
  const sidebar=$('#managementSidebar');
  const mobileToggle=$('#managementMobileToggle');
  const desktopToggle=$('#managementDesktopToggle');
  const sidebarBackdrop=$('#managementSidebarBackdrop');
  const profileButton=$('#managementProfileButton');
  const profileMenu=$('#managementProfileMenu');
  const createMenu=$('#createMenu');
  const createTrigger=$('#createMenuTrigger');
  const searchDialog=$('#globalSearchDialog');
  const searchInput=$('#globalSearchInput');
  const dialogRoot=$('#filings4uDialog');
  const dialogTitle=$('#filings4uDialogTitle');
  const dialogKicker=$('#filings4uDialogKicker');
  const dialogMessage=$('#filings4uDialogMessage');
  const dialogField=$('#filings4uDialogField');
  const dialogFieldLabel=$('#filings4uDialogFieldLabel');
  const dialogInput=$('#filings4uDialogInput');
  const dialogSelect=$('#filings4uDialogSelect');
  const dialogHelp=$('#filings4uDialogHelp');
  const dialogCancel=$('#filings4uDialogCancel');
  const dialogConfirm=$('#filings4uDialogConfirm');
  let dialogResolve=null;
  function finishDialog(value){if(!dialogRoot)return;if(dialogResolve){const done=dialogResolve;dialogResolve=null;done(value)}dialogRoot.hidden=true;dialogRoot.setAttribute('aria-hidden','true');body.classList.remove('management-modal-open');}
  function openDialog(options={}){
    if(!dialogRoot)return Promise.resolve(options.type==='confirm'?false:null);
    if(dialogResolve)finishDialog(null);
    const type=options.type||'alert';
    dialogKicker.textContent=options.kicker||'filings4u Management';dialogTitle.textContent=options.title||'Notice';dialogMessage.textContent=options.message||'';
    dialogCancel.hidden=type==='alert';dialogCancel.textContent=options.cancelText||'Cancel';dialogConfirm.textContent=options.confirmText||(type==='alert'?'Okay':'Continue');
    dialogField.hidden=type!=='prompt';dialogInput.hidden=false;dialogSelect.hidden=true;dialogHelp.hidden=!options.help;dialogHelp.textContent=options.help||'';
    if(type==='prompt'){
      dialogFieldLabel.textContent=options.label||'Value';
      if(Array.isArray(options.options)&&options.options.length){dialogInput.hidden=true;dialogSelect.hidden=false;dialogSelect.innerHTML=options.options.map(o=>`<option value="${String(o.value??o).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">${String(o.label??o).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');dialogSelect.value=options.value||''}
      else{dialogInput.value=options.value||'';dialogInput.placeholder=options.placeholder||''}
    }
    dialogRoot.hidden=false;dialogRoot.setAttribute('aria-hidden','false');body.classList.add('management-modal-open');
    requestAnimationFrame(()=>{(type==='prompt'?(dialogSelect.hidden?dialogInput:dialogSelect):dialogConfirm)?.focus()});
    return new Promise(resolve=>{dialogResolve=resolve});
  }
  window.filings4uDialog={
    alert:(message,options={})=>openDialog({...options,type:'alert',message}),
    confirm:(message,options={})=>openDialog({...options,type:'confirm',message}),
    prompt:(message,options={})=>openDialog({...options,type:'prompt',message})
  };
  dialogConfirm?.addEventListener('click',()=>{const fieldValue=dialogSelect && !dialogSelect.hidden?dialogSelect.value:dialogInput?.value;finishDialog(dialogField?.hidden?true:fieldValue)});
  dialogCancel?.addEventListener('click',()=>finishDialog(null));
  dialogRoot?.querySelectorAll('[data-dialog-dismiss]').forEach(el=>el.addEventListener('click',()=>finishDialog(null)));
  dialogInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dialogConfirm?.click()}});

  // Preserve the existing protected-page contract. If the guard returns auth,
  // use the signed-in user's safe identity fields for the shell. The management
  // UI does not make authorization decisions from user-editable metadata.
  try{
    const auth=await window.filings4uRequireAdmin?.();
    if(window.filings4uRequireAdmin && !auth)return;
    const user=auth?.user || auth?.session?.user || null;
    if(user){
      const email=user.email || 'Admin account';
      const appMeta=user.app_metadata || {};
      const safeName=appMeta.display_name || appMeta.name || email.split('@')[0] || 'Administrator';
      const initials=safeName.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase() || 'AD';
      $$('[data-admin-name]').forEach(el=>el.textContent=safeName);
      $$('[data-admin-email]').forEach(el=>el.textContent=email);
      $$('[data-admin-initials]').forEach(el=>el.textContent=initials);
    }
  }catch(error){
    console.error('[filings4u management shell] auth bootstrap failed',error);
  }

  const routes=new Set($$('.management-view').map(el=>el.dataset.view));
  function normalizeRoute(value){
    const route=String(value||'home').replace(/^#/,'').trim();
    return routes.has(route)?route:'home';
  }
  function closeMobileNav(){
    body.classList.remove('mobile-nav-open');
    mobileToggle?.setAttribute('aria-expanded','false');
  }
  function setRoute(route,{updateHash=true}={}){
    route=normalizeRoute(route);
    $$('.management-view').forEach(view=>view.classList.toggle('is-active',view.dataset.view===route));
    $$('[data-route]').forEach(link=>link.classList.toggle('is-active',link.dataset.route===route));
    const active=$(`[data-route="${CSS.escape(route)}"]`);
    const group=active?.closest('[data-nav-group]');
    if(group){
      group.classList.add('is-open');
      const toggle=group.querySelector('.management-nav-group__toggle');
      const panel=group.querySelector('.management-nav-group__panel');
      toggle?.setAttribute('aria-expanded','true');
      if(panel)panel.hidden=false;
    }
    body.dataset.page=`management-${route}`;
    document.title=`filings4u Admin | ${route==='home'?'Management System':route.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}`;
    if(updateHash && location.hash!==`#${route}`)history.pushState(null,'',`#${route}`);
    closeMobileNav();
    $('#managementMain')?.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }

  $$('[data-route-button]').forEach(el=>el.addEventListener('click',()=>{
    closeCreate(); closeSearch(); setRoute(el.dataset.routeButton);
  }));
  $$('[data-route]').forEach(el=>el.addEventListener('click',e=>{
    e.preventDefault(); setRoute(el.dataset.route);
  }));
  window.addEventListener('hashchange',()=>setRoute(location.hash,{updateHash:false}));
  setRoute(location.hash,{updateHash:false});

  $$('[data-nav-group]').forEach(group=>{
    const toggle=group.querySelector('.management-nav-group__toggle');
    const panel=group.querySelector('.management-nav-group__panel');
    toggle?.addEventListener('click',()=>{
      const open=!group.classList.contains('is-open');
      group.classList.toggle('is-open',open);
      toggle.setAttribute('aria-expanded',String(open));
      if(panel)panel.hidden=!open;
    });
  });

  desktopToggle?.addEventListener('click',()=>{
    const collapsed=body.classList.toggle('sidebar-collapsed');
    desktopToggle.setAttribute('aria-expanded',String(!collapsed));
    localStorage.setItem('filings4u-management-sidebar',collapsed?'collapsed':'open');
  });
  if(localStorage.getItem('filings4u-management-sidebar')==='collapsed'){
    body.classList.add('sidebar-collapsed');
    desktopToggle?.setAttribute('aria-expanded','false');
  }
  mobileToggle?.addEventListener('click',()=>{
    const open=body.classList.toggle('mobile-nav-open');
    mobileToggle.setAttribute('aria-expanded',String(open));
  });
  sidebarBackdrop?.addEventListener('click',closeMobileNav);

  function closeProfile(){if(profileMenu)profileMenu.hidden=true;profileButton?.setAttribute('aria-expanded','false')}
  profileButton?.addEventListener('click',e=>{
    e.stopPropagation();
    const open=profileMenu?.hidden!==false;
    if(profileMenu)profileMenu.hidden=!open;
    profileButton.setAttribute('aria-expanded',String(open));
  });

  function openCreate(){
    if(!createMenu)return;
    closeProfile();closeSearch();createMenu.hidden=false;body.classList.add('is-locked');createTrigger?.setAttribute('aria-expanded','true');
  }
  function closeCreate(){if(createMenu)createMenu.hidden=true;body.classList.remove('is-locked');createTrigger?.setAttribute('aria-expanded','false')}
  createTrigger?.addEventListener('click',openCreate);
  $$('[data-open-create]').forEach(el=>el.addEventListener('click',openCreate));
  $$('[data-close-create]').forEach(el=>el.addEventListener('click',closeCreate));
  createMenu?.addEventListener('click',e=>{if(e.target===createMenu)closeCreate()});

  function openSearch(){
    if(!searchDialog)return;
    closeProfile();closeCreate();searchDialog.hidden=false;body.classList.add('is-locked');
    requestAnimationFrame(()=>searchInput?.focus());
  }
  function closeSearch(){if(searchDialog)searchDialog.hidden=true;body.classList.remove('is-locked');if(searchInput){searchInput.value='';filterSearch('')}}
  $('#globalSearchTrigger')?.addEventListener('click',openSearch);
  $$('[data-open-search]').forEach(el=>el.addEventListener('click',openSearch));
  $$('[data-close-search]').forEach(el=>el.addEventListener('click',closeSearch));
  searchDialog?.addEventListener('click',e=>{if(e.target===searchDialog)closeSearch()});

  function filterSearch(value){
    const q=String(value||'').trim().toLowerCase();
    let visible=0;
    $$('#searchDestinations > *').forEach(item=>{
      const haystack=`${item.dataset.searchKeywords||''} ${item.textContent||''}`.toLowerCase();
      const show=!q || haystack.includes(q);
      item.hidden=!show;if(show)visible++;
    });
    const empty=$('#searchEmpty');if(empty)empty.hidden=visible!==0;
  }
  searchInput?.addEventListener('input',()=>filterSearch(searchInput.value));

  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch()}
    if(e.key==='Escape'){closeProfile();closeCreate();closeSearch();closeMobileNav()}
  });
  document.addEventListener('click',e=>{
    if(profileMenu && !profileMenu.hidden && !e.target.closest('.management-account'))closeProfile();
  });

  $('#managementSignOut')?.addEventListener('click',async()=>{await window.filings4uSignOut?.()});
})();
