(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const state = { rows: [], filtered: [], detail: null };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const labelize = key => String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const fmtDate = value => {
    if (!value) return 'Not provided';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
  };

  const FORM_TITLES = {
    poa: 'Limited Power of Attorney',
    ein: 'EIN Application',
    broker_authority: 'Broker Authority Application',
    boc3: 'BOC-3 Application',
    logo_design: 'Logo Design Intake',
    website_design: 'Website Design Intake'
  };

  /*
   * These schemas intentionally mirror the customer-facing forms.
   * They control BOTH the on-screen document and the generated PDF so
   * fields remain in the same order as the form instead of JSON/key order.
   */
  const FORM_SCHEMAS = {
    ein: [
      ['section', 'Applicant contact'],
      ['full_name', 'Contact full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['best_contact_time', 'Best time to contact'],
      ['section', 'Entity information'],
      ['legal_name', 'Legal name of entity or individual'], ['trade_name', 'Trade name / DBA, if different'], ['entity_type', 'Entity type'], ['entity_type_other', 'If other, describe'],
      ['mailing_address_1', 'Mailing street address'], ['mailing_address_2', 'Mailing address line 2'], ['mailing_city', 'City'], ['mailing_state', 'State / province'], ['mailing_postal', 'ZIP / postal code'], ['mailing_country', 'Country'],
      ['physical_different', 'Is the physical address different from the mailing address?'], ['physical_address_1', 'Physical street address'], ['physical_city', 'Physical city'], ['physical_state', 'Physical state / province'], ['physical_postal', 'Physical ZIP / postal code'], ['physical_country', 'Physical country'], ['principal_county', 'County where principal business is located'], ['principal_state', 'State where principal business is located'],
      ['section', 'Responsible party'],
      ['responsible_party_name', 'Responsible party full legal name'], ['responsible_party_id_type', 'Responsible party taxpayer ID type'], ['responsible_party_tax_id', 'Responsible party taxpayer ID'], ['is_llc', 'Is the entity an LLC?'], ['llc_members', 'Number of LLC members'], ['llc_us', 'Was the LLC organized in the United States?'], ['corporation_jurisdiction', 'Corporation state / foreign country of incorporation'],
      ['section', 'Reason for applying'],
      ['reason_applying', 'Primary reason for applying'], ['reason_details', 'Reason / business change details'], ['business_start_date', 'Date business started or acquired'], ['accounting_close_month', 'Closing month of accounting year'], ['prior_ein', 'Has the applicant previously received or applied for an EIN?'], ['previous_ein', 'Previous EIN, if known'], ['previous_ein_details', 'Previous EIN application details'],
      ['section', 'Employees and payroll'],
      ['expects_employees', 'Does the business expect employees?'], ['agricultural_employees', 'Agricultural employees expected'], ['household_employees', 'Household employees expected'], ['other_employees', 'Other employees expected'], ['first_wage_date', 'First date wages or annuities were / will be paid'], ['form_944_election', 'Form 944 election'],
      ['section', 'Business activity'],
      ['principal_activity', 'Principal activity'], ['primary_product_service', 'Primary product or service'], ['activity_description', 'Principal business activity description'],
      ['section', 'Certification and electronic signature'],
      ['electronic_signature', 'Electronic signature', { signature: true }], ['signature_date', 'Signature date']
    ],

    broker_authority: [
      ['section', 'Applicant contact'],
      ['full_name', 'Contact full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['contact_title', 'Title / role'],
      ['section', 'Business identity'],
      ['business_legal_name', 'Legal business name'], ['dba_name', 'DBA / trade name'], ['entity_type', 'Entity type'], ['formation_state', 'State / jurisdiction of formation'], ['formation_date', 'Formation date'], ['business_ein', 'EIN / federal tax ID'], ['principal_address', 'Principal street address'], ['principal_city', 'City'], ['principal_state', 'State'], ['principal_zip', 'ZIP code'], ['mailing_different', 'Is the mailing address different?'], ['mailing_address', 'Mailing address'], ['mailing_city', 'Mailing city'], ['mailing_state', 'Mailing state'], ['mailing_zip', 'Mailing ZIP'], ['business_phone', 'Business phone'], ['business_email', 'Business email'],
      ['section', 'FMCSA registration history'],
      ['existing_fmcsa', 'Existing FMCSA registration?'], ['usdot_number', 'USDOT number, if assigned'], ['mc_number', 'MC / FF / MX number, if assigned'], ['authority_application_situation', 'Application situation'], ['authority_adverse_history', 'Prior authority revocation, dismissal, suspension, or denial?'], ['authority_adverse_details', 'Prior authority history details'], ['prior_business_identity', 'Prior business identity?'], ['prior_business_details', 'Prior business names and USDOT / MC numbers'],
      ['section', 'Requested broker authority'],
      ['broker_authority_type', 'Broker authority requested'], ['broker_no_cmv', 'Will the brokerage operate without commercial motor vehicles?'], ['broker_interstate', 'Will brokerage operations be interstate?'], ['broker_operations_description', 'Brokerage services, freight types, and customer base'],
      ['section', 'Ownership and management'],
      ['primary_owner_name', 'Primary owner / managing member / officer'], ['primary_owner_percent', 'Primary ownership percentage'], ['second_owner_name', 'Second owner / officer, if applicable'], ['second_owner_percent', 'Second ownership percentage'], ['additional_owners', 'Additional owners, partners, members, or officers'], ['related_entity_history', 'Related entity history?'], ['related_entity_details', 'Related companies and USDOT / MC / FF numbers'],
      ['section', 'Financial security, process agent, and readiness'],
      ['financial_security_status', 'BMC-84 / BMC-85 financial security status'], ['bond_provider', 'Bond / trust provider, if known'], ['bond_reference', 'Bond / trust application or reference number'], ['boc3_status', 'BOC-3 status'], ['hhg_ready', 'Household goods readiness'], ['broker_compliance_notes', 'Additional bond, trust, BOC-3, or compliance notes'],
      ['section', 'Certification and electronic signature'],
      ['electronic_signature', 'Electronic signature', { signature: true }], ['signature_date', 'Signature date']
    ],

    boc3: [
      ['section', 'Applicant contact'],
      ['full_name', 'Contact full name'], ['email', 'Email address'], ['phone', 'Phone number'], ['contact_title', 'Title / role'],
      ['section', 'Company information'],
      ['business_legal_name', 'Legal business name'], ['dba_name', 'DBA / trade name'], ['entity_type', 'Entity type'], ['formation_state', 'State / jurisdiction of formation'], ['usdot_number', 'USDOT number, if assigned'], ['mc_ff_mx_number', 'MC / FF / MX number, if assigned'], ['registrant_type', 'Registrant type'], ['principal_address', 'Principal street address'], ['principal_city', 'City'], ['principal_state', 'State'], ['principal_zip', 'ZIP code'],
      ['section', 'BOC-3 request'],
      ['boc3_request_type', 'Request type'], ['existing_boc3', 'Existing BOC-3 filing?'], ['multi_state', 'Multi-state / blanket designation requested?'], ['operating_states', 'Operating states'], ['process_agent_notes', 'Existing process-agent details or special instructions'],
      ['section', 'Authority and filing status'],
      ['fmcsa_stage', 'Current FMCSA registration stage'], ['docket_assigned', 'Has a docket number been assigned?'], ['docket_number', 'Docket / MC / FF number'], ['filing_notes', 'Authority filing or deadline notes'],
      ['section', 'Certification and electronic signature'],
      ['electronic_signature', 'Electronic signature', { signature: true }], ['signature_date', 'Signature date']
    ],

    logo_design: [
      ['section', 'Customer and business information'],
      ['__client_name', 'Customer name'], ['__client_email', 'Email address'], ['phone_number', 'Phone number'], ['__business_name', 'Business / company name'],
      ['industry', 'Industry'], ['business_description', 'Business description'], ['target_audience', 'Target audience'],
      ['section', 'Logo direction'],
      ['logo_text', 'Logo text / business name to appear in logo'], ['logo_tagline', 'Tagline'], ['logo_style', 'Preferred logo style'], ['brand_mood', 'Brand mood / personality'], ['brand_colors', 'Preferred brand colors'], ['typography_preference', 'Typography preference'], ['logo_description', 'Logo concept / design description'], ['avoid_notes', 'Elements or styles to avoid'], ['competitor_inspiration_links', 'Competitor / inspiration links'], ['additional_notes', 'Additional notes'],
      ['section', 'Reference materials'],
      ['reference_asset_url', 'Reference asset'], ['reference_assets', 'Reference assets']
    ],

    website_design: [
      ['section', 'Customer and business information'],
      ['__client_name', 'Customer name'], ['__client_email', 'Email address'], ['phone_number', 'Phone number'], ['__business_name', 'Business / company name'],
      ['section', 'Website information'],
      ['current_url', 'Current website URL'], ['website_type', 'Website type'], ['website_type_other', 'Other website type'], ['main_goal', 'Main website goal'], ['target_audience', 'Target audience'],
      ['section', 'Brand and design direction'],
      ['branding_status', 'Branding status'], ['brand_assets_links', 'Brand asset links'], ['style_preference', 'Style preference'], ['style_preference_other', 'Other style preference'], ['aesthetic_tone', 'Aesthetic tone'], ['design_inspiration_links', 'Design inspiration links'],
      ['section', 'Features and content'],
      ['required_features', 'Required features'], ['required_features_other', 'Other required features'], ['estimated_page_count', 'Estimated page count'], ['asset_copy_status', 'Website copy / content status'], ['logo_status', 'Logo status'], ['logo_asset_url', 'Logo asset'], ['architectural_notes', 'Additional website notes']
    ]
  };

  const POA_TEXT = [
    ['WHEREAS', "The undersigned Principal appoints and authorizes Filings4u, LLC, an Illinois limited liability company and a subsidiary of Roseland Companies, LLC, together with its authorized operational agents, officers, employees, and designees, to act as the Principal's limited Attorney-in-Fact and Corporate Agent solely under the terms and limitations stated in this Agreement."],
    ['1. Express Limited Scope of Appointment', 'This appointment is limited to administrative, regulatory, filing, registration, compliance, document-preparation, document-transmission, and related ministerial activities reasonably necessary to perform the service purchased or requested by the Principal through Filings4u.\n\nThe Attorney-in-Fact may prepare, complete, sign where permitted and authorized, correct, amend, transmit, submit, receive, and process applications, registrations, forms, renewals, supporting documents, and related correspondence necessary to complete the requested service.'],
    ['2. Grant of Operational Powers', 'The Principal authorizes Filings4u, LLC to communicate with applicable state filing offices, federal agencies, regulatory bodies, registries, tax authorities, licensing agencies, and other governmental or administrative entities as reasonably necessary to carry out the requested service.\n\nThis limited authorization may include responding to routine filing deficiencies, correcting clerical or formatting issues, transmitting customer-approved information, receiving filing confirmations, and taking other administrative actions reasonably required to complete the requested service.'],
    ['3. Customer Information & Accuracy', "The Principal certifies that the information supplied to Filings4u is complete and accurate to the best of the Principal's knowledge and that the Principal has authority to act for the applicant, business, organization, carrier, or other entity identified in this authorization.\n\nFilings4u, LLC may rely on the information supplied by the Principal and is not responsible for inaccuracies, omissions, or delays caused by information supplied by the Principal or by government agency requirements outside Filings4u's reasonable control."],
    ['4. Electronic Signatures & Intent', "The Principal agrees to conduct this transaction electronically and expressly intends the typed first and last name entered on this form, together with the associated electronic record and execution timestamp, to serve as the Principal's electronic signature for this authorization.\n\nThe Principal acknowledges that electronic signatures and electronic records may be used in accordance with applicable federal and state electronic-transactions law, including the federal Electronic Signatures in Global and National Commerce Act (ESIGN) and applicable enactments of the Uniform Electronic Transactions Act (UETA), where those laws apply."],
    ['5. No Attorney-Client Relationship', 'This authorization does not create an attorney-client relationship and does not appoint Filings4u, LLC as an attorney-at-law. Filings4u, LLC provides filing, registration, compliance, document preparation, and administrative support services and does not provide legal, tax, accounting, or other professional advice.'],
    ['6. Ratification, Revocation & Duration', 'The Principal ratifies lawful administrative acts performed by Filings4u, LLC within the scope of this authorization. This authorization becomes effective when electronically executed and remains effective only for the requested service and reasonably related filing communications unless earlier revoked in writing or as otherwise required by applicable law.\n\nRevocation does not affect actions already taken in reasonable reliance on this authorization before Filings4u receives and can reasonably process the revocation. A revocation request may be submitted through an available verified client portal workflow or by contacting Filings4u support.'],
    ['7. Corporate Entity Information', 'Filings4u, LLC\nA Subsidiary of Roseland Companies, LLC\nState of Illinois\nSupport: support@filings4u.com']
  ];

  function toast(message) {
    const el = $('formsToast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  function formTitle(row) {
    return FORM_TITLES[String(row?.form_key || '').toLowerCase()] || row?.form_title || labelize(row?.form_key) || 'Client Form';
  }

  function isStoredAsset(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value) && value.path && (value.bucket || value.name || value.mime_type));
  }

  function storedAssets(value) {
    if (isStoredAsset(value)) return [value];
    if (Array.isArray(value)) return value.filter(isStoredAsset);
    return [];
  }

  function collectStoredAssets(value, out = [], seen = new Set()) {
    if (!value || typeof value !== 'object') return out;
    if (isStoredAsset(value)) {
      const key = `${value.bucket || ''}:${value.path || ''}`;
      if (!seen.has(key)) { seen.add(key); out.push(value); }
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach(item => collectStoredAssets(item, out, seen));
      return out;
    }
    Object.values(value).forEach(item => collectStoredAssets(item, out, seen));
    return out;
  }

  function allSubmissionAssets(d) {
    const assets = collectStoredAssets(d?.answers || {});
    for (const doc of (d?.related_documents || [])) {
      if (!doc?.path) continue;
      const normalized = {
        name: doc.name || doc.title || 'Document',
        path: doc.path,
        bucket: doc.bucket || 'customer-documents',
        mime_type: doc.mime_type || 'application/octet-stream',
        size: doc.size || 0,
        category: doc.category || doc.source || 'Document',
        created_at: doc.created_at || null
      };
      const key = `${normalized.bucket}:${normalized.path}`;
      if (!assets.some(a => `${a.bucket || ''}:${a.path || ''}` === key)) assets.push(normalized);
    }
    return assets;
  }

  async function openStoredAsset(bucket, path, downloadName) {
    const db = window.filings4uSupabase;
    if (!db) return toast('Supabase client unavailable.');
    try {
      const options = downloadName ? { download: downloadName } : undefined;
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 300, options);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast(error?.message || 'Unable to open this uploaded file.');
    }
  }

  function assetMarkup(value) {
    const assets = storedAssets(value);
    if (!assets.length) return '';
    return `<div style="display:grid;gap:8px;margin-top:7px;">${assets.map((asset, index) => {
      const name = asset.name || `Uploaded file ${index + 1}`;
      const size = Number(asset.size || 0);
      const sizeText = size ? ` · ${(size / 1024 / 1024).toFixed(size > 1024 * 1024 ? 2 : 3)} MB` : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #dfe7f0;border-radius:9px;background:#f8fafc;"><div style="min-width:0;"><strong style="display:block;color:#0a1f44;font-size:12px;overflow-wrap:anywhere;">${esc(name)}</strong><small style="color:#64748b;">${esc(asset.mime_type || asset.type || 'Uploaded file')}${esc(sizeText)}</small></div><div style="display:flex;gap:7px;flex-shrink:0;"><button type="button" data-form-asset-view data-bucket="${esc(asset.bucket || 'design_intake_assets')}" data-path="${esc(asset.path)}" style="border:0;border-radius:8px;padding:8px 11px;background:#0a1f44;color:white;font-weight:800;cursor:pointer;">View</button><button type="button" data-form-asset-download data-bucket="${esc(asset.bucket || 'design_intake_assets')}" data-path="${esc(asset.path)}" data-name="${esc(name)}" style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 11px;background:white;color:#0a1f44;font-weight:800;cursor:pointer;">Download</button></div></div>`;
    }).join('')}</div>`;
  }

  function friendlyValue(value) {
    if (value === null || value === undefined || value === '') return 'Not provided';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? value.map(friendlyValue).join(', ') : 'Not provided';
    if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${labelize(k)}: ${friendlyValue(v)}`).join('\n');

    const raw = String(value).trim();
    if (!raw) return 'Not provided';
    const lower = raw.toLowerCase();
    if (lower === 'true') return 'Yes';
    if (lower === 'false') return 'No';
    if (lower === 'not_applicable') return 'Not applicable';
    if (lower === 'yes') return 'Yes';
    if (lower === 'no') return 'No';
    if (lower === 'unsure') return 'Unsure';
    if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(raw)) {
      return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return raw;
  }

  function splitName(full) {
    const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
  }

  function getValue(d, key) {
    const a = d?.answers || {};
    if (key === '__client_name') return d.client_name;
    if (key === '__client_email') return d.client_email;
    if (key === '__business_name') return d.business_name;
    if (key === '__tracking') return d.tracking_number || d.order_reference;
    if (key === '__completed_at') return d.completed_at;
    if (key === '__poa_company') return d.business_name || a.company_name;
    if (key === '__poa_capacity') return a.signer_capacity;
    if (key === '__poa_first') return splitName(a.signer_name || d.client_name).first;
    if (key === '__poa_last') return splitName(a.signer_name || d.client_name).last;
    if (key === '__poa_email') return d.client_email;
    if (key === '__poa_phone') return d.applicant_phone || a.phone_number || a.phone;
    return a[key];
  }

  function schemaFor(d) {
    const key = String(d?.form_key || '').toLowerCase();
    if (key === 'poa') {
      return [
        ['section', 'Your information'],
        ['__poa_company', 'Company / entity name'],
        ['__poa_capacity', 'Your title / capacity'],
        ['__poa_first', 'First name'],
        ['__poa_last', 'Last name'],
        ['__poa_email', 'Email address'],
        ['__poa_phone', 'Phone number']
      ];
    }
    return FORM_SCHEMAS[key] || null;
  }

  function orderedFields(d) {
    const schema = schemaFor(d);
    if (schema) {
      return schema.map(item => {
        if (item[0] === 'section') return { type: 'section', label: item[1] };
        return { type: 'field', key: item[0], label: item[1], options: item[2] || {}, value: getValue(d, item[0]) };
      });
    }

    // Fallback for future forms: keep the payload's supplied order and always humanize labels/values.
    return Object.entries(d?.answers || {})
      .filter(([key]) => !['source', 'document_version', 'authorization_scope', 'limited_poa_confirmed', 'principal_acknowledgment', 'electronic_signature_intent'].includes(key))
      .map(([key, value]) => ({ type: 'field', key, label: labelize(key), value }));
  }

  function buildFilters() {
    const types = [...new Map(state.rows.map(r => [r.form_key, formTitle(r)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    $('formsTypeFilter').innerHTML = '<option value="">All form types</option>' + types.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    const clients = [...new Map(state.rows.filter(r => r.client_email).map(r => [r.client_email, r.client_name || r.client_email])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    $('formsClientFilter').innerHTML = '<option value="">All clients</option>' + clients.map(([v, l]) => `<option value="${esc(v)}">${esc(l)} · ${esc(v)}</option>`).join('');
  }

  function renderStats() {
    const now = Date.now();
    $('formsTotal').textContent = state.rows.length;
    $('formsRecent').textContent = state.rows.filter(r => now - new Date(r.completed_at).getTime() <= 30 * 864e5).length;
    $('formsClients').textContent = new Set(state.rows.map(r => r.client_email).filter(Boolean)).size;
    $('formsTypes').textContent = new Set(state.rows.map(r => r.form_key).filter(Boolean)).size;
  }

  function applyFilters() {
    const q = $('formsSearch').value.trim().toLowerCase();
    const type = $('formsTypeFilter').value;
    const client = $('formsClientFilter').value;
    const days = Number($('formsDateFilter').value || 0);
    const cutoff = days ? Date.now() - days * 864e5 : 0;
    state.filtered = state.rows.filter(r => {
      const hay = [r.form_title, r.form_key, r.client_name, r.client_email, r.business_name, r.tracking_number, r.order_reference].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (!type || r.form_key === type) && (!client || r.client_email === client) && (!cutoff || new Date(r.completed_at).getTime() >= cutoff);
    });
    renderRows();
  }

  function renderRows() {
    const body = $('formsRows');
    $('formsResultCount').textContent = `${state.filtered.length} submission${state.filtered.length === 1 ? '' : 's'}`;
    if (!state.filtered.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="forms-empty">No completed forms match these filters.</div></td></tr>';
      return;
    }
    body.innerHTML = state.filtered.map(r => `<tr>
      <td><strong>${esc(formTitle(r))}</strong><small>${esc(r.form_version ? 'Version ' + r.form_version : String(r.source_type || '').replaceAll('_', ' '))} · ${r.answer_count || 0} fields</small></td>
      <td><strong>${esc(r.client_name || 'Client')}</strong><small>${esc(r.client_email || '—')}</small></td>
      <td><strong>${esc(r.business_name || '—')}</strong></td>
      <td><strong>${esc(r.tracking_number || r.order_reference || '—')}</strong><small>${r.order_reference && r.tracking_number ? esc('Order ' + r.order_reference) : ''}</small></td>
      <td><strong>${esc(fmtDate(r.completed_at))}</strong></td>
      <td><span class="form-status">${esc(r.status || 'completed')}</span></td>
      <td><div class="form-actions"><button type="button" data-view="${esc(r.source_type)}:${esc(r.submission_id)}">View</button><button type="button" data-pdf="${esc(r.source_type)}:${esc(r.submission_id)}">Download PDF</button></div></td>
    </tr>`).join('');
  }

  async function detail(source, id) {
    const db = window.filings4uSupabase;
    if (!db) throw Error('Supabase client unavailable');
    const [formResult, documentResult] = await Promise.all([
      db.rpc('admin_client_completed_form_detail', { p_source_type: source, p_submission_id: id }),
      db.rpc('admin_client_completed_form_documents', { p_source_type: source, p_submission_id: id })
    ]);
    if (formResult.error) throw formResult.error;
    if (documentResult.error) throw documentResult.error;
    return { ...formResult.data, related_documents: documentResult.data || [] };
  }

  function previewField(field) {
    if (field.type === 'section') {
      return `<h3 style="margin:24px 0 10px;padding-bottom:7px;border-bottom:1px solid #dfe7f0;color:#0a1f44;font:800 15px/1.25 Manrope,Arial,sans-serif;">${esc(field.label)}</h3>`;
    }
    const attachments = assetMarkup(field.value);
    if (attachments) {
      return `<div style="padding:10px 0;border-bottom:1px solid #edf1f5;break-inside:avoid;"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.055em;color:#64748b;">${esc(field.label)}</div>${attachments}</div>`;
    }
    const raw = String(field.value ?? '').trim();
    const isUrl = /^https?:\/\//i.test(raw) && /(url|link|asset|website|inspiration)/i.test(field.key || field.label || '');
    if (isUrl) {
      return `<div style="padding:10px 0;border-bottom:1px solid #edf1f5;break-inside:avoid;"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.055em;color:#64748b;">${esc(field.label)}</div><div style="margin-top:7px;"><a href="${esc(raw)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;border-radius:8px;padding:8px 11px;background:#0a1f44;color:#fff;text-decoration:none;font-size:12px;font-weight:800;">Open link</a></div></div>`;
    }
    const value = friendlyValue(field.value);
    if (field.options?.signature) {
      return `<div style="margin:16px 0 6px;padding:18px;border:1px solid #cad6e4;border-radius:10px;background:#fbfdff;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#64748b;">${esc(field.label)}</div>
        <div style="margin-top:10px;font:italic 30px/1.15 'Segoe Script','Brush Script MT',cursive;color:#0a1f44;">${esc(value)}</div>
      </div>`;
    }
    return `<div style="padding:10px 0;border-bottom:1px solid #edf1f5;break-inside:avoid;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.055em;color:#64748b;">${esc(field.label)}</div>
      <div style="margin-top:4px;color:#14233d;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;">${esc(value)}</div>
    </div>`;
  }

  function poaPreview(d) {
    const signedName = d.answers?.signer_name || d.client_name || '';
    const executed = d.answers?.executed_at || d.completed_at;
    return `<section style="margin-top:26px;page-break-before:auto;">
      <h3 style="margin:0 0 14px;color:#0a1f44;font:800 17px/1.2 Manrope,Arial,sans-serif;">Limited Power of Attorney &amp; Corporate Agency Agreement</h3>
      ${POA_TEXT.map(([heading, body]) => `<div style="margin:0 0 15px;"><h4 style="margin:0 0 5px;color:#0a1f44;font-size:12px;">${esc(heading)}</h4><p style="margin:0;color:#334155;font-size:12px;line-height:1.65;white-space:pre-line;">${esc(body)}</p></div>`).join('')}
      <div style="margin-top:24px;padding:18px;border:1px solid #b9d7cc;background:#f2fbf7;border-radius:10px;break-inside:avoid;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#557568;">Electronic signature</div>
        <div style="margin:10px 0 8px;font:italic 32px/1.1 'Segoe Script','Brush Script MT',cursive;color:#0a1f44;">${esc(signedName || 'Not provided')}</div>
        <div style="font-size:12px;line-height:1.6;color:#334155;"><strong>Signer capacity:</strong> ${esc(friendlyValue(d.answers?.signer_capacity))}<br><strong>Signed:</strong> ${esc(fmtDate(executed))}<br><strong>Authorization consent:</strong> ${d.answers?.consent === true ? 'Accepted' : 'Not recorded'}</div>
      </div>
    </section>`;
  }

  function documentPreviewHtml(d) {
    const fields = orderedFields(d);
    const title = formTitle(d);
    const ref = d.tracking_number || d.order_reference || 'Not assigned';
    return `<article style="max-width:820px;margin:0 auto;background:#fff;border:1px solid #dfe5ec;box-shadow:0 12px 30px rgba(10,31,68,.08);font-family:DM Sans,Arial,sans-serif;color:#14233d;">
      <header style="background:#0a1f44;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
        <img src="images/logo2.png" alt="Filings4u" style="display:block;width:145px;max-height:44px;object-fit:contain;" onerror="this.src='images/logo.png';this.style.background='white';this.style.padding='6px';this.style.borderRadius='6px';">
        <div style="color:white;text-align:right;"><div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.76;">Completed customer form</div><div style="margin-top:4px;font-size:12px;font-weight:700;">${esc(ref)}</div></div>
      </header>
      <div style="padding:28px;">
        <h2 style="margin:0;color:#0a1f44;font:800 25px/1.1 Manrope,Arial,sans-serif;">${esc(title)}</h2>
        <div style="margin-top:9px;color:#64748b;font-size:12px;line-height:1.7;"><strong>Completed:</strong> ${esc(fmtDate(d.completed_at))}<br><strong>Customer:</strong> ${esc(d.client_name || 'Not provided')}<br><strong>Email:</strong> ${esc(d.client_email || 'Not provided')}${d.business_name ? `<br><strong>Business:</strong> ${esc(d.business_name)}` : ''}</div>
        <div style="height:1px;background:#dfe5ec;margin:22px 0;"></div>
        ${fields.map(previewField).join('')}
        ${(() => {
          const files = allSubmissionAssets(d);
          if (!files.length) return '';
          return `<section style="margin-top:28px;padding-top:4px;"><h3 style="margin:0 0 10px;padding-bottom:7px;border-bottom:1px solid #dfe7f0;color:#0a1f44;font:800 15px/1.25 Manrope,Arial,sans-serif;">Documents &amp; uploads</h3>${assetMarkup(files)}</section>`;
        })()}
        ${String(d.form_key).toLowerCase() === 'poa' ? poaPreview(d) : ''}
      </div>
      <footer style="padding:16px 28px;border-top:1px solid #e6ebf1;color:#8290a3;font-size:10px;display:flex;justify-content:space-between;gap:16px;"><span>Filings4u, LLC · Secure customer record</span><span>Completed ${esc(fmtDate(d.completed_at))}</span></footer>
    </article>`;
  }

  function openModal(d) {
    state.detail = d;
    $('formViewerTitle').textContent = formTitle(d);
    $('formViewerMeta').textContent = `Completed ${fmtDate(d.completed_at)}`;
    const meta = [d.client_name, d.client_email, d.business_name, d.tracking_number, d.order_reference ? `Order ${d.order_reference}` : ''].filter(Boolean);
    $('formRecordMeta').innerHTML = meta.map(x => `<span>${esc(x)}</span>`).join('');
    $('formAnswerList').innerHTML = documentPreviewHtml(d);
    $('formsModal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('formsModal').hidden = true;
    document.body.style.overflow = '';
    state.detail = null;
  }

  function safeName(value) {
    return String(value || 'form').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }

  function dataUrlFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadLogoData() {
    for (const path of ['images/logo2.png', 'images/logo.png']) {
      try {
        const response = await fetch(path, { cache: 'force-cache' });
        if (!response.ok) continue;
        return await dataUrlFromBlob(await response.blob());
      } catch (_) {}
    }
    return null;
  }

  function addPdfLogo(doc, dataUrl) {
    if (!dataUrl) {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(21);
      doc.text('filings4u', 50, 45);
      return;
    }
    try {
      const props = doc.getImageProperties(dataUrl);
      const width = 120;
      const height = Math.min(40, width * props.height / props.width);
      doc.addImage(dataUrl, 'PNG', 50, 19, width, height, undefined, 'FAST');
    } catch (_) {
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(21);
      doc.text('filings4u', 50, 45);
    }
  }

  async function downloadPdf(d) {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
      toast('PDF library did not load.');
      return;
    }

    const doc = new JsPDF({ unit: 'pt', format: 'letter' });
    const logo = await loadLogoData();
    const left = 50;
    const right = 562;
    const maxWidth = right - left;
    const bottom = 724;
    let y = 104;

    function header(firstPage = false) {
      doc.setFillColor(10, 31, 68);
      doc.rect(0, 0, 612, 72, 'F');
      addPdfLogo(doc, logo);
      if (!firstPage) {
        doc.setTextColor(218, 228, 240);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(formTitle(d), right, 42, { align: 'right' });
      }
    }

    function newPage() {
      doc.addPage();
      header(false);
      y = 100;
    }

    function ensure(height) {
      if (y + height > bottom) newPage();
    }

    function textBlock(text, size = 10, style = 'normal', color = [20, 35, 61], indent = 0, spacing = 5) {
      const x = left + indent;
      const width = maxWidth - indent;
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text ?? ''), width);
      const lineHeight = size * 1.35;
      ensure(lines.length * lineHeight + spacing);
      doc.text(lines, x, y);
      y += lines.length * lineHeight + spacing;
    }

    function section(title) {
      ensure(34);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(10, 31, 68);
      doc.text(String(title), left, y);
      y += 8;
      doc.setDrawColor(220, 228, 237);
      doc.line(left, y, right, y);
      y += 16;
    }

    function field(label, value, signature = false) {
      const shown = friendlyValue(value);
      if (signature) {
        ensure(76);
        doc.setFillColor(248, 251, 253);
        doc.setDrawColor(205, 216, 229);
        doc.roundedRect(left, y - 4, maxWidth, 62, 6, 6, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(String(label).toUpperCase(), left + 12, y + 10);
        doc.setFont('times', 'italic');
        doc.setFontSize(22);
        doc.setTextColor(10, 31, 68);
        doc.text(doc.splitTextToSize(shown, maxWidth - 24), left + 12, y + 39);
        y += 74;
        return;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      ensure(26);
      doc.text(String(label).toUpperCase(), left, y);
      y += 12;
      textBlock(shown, 10, 'normal', [20, 35, 61], 0, 8);
      doc.setDrawColor(238, 242, 246);
      doc.line(left, y - 3, right, y - 3);
      y += 5;
    }

    header(true);
    doc.setTextColor(10, 31, 68);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(formTitle(d), left, y);
    y += 22;
    textBlock(`Completed: ${fmtDate(d.completed_at)}`, 9, 'normal', [100, 116, 139], 0, 2);
    textBlock(`Customer: ${d.client_name || 'Not provided'}`, 9, 'normal', [100, 116, 139], 0, 2);
    textBlock(`Email: ${d.client_email || 'Not provided'}`, 9, 'normal', [100, 116, 139], 0, 2);
    if (d.business_name) textBlock(`Business: ${d.business_name}`, 9, 'normal', [100, 116, 139], 0, 2);
    if (d.tracking_number || d.order_reference) textBlock(`Reference: ${d.tracking_number || d.order_reference}`, 9, 'normal', [100, 116, 139], 0, 2);
    y += 8;

    for (const item of orderedFields(d)) {
      if (item.type === 'section') section(item.label);
      else field(item.label, item.value, !!item.options?.signature);
    }

    if (String(d.form_key).toLowerCase() === 'poa') {
      section('Limited Power of Attorney & Corporate Agency Agreement');
      for (const [heading, body] of POA_TEXT) {
        textBlock(heading, 10, 'bold', [10, 31, 68], 0, 3);
        for (const paragraph of String(body).split(/\n\n/)) {
          textBlock(paragraph, 9, 'normal', [51, 65, 85], 0, 8);
        }
      }
      section('Electronic signature');
      field('Signature', d.answers?.signer_name || d.client_name, true);
      field('Signer capacity', d.answers?.signer_capacity);
      field('Signed date and time', fmtDate(d.answers?.executed_at || d.completed_at));
      field('Authorization consent', d.answers?.consent === true ? 'Accepted' : 'Not recorded');
    }

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(225, 231, 239);
      doc.line(left, 748, right, 748);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(128, 145, 165);
      doc.text(`Filings4u, LLC · Completed ${fmtDate(d.completed_at)}`, left, 765);
      doc.text(`Page ${page} of ${pages}`, right, 765, { align: 'right' });
    }

    const file = `${safeName(formTitle(d))}-${safeName(d.client_name || d.client_email)}-${new Date(d.completed_at).toISOString().slice(0, 10)}.pdf`;
    doc.save(file);
  }

  document.addEventListener('click', event => {
    const view = event.target.closest('[data-form-asset-view]');
    if (view) {
      event.preventDefault();
      openStoredAsset(view.dataset.bucket, view.dataset.path, '');
      return;
    }
    const download = event.target.closest('[data-form-asset-download]');
    if (download) {
      event.preventDefault();
      openStoredAsset(download.dataset.bucket, download.dataset.path, download.dataset.name || 'download');
    }
  });

  async function load() {
    const gate = $('formsGate');
    const app = $('formsApp');
    try {
      const db = window.filings4uSupabase;
      if (!db) throw Error('Supabase client unavailable');
      const { data, error } = await db.rpc('admin_client_completed_forms', { p_search: null, p_limit: 1000 });
      if (error) throw error;
      state.rows = data || [];
      state.filtered = state.rows.slice();
      buildFilters();
      renderStats();
      renderRows();
      gate.hidden = true;
      app.hidden = false;
    } catch (error) {
      console.error(error);
      gate.textContent = `Could not load completed forms: ${error.message || error}`;
    }
  }

  async function handleAction(token, pdfOnly) {
    const separator = token.indexOf(':');
    const source = token.slice(0, separator);
    const id = token.slice(separator + 1);
    try {
      toast('Loading submission…');
      const d = await detail(source, id);
      if (pdfOnly) await downloadPdf(d);
      else openModal(d);
    } catch (error) {
      console.error(error);
      toast(error.message || 'Could not open submission.');
    }
  }

  document.addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    const pdf = event.target.closest('[data-pdf]');
    if (view) handleAction(view.dataset.view, false);
    if (pdf) handleAction(pdf.dataset.pdf, true);
    if (event.target.closest('[data-close-form]')) closeModal();
  });

  ['formsSearch', 'formsTypeFilter', 'formsClientFilter', 'formsDateFilter'].forEach(id => {
    $(id)?.addEventListener(id === 'formsSearch' ? 'input' : 'change', applyFilters);
  });

  $('formsClear')?.addEventListener('click', () => {
    $('formsSearch').value = '';
    $('formsTypeFilter').value = '';
    $('formsClientFilter').value = '';
    $('formsDateFilter').value = '';
    applyFilters();
  });

  $('formsRefresh')?.addEventListener('click', load);
  $('downloadFormPdf')?.addEventListener('click', () => state.detail && downloadPdf(state.detail));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('formsModal').hidden) closeModal();
  });

  load();
})();
