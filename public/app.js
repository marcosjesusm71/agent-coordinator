const API_BASE = '/api';
let currentFilter = { agent: 'all', status: 'pending' };

document.addEventListener('DOMContentLoaded', () => {
  loadCommunications();

  document.getElementById('agentFilter').addEventListener('change', (e) => {
    currentFilter.agent = e.target.value;
    loadCommunications();
  });

  document.getElementById('statusFilter').addEventListener('change', (e) => {
    currentFilter.status = e.target.value;
    loadCommunications();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadCommunications);
});

async function loadCommunications() {
  try {
    const params = new URLSearchParams();
    if (currentFilter.status !== 'all') {
      params.set('filter', currentFilter.status);
    }

    let url = `${API_BASE}/communications/${currentFilter.agent}`;
    if (currentFilter.agent === 'all') {
      // Fetch all and filter client-side; deduplicate by id (appears in both agents)
      const [paco, paqui] = await Promise.all([
        fetchWrap(`${API_BASE}/communications/Paco?${params}`),
        fetchWrap(`${API_BASE}/communications/Paqui?${params}`)
      ]);
      const all = [...paco.communications, ...paqui.communications];
      const seen = new Map();
      for (const c of all) seen.set(c.id, c);
      renderList([...seen.values()]);
      return;
    }

    const res = await fetchWrap(`${API_BASE}/communications/${currentFilter.agent}?${params}`);
    renderList(res.communications);
  } catch (err) {
    showToast('Error cargando: ' + err.message);
  }
}

async function fetchWrap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderList(communications) {
  const list = document.getElementById('list');

  // Sort by createdAt descending
  communications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (communications.length === 0) {
    list.innerHTML = '<div class="empty">No hay comunicaciones</div>';
    return;
  }

  list.innerHTML = communications.map(c => `
    <div class="list-item" onclick="openDetail('${c.id}')">
      <span class="date">${formatDate(c.createdAt)}</span>
      <span class="origin">${c.origin}</span>
      <span class="destination">${c.destination}</span>
      <span class="title">${escapeHtml(c.title)}</span>
      <span class="check" title="${statusTitle(c)}">${statusIcon(c)}</span>
    </div>
  `).join('');
}

function statusIcon(c) {
  if (c.status === 'pending') return '⏳';
  if (c.status === 'answered') {
    return c.processed ? '✅' : '📩';
  }
  return '—';
}

function statusTitle(c) {
  if (c.status === 'pending') return 'Pendiente de respuesta';
  if (c.status === 'answered') {
    return c.processed ? 'Procesada' : 'Respuesta pendiente de procesar';
  }
  return '';
}

async function openDetail(id) {
  try {
    const res = await fetchWrap(`${API_BASE}/communications/detail/${id}`);
    showDetail(res.communication);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

function showDetail(c) {
  document.getElementById('detailTitle').textContent = c.title;
  document.getElementById('detailDate').textContent = formatDateTime(c.createdAt);
  document.getElementById('detailOrigin').textContent = c.origin;
  document.getElementById('detailDestination').textContent = c.destination;
  document.getElementById('detailStatus').innerHTML = statusBadge(c);
  document.getElementById('detailDescription').textContent = c.description || '—';

  if (c.answer) {
    document.getElementById('detailAnswer').innerHTML =
      `<strong>${c.answeredAt ? formatDateTime(c.answeredAt) : ''}</strong><br>${escapeHtml(c.answer)}`;
  } else {
    document.getElementById('detailAnswer').textContent = '—';
  }

  document.getElementById('detail').classList.remove('hidden');
}

function statusBadge(c) {
  if (c.status === 'pending') return '<span class="badge pending">Pendiente</span>';
  if (c.status === 'answered') {
    return c.processed
      ? '<span class="badge processed">Procesada</span>'
      : '<span class="badge answered">Respondida</span>';
  }
  return '—';
}

function closeDetail() {
  document.getElementById('detail').classList.add('hidden');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Close modal on outside click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('detail');
  if (e.target === modal) closeDetail();
});
