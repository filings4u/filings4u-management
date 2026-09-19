/**
 * filings4u Management — Shared Navigation
 * One source of truth for every management page.
 *
 * Required target on every management HTML page:
 * <nav class="management-nav" id="managementNavigation" data-management-navigation></nav>
 */
(function () {
  "use strict";

  const groups = [
    {
      key: "websites",
      label: "Websites",
      items: [
        ["website", "▣", "Main Website", "admin-management.html#website"],
        ["client-portal", "◫", "Client Portal", "admin-management.html#client-portal"],
        ["admin-portal", "▦", "Admin Portal", "admin-management.html#admin-portal"],
        ["wizard", "◇", "Wizard", "admin-management.html#wizard"],
        ["management", "▦", "Management System", "admin-management.html"]
      ]
    },
    {
      key: "business",
      label: "Business",
      items: [
        // Original navigation — unchanged.
        ["prospects", "◉", "Prospects", "admin-prospects.html"],
        ["customers", "◎", "Customers", "admin-customers.html"],
        ["orders", "▤", "Orders", "admin-orders.html"],
        ["applications", "▧", "Applications", "admin-applications.html"],
        ["client-forms", "▨", "Client Forms", "admin-client-forms.html"],
        ["invoices", "$", "Invoices & Payments", "admin-invoices.html"],
        ["support", "◌", "Support", "admin-support.html"],
        ["compliance", "✓", "Compliance", "admin-compliance.html"],
        ["design", "✦", "Design Projects", "admin-design.html"],

        // Missing business pages added below the originals.
        ["clients", "◉", "Clients", "admin-clients.html"],
        ["entities", "◇", "Business Entities", "admin-entities.html"],
        ["order-intake", "+", "Order Intake", "admin-order-intake.html"],
        ["invoice-management", "▧", "Invoice Management", "admin-invoice-management.html"],
        ["documents", "▱", "Documents", "admin-documents.html"],
        ["messages", "✉", "Messages", "admin-messages.html"],
        ["accounting", "$", "Accounting & Books", "admin-accounting.html"]
      ]
    },
    {
      key: "content",
      label: "Content",
      items: [
        ["pages", "▤", "Pages", "admin-pages.html"],
        ["services", "◈", "Services", "admin-services.html"],
        ["blog", "¶", "Blog", "admin-blog.html"],
        ["faqs", "?", "FAQs", "admin-faqs.html"],
        ["knowledge", "▧", "Knowledge Center", "admin-knowledge.html"],
        ["media", "▣", "Media", "admin-media.html"]
      ]
    },
    {
      key: "operations",
      label: "Operations",
      items: [
        ["tasks", "✓", "Tasks", "admin-tasks.html"],
        ["calendar", "□", "Calendar", "admin-calendar.html"],
        ["notifications", "○", "Notifications", "admin-notifications.html"],
        ["activity", "↻", "Activity", "admin-activity.html"]
      ]
    },
    {
      key: "platform",
      label: "Platform",
      items: [
        ["users", "◎", "Users & Roles", "admin-users.html"],
        ["automations", "◇", "Automations", "admin-automations.html"],
        ["integrations", "⌁", "Integrations", "admin-integrations.html"],
        ["security", "⌾", "Security", "admin-security.html"],
        ["logs", "▤", "System Logs", "admin-logs.html"],
        ["settings", "⚙", "Settings", "admin-settings.html"],
        ["staff", "♙", "Staff & Access", "admin-staff.html"],
        ["audit", "⌁", "Audit & System Logs", "admin-audit.html"]
      ]
    }
  ];

  const fileToKey = {
    "admin-prospects.html": "prospects",
    "admin-customers.html": "customers",
    "admin-orders.html": "orders",
    "admin-applications.html": "applications",
    "admin-client-forms.html": "client-forms",
    "admin-invoices.html": "invoices",
    "admin-support.html": "support",
    "admin-compliance.html": "compliance",
    "admin-design.html": "design",
    "admin-pages.html": "pages",
    "admin-services.html": "services",
    "admin-blog.html": "blog",
    "admin-faqs.html": "faqs",
    "admin-knowledge.html": "knowledge",
    "admin-media.html": "media",
    "admin-tasks.html": "tasks",
    "admin-calendar.html": "calendar",
    "admin-notifications.html": "notifications",
    "admin-activity.html": "activity",
    "admin-users.html": "users",
    "admin-automations.html": "automations",
    "admin-integrations.html": "integrations",
    "admin-security.html": "security",
    "admin-logs.html": "logs",
    "admin-settings.html": "settings",

    // Missing pages added; original mappings above remain intact.
    "admin-clients.html": "clients",
    "admin-entities.html": "entities",
    "admin-order-intake.html": "order-intake",
    "admin-invoice-management.html": "invoice-management",
    "admin-documents.html": "documents",
    "admin-messages.html": "messages",
    "admin-accounting.html": "accounting",
    "admin-staff.html": "staff",
    "admin-audit.html": "audit",
    "admin-management.html": "management"
  };

  function currentKey() {
    const bodyKey = document.body?.dataset?.managementPage;
    if (bodyKey) return bodyKey;

    const file = (location.pathname.split("/").pop() || "").toLowerCase();
    if (fileToKey[file]) return fileToKey[file];

    return (location.hash || "#home").replace(/^#/, "").split("?")[0] || "home";
  }

  function currentGroup(activeKey) {
    return groups.find(group => group.items.some(item => item[0] === activeKey))?.key || "";
  }

  function itemMarkup(item, activeKey) {
    const [key, icon, label, href] = item;
    return `
      <a href="${href}"
         data-management-target="${key}"
         ${key === activeKey ? 'class="is-active" aria-current="page"' : ""}>
        <span aria-hidden="true">${icon}</span>
        ${label}
      </a>`;
  }

  function groupMarkup(group, activeKey, activeGroup) {
    const storageKey = `filings4u-management-nav-${group.key}`;
    const saved = localStorage.getItem(storageKey);
    const isOpen = saved === null ? true : saved === "open";
    const forceOpen = group.key === activeGroup;
    const open = forceOpen || isOpen;

    return `
      <section class="management-nav-group ${open ? "is-open" : ""}"
               data-nav-group="${group.key}">
        <button class="management-nav-group__toggle"
                type="button"
                aria-expanded="${open}">
          <span>${group.label}</span>
          <b aria-hidden="true">⌄</b>
        </button>
        <div class="management-nav-group__panel" ${open ? "" : "hidden"}>
          ${group.items.map(item => itemMarkup(item, activeKey)).join("")}
        </div>
      </section>`;
  }

  function bindGroups(host) {
    host.querySelectorAll("[data-nav-group]").forEach(group => {
      const toggle = group.querySelector(".management-nav-group__toggle");
      const panel = group.querySelector(".management-nav-group__panel");
      if (!toggle || !panel) return;

      toggle.addEventListener("click", () => {
        const open = !group.classList.contains("is-open");
        group.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        panel.hidden = !open;
        localStorage.setItem(
          `filings4u-management-nav-${group.dataset.navGroup}`,
          open ? "open" : "closed"
        );
      });
    });
  }

  function render() {
    /*
     * Preferred shared target first.
     * Fallback to an existing .management-nav so older pages are not broken
     * while they are being converted to the shared target.
     */
    const host =
      document.querySelector("[data-management-navigation]") ||
      document.getElementById("managementNavigation") ||
      document.querySelector(".management-nav");

    if (!host) {
      console.error(
        "filings4u Management navigation target missing. Add: " +
        '<nav class="management-nav" id="managementNavigation" data-management-navigation></nav>'
      );
      return;
    }

    host.classList.add("management-nav");
    host.id = "managementNavigation";
    host.setAttribute("data-management-navigation", "");

    const activeKey = currentKey();
    const activeGroup = currentGroup(activeKey);

    host.innerHTML = `
      <a class="management-nav__home ${activeKey === "home" ? "is-active" : ""}"
         href="admin-management.html#home"
         ${activeKey === "home" ? 'aria-current="page"' : ""}>
        <span aria-hidden="true">⌂</span>
        Home
      </a>
      ${groups.map(group => groupMarkup(group, activeKey, activeGroup)).join("")}
    `;

    bindGroups(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.addEventListener("hashchange", render);

  window.filings4uManagementNavigation = {
    render,
    groups
  };
})();