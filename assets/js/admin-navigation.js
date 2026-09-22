(function(){
'use strict';

const TARGETS = Object.freeze({
  overview: 'admin-dashboard.html',
  orders: 'admin-orders.html',
  invoices: 'admin-invoices.html',
  applications: 'admin-applications.html',
  clientForms: 'admin-client-forms.html',
  clients: 'admin-clients.html',
  entities: 'admin-entities.html',
  services: 'admin-services.html',
  design: 'admin-design.html',
  documents: 'admin-documents.html',
  support: 'admin-support.html',
  messages: 'admin-messages.html',
  staff: 'admin-staff.html',
  audit: 'admin-audit.html',
  settings: 'admin-settings.html',

  // Added pages — the original navigation above is intentionally preserved.
  customers: 'admin-customers.html',
  orderIntake: 'admin-order-intake.html',
  invoiceManagement: 'admin-invoice-management.html',
  compliance: 'admin-compliance.html',
  accounting: 'admin-accounting.html',
  tasks: 'admin-tasks.html',
  calendar: 'admin-calendar.html',
  notifications: 'admin-notifications.html',
  activity: 'admin-activity.html',
  pages: 'admin-pages.html',
  blog: 'admin-blog.html',
  faqs: 'admin-faqs.html',
  knowledge: 'admin-knowledge.html',
  media: 'admin-media.html',
  users: 'admin-users.html',
  automations: 'admin-automations.html',
  integrations: 'admin-integrations.html',
  security: 'admin-security.html',
  logs: 'admin-logs.html',
  management: 'admin-management.html'
});

const GROUPS = [
  {
    key: 'operations',
    label: 'Operations',
    items: [
      // Original items — unchanged.
      ['overview','Overview','▦'],
      ['orders','Orders','▤'],
      ['invoices','Invoices & Billing','$'],
      ['applications','Applications & Filings','◫'],
      ['clientForms','Client Forms','▧'],
      ['clients','Clients','◎'],
      ['entities','Business Entities','◇'],

      // Missing operational pages added below the originals.
      ['customers','Customers','◉'],
      ['orderIntake','Order Intake','＋'],
      ['invoiceManagement','Invoice Management','▧'],
      ['compliance','Compliance','✓'],
      ['accounting','Accounting & Books','＄'],
      ['tasks','Tasks','☑'],
      ['calendar','Calendar','□'],
      ['notifications','Notifications','○'],
      ['activity','Activity','↻']
    ]
  },
  {
    key: 'service',
    label: 'Service Management',
    items: [
      // Original items — unchanged.
      ['services','Services & Pricing','☷'],
      ['design','Design Projects','✦'],
      ['documents','Documents','▱'],
      ['support','Support Tickets','◌'],
      ['messages','Messages','✉']
    ]
  },
  {
    key: 'content',
    label: 'Content Management',
    items: [
      ['pages','Pages','▤'],
      ['blog','Blog','¶'],
      ['faqs','FAQs','?'],
      ['knowledge','Knowledge Center','▧'],
      ['media','Media','▣']
    ]
  },
  {
    key: 'administration',
    label: 'Administration',
    items: [
      // Original items — unchanged and kept first.
      ['staff','Staff & Access','♙'],
      ['audit','Audit & System Logs','⌁'],
      ['settings','Platform Settings','⚙'],

      // Missing administration pages.
      ['users','Users & Roles','◎'],
      ['automations','Automations','◇'],
      ['integrations','Integrations','⌘'],
      ['security','Security','⌾'],
      ['logs','System Logs','▤'],
      ['management','Management System','▦']
    ]
  }
];

function currentPageKey(){
  const file=(location.pathname.split('/').pop()||'admin-portal-shell.html').toLowerCase();
  return Object.entries(TARGETS).find(([,target])=>target.toLowerCase()===file)?.[0] || document.body.dataset.page || 'overview';
}

function activeGroupFor(page){
  return GROUPS.find(group=>group.items.some(([key])=>key===page))?.key || 'operations';
}

function shellMarkup(page){
  const activeGroup=activeGroupFor(page);
  return `
    <header class="admin-header">
      <div class="admin-header__left">
        <button class="admin-mobile-toggle" id="adminMobileToggle" type="button" aria-label="Open administration navigation" aria-expanded="false">☰</button>
        <button class="admin-desktop-toggle" id="adminDesktopToggle" type="button" aria-label="Hide administration navigation" aria-pressed="false">☰</button>
        <a class="admin-brand" href="${TARGETS.overview}">
          <img src="images/logo.png" alt="filings4u" class="admin-logo">
          <span class="admin-brand-divider" aria-hidden="true"></span>
          <span class="admin-brand-label">Administration</span>
        </a>
      </div>

      <div class="admin-account">
        <button class="admin-profile" id="adminProfileButton" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="adminAccountMenu">
          <span class="admin-avatar" id="adminAvatar">A</span>
          <span class="admin-profile-copy">
            <strong id="adminName">Administrator</strong>
            <small id="adminEmail">Checking access…</small>
          </span>
          <span class="admin-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="admin-account-menu" id="adminAccountMenu" role="menu" hidden>
          <div class="admin-menu-profile">
            <span class="admin-menu-avatar" id="adminMenuAvatar">A</span>
            <div><strong id="adminMenuName">Administrator</strong><small id="adminMenuRole">Management access</small></div>
          </div>
          <div class="admin-menu-links">
            <a href="${TARGETS.staff}" data-admin-target="staff">Staff & Access</a>
            <a href="${TARGETS.audit}" data-admin-target="audit">Audit & System Logs</a>
            <a href="${TARGETS.settings}" data-admin-target="settings">Platform Settings</a>
          </div>
          <button id="signOut" class="admin-signout" type="button">Sign out</button>
        </div>
      </div>
    </header>

    <div class="admin-sidebar-backdrop" id="adminSidebarBackdrop"></div>

    <aside class="admin-sidebar" id="adminSidebar" aria-label="Administration navigation">
      <div class="admin-sidebar__intro">
        <span class="admin-sidebar__eyebrow"><i></i> Management system</span>
        <strong>Administration</strong>
        <small>filings4u operations</small>
      </div>

      <nav class="admin-accordion">
        ${GROUPS.map(group=>`
          <section class="admin-nav-group ${group.key===activeGroup?'is-open':''}" data-admin-group="${group.key}">
            <button class="admin-nav-toggle" type="button" aria-expanded="${group.key===activeGroup?'true':'false'}">
              <span>${group.label}</span><span class="admin-nav-chevron">⌄</span>
            </button>
            <div class="admin-nav-panel" ${group.key===activeGroup?'':'hidden'}>
              ${group.items.map(([key,label,icon])=>`
                <a href="${TARGETS[key]}" data-admin-target="${key}" class="admin-nav-item ${key===page?'is-active':''}">
                  <span class="admin-nav-icon">${icon}</span><span>${label}</span>
                </a>`).join('')}
            </div>
          </section>`).join('')}
      </nav>

      <div class="admin-sidebar__footer">
        <span>Secure admin workspace</span>
        <small>filings4u, LLC</small>
      </div>
    </aside>`;
}

function closeSidebar(){
  document.body.classList.remove('admin-nav-open');
  const btn=document.getElementById('adminMobileToggle');
  if(btn) btn.setAttribute('aria-expanded','false');
}


function applyDesktopSidebarState(collapsed){
  document.body.classList.toggle('admin-sidebar-collapsed',collapsed);
  const btn=document.getElementById('adminDesktopToggle');
  if(btn){
    btn.setAttribute('aria-pressed',String(collapsed));
    btn.setAttribute('aria-label',collapsed?'Show administration navigation':'Hide administration navigation');
    btn.title=collapsed?'Show navigation':'Hide navigation';
  }
}

function wireDesktopSidebar(){
  const button=document.getElementById('adminDesktopToggle');
  if(!button) return;
  let collapsed=false;
  try{ collapsed=localStorage.getItem('filings4u-admin-sidebar')==='collapsed'; }catch(_){}
  applyDesktopSidebarState(collapsed);
  button.addEventListener('click',()=>{
    collapsed=!document.body.classList.contains('admin-sidebar-collapsed');
    applyDesktopSidebarState(collapsed);
    try{ localStorage.setItem('filings4u-admin-sidebar',collapsed?'collapsed':'open'); }catch(_){}
  });
}

function wireAccordion(){
  document.querySelectorAll('.admin-nav-toggle').forEach(button=>{
    button.addEventListener('click',()=>{
      const current=button.closest('.admin-nav-group');
      const opening=!current.classList.contains('is-open');

      document.querySelectorAll('.admin-nav-group').forEach(group=>{
        const open=group===current && opening;
        group.classList.toggle('is-open',open);
        const toggle=group.querySelector('.admin-nav-toggle');
        const panel=group.querySelector('.admin-nav-panel');
        toggle?.setAttribute('aria-expanded',String(open));
        if(panel) panel.hidden=!open;
      });
    });
  });
}

function wireAccountMenu(){
  const button=document.getElementById('adminProfileButton');
  const menu=document.getElementById('adminAccountMenu');
  if(!button||!menu) return;

  function close(){
    menu.hidden=true;
    button.setAttribute('aria-expanded','false');
  }
  button.addEventListener('click',event=>{
    event.stopPropagation();
    const opening=menu.hidden;
    menu.hidden=!opening;
    button.setAttribute('aria-expanded',String(opening));
  });
  menu.addEventListener('click',event=>event.stopPropagation());
  document.addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
}

async function hydrateAdmin(){
  try{
    const db=window.filings4uSupabase;
    if(!db) return;
    const {data:userData}=await db.auth.getUser();
    const user=userData?.user;
    if(!user) return;
    const {data:admin}=await db.from('admin_profiles')
      .select('first_name,last_name,email_address,role')
      .eq('id',user.id).maybeSingle();

    const name=[admin?.first_name,admin?.last_name].filter(Boolean).join(' ') || 'Administrator';
    const email=admin?.email_address || user.email || 'Administrator';
    const role=(admin?.role || 'Management access').replace(/_/g,' ');
    const initial=(admin?.first_name || user.email || 'A').charAt(0).toUpperCase();

    const values={
      adminName:name,adminEmail:email,adminAvatar:initial,
      adminMenuName:name,adminMenuAvatar:initial,adminMenuRole:role
    };
    Object.entries(values).forEach(([id,value])=>{
      const el=document.getElementById(id);
      if(el) el.textContent=value;
    });
  }catch(error){
    console.warn('[filings4u admin navigation]',error);
  }
}

function init(){
  const page=currentPageKey();
  document.body.dataset.page=page;
  document.body.classList.add('admin-shell-ready');

  const mount=document.getElementById('adminNavigationMount');
  if(mount) mount.innerHTML=shellMarkup(page);
  else document.body.insertAdjacentHTML('afterbegin',shellMarkup(page));

  wireAccordion();
  wireDesktopSidebar();
  wireAccountMenu();

  document.getElementById('adminMobileToggle')?.addEventListener('click',()=>{
    const open=document.body.classList.toggle('admin-nav-open');
    document.getElementById('adminMobileToggle')?.setAttribute('aria-expanded',String(open));
  });
  document.getElementById('adminSidebarBackdrop')?.addEventListener('click',closeSidebar);
  document.querySelectorAll('[data-admin-target]').forEach(link=>link.addEventListener('click',closeSidebar));

  const signOut=document.getElementById('signOut');
  if(signOut){
    signOut.addEventListener('click',async()=>{
      if(window.filings4uSignOut) return window.filings4uSignOut();
      await window.filings4uAuditEvent?.('logout',{source:'admin'});
      if(window.filings4uSupabase) await window.filings4uSupabase.auth.signOut({ scope: 'local' });
      location.href='admin-login.html';
    });
  }

  hydrateAdmin();
}

window.filings4uAdminTargets=TARGETS;
window.filings4uAdminNavigation={currentPageKey,closeSidebar};

let navigationInitialized=false;
function startNavigation(){
  if(navigationInitialized) return;
  navigationInitialized=true;
  init();
}

/*
 * Admin pages load navigation.js at the end of <body>, before their page-specific JS.
 * The mount already exists at that point even if document.readyState is still "loading".
 * Initialize immediately so #signOut, #adminEmail, and the shared shell exist before
 * page-specific scripts bind to them.
 */
if(document.getElementById('adminNavigationMount')){
  startNavigation();
}else if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',startNavigation,{once:true});
}else{
  startNavigation();
}
})();