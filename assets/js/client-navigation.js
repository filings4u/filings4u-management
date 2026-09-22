/**
 * filings4u Client Portal Shared Navigation
 * Centralized page targets + account dropdown.
 */
(function () {
  'use strict';

  const TARGETS = {
    dashboard: 'client-dashboard.html',
    orders: 'client-orders.html',
    filings: 'client-filings.html',
    entities: 'client-entities.html',
    documents: 'client-documents.html',
    design: 'client-design.html',
    support: 'client-support.html',
    account: 'client-account.html',
    notifications: 'client-notifications.html'
  };

  window.filings4uClientTargets = TARGETS;

  function currentPageKey() {
    const bodyKey = document.body?.dataset?.page;
    if (bodyKey) return bodyKey;

    const file = (location.pathname.split('/').pop() || '').toLowerCase();

    if (file.includes('dashboard')) return 'dashboard';
    if (file.includes('orders')) return 'orders';
    if (file.includes('filings')) return 'filings';
    if (file.includes('entities')) return 'entities';
    if (file.includes('documents')) return 'documents';
    if (file.includes('design')) return 'design';
    if (file.includes('support')) return 'support';
    if (file.includes('account')) return 'account';
    if (file.includes('notifications')) return 'notifications';

    return '';
  }

  function setActiveNav() {
    const active = currentPageKey();

    document.querySelectorAll('[data-nav-target]').forEach(link => {
      const isActive = link.dataset.navTarget === active;
      link.classList.toggle('is-active', isActive);

      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function wireTargets() {
    document.querySelectorAll('[data-nav-target]').forEach(el => {
      const key = el.dataset.navTarget;
      if (TARGETS[key]) el.setAttribute('href', TARGETS[key]);
    });

    document.querySelectorAll('[data-account-target]').forEach(el => {
      const key = el.dataset.accountTarget;
      if (TARGETS[key]) el.setAttribute('href', TARGETS[key]);
    });
  }

  function closeMenu() {
    const menu = document.getElementById('clientAccountMenu');
    const trigger = document.getElementById('clientProfileButton');

    if (!menu || !trigger) return;

    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('account-menu-open');
  }

  function openMenu() {
    const menu = document.getElementById('clientAccountMenu');
    const trigger = document.getElementById('clientProfileButton');

    if (!menu || !trigger) return;

    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('account-menu-open');
  }

  function toggleMenu() {
    const menu = document.getElementById('clientAccountMenu');
    if (!menu) return;

    if (menu.hidden) openMenu();
    else closeMenu();
  }

  function wireAccountMenu() {
    const trigger = document.getElementById('clientProfileButton');
    const menu = document.getElementById('clientAccountMenu');
    const signOut = document.getElementById('clientSignOut');

    if (!trigger || !menu) return;

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      toggleMenu();
    });

    menu.addEventListener('click', event => event.stopPropagation());

    document.addEventListener('click', closeMenu);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu();
    });

    if (signOut) {
      signOut.addEventListener('click', async event => {
        event.preventDefault();
        closeMenu();

        if (typeof window.filings4uClientSignOut === 'function') {
          await window.filings4uClientSignOut();
          return;
        }

        if (window.filings4uSupabase) {
          await window.filings4uAuditEvent?.('logout',{source:'client'});
          await window.filings4uSupabase.auth.signOut({ scope: 'local' });
        }

        location.href = 'customer-login.html';
      });
    }
  }

  function init() {
    wireTargets();
    setActiveNav();
    wireAccountMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();