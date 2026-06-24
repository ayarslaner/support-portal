// ── Internal Dashboard — Client Logic ──────────────────

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────
  let apiKey = sessionStorage.getItem('support_api_key') || '';
  let currentPage = 1;
  let totalPages = 1;
  let currentTicketId = null;
  let currentTicketStatus = null;
  let debounceTimer = null;

  // ── DOM Refs ──────────────────────────────────────
  const authOverlay = document.getElementById('auth-overlay');
  const authKeyInput = document.getElementById('auth-key-input');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authError = document.getElementById('auth-error');
  const dashboard = document.getElementById('dashboard');
  const logoutBtn = document.getElementById('logout-btn');

  const ticketsTbody = document.getElementById('tickets-tbody');
  const ticketCount = document.getElementById('ticket-count');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const ticketsTable = document.getElementById('tickets-table');

  const filterStatus = document.getElementById('filter-status');
  const filterCompany = document.getElementById('filter-company');
  const filterSort = document.getElementById('filter-sort');
  const filterResetBtn = document.getElementById('filter-reset-btn');

  const exportBtn = document.getElementById('export-btn');
  const refreshBtn = document.getElementById('refresh-btn');

  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const pageInfo = document.getElementById('page-info');

  const detailOverlay = document.getElementById('detail-overlay');
  const detailPanel = document.getElementById('detail-panel');
  const closeDetailBtn = document.getElementById('close-detail-btn');
  const detailSubject = document.getElementById('detail-subject');
  const detailTicketId = document.getElementById('detail-ticket-id');
  const detailInfoGrid = document.getElementById('detail-info-grid');
  const detailDescription = document.getElementById('detail-description');
  const detailTimeline = document.getElementById('detail-timeline');
  const detailPriority = document.getElementById('detail-priority');
  const detailStatus = document.getElementById('detail-status');
  const saveChangesBtn = document.getElementById('save-changes-btn');
  const updateUser = document.getElementById('update-user');
  const updateText = document.getElementById('update-text');
  const submitUpdateBtn = document.getElementById('submit-update-btn');

  const toastContainer = document.getElementById('toast-container');

  // ── Utility Functions ─────────────────────────────

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      'X-Internal-Key': apiKey,
      ...options.headers,
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof Blob)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const res = await fetch(`/api${path}`, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('support_api_key');
      apiKey = '';
      showAuth();
      throw new Error('Authentication failed');
    }

    return res;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'Z'); // treat as UTC
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'Z');
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(dateStr);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function getPriorityClass(priority) {
    return (priority || '').toLowerCase();
  }

  function getStatusClass(status) {
    return (status || '').toLowerCase().replace(/\s+/g, '-');
  }

  // ── Auth ──────────────────────────────────────────

  function showAuth() {
    authOverlay.classList.remove('hidden');
    dashboard.classList.add('hidden');
    authKeyInput.value = '';
    authError.classList.add('hidden');
    authKeyInput.focus();
  }

  function showDashboard() {
    authOverlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadTickets();
  }

  async function authenticate() {
    const key = authKeyInput.value.trim();
    if (!key) {
      authError.textContent = 'Please enter an API key.';
      authError.classList.remove('hidden');
      return;
    }

    apiKey = key;

    try {
      const res = await apiFetch('/tickets?limit=1');
      if (res.ok) {
        sessionStorage.setItem('support_api_key', key);
        showDashboard();
      } else {
        authError.textContent = 'Invalid API key. Please try again.';
        authError.classList.remove('hidden');
        apiKey = '';
      }
    } catch (e) {
      authError.textContent = 'Connection failed. Please try again.';
      authError.classList.remove('hidden');
      apiKey = '';
    }
  }

  authSubmitBtn.addEventListener('click', authenticate);
  authKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authenticate();
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('support_api_key');
    apiKey = '';
    showAuth();
  });

  // ── Load Tickets ──────────────────────────────────

  async function loadTickets() {
    ticketsTbody.innerHTML = '';
    emptyState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    ticketsTable.style.display = 'none';

    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', 25);

    if (filterStatus.value) params.set('status', filterStatus.value);
    if (filterCompany.value.trim()) params.set('customer_company', filterCompany.value.trim());
    if (filterSort.value) params.set('sort_by', filterSort.value);

    try {
      const res = await apiFetch(`/tickets?${params}`);
      const data = await res.json();

      loadingState.classList.add('hidden');

      if (!data.tickets || data.tickets.length === 0) {
        emptyState.classList.remove('hidden');
        ticketCount.textContent = '0 tickets';
        updatePagination({ page: 1, totalPages: 1, total: 0 });
        return;
      }

      ticketsTable.style.display = '';
      ticketCount.textContent = `${data.pagination.total} ticket${data.pagination.total !== 1 ? 's' : ''}`;
      totalPages = data.pagination.totalPages;

      renderTickets(data.tickets);
      updatePagination(data.pagination);

    } catch (err) {
      loadingState.classList.add('hidden');
      console.error('Failed to load tickets:', err);
      showToast('Failed to load tickets.', 'error');
    }
  }

  function renderTickets(tickets) {
    ticketsTbody.innerHTML = '';

    tickets.forEach((t) => {
      const tr = document.createElement('tr');
      tr.dataset.ticketId = t.ticket_id;

      tr.innerHTML = `
        <td><span class="cell-id">${escapeHtml(t.ticket_id)}</span></td>
        <td><span class="cell-customer">${escapeHtml(t.customer_name)}</span></td>
        <td>${escapeHtml(t.customer_company)}</td>
        <td><span class="cell-subject">${escapeHtml(t.issue_subject)}</span></td>
        <td>
          <span class="priority-badge ${getPriorityClass(t.priority)}">
            <span class="priority-dot"></span>
            ${escapeHtml(t.priority)}
          </span>
        </td>
        <td>
          <span class="status-badge ${getStatusClass(t.status)}">${escapeHtml(t.status)}</span>
        </td>
        <td class="cell-date">${formatDate(t.created_at)}</td>
        <td class="cell-date" title="${formatDateTime(t.last_updated_at)}">${timeAgo(t.last_updated_at)}</td>
      `;

      tr.addEventListener('click', () => openTicketDetail(t.ticket_id));
      ticketsTbody.appendChild(tr);
    });
  }

  function updatePagination(p) {
    currentPage = p.page;
    totalPages = p.totalPages;
    pageInfo.textContent = `Page ${p.page} of ${p.totalPages}`;
    prevPageBtn.disabled = p.page <= 1;
    nextPageBtn.disabled = p.page >= p.totalPages;
  }

  // ── Pagination ────────────────────────────────────

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTickets();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadTickets();
    }
  });

  // ── Filters ───────────────────────────────────────

  filterStatus.addEventListener('change', () => { currentPage = 1; loadTickets(); });
  filterSort.addEventListener('change', () => { currentPage = 1; loadTickets(); });

  filterCompany.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentPage = 1;
      loadTickets();
    }, 400);
  });

  filterResetBtn.addEventListener('click', () => {
    filterStatus.value = '';
    filterCompany.value = '';
    filterSort.value = 'priority';
    currentPage = 1;
    loadTickets();
  });

  refreshBtn.addEventListener('click', () => {
    loadTickets();
    showToast('Tickets refreshed.', 'info');
  });

  // ── Export ────────────────────────────────────────

  exportBtn.addEventListener('click', async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus.value) params.set('status', filterStatus.value);
      if (filterCompany.value.trim()) params.set('customer_company', filterCompany.value.trim());

      showToast('Generating export...', 'info');

      const res = await apiFetch(`/tickets/export?${params}`);

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header
      // Generate download filename directly to avoid Content-Disposition parsing issues
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `support-tickets-${timestamp}.xlsx`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Export downloaded successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export tickets.', 'error');
    }
  });

  // ── Ticket Detail ─────────────────────────────────

  async function openTicketDetail(ticketId) {
    currentTicketId = ticketId;

    // Show panel
    detailOverlay.classList.remove('hidden');
    detailPanel.classList.remove('hidden');
    requestAnimationFrame(() => {
      detailOverlay.classList.add('show');
      detailPanel.classList.add('show');
    });

    // Clear previous data
    detailSubject.textContent = 'Loading…';
    detailTicketId.textContent = ticketId;
    detailInfoGrid.innerHTML = '';
    detailDescription.textContent = '';
    detailTimeline.innerHTML = '<p class="no-updates">Loading…</p>';

    try {
      const res = await apiFetch(`/tickets/${ticketId}`);
      const data = await res.json();
      const { ticket, updates } = data;

      // Populate header
      detailSubject.textContent = ticket.issue_subject;
      detailTicketId.textContent = ticket.ticket_id;

      // Populate info grid
      detailInfoGrid.innerHTML = `
        <div class="detail-field">
          <span class="detail-field-label">Customer</span>
          <span class="detail-field-value">${escapeHtml(ticket.customer_name)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Email</span>
          <span class="detail-field-value">${escapeHtml(ticket.customer_email)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Company</span>
          <span class="detail-field-value">${escapeHtml(ticket.customer_company)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Device #</span>
          <span class="detail-field-value">${escapeHtml(ticket.device_number)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Order #</span>
          <span class="detail-field-value">${escapeHtml(ticket.order_number)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Purchase Date</span>
          <span class="detail-field-value">${formatDate(ticket.purchase_date)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Created</span>
          <span class="detail-field-value">${formatDateTime(ticket.created_at)}</span>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Last Updated</span>
          <span class="detail-field-value">${formatDateTime(ticket.last_updated_at)}</span>
        </div>
      `;

      // Set dropdowns
      detailPriority.value = ticket.priority;
      detailStatus.value = ticket.status;
      currentTicketStatus = ticket.status;

      // Description
      detailDescription.textContent = ticket.issue_description;

      // Timeline
      renderTimeline(updates);

      // Restore saved user name
      const savedUser = sessionStorage.getItem('support_agent_name');
      if (savedUser) updateUser.value = savedUser;

    } catch (err) {
      console.error('Error loading ticket detail:', err);
      showToast('Failed to load ticket details.', 'error');
      closeDetail();
    }
  }

  function formatUpdateText(text) {
    // Format status/priority change lines with special styling
    return escapeHtml(text)
      .split('\n')
      .map(line => {
        if (line.startsWith('⚙️')) {
          return `<span class="change-line">${line}</span>`;
        }
        return line;
      })
      .join('<br>')
      .replace(/<br>(<br>)+/g, '<br>'); // collapse multiple blank lines
  }

  function renderTimeline(updates) {
    if (!updates || updates.length === 0) {
      detailTimeline.innerHTML = '<p class="no-updates">No updates yet.</p>';
      return;
    }

    detailTimeline.innerHTML = updates.map(u => {
      const hasChange = u.update_text.includes('⚙️');
      return `
        <div class="timeline-item${hasChange ? ' timeline-change' : ''}">
          <div class="timeline-meta">
            <span class="timeline-user">${escapeHtml(u.internal_user)}</span>
            <span class="timeline-date">${formatDateTime(u.created_at)}</span>
          </div>
          <div class="timeline-text">${formatUpdateText(u.update_text)}</div>
        </div>
      `;
    }).join('');
  }

  function closeDetail() {
    detailOverlay.classList.remove('show');
    detailPanel.classList.remove('show');
    setTimeout(() => {
      detailOverlay.classList.add('hidden');
      detailPanel.classList.add('hidden');
    }, 300);
    currentTicketId = null;
  }

  closeDetailBtn.addEventListener('click', closeDetail);
  detailOverlay.addEventListener('click', closeDetail);

  // ── Save Priority/Status Changes ──────────────────
  // Requires an activity note before allowing status/priority changes.

  saveChangesBtn.addEventListener('click', async () => {
    if (!currentTicketId) return;

    const user = updateUser.value.trim();
    const text = updateText.value.trim();

    // Enforce: must provide a name and a note to explain the change
    if (!user) {
      showToast('Please enter your name in the Add Update section before saving changes.', 'error');
      updateUser.focus();
      updateUser.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const statusChanged = detailStatus.value !== currentTicketStatus;

    if (statusChanged && !text) {
      showToast(dt('noteRequired') || 'Please add an activity note explaining the reason for this change.', 'error');
      updateText.focus();
      updateText.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Save agent name for convenience
    sessionStorage.setItem('support_agent_name', user);

    try {
      const res = await apiFetch(`/tickets/${currentTicketId}`, {
        method: 'PATCH',
        body: {
          priority: detailPriority.value,
          status: detailStatus.value,
          change_note: text,
          change_by: user,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Update failed');
      }

      showToast('Ticket updated successfully!', 'success');
      updateText.value = ''; // Clear the note since it was used
      loadTickets();
      openTicketDetail(currentTicketId); // Refresh detail to show the change in timeline
    } catch (err) {
      console.error('Update error:', err);
      showToast(err.message || 'Failed to update ticket.', 'error');
    }
  });

  // ── Submit Update Note ────────────────────────────

  submitUpdateBtn.addEventListener('click', async () => {
    if (!currentTicketId) return;

    const user = updateUser.value.trim();
    const text = updateText.value.trim();

    if (!user) {
      showToast('Please enter your name.', 'error');
      updateUser.focus();
      return;
    }
    if (!text) {
      showToast('Please enter an update note.', 'error');
      updateText.focus();
      return;
    }

    // Save agent name for convenience
    sessionStorage.setItem('support_agent_name', user);

    try {
      const res = await apiFetch(`/tickets/${currentTicketId}/updates`, {
        method: 'POST',
        body: {
          internal_user: user,
          update_text: text,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add update');
      }

      showToast('Update posted successfully!', 'success');
      updateText.value = '';

      // Reload the detail to show the new update
      openTicketDetail(currentTicketId);
      loadTickets(); // Refresh table timestamps

    } catch (err) {
      console.error('Add update error:', err);
      showToast('Failed to post update.', 'error');
    }
  });

  // ── Keyboard Shortcuts ────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentTicketId) {
      closeDetail();
    }
  });

  // ── Page Navigation ──────────────────────────────

  const ticketsView = document.getElementById('tickets-view');
  const settingsView = document.getElementById('settings-view');
  const navTickets = document.getElementById('nav-tickets');
  const navSettings = document.getElementById('nav-settings');

  function switchPage(pageName) {
    // Toggle views
    if (pageName === 'settings') {
      ticketsView.classList.add('hidden');
      settingsView.classList.remove('hidden');
      navTickets.classList.remove('active');
      navSettings.classList.add('active');
      loadSettings();
    } else {
      ticketsView.classList.remove('hidden');
      settingsView.classList.add('hidden');
      navTickets.classList.add('active');
      navSettings.classList.remove('active');
    }
  }

  navTickets.addEventListener('click', (e) => { e.preventDefault(); switchPage('tickets'); });
  navSettings.addEventListener('click', (e) => { e.preventDefault(); switchPage('settings'); });

  // ── Settings Logic ────────────────────────────────

  const settingsFields = {
    smtp_host: document.getElementById('setting-smtp-host'),
    smtp_port: document.getElementById('setting-smtp-port'),
    smtp_user: document.getElementById('setting-smtp-user'),
    smtp_pass: document.getElementById('setting-smtp-pass'),
    smtp_from: document.getElementById('setting-smtp-from'),
    smtp_secure: document.getElementById('setting-smtp-secure'),
    admin_email: document.getElementById('setting-admin-email'),
    language: document.getElementById('setting-language'),
  };

  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const saveStatus = document.getElementById('save-status');
  const testEmailBtn = document.getElementById('test-email-btn');
  const testResult = document.getElementById('test-result');
  const tlsLabel = document.getElementById('tls-label');
  const themeDarkBtn = document.getElementById('theme-dark');
  const themeLightBtn = document.getElementById('theme-light');

  // TLS toggle label
  settingsFields.smtp_secure.addEventListener('change', () => {
    tlsLabel.textContent = settingsFields.smtp_secure.checked ? 'On' : 'Off';
  });

  // Theme toggle
  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      themeLightBtn.classList.add('active');
      themeDarkBtn.classList.remove('active');
    } else {
      document.body.classList.remove('light-theme');
      themeDarkBtn.classList.add('active');
      themeLightBtn.classList.remove('active');
    }
    localStorage.setItem('support_theme', theme);
  }

  themeDarkBtn.addEventListener('click', () => applyTheme('dark'));
  themeLightBtn.addEventListener('click', () => applyTheme('light'));

  // Apply saved theme on load
  const savedTheme = localStorage.getItem('support_theme') || 'dark';
  applyTheme(savedTheme);

  async function loadSettings() {
    try {
      const res = await apiFetch('/settings');
      const data = await res.json();
      const s = data.settings;

      settingsFields.smtp_host.value = s.smtp_host || '';
      settingsFields.smtp_port.value = s.smtp_port || '587';
      settingsFields.smtp_user.value = s.smtp_user || '';
      settingsFields.smtp_from.value = s.smtp_from || '';
      settingsFields.admin_email.value = s.admin_email || '';
      settingsFields.language.value = s.language || 'en';

      // Don't overwrite password field with masked value, leave placeholder
      settingsFields.smtp_pass.value = '';
      settingsFields.smtp_pass.placeholder = s.smtp_pass_masked || '••••••••';

      settingsFields.smtp_secure.checked = s.smtp_secure === 'true';
      tlsLabel.textContent = s.smtp_secure === 'true' ? 'On' : 'Off';

      // Sync theme buttons
      applyTheme(localStorage.getItem('support_theme') || s.theme || 'dark');

    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  saveSettingsBtn.addEventListener('click', async () => {
    saveStatus.textContent = '';
    saveStatus.className = 'save-status';

    const payload = {
      smtp_host: settingsFields.smtp_host.value.trim(),
      smtp_port: settingsFields.smtp_port.value.trim() || '587',
      smtp_user: settingsFields.smtp_user.value.trim(),
      smtp_from: settingsFields.smtp_from.value.trim(),
      smtp_secure: settingsFields.smtp_secure.checked ? 'true' : 'false',
      admin_email: settingsFields.admin_email.value.trim(),
      language: settingsFields.language.value,
      theme: localStorage.getItem('support_theme') || 'dark',
    };

    // Only send password if user actually typed one (non-empty)
    if (settingsFields.smtp_pass.value) {
      payload.smtp_pass = settingsFields.smtp_pass.value;
    }

    try {
      const res = await apiFetch('/settings', {
        method: 'PUT',
        body: payload,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      saveStatus.textContent = '✓ Settings saved successfully';
      saveStatus.className = 'save-status success';
      showToast('Settings saved!', 'success');

      // Clear status after 4s
      setTimeout(() => { saveStatus.textContent = ''; }, 4000);

    } catch (err) {
      console.error('Save settings error:', err);
      saveStatus.textContent = '✗ Failed to save settings';
      saveStatus.className = 'save-status error';
      showToast('Failed to save settings.', 'error');
    }
  });

  testEmailBtn.addEventListener('click', async () => {
    testResult.textContent = 'Testing...';
    testResult.className = 'test-result';

    try {
      const res = await apiFetch('/settings/test-email', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        testResult.textContent = '✓ ' + data.message;
        testResult.className = 'test-result success';
      } else {
        testResult.textContent = '✗ ' + data.message;
        testResult.className = 'test-result error';
      }
    } catch (err) {
      testResult.textContent = '✗ Connection test failed';
      testResult.className = 'test-result error';
    }
  });

  // ── Change Password ────────────────────────────────

  const changePasswordBtn = document.getElementById('change-password-btn');
  const passwordResult = document.getElementById('password-result');
  const currentPasswordInput = document.getElementById('setting-current-password');
  const newPasswordInput = document.getElementById('setting-new-password');
  const confirmPasswordInput = document.getElementById('setting-confirm-password');

  changePasswordBtn.addEventListener('click', async () => {
    passwordResult.textContent = '';
    passwordResult.className = 'test-result';

    const currentPass = currentPasswordInput.value;
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (!currentPass || !newPass || !confirmPass) {
      passwordResult.textContent = '✗ All password fields are required.';
      passwordResult.className = 'test-result error';
      return;
    }

    if (newPass.length < 6) {
      passwordResult.textContent = '✗ New password must be at least 6 characters.';
      passwordResult.className = 'test-result error';
      return;
    }

    if (newPass !== confirmPass) {
      passwordResult.textContent = '✗ New passwords do not match.';
      passwordResult.className = 'test-result error';
      return;
    }

    try {
      const res = await apiFetch('/settings/change-password', {
        method: 'POST',
        body: {
          current_password: currentPass,
          new_password: newPass,
          confirm_password: confirmPass,
        },
      });

      const data = await res.json();

      if (res.ok) {
        passwordResult.textContent = '✓ ' + data.message;
        passwordResult.className = 'test-result success';

        // Clear fields
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        // Update stored API key and re-login
        sessionStorage.setItem('support_api_key', newPass);
        apiKey = newPass;

        showToast('Password changed! You are now using the new password.', 'success');
      } else {
        passwordResult.textContent = '✗ ' + (data.error || 'Failed to change password.');
        passwordResult.className = 'test-result error';
      }
    } catch (err) {
      passwordResult.textContent = '✗ Failed to change password.';
      passwordResult.className = 'test-result error';
    }
  });

  // ── Dashboard Turkish Translations ─────────────────

  const dashI18n = {
    en: {
      supportTickets: 'Support Tickets',
      allTickets: 'All Tickets',
      settings: 'Settings',
      configPrefs: 'Configuration & Preferences',
      exportExcel: 'Export to Excel',
      refresh: 'Refresh',
      status: 'Status',
      allStatuses: 'All Statuses',
      open: 'Open',
      inProgress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed',
      company: 'Company',
      searchCompany: 'Search by company...',
      sortBy: 'Sort By',
      priority: 'Priority',
      dateCreated: 'Date Created',
      lastUpdated: 'Last Updated',
      clearFilters: 'Clear Filters',
      ticketId: 'Ticket ID',
      customer: 'Customer',
      subject: 'Subject',
      created: 'Created',
      updated: 'Updated',
      noTickets: 'No tickets found matching your filters.',
      loadingTickets: 'Loading tickets...',
      previous: 'Previous',
      next: 'Next',
      signOut: 'Sign Out',
      // Detail panel
      ticketInfo: 'Ticket Information',
      quickActions: 'Quick Actions',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical',
      saveChanges: 'Save Changes',
      issueDescription: 'Issue Description',
      activityLog: 'Activity Log',
      noUpdates: 'No updates yet.',
      addUpdate: 'Add Update',
      yourName: 'Your Name',
      agentName: 'Agent name...',
      updateNote: 'Update Note',
      updatePlaceholder: 'Enter your update or internal notes...',
      postUpdate: 'Post Update',
      // Detail fields
      email: 'Email',
      deviceNo: 'Device #',
      orderNo: 'Order #',
      purchaseDate: 'Purchase Date',
      // Auth
      internalDashboard: 'Internal Dashboard',
      authDesc: 'Enter your API key to access the support management portal.',
      enterApiKey: 'Enter API Key',
      authenticate: 'Authenticate',
      invalidKey: 'Invalid API key. Please try again.',
      // Settings
      appearance: 'Appearance',
      theme: 'Theme',
      themeDesc: 'Choose between dark and light mode',
      dark: 'Dark',
      light: 'Light',
      language: 'Language',
      langDesc: 'Select your preferred interface language',
      emailConfig: 'Email Configuration (SMTP)',
      emailConfigDesc: 'Configure your mail server to send automated ticket notifications.',
      smtpHost: 'SMTP Host',
      smtpPort: 'SMTP Port',
      username: 'Username',
      password: 'Password',
      fromAddress: 'From Address',
      secureTls: 'Secure Connection (TLS)',
      testConnection: 'Test Connection',
      adminNotifications: 'Admin Notifications',
      adminNotifDesc: 'Receive email alerts when new tickets are submitted by customers.',
      adminEmail: 'Admin Email Address',
      adminEmailHint: 'Leave empty to disable admin notifications.',
      saveAllSettings: 'Save All Settings',
      // Security
      security: 'Security',
      securityDesc: 'Change the login password for the admin portal.',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm New Password',
      changePassword: 'Change Password',
      // Toasts
      ticketsRefreshed: 'Tickets refreshed.',
      exportGenerating: 'Generating export...',
      exportSuccess: 'Export downloaded successfully!',
      exportFail: 'Failed to export tickets.',
      ticketUpdated: 'Ticket updated successfully!',
      ticketUpdateFail: 'Failed to update ticket.',
      updatePosted: 'Update posted successfully!',
      updateFail: 'Failed to post update.',
      settingsSaved: 'Settings saved!',
      settingsSaveFail: 'Failed to save settings.',
      nameRequired: 'Please enter your name in the Add Update section before saving changes.',
      noteRequired: 'Please add an activity note explaining the reason for this change.',
      enterName: 'Please enter your name.',
      enterNote: 'Please enter an update note.',
      ticket: 'ticket',
      tickets: 'tickets',
      pageOf: 'Page {page} of {total}',
    },
    tr: {
      supportTickets: 'Destek Talepleri',
      allTickets: 'Tüm Talepler',
      settings: 'Ayarlar',
      configPrefs: 'Yapılandırma ve Tercihler',
      exportExcel: "Excel'e Aktar",
      refresh: 'Yenile',
      status: 'Durum',
      allStatuses: 'Tüm Durumlar',
      open: 'Açık',
      inProgress: 'İşlemde',
      resolved: 'Çözüldü',
      closed: 'Kapatıldı',
      company: 'Şirket',
      searchCompany: 'Şirkete göre ara...',
      sortBy: 'Sırala',
      priority: 'Öncelik',
      dateCreated: 'Oluşturulma Tarihi',
      lastUpdated: 'Son Güncelleme',
      clearFilters: 'Filtreleri Temizle',
      ticketId: 'Talep No',
      customer: 'Müşteri',
      subject: 'Konu',
      created: 'Oluşturulma',
      updated: 'Güncelleme',
      noTickets: 'Filtrelere uygun talep bulunamadı.',
      loadingTickets: 'Talepler yükleniyor...',
      previous: 'Önceki',
      next: 'Sonraki',
      signOut: 'Çıkış Yap',
      ticketInfo: 'Talep Bilgileri',
      quickActions: 'Hızlı İşlemler',
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      critical: 'Kritik',
      saveChanges: 'Değişiklikleri Kaydet',
      issueDescription: 'Sorun Açıklaması',
      activityLog: 'Etkinlik Günlüğü',
      noUpdates: 'Henüz güncelleme yok.',
      addUpdate: 'Güncelleme Ekle',
      yourName: 'Adınız',
      agentName: 'Temsilci adı...',
      updateNote: 'Güncelleme Notu',
      updatePlaceholder: 'Güncellemenizi veya dahili notlarınızı girin...',
      postUpdate: 'Güncelleme Gönder',
      email: 'E-posta',
      deviceNo: 'Cihaz No',
      orderNo: 'Sipariş No',
      purchaseDate: 'Satın Alma Tarihi',
      internalDashboard: 'Dahili Kontrol Paneli',
      authDesc: 'Destek yönetim portalına erişmek için API anahtarınızı girin.',
      enterApiKey: 'API Anahtarı Girin',
      authenticate: 'Giriş Yap',
      invalidKey: 'Geçersiz API anahtarı. Lütfen tekrar deneyin.',
      appearance: 'Görünüm',
      theme: 'Tema',
      themeDesc: 'Koyu ve açık mod arasında seçin',
      dark: 'Koyu',
      light: 'Açık',
      language: 'Dil',
      langDesc: 'Tercih ettiğiniz arayüz dilini seçin',
      emailConfig: 'E-posta Yapılandırması (SMTP)',
      emailConfigDesc: 'Otomatik talep bildirimleri göndermek için posta sunucunuzu yapılandırın.',
      smtpHost: 'SMTP Sunucu',
      smtpPort: 'SMTP Port',
      username: 'Kullanıcı Adı',
      password: 'Şifre',
      fromAddress: 'Gönderen Adresi',
      secureTls: 'Güvenli Bağlantı (TLS)',
      testConnection: 'Bağlantıyı Test Et',
      adminNotifications: 'Yönetici Bildirimleri',
      adminNotifDesc: 'Müşteriler tarafından yeni talep oluşturulduğunda e-posta bildirimleri alın.',
      adminEmail: 'Yönetici E-posta Adresi',
      adminEmailHint: 'Yönetici bildirimlerini devre dışı bırakmak için boş bırakın.',
      saveAllSettings: 'Tüm Ayarları Kaydet',
      security: 'Güvenlik',
      securityDesc: 'Yönetici portalının giriş şifresini değiştirin.',
      currentPassword: 'Mevcut Şifre',
      newPassword: 'Yeni Şifre',
      confirmPassword: 'Yeni Şifre (Tekrar)',
      changePassword: 'Şifreyi Değiştir',
      ticketsRefreshed: 'Talepler yenilendi.',
      exportGenerating: 'Dışa aktarım hazırlanıyor...',
      exportSuccess: 'Dışa aktarım başarıyla indirildi!',
      exportFail: 'Talepler dışa aktarılamadı.',
      ticketUpdated: 'Talep başarıyla güncellendi!',
      ticketUpdateFail: 'Talep güncellenemedi.',
      updatePosted: 'Güncelleme başarıyla gönderildi!',
      updateFail: 'Güncelleme gönderilemedi.',
      settingsSaved: 'Ayarlar kaydedildi!',
      settingsSaveFail: 'Ayarlar kaydedilemedi.',
      nameRequired: 'Değişiklikleri kaydetmeden önce Güncelleme Ekle bölümüne adınızı girin.',
      noteRequired: 'Lütfen bu değişikliğin nedenini açıklayan bir etkinlik notu ekleyin.',
      enterName: 'Lütfen adınızı girin.',
      enterNote: 'Lütfen bir güncelleme notu girin.',
      ticket: 'talep',
      tickets: 'talep',
      pageOf: 'Sayfa {page} / {total}',
    },
  };

  let dashLang = localStorage.getItem('support_dash_lang') || 'en';

  function dt(key) {
    return (dashI18n[dashLang] && dashI18n[dashLang][key]) || dashI18n.en[key] || key;
  }

  /** Apply dashboard language to all static UI elements. */
  function applyDashLang(lang) {
    dashLang = lang;
    localStorage.setItem('support_dash_lang', lang);

    // Nav
    document.querySelector('#nav-tickets span').textContent = dt('allTickets');
    document.querySelector('#nav-settings span').textContent = dt('settings');
    document.querySelector('#logout-btn span').textContent = dt('signOut');

    // Tickets view top bar
    document.getElementById('page-title').textContent = dt('supportTickets');

    // Export & Refresh buttons text
    const exportBtn = document.getElementById('export-btn');
    exportBtn.lastChild.textContent = ' ' + dt('exportExcel');
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.lastChild.textContent = ' ' + dt('refresh');

    // Filters
    document.querySelector('label[for="filter-status"]').textContent = dt('status');
    const filterStatus = document.getElementById('filter-status');
    filterStatus.options[0].text = dt('allStatuses');
    filterStatus.options[1].text = dt('open');
    filterStatus.options[2].text = dt('inProgress');
    filterStatus.options[3].text = dt('resolved');
    filterStatus.options[4].text = dt('closed');

    document.querySelector('label[for="filter-company"]').textContent = dt('company');
    document.getElementById('filter-company').placeholder = dt('searchCompany');

    document.querySelector('label[for="filter-sort"]').textContent = dt('sortBy');
    const filterSort = document.getElementById('filter-sort');
    filterSort.options[0].text = dt('priority');
    filterSort.options[1].text = dt('dateCreated');
    filterSort.options[2].text = dt('lastUpdated');
    filterSort.options[3].text = dt('company');

    document.getElementById('filter-reset-btn').textContent = dt('clearFilters');

    // Table headers
    document.querySelector('.col-id').textContent = dt('ticketId');
    document.querySelector('.col-customer').textContent = dt('customer');
    document.querySelector('.col-company').textContent = dt('company');
    document.querySelector('.col-subject').textContent = dt('subject');
    document.querySelector('.col-priority').textContent = dt('priority');
    document.querySelector('.col-status').textContent = dt('status');
    document.querySelector('.col-date').textContent = dt('created');
    document.querySelector('.col-updated').textContent = dt('updated');

    // Empty & Loading states
    document.querySelector('#empty-state p').textContent = dt('noTickets');
    document.querySelector('#loading-state p').textContent = dt('loadingTickets');

    // Pagination buttons
    document.getElementById('prev-page-btn').lastChild.textContent = ' ' + dt('previous');
    document.getElementById('next-page-btn').firstChild.textContent = dt('next') + ' ';

    // Detail panel
    const detailSections = document.querySelectorAll('.detail-section h4');
    if (detailSections[0]) detailSections[0].textContent = dt('ticketInfo');
    if (detailSections[1]) detailSections[1].textContent = dt('quickActions');
    if (detailSections[2]) detailSections[2].textContent = dt('issueDescription');
    if (detailSections[3]) detailSections[3].textContent = dt('activityLog');
    if (detailSections[4]) detailSections[4].textContent = dt('addUpdate');

    // Detail panel dropdowns
    const dp = document.getElementById('detail-priority');
    dp.options[0].text = dt('low');
    dp.options[1].text = dt('medium');
    dp.options[2].text = dt('high');
    dp.options[3].text = dt('critical');

    const ds = document.getElementById('detail-status');
    ds.options[0].text = dt('open');
    ds.options[1].text = dt('inProgress');
    ds.options[2].text = dt('resolved');
    ds.options[3].text = dt('closed');

    document.querySelector('label[for="detail-priority"]').textContent = dt('priority');
    document.querySelector('label[for="detail-status"]').textContent = dt('status');
    document.getElementById('save-changes-btn').textContent = dt('saveChanges');

    document.querySelector('label[for="update-user"]').textContent = dt('yourName');
    document.getElementById('update-user').placeholder = dt('agentName');
    document.querySelector('label[for="update-text"]').textContent = dt('updateNote');
    document.getElementById('update-text').placeholder = dt('updatePlaceholder');
    document.getElementById('submit-update-btn').textContent = dt('postUpdate');

    // Auth screen
    document.querySelector('.auth-card h1').textContent = dt('internalDashboard');
    document.querySelector('.auth-card p:not(.auth-error)').textContent = dt('authDesc');
    document.getElementById('auth-key-input').placeholder = dt('enterApiKey');
    document.getElementById('auth-submit-btn').textContent = dt('authenticate');

    // Settings view
    document.querySelector('#settings-view .topbar h2').textContent = dt('settings');
    document.querySelector('#settings-view .ticket-count').textContent = dt('configPrefs');

    // Settings sections
    const sectionHeaders = document.querySelectorAll('.settings-section-header h3');
    if (sectionHeaders[0]) sectionHeaders[0].textContent = dt('appearance');
    if (sectionHeaders[1]) sectionHeaders[1].textContent = dt('emailConfig');
    if (sectionHeaders[2]) sectionHeaders[2].textContent = dt('adminNotifications');

    const subs = document.querySelectorAll('.section-subtitle');
    if (subs[0]) subs[0].textContent = dt('emailConfigDesc');
    if (subs[1]) subs[1].textContent = dt('adminNotifDesc');

    // Settings labels
    const settingInfoLabels = document.querySelectorAll('.setting-info label');
    if (settingInfoLabels[0]) settingInfoLabels[0].textContent = dt('theme');
    if (settingInfoLabels[1]) settingInfoLabels[1].textContent = dt('language');
    const settingDescs = document.querySelectorAll('.setting-desc');
    if (settingDescs[0]) settingDescs[0].textContent = dt('themeDesc');
    if (settingDescs[1]) settingDescs[1].textContent = dt('langDesc');

    document.getElementById('theme-dark').lastChild.textContent = ' ' + dt('dark');
    document.getElementById('theme-light').lastChild.textContent = ' ' + dt('light');

    // SMTP fields
    document.querySelector('label[for="setting-smtp-host"]').textContent = dt('smtpHost');
    document.querySelector('label[for="setting-smtp-port"]').textContent = dt('smtpPort');
    document.querySelector('label[for="setting-smtp-user"]').textContent = dt('username');
    document.querySelector('label[for="setting-smtp-pass"]').textContent = dt('password');
    document.querySelector('label[for="setting-smtp-from"]').textContent = dt('fromAddress');

    // Secure TLS label inside setting-field
    const tlsFieldLabels = document.querySelectorAll('.settings-grid .setting-field label');
    // The TLS field label is the 6th field label in the grid
    for (const lbl of tlsFieldLabels) {
      if (lbl.htmlFor === '' && !lbl.classList.contains('toggle-wrapper')) {
        lbl.textContent = dt('secureTls');
        break;
      }
    }

    document.getElementById('test-email-btn').lastChild.textContent = ' ' + dt('testConnection');

    document.querySelector('label[for="setting-admin-email"]').textContent = dt('adminEmail');
    document.querySelector('.field-hint').textContent = dt('adminEmailHint');

    // Security section
    if (sectionHeaders[3]) sectionHeaders[3].textContent = dt('security');
    if (subs[2]) subs[2].textContent = dt('securityDesc');
    document.querySelector('label[for="setting-current-password"]').textContent = dt('currentPassword');
    document.querySelector('label[for="setting-new-password"]').textContent = dt('newPassword');
    document.querySelector('label[for="setting-confirm-password"]').textContent = dt('confirmPassword');
    document.getElementById('change-password-btn').lastChild.textContent = ' ' + dt('changePassword');

    // Save all settings button
    document.getElementById('save-settings-btn').lastChild.textContent = ' ' + dt('saveAllSettings');
  }

  // Listen for language changes from settings select
  settingsFields.language.addEventListener('change', () => {
    applyDashLang(settingsFields.language.value);
  });

  // Apply saved language on load
  applyDashLang(dashLang);

  // Also sync the settings language selector with the stored value
  settingsFields.language.value = dashLang;

  // ── Init ──────────────────────────────────────────

  if (apiKey) {
    showDashboard();
  } else {
    showAuth();
  }

})();
