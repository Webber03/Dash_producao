// ── CONFIG ────────────────────────────────────────────────────
// URL padrão — usada apenas se não houver nada salvo no navegador
const JSON_URL_DEFAULT = 'https://novo.progestor21.com.br/sistema/_lib/tmp/sc_json_20260319113030_485_consultajsonlf.json';
const getJsonUrl = () => localStorage.getItem('progestor_json_url') || JSON_URL_DEFAULT;

// finder.php busca automaticamente o arquivo mais recente
// proxy.php é usado quando o usuário informa a URL manualmente
const USE_FINDER = !localStorage.getItem('progestor_json_url');

// ── MODAL URL ─────────────────────────────────────────────────
function openUrlModal() {
  document.getElementById('urlInput').value = getJsonUrl();
  document.getElementById('modal-url').style.display = 'flex';
}
function closeUrlModal() {
  document.getElementById('modal-url').style.display = 'none';
}
function saveUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;
  localStorage.setItem('progestor_json_url', url);
  closeUrlModal();
  stopAutoRefresh();
  loadData();
}
function clearSavedUrl() {
  localStorage.removeItem('progestor_json_url');
  stopAutoRefresh();
  loadData();
}

// ── TIPOS PERMITIDOS ──────────────────────────────────────────
// Mapeamento: tipo → classe de badge
const TIPO_BADGE = {
  'NOVO': 'b-novo',
  'REFINANCIAMENTO': 'b-refin',
  'REFIN-PORTABILIDADE': 'b-rp',
  'PORTABILIDADE': 'b-port',
  'CARTÃO C/SAQUE': 'b-cart',
  'COMPRA DE DIVIDA': 'b-cd',
  'COMPRA INTERNA': 'b-ci',
  'CARTÃO EMISSÃO PLASTICO': 'b-ep',
  'CARTAO BENEFICIO': 'b-cb',
  'CARTÃO BENEFICIO C/SAQUE': 'b-cbs',
  'COMPRA INTERNA C/AJUSTE': 'b-cia',
  'ABERTURA DE CONTA CORRENTE': 'b-ac',
};

// ── FILIAIS ───────────────────────────────────────────────────
const FILIAIS = {
  '377': 'CONSORCIO',
  '366': 'ERBANK',
  '379': 'EXTERNO',
  '279': 'FEIRA DE SANTANA',
  '365': 'FGTS [Externo]',
  '348': 'EQUIPE PRIME',
  '303': 'INSS',
  '358': 'EQUIPE ALPHA',
  '281': 'LF & CREDSAMPAIO',
  '315': 'MATRIZ',
  '362': 'MEI / PREST. SERVI',
  '372': 'MF SERVICOS',
  '373': 'SIAPE',
  '373': 'EQUIPE PRIME',
  '468': 'CONSIGNADO CLT',
  '469': 'EQUIPE EVOLUTION',
  '470': 'APL SERVICOS',
  '472': 'CARTOES',
};
// Filiais ordenadas alfabeticamente por nome
const FILIAIS_ORDER = Object.entries(FILIAIS).sort((a, b) => a[1].localeCompare(b[1]));
const filialNome = codigo => FILIAIS[String(codigo)] || String(codigo);

// ── CANAIS DE VENDA ───────────────────────────────────────────
const CANAIS = {
  '27': 'URA ATENDE',
  '28': 'ATIVÃO',
  '29': 'SMS',
  '30': 'DISPARADOR WHATSAPP',
  '31': 'CALL CENTER MANUAL',
  '32': 'INDICAÇÃO CLIENTE',
  '34': 'LEAD TRÁFEGO PAGO',
  '65': 'FACEBOOK | INSTAGRAM',
  '78': 'POS-VENDA',
  '79': 'INDICACAO FABRICIO',
  '81': 'URA WHATSAPP',
  '82': 'DISP. WHATSAPP RECEPTIVO',
  '83': 'INDICAÇÃO ESRON MENEZES',
  '84': 'DISCADORA',
  '86': 'URA VOIP',
  '87': 'ESTAGIÁRIO(A)',
  '107': 'DISP WHATSAPP INTELIGENTE',
  '108': 'SDR',
  '112': 'DISP WHATSAPP API'
};
const canalNome = codigo => CANAIS[String(codigo)] || String(codigo);

// ── ESTADO ────────────────────────────────────────────────────
let ALL = [], FILTERED = [], PAGE = 0, MESES_SEL = [], FILS_SEL = [];
let PREV_MES = '', PREV_DE = '', PREV_ATE = '';
let USER_ROLE = 'admin', USER_NAME = '', USER_CONSULTANT_TYPE = '', USER_GOALS = [];
const PER = 20;
let CHARTS = {};
let METRIC = 'val';

function setMetric(m) {
  METRIC = m;
  $('btnMetricVal').className = m === 'val' ? 'btn' : 'btn-ghost';
  $('btnMetricVal').style.border = m === 'val' ? '' : 'none';
  $('btnMetricLiq').className = m === 'liq' ? 'btn' : 'btn-ghost';
  $('btnMetricLiq').style.border = m === 'liq' ? '' : 'none';
  renderCharts();
}

const COLORS = ['#f7cb45', '#4cba7a', '#3e4344', '#e05c4b', '#d1c9ca', '#fbd96a', '#7dd4a0', '#a0a8aa', '#f08070', '#b8b2b3', '#ffd85a', '#6b8f6e'];
const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ── UTILS ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim();
  if (!s) return 0;
  s = s.replace(/\s/g, '').replace('%', '').replace(/[Rr]\$/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
const val = r => toNumber(r['Valor Liberado']);
const com = r => toNumber(r['Comissao Loja']);
// comissão total em R$: percentual aplicado sobre base + bônus absolutos
const comTotal = r => toNumber(r['Base Comissao']) * com(r) / 100 + toNumber(r['Bonus1']) + toNumber(r['Bonus2']);
// Porcentagem de comissão do consultor (%) extraída do campo "Valorda Comissao"
const pctCorr = r => toNumber(r['Valorda Comissao'] || r['Valor da Comissão'] || r['Comissao Corretor'] || 0);
// Base de cálculo da comissão (Base Comissao ou Valor Liberado como fallback)
const baseCVal = r => { const b = toNumber(r['Base Comissao']); return b > 0 ? b : val(r); };
// Comissão final do consultor em R$ = (Base × % Consultor) / 100
const valComCorretor = r => (baseCVal(r) * pctCorr(r)) / 100;
const fmt = n => 'R$ ' + parseFloat(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = n => 'R$ ' + parseFloat(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getMes = d => { if (!d) return null; const p = d.split('-'); return p[0] + '-' + p[1] };
const fmtData = d => d ? d.split('-').reverse().join('/') : '—';
const fmtPhone = p => {
  if (!p) return '—';
  const s = String(p).replace(/\D/g, '');
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return p;
};

// ── CARGA AUTOMÁTICA (SESSÃO SEGURA POSTGRESQL) ──────────────────────────
async function loadData() {
  try {
    show('loader'); hide('app'); hide('error-box');
    if ($('status-txt')) $('status-txt').textContent = 'carregando';

    const token = localStorage.getItem('auth_token') || '';
    if (!token) {
      hide('loader');
      hide('app');
      show('login-screen');
      $('btn-logout').style.display = 'none';
      if ($('status-txt')) $('status-txt').textContent = 'desconectado';
      stopAutoRefresh();
      return;
    }

    // Esconde a tela de login imediatamente (temos token válido)
    hide('login-screen');
    $('btn-logout').style.display = 'inline-flex';

    const manualUrl = localStorage.getItem('progestor_json_url') || '';
    let endpoint = 'data.php?_t=' + Date.now() + '&token=' + encodeURIComponent(token);
    if (manualUrl) {
      endpoint += '&url=' + encodeURIComponent(manualUrl);
    }

    if ($('loader-msg')) $('loader-msg').textContent = 'carregando dados seguros...';
    
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const res = await fetch(endpoint, ctrl ? { cache: 'no-cache', signal: ctrl.signal } : { cache: 'no-cache' });
    
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      hide('loader');
      hide('app');
      show('login-screen');
      $('btn-logout').style.display = 'none';
      if ($('status-txt')) $('status-txt').textContent = 'sessão expirada';
      stopAutoRefresh();
      return;
    }

    if (!res.ok) throw new Error('HTTP ' + res.status);
    
    const payload = await res.json();
    if (payload && payload.error) throw new Error(payload.error);
    
    initData(payload);
  } catch (e) {
    console.error('loadData erro inesperado:', e);
    hide('loader');
    show('error-box');
    if ($('status-txt')) $('status-txt').textContent = 'erro ao carregar dados';
  }
}

async function fetchJSON(url, timeout = 10000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const fetchPromise = fetch(url, ctrl ? { cache: 'no-cache', signal: ctrl.signal } : { cache: 'no-cache' });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      if (ctrl) ctrl.abort();
      reject(new Error('timeout'));
    }, timeout);
  });

  const res = await Promise.race([fetchPromise, timeoutPromise]);
  if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'sem-resposta'));
  const data = await res.json();
  if (data && typeof data === 'object' && !Array.isArray(data) && data.error) {
    throw new Error(String(data.error));
  }
  if (!Array.isArray(data) && data.data) return data.data; // Adaptação de formato
  if (!Array.isArray(data) || !data.length) throw new Error('vazio');
  return data;
}

function reloadData() { stopAutoRefresh(); loadData(); }

// ── ATUALIZAÇÃO DO ESTADO DA SESSÃO ───────────────────────────
function updateSessionData(payload) {
  USER_ROLE = payload.role;
  USER_NAME = payload.name;
  USER_CONSULTANT_TYPE = payload.consultant_type || '';
  USER_GOALS = payload.goals || [];
  
  const rawData = payload.data || [];
  ALL = rawData.map(r => ({
    ...r,
    'Valor Liberado': toNumber(r['Valor Liberado']),
    'Base Comissao': toNumber(r['Base Comissao']),
    'Comissao Loja': toNumber(r['Comissao Loja']),
    'Desconto Loja': toNumber(r['Desconto Loja']),
    'Bonus1': toNumber(r['R$ Bonus Loja 1']),
    'Bonus2': toNumber(r['R$ Bonus Loja 2'])
  }));
}

// ── CONFIGURAÇÃO DE VISIBILIDADE DO MENU POR CARGO ────────────
function setupMenuVisibility() {
  const isCorr = USER_ROLE === 'corretor';
  const isSuper = USER_ROLE === 'supervisor';
  const isAdmin = USER_ROLE === 'admin';
  
  // Sidebar Desktop
  const navVisao = $('nav-visao');
  const navCorretores = $('nav-corretores');
  const navFilial = $('nav-filial');
  const navTabela = $('nav-tabela');
  const navCorrDash = $('nav-corretor-dash');
  const navAdminUsers = $('nav-admin-users');
  
  if (navCorrDash) navCorrDash.style.display = isCorr ? 'block' : 'none';
  if (navAdminUsers) navAdminUsers.style.display = isAdmin ? 'block' : 'none';
  if (navVisao) navVisao.style.display = isCorr ? 'none' : 'block';
  if (navCorretores) navCorretores.style.display = isCorr ? 'none' : 'block';
  if (navFilial) navFilial.style.display = (isAdmin || isSuper) ? 'block' : 'none';
  if (navTabela) navTabela.style.display = 'block';
  
  // Mobile Nav
  const mobVisao = $('mob-visao');
  const mobCorretores = $('mob-corretores');
  const mobFilial = $('mob-filial');
  const mobTabela = $('mob-tabela');
  const mobCorrDash = $('mob-corretor-dash');
  const mobAdminUsers = $('mob-admin-users');
  
  if (mobCorrDash) mobCorrDash.style.display = isCorr ? 'block' : 'none';
  if (mobAdminUsers) mobAdminUsers.style.display = isAdmin ? 'block' : 'none';
  if (mobVisao) mobVisao.style.display = isCorr ? 'none' : 'block';
  if (mobCorretores) mobCorretores.style.display = isCorr ? 'none' : 'block';
  if (mobFilial) mobFilial.style.display = (isAdmin || isSuper) ? 'block' : 'none';
  if (mobTabela) mobTabela.style.display = 'block';
  
  // Configuração URL (Apenas Admin)
  const btnUrlConfig = document.querySelector('.btn-link[onclick="openUrlModal()"]');
  if (btnUrlConfig) {
    btnUrlConfig.style.display = isAdmin ? 'inline-block' : 'none';
  }

  // Filtro de Corretor na Barra Lateral (oculto para o próprio corretor)
  const sbFCorrGroup = $('sb-fCorr-group');
  if (sbFCorrGroup) sbFCorrGroup.style.display = isCorr ? 'none' : 'block';
  const mobFCorrGroup = $('mob-fCorr-group');
  if (mobFCorrGroup) mobFCorrGroup.style.display = isCorr ? 'none' : 'block';
}

// ── INIT ──────────────────────────────────────────────────────
function initData(payload) {
  updateSessionData(payload);
  hide('loader'); hide('error-box'); show('app');
  $('status-txt').textContent = ALL.length + ' registros';
  if ($('sidebar-total')) $('sidebar-total').textContent = ALL.length.toLocaleString('pt-BR');
  $('ts').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');
  
  setupMenuVisibility();
  
  buildFilters();
  buildTvFilSelect();
  rebuildMobFilters();
  
  // Define a aba inicial correta baseado no cargo
  if (USER_ROLE === 'corretor') {
    switchTab('corretor-dash', $('nav-corretor-dash'));
  } else {
    switchTab('visao', $('nav-visao'));
  }
  
  applyFilter();
  startAutoRefresh();
}

function show(id) {
  const el = $(id); if (!el) return;
  if (id === 'login-screen') {
    el.classList.remove('hidden');
  } else {
    el.style.display = 'block';
  }
}
function hide(id) {
  const el = $(id); if (!el) return;
  if (id === 'login-screen') {
    el.classList.add('hidden');
  } else {
    el.style.display = 'none';
  }
}

// ── FILTROS ───────────────────────────────────────────────────
function buildCorretorFilter() {
  const elCorr = $('fCorr');
  if (!elCorr) return;
  const curCorr = elCorr.value;

  // Se houver filiais selecionadas na sidebar, filtra apenas corretores que possuem produção nessas filiais
  const fils = [...($('fFil').selectedOptions || [])].map(o => o.value).filter(Boolean);
  const rows = fils.length ? ALL.filter(r => fils.includes(String(r.Filial || ''))) : ALL;

  const corretores = [...new Set(rows.map(r => String(r.Corretor || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  elCorr.innerHTML = '<option value="">Todos os corretores</option>';
  corretores.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    if (c === curCorr) o.selected = true;
    elCorr.appendChild(o);
  });
}

function buildFilters() {
  const fillSelect = (id, arr, allLabel = 'Todos') => {
    const el = $(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${allLabel}</option>`;
    arr.forEach(v => { const o = document.createElement('option'); o.value = o.textContent = v; if (v === cur) o.selected = true; el.appendChild(o) });
  };
  // Meses — une Data da Liberação + Data Comissao Loja para cobrir ambos os KPIs
  const mesesLib = ALL.map(r => getMes(r['Data da Liberação'])).filter(Boolean);
  const mesesCom = ALL.map(r => getMes(r['Data Comissao Loja'])).filter(Boolean);
  const meses = [...new Set([...mesesLib, ...mesesCom])].sort();
  // MÊS — dropdown multi
  const elMes = $('fMes'), curM = elMes ? elMes.value : '';
  if (elMes) {
    elMes.innerHTML = '<option value="">Todos</option>';
    meses.forEach(m => { const [y, mo] = m.split('-'); const o = document.createElement('option'); o.value = m; o.textContent = MES[parseInt(mo) - 1] + '/' + y.slice(2); if (m === curM) o.selected = true; elMes.appendChild(o) });
  }
  // Filtra só os tipos permitidos
  const tiposPermitidos = Object.keys(TIPO_BADGE);
  const tiposPresentes = [...new Set(ALL.map(r => r.Tipo))].filter(t => tiposPermitidos.includes(t)).sort();
  fillSelect('fTipo', tiposPresentes);
  fillSelect('fBco', [...new Set(ALL.map(r => r.BCO))].sort());
  fillSelect('fParc', [...new Set(ALL.map(r => r.Parceiro))].sort());
  fillSelect('fConv', [...new Set(ALL.map(r => String(r.Produto || '').trim()).filter(Boolean))].sort());
  
  // Filial — valor é o código, label é o nome
  // Ordena filiais alfabeticamente pelo nome mapeado
  const rawFilCodes = [...new Set(ALL.map(r => String(r.Filial || '')).filter(Boolean))];
  const filCodes = rawFilCodes.sort((a, b) => (FILIAIS[a] || a).localeCompare(FILIAIS[b] || b));
  const elFil = $('fFil');
  if (elFil) {
    const curFils = [...elFil.selectedOptions].map(o => o.value);
    elFil.innerHTML = '';
    filCodes.forEach(cod => { const o = document.createElement('option'); o.value = cod; o.textContent = filialNome(cod); if (curFils.includes(cod)) o.selected = true; elFil.appendChild(o) });
    buildDropdown('fFil', filCodes.map(c => ({ val: c, label: filialNome(c) })), curFils, 'Todas', 'Todas as filiais');
  }

  // Canal de venda (Filtros Principais)
  const canalCodes = [...new Set(ALL.map(r => String(r.Canaldevenda || '')).filter(Boolean))];
  canalCodes.sort((a, b) => (CANAIS[a] || a).localeCompare(CANAIS[b] || b));
  const elCanal = $('fCanal'), curCanal = elCanal ? elCanal.value : '';
  if (elCanal) {
    elCanal.innerHTML = '<option value="">Todos</option>';
    canalCodes.forEach(cod => { const o = document.createElement('option'); o.value = cod; o.textContent = canalNome(cod); if (cod === curCanal) o.selected = true; elCanal.appendChild(o) });
  }

  // Corretor / Consultor (Filtros Rápidos)
  buildCorretorFilter();
}

function applyFilter() {
  let mes = $('fMes') ? $('fMes').value : '';
  let fDe = $('fDe') ? $('fDe').value : '';
  let fAte = $('fAte') ? $('fAte').value : '';

  // quando seleciona mês, limpa período e vice-versa
  if (mes !== PREV_MES && mes) {
    if ($('fDe')) $('fDe').value = '';
    if ($('fAte')) $('fAte').value = '';
    fDe = '';
    fAte = '';
  } else if ((fDe !== PREV_DE && fDe) || (fAte !== PREV_ATE && fAte)) {
    if ($('fMes')) $('fMes').value = '';
    mes = '';
  }
  PREV_MES = mes;
  PREV_DE = fDe;
  PREV_ATE = fAte;

  const tipo = $('fTipo') ? $('fTipo').value : '';
  const bco = $('fBco') ? $('fBco').value : '';
  const parc = $('fParc') ? $('fParc').value : '';
  const conv = $('fConv') ? $('fConv').value : '';
  const canal = $('fCanal') ? $('fCanal').value : '';
  const corr = $('fCorr') ? $('fCorr').value : '';
  const srch = $('srch') ? $('srch').value.toLowerCase().trim() : '';

  MESES_SEL = mes ? [mes] : [];
  FILS_SEL = $('fFil') ? [...($('fFil').selectedOptions || [])].map(o => o.value).filter(Boolean) : [];
  const meses = MESES_SEL;
  const fils = FILS_SEL;

  const baseFilter = r => {
    if (tipo && r.Tipo !== tipo) return false;
    if (bco && r.BCO !== bco) return false;
    if (parc && r.Parceiro !== parc) return false;
    if (conv && String(r.Produto || '').trim() !== conv) return false;
    if (fils.length && !fils.includes(String(r.Filial || ''))) return false;
    if (canal && String(r.Canaldevenda || '') !== canal) return false;
    if (corr && String(r.Corretor || '').trim() !== corr) return false;
    if (srch && !(r.Nome || '').toLowerCase().includes(srch) && !(r.Contrato || '').toLowerCase().includes(srch) && !(r.CPF || '').includes(srch)) return false;
    return true;
  };

  FILTERED = ALL.filter(r => {
    if (meses.length) {
      const mesLib = getMes(r['Data da Liberação']) || '';
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (!meses.includes(mesLib) && !meses.includes(mesCom)) return false;
    }
    if (fDe || fAte) {
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      // mesma lógica do filtro de mês: passa se qualquer data está no período
      const libOk = lib && (!fDe || lib >= fDe) && (!fAte || lib <= fAte);
      const comOk = com && (!fDe || com >= fDe) && (!fAte || com <= fAte);
      if (!libOk && !comOk) return false;
    }
    return baseFilter(r);
  });

  PAGE = 0; render();
}

function clearFilters() {
  ['fTipo', 'fBco', 'fParc', 'fCanal', 'fConv', 'fCorr'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  if ($('fMes')) $('fMes').value = '';
  // Limpar filial
  if ($('fFil')) [...$('fFil').options].forEach(o => o.selected = false);
  const filPanel = $('fFil-panel');
  if (filPanel) {
    filPanel.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = false; });
    filPanel.querySelectorAll('.sb-opt').forEach(o => o.classList.remove('sel'));
  }
  const filLbl = $('fFil-label');
  if (filLbl) filLbl.textContent = 'Todas';
  if ($('fDe')) $('fDe').value = ''; 
  if ($('fAte')) $('fAte').value = ''; 
  if ($('srch')) $('srch').value = '';
  buildCorretorFilter();
  applyFilter();
}
function clearMes() {
  if ($('fMes')) [...$('fMes').options].forEach(o => o.selected = false);
  if ($('fMes-pills')) $('fMes-pills').querySelectorAll('.mes-pill').forEach(p => p.classList.remove('on'));
  if ($('fMes-clear')) $('fMes-clear').style.display = 'none';
  MESES_SEL = [];
}
['fMes', 'fCorr', 'fTipo', 'fBco', 'fParc', 'fCanal', 'fConv'].forEach(id => { const el = $(id); if (el) el.onchange = applyFilter });
const srchEl = $('srch'); if (srchEl) srchEl.oninput = applyFilter;

// ── RENDER ────────────────────────────────────────────────────
function render() {
  renderKpis(); // Atualiza sempre os KPIs principais com base em FILTERED
  if (USER_ROLE === 'corretor') {
    renderCorretorDashboard();
    renderTabela();
  } else {
    renderCharts();
    renderCorretores();
    renderTabela();
  }
}

function renderKpis() {
  const mes = MESES_SEL.length ? MESES_SEL[0] : '';
  const meses = mes ? [mes] : [];
  const tipo = $('fTipo').value, bco = $('fBco').value, parc = $('fParc').value;
  const fDe = $('fDe').value, fAte = $('fAte').value;

  const isProdInPeriod = r => {
    if (meses.length) {
      const mesLib = getMes(r['Data da Liberação']) || '';
      if (!meses.includes(mesLib)) return false;
    }
    if (fDe || fAte) {
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      if (!lib || (fDe && lib < fDe) || (fAte && lib > fAte)) return false;
    }
    return true;
  };

  const isComInPeriod = r => {
    if (meses.length) {
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (!meses.includes(mesCom)) return false;
    }
    if (fDe || fAte) {
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      if (!com || (fDe && com < fDe) || (fAte && com > fAte)) return false;
    }
    return true;
  };

  // Produção: contratos cuja Data da Liberação está nos meses/período filtrados
  const prodRows = FILTERED.filter(isProdInPeriod);
  const tot = prodRows.length;
  const sumV = prodRows.reduce((a, r) => a + val(r), 0);
  const tick = tot ? sumV / tot : 0;

  // Comissão Loja: contratos cuja Data Comissao Loja está nos meses/período filtrados
  const comRows = FILTERED.filter(isComInPeriod);
  const sumC = comRows.reduce((a, r) => a + comTotal(r), 0);
  const sumD = comRows.reduce((a, r) => a + (r['Desconto Loja'] || 0), 0);
  const sumL = sumC - sumD;
  const tickCom = comRows.length ? sumC / comRows.length : 0;

  if ($('kTot')) $('kTot').textContent = tot.toLocaleString('pt-BR');
  if ($('kTotS')) $('kTotS').textContent = 'de ' + ALL.length + ' totais';
  if ($('kVal')) $('kVal').textContent = fmtK(sumV);
  if ($('kValS')) $('kValS').textContent = 'valor total liberado';

  if ($('kCom')) $('kCom').textContent = fmtK(sumC);
  if ($('kComS')) $('kComS').textContent = 'por Data Comissão Loja';
  if ($('kLiq')) $('kLiq').textContent = fmtK(sumL);
  if ($('kLiqS')) $('kLiqS').textContent = 'produção líquida da loja';

  // Comissão do consultor (Valorda Comissao)
  const sumComConsultor = prodRows.reduce((a, r) => a + valComCorretor(r), 0);
  if ($('kComConsultor')) $('kComConsultor').textContent = fmtK(sumComConsultor);
  if ($('kComConsultorS')) $('kComConsultorS').textContent = 'Comissões recebidas ou a receber';

  if ($('kTick')) $('kTick').textContent = fmtK(tickCom);
  if ($('kTickS')) $('kTickS').textContent = 'ticket médio de comissão';
}

function groupBy(arr, key, valFn) { const m = {}; arr.forEach(r => { const k = r[key] || '—'; m[k] = (m[k] || 0) + valFn(r) }); return Object.entries(m).sort((a, b) => b[1] - a[1]) }




function mkChart(id, type, labels, data, colors, opts = {}) {
  if (CHARTS[id]) CHARTS[id].destroy();
  const ctx = $(id).getContext('2d');
  const isDoughnut = type === 'doughnut' || type === 'pie';
  const totalForTooltip = () => (Array.isArray(data) ? data.reduce((a, n) => a + (Number(n) || 0), 0) : 0);
  CHARTS[id] = new Chart(ctx, {
    type,
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, borderRadius: type === 'bar' ? 4 : 0, ...(opts.ds || {}) }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        ...(opts.plugins || {}),
        ...(isDoughnut ? {
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(24,24,27,.96)',
            borderColor: 'rgba(255,255,255,.10)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 12,
            displayColors: false,
            caretSize: 0,
            titleColor: '#fafafa',
            bodyColor: '#fafafa',
            bodyFont: { family: 'JetBrains Mono, monospace', size: 11, weight: '600' },
            callbacks: {
              title: () => undefined,
              label: (c) => {
                const idx = c.dataIndex;
                const v = Number((Array.isArray(c.dataset?.data) ? c.dataset.data[idx] : data[idx]) || 0);
                const t = totalForTooltip();
                const p = t ? (v / t) * 100 : 0;
                return `${fmt(v)} (${p.toFixed(1)}%)`;
              }
            }
          }
        } : {})
      },
      scales: opts.scales || {},
      ...(isDoughnut && opts.extra ? { cutout: opts.extra.cutout || '62%' } : {}),
      onClick: (e, els) => {
        if (!els.length) return;
        const label = CHARTS[id].data.labels[els[0].index];
        if (opts.onClickLabel) opts.onClickLabel(label);
      },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
    },
    plugins: [...(opts.pluginsList || [])]
  });
}

function makeLegend(el, labels, colors) {
  if (!el) return;
  el.style.display = 'flex';
  el.style.flexWrap = 'wrap';
  el.style.gap = '8px 12px';
  el.style.marginTop = '1rem';

  el.innerHTML = labels.map((l, i) => {
    let formattedLabel = String(l || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/(PORTABILIDADE)(REFIN)/gi, '$1 / $2')
      .replace(/(PORTABILIDADE)(NOVO)/gi, '$1 / $2')
      .replace(/(REFIN)(NOVO)/gi, '$1 / $2')
      .trim();

    return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--t1);background:var(--s1);padding:4px 10px;border-radius:99px;border:1px solid var(--b2)">
      <span class="legend-dot" style="background:${colors[i % colors.length]};width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
      ${formattedLabel}
    </span>`;
  }).join('');
}

// Aplica filtro ao clicar num gráfico, com toggle (clica 2x para remover)
function applyChartFilter(field, value) {
  const el = $(field);
  if (!el) return;
  if (el.value === value) { el.value = ''; } // toggle off
  else { el.value = value; }
  applyFilter();
  setTimeout(renderCharts, 50);
}

// Aplica filtro de mês ao clicar no gráfico de barras
function applyChartMes(label) {
  const el = $('fMes');
  if (!el) return;
  // Converter label "Jan/24" → "2024-01"
  const parts = label.split('/');
  const mo = String(MES.indexOf(parts[0]) + 1).padStart(2, '0');
  const yr = '20' + parts[1];
  const val = yr + '-' + mo;
  if (el.value === val) { el.value = ''; }
  else { el.value = val; }
  applyFilter();
  setTimeout(renderCharts, 50);
}

// Aplica filtro de filial ao clicar — precisa mapear nome→código
function applyChartFilial(nome) {
  const el = $('fFil');
  if (!el) return;
  const entry = Object.entries(FILIAIS).find(([, n]) => n === nome);
  if (!entry) return;
  const cod = entry[0];
  // toggle: se já selecionado, deseleciona
  const opt = [...el.options].find(o => o.value === cod);
  if (opt) { opt.selected = !opt.selected; }
  // Sync dropdown de filiais
  const panel = $('fFil-panel');
  if (panel) {
    const cb = panel.querySelector(`input[value="${cod}"]`);
    if (cb) { cb.checked = opt ? opt.selected : false; cb.closest('.sb-opt').classList.toggle('sel', cb.checked); }
  }
  FILS_SEL = [...el.selectedOptions].map(o => o.value);
  applyFilter();
  setTimeout(renderCharts, 50);
}

// Aplica filtro de canal ao clicar — mapeia nome→código
function applyChartCanal(nome) {
  const el = $('fCanal');
  if (!el) return;
  const entry = Object.entries(CANAIS).find(([, n]) => n === nome);
  if (!entry) return;
  el.value = el.value === entry[0] ? '' : entry[0];
  applyFilter();
  setTimeout(renderCharts, 50);
}

function renderCharts() {
  const metricFn = METRIC === 'val' ? val : r => comTotal(r) - parseFloat(r['Desconto Loja'] || 0);

  const mes = MESES_SEL.length ? MESES_SEL[0] : '';
  const meses = mes ? [mes] : [];
  const fDe = $('fDe').value, fAte = $('fAte').value;

  const isProdInPeriod = r => {
    if (meses.length) {
      const mesLib = getMes(r['Data da Liberação']) || '';
      if (!meses.includes(mesLib)) return false;
    }
    if (fDe || fAte) {
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      if (!lib || (fDe && lib < fDe) || (fAte && lib > fAte)) return false;
    }
    return true;
  };

  const isComInPeriod = r => {
    if (meses.length) {
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (!meses.includes(mesCom)) return false;
    }
    if (fDe || fAte) {
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      if (!com || (fDe && com < fDe) || (fAte && com > fAte)) return false;
    }
    return true;
  };

  const chartRows = FILTERED.filter(METRIC === 'val' ? isProdInPeriod : isComInPeriod);

  const byTipo = groupBy(chartRows, 'Tipo', metricFn).slice(0, 12);
  const byBco = groupBy(chartRows, 'BCO', metricFn).slice(0, 8);
  const byParc = groupBy(chartRows, 'Parceiro', metricFn).slice(0, 6);
  const mesMap = {}; chartRows.forEach(r => { const k = getMes(METRIC === 'val' ? r['Data da Liberação'] : r['Data Comissao Loja']); if (k) mesMap[k] = (mesMap[k] || 0) + 1 });
  const mesArr = Object.entries(mesMap).sort((a, b) => a[0].localeCompare(b[0]));
  const mesLabels = mesArr.map(([k]) => { const [y, mo] = k.split('-'); return MES[parseInt(mo) - 1] + '/' + y.slice(2) });
  const barScales = { x: { grid: { color: 'transparent' }, ticks: { color: '#6b7080', font: { size: 10 }, maxRotation: 45 } }, y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#6b7080', font: { size: 10 }, callback: n => Math.round(n) } } };

  mkChart('cTipo', 'doughnut', byTipo.map(x => x[0]), byTipo.map(x => x[1]), COLORS.slice(0, byTipo.length), { extra: { cutout: '62%' }, onClickLabel: v => applyChartFilter('fTipo', v) });
  makeLegend($('lgTipo'), byTipo.map(x => x[0]), COLORS);

  mkChart('cBco', 'doughnut', byBco.map(x => x[0]), byBco.map(x => x[1]), COLORS.slice(2, 2 + byBco.length), { extra: { cutout: '62%' }, onClickLabel: v => applyChartFilter('fBco', v) });
  makeLegend($('lgBco'), byBco.map(x => x[0]), COLORS.slice(2));

  mkChart('cMes', 'bar', mesLabels, mesArr.map(x => x[1]), '#f7cb45', { ds: { backgroundColor: 'rgba(247,203,69,.8)', borderRadius: 4, hoverBackgroundColor: '#f7cb45' }, scales: barScales, onClickLabel: v => applyChartMes(v) });

  mkChart('cParc', 'doughnut', byParc.map(x => x[0]), byParc.map(x => x[1]), COLORS.slice(4, 4 + byParc.length), { extra: { cutout: '62%' }, onClickLabel: v => applyChartFilter('fParc', v) });
  makeLegend($('lgParc'), byParc.map(x => x[0]), COLORS.slice(4));

  // Filiais
  const byFilRaw = groupBy(FILTERED, 'Filial', metricFn).slice(0, 10);
  const byFil = byFilRaw.map(([cod, v]) => [filialNome(cod), v]);
  mkChart('cFil', 'doughnut', byFil.map(x => x[0]), byFil.map(x => x[1]), COLORS.slice(6, 6 + byFil.length), { extra: { cutout: '62%' }, onClickLabel: v => applyChartFilial(v) });
  makeLegend($('lgFil'), byFil.map(x => x[0]), COLORS.slice(6));

  // Canais de venda
  const byCanalRaw = groupBy(FILTERED, 'Canaldevenda', metricFn).slice(0, 10);
  const byCanal = byCanalRaw.map(([cod, v]) => [canalNome(cod), v]);
  mkChart('cCanal', 'doughnut', byCanal.map(x => x[0]), byCanal.map(x => x[1]), COLORS.slice(8, 8 + byCanal.length), { extra: { cutout: '62%' }, onClickLabel: v => applyChartCanal(v) });
  makeLegend($('lgCanal'), byCanal.map(x => x[0]), COLORS.slice(8));
}

function renderCorretores() {
  const m = {};
  const mes = MESES_SEL.length ? MESES_SEL[0] : '';
  const meses = mes ? [mes] : [];
  const fDe = $('fDe').value, fAte = $('fAte').value;

  const isProdInPeriod = r => {
    if (meses.length) {
      const mesLib = getMes(r['Data da Liberação']) || '';
      if (!meses.includes(mesLib)) return false;
    }
    if (fDe || fAte) {
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      if (!lib || (fDe && lib < fDe) || (fAte && lib > fAte)) return false;
    }
    return true;
  };

  const isComInPeriod = r => {
    if (meses.length) {
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (!meses.includes(mesCom)) return false;
    }
    if (fDe || fAte) {
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      if (!com || (fDe && com < fDe) || (fAte && com > fAte)) return false;
    }
    return true;
  };

  FILTERED.forEach(r => {
    const k = (r.Corretor || '—').trim();
    const prodOk = isProdInPeriod(r);
    const comOk = isComInPeriod(r);

    if (!prodOk && !comOk) return;

    if (!m[k]) m[k] = { n: 0, v: 0, c: 0, d: 0 };
    if (prodOk) {
      m[k].n++;
      m[k].v += val(r);
    }
    if (comOk) {
      m[k].c += comTotal(r);
      m[k].d += (r['Desconto Loja'] || 0);
    }
  });

  $('tbCorr').innerHTML = Object.entries(m).sort((a, b) => (b[1].c - b[1].d) - (a[1].c - a[1].d)).map(([nome, d], i) => {
    const liq = d.c - d.d;
    return `<tr>
      <td style="color:var(--t3);font-family:var(--mono);font-size:11px">${i + 1}</td>
      <td style="font-weight:600">${nome}</td>
      <td style="font-family:var(--mono);text-align:center">${d.n}</td>
      <td style="font-family:var(--mono);text-align:right">${fmt(d.v)}</td>
      <td style="font-family:var(--mono);text-align:right;color:#22d3ee;font-weight:600">${fmt(liq)}</td>
      <td style="font-family:var(--mono);text-align:right;color:var(--t2)">${d.n > 0 ? fmt(d.v / d.n) : '—'}</td>
    </tr>`;
  }).join('');
}

let VER_TUDO = false;
function toggleVerTudo() {
  VER_TUDO = !VER_TUDO;
  $('bVerTudo').textContent = VER_TUDO ? 'Paginar' : 'Ver tudo';
  $('bVerTudo').style.background = VER_TUDO ? 'var(--accent2)' : '';
  $('bVerTudo').style.color = VER_TUDO ? '#000' : '';
  $('pagBar').style.display = VER_TUDO ? 'none' : 'flex';
  PAGE = 0; renderTabela();
}

function stCom(s) {
  if (!s) return '—';
  if (s === 'RECEBIDA') return '<span style="color:var(--green);font-size:10px;font-weight:600"><i class="ph ph-check" style="vertical-align:middle;margin-right:2px"></i> REC</span>';
  if (s === 'PENDENTE') return '<span style="color:var(--accent4);font-size:10px;font-weight:600"><i class="ph ph-hourglass" style="vertical-align:middle;margin-right:2px"></i> PEN</span>';
  return `<span style="font-size:10px">${s}</span>`;
}

function renderTabela() {
  const pages = Math.max(1, Math.ceil(FILTERED.length / PER)); if (PAGE >= pages) PAGE = 0;
  const slice = VER_TUDO ? FILTERED : FILTERED.slice(PAGE * PER, (PAGE + 1) * PER);
  $('tblCount').textContent = FILTERED.length + ' registros';
  const baseC = r => parseFloat(r['Base Comissao'] || 0);
  const isCorr = USER_ROLE === 'corretor';

  // Controla visibilidade dos headers das colunas restritas
  const hideCols = ['th-com-pct-loja', 'th-com-rs-loja', 'th-com-pct-corr'];
  hideCols.forEach(id => {
    const th = $(id);
    if (th) th.style.display = isCorr ? 'none' : '';
  });

  $('tbContr').innerHTML = slice.map(r => {
    const comR = comTotal(r);
    return `<tr>
    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;font-weight:500;white-space:nowrap">${r.Nome || '—'}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--muted)">${r.CPF || '—'}</td>
    <td style="font-family:var(--mono);font-size:11px;color:var(--t1);white-space:nowrap">${fmtPhone(r.Celular || r['Celular'] || r.Telefone)}</td>
    <td style="font-family:var(--mono);font-size:10px;color:var(--muted)">${r.Contrato || '—'}</td>
    <td style="font-size:11px;white-space:nowrap">${r.BCO || '—'}</td>
    <td><span class="badge ${TIPO_BADGE[(r.Tipo || '').trim()] || 'b-ac'}">${(r.Tipo || '—').trim()}</span></td>
    <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--muted);white-space:nowrap">${r.Produto || '—'}</td>
    <td style="font-family:var(--mono);text-align:center">${r['QuantidadedePrestação'] || '—'}</td>
    <td style="font-family:var(--mono);text-align:right;white-space:nowrap">${fmt(val(r))}</td>
    ${isCorr ? '' : `<td style="font-family:var(--mono);text-align:right">${com(r).toFixed(2)}%</td>`}
    ${isCorr ? '' : `<td style="font-family:var(--mono);text-align:right;white-space:nowrap;color:#4ade80">${comR > 0 ? fmt(comR) : '—'}</td>`}
    <td style="font-family:var(--mono);text-align:right;white-space:nowrap;color:#22d3ee;font-weight:600">${(() => { const d = parseFloat(r['Desconto Loja'] || 0); const l = comR - d; return comR > 0 ? fmt(l) : '—' })()}</td>
    ${isCorr ? '' : `<td style="font-family:var(--mono);text-align:right">${pctCorr(r) > 0 ? pctCorr(r).toFixed(2) + '%' : '—'}</td>`}
    <td style="font-family:var(--mono);text-align:right;white-space:nowrap;color:#38bdf8;font-weight:600">${valComCorretor(r) > 0 ? fmt(valComCorretor(r)) : '—'}</td>
    <td style="font-family:var(--mono);font-size:11px">${fmtData(r['Data da Liberação'])}</td>
    <td style="font-family:var(--mono);font-size:11px">${fmtData(r['Data Comissao Loja'])}</td>
    <td style="text-align:center">${stCom(r['Status Comissao Loja'])}</td>
    <td style="font-size:11px;white-space:nowrap">${canalNome(r.Canaldevenda) || '—'}</td>
    <td style="font-size:11px;white-space:nowrap">${r.Parceiro || '—'}</td>
    <td style="font-size:11px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(r.Corretor || '—').trim()}</td>
    <td style="font-family:var(--mono);font-size:11px;white-space:nowrap">${filialNome(r.Filial) || '—'}</td>
  </tr>`;
  }).join('');
  if (!VER_TUDO) {
    $('pInfo').textContent = `Pág. ${PAGE + 1} de ${pages} — ${FILTERED.length} registros`;
    $('bPrev').disabled = PAGE === 0; $('bNext').disabled = PAGE >= pages - 1;
  }
}

function changePage(d) { PAGE += d; renderTabela() }
// ── MÊS PILLS ────────────────────────────────────────────────
function buildMesPills(meses, selected) {
  const container = $('fMes-pills');
  if (!container) return;
  container.innerHTML = '';
  meses.forEach(m => {
    const [y, mo] = m.split('-');
    const label = MES[parseInt(mo) - 1] + '/' + y.slice(2);
    const pill = document.createElement('span');
    pill.className = 'mes-pill' + (selected.includes(m) ? ' on' : '');
    pill.textContent = label;
    pill.dataset.val = m;
    pill.onclick = () => {
      pill.classList.toggle('on');
      // sync hidden select
      [...$('fMes').options].forEach(o => {
        if (o.value === m) o.selected = pill.classList.contains('on');
      });
      // mostrar/esconder botão limpar
      const hasAny = !!container.querySelector('.mes-pill.on');
      if ($('fMes-clear')) $('fMes-clear').style.display = hasAny ? '' : 'none';
      MESES_SEL = [...($('fMes').selectedOptions || [])].map(o => o.value).filter(Boolean);
      applyFilter();
    };
    container.appendChild(pill);
  });
  // mostrar botão limpar se há seleção
  if ($('fMes-clear')) $('fMes-clear').style.display = selected.length ? '' : 'none';
}

// ── DROPDOWNS GENÉRICOS (Mês + Filial) ───────────────────────
function buildDropdown(id, items, selected, emptyLabel, allLabel) {
  const panel = $(id + '-panel');
  const sel = $(id);
  const lbl = $(id + '-label');
  if (!panel) return;
  panel.innerHTML = '';
  items.forEach(({ val, label }) => {
    const div = document.createElement('label');
    div.className = 'sb-opt' + (selected.includes(val) ? ' sel' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = val; cb.checked = selected.includes(val);
    cb.addEventListener('change', () => {
      div.classList.toggle('sel', cb.checked);
      syncDrop(id);
      if (id === 'fFil') {
        buildCorretorFilter();
      }
      applyFilter();
    });
    div.appendChild(cb);
    div.appendChild(document.createTextNode(' ' + label));
    panel.appendChild(div);
  });
  updateDropLabel(id, emptyLabel, allLabel);
}

function syncDrop(id) {
  const panel = $(id + '-panel');
  const sel = $(id);
  if (!panel || !sel) return;
  const checks = [...panel.querySelectorAll('input[type=checkbox]')];
  [...sel.options].forEach(o => {
    const cb = checks.find(c => c.value === o.value);
    o.selected = cb ? cb.checked : false;
  });
}

function updateDropLabel(id, emptyLabel, allLabel) {
  const sel = $(id);
  const lbl = $(id + '-label');
  if (!sel || !lbl) return;
  const chosen = [...sel.selectedOptions].map(o => o.textContent);
  if (chosen.length === 0) lbl.textContent = emptyLabel || 'Todos';
  else if (chosen.length === 1) lbl.textContent = chosen[0].slice(0, 20);
  else lbl.textContent = chosen.length + ' selecionados';
}

function toggleDrop(id, e) {
  if (e) e.stopPropagation();
  const panel = $(id + '-panel');
  const btn = $(id + '-btn');
  if (!panel || !btn) return;
  const isOpen = panel.classList.contains('open');
  // fecha todos
  document.querySelectorAll('.sb-drop-panel.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.sb-drop-btn.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) { panel.classList.add('open'); btn.classList.add('open'); }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.sb-drop-wrap') && !e.target.closest('.sb-drop-panel')) {
    document.querySelectorAll('.sb-drop-panel.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.sb-drop-btn.open').forEach(b => b.classList.remove('open'));
  }
});

function switchTab(id, btn) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  if (btn) btn.classList.add('on');
  $('p-' + id).classList.add('on');

  // Sync bottom nav mobile
  document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('on'));
  const mobBtn = $('mob-' + id);
  if (mobBtn) mobBtn.classList.add('on');

  const isFilial = id === 'filial';
  const isCorrDash = id === 'corretor-dash';
  const isAdminUsers = id === 'admin-users';
  const sbCtrl = $('sb-filial-controls');
  if (sbCtrl) sbCtrl.style.display = isFilial ? 'block' : 'none';
  // Esconder filtros rápidos quando em filial, painel do corretor ou admin de usuários
  const sbQuick = $('sb-quick-filters');
  if (sbQuick) sbQuick.style.display = (isFilial || isCorrDash || isAdminUsers) ? 'none' : 'block';

  // Apenas elementos DENTRO de painéis — já controlados pelo CSS .panel/.panel.on
  // Não tocar em elementos fora de painéis (ex: #main-kpi-grid)

  // Controla o filtro global (De/Ate/Tipo/Banco/Parceiro/Convenio/Busca)
  // Aparece apenas nas abas de conteúdo normal (Contratos, Visão Geral, etc.)
  // Fica oculto em Meu Painel (tem filtros próprios), Filial e Admin Users
  const globalFilterBar = $('global-filter-bar');
  if (globalFilterBar) {
    globalFilterBar.style.display = (isCorrDash || isFilial || isAdminUsers) ? 'none' : '';
  }

  // Controla o KPI grid do Admin separadamente: visível somente para admin/supervisor
  // nas abas de conteúdo (não filial, não meu painel, não admin-users)
  const mainKpiGrid = $('main-kpi-grid');
  if (mainKpiGrid) {
    const showGrid = USER_ROLE !== 'corretor' && !isFilial && !isCorrDash && !isAdminUsers;
    mainKpiGrid.style.display = showGrid ? 'grid' : 'none';
  }

  if (id === 'visao') setTimeout(renderCharts, 50);
  if (id === 'corretor-dash') renderCorretorDashboard();
  if (id === 'admin-users') loadAdminUsers();
  if (isFilial) {
    if (TV_FILS.length) renderTv();
    else {
      const empty = $('tv-empty');
      const tc = $('tv-content');
      if (empty) empty.style.display = 'flex';
      if (tc) tc.innerHTML = '';
      const isMob = window.innerWidth <= 1200;
      const emptyBtn = $('tv-empty-btn');
      if (emptyBtn) emptyBtn.style.display = isMob ? 'block' : 'none';
      if (isMob) setTimeout(() => openMobDrawer(), 400);
    }
  }
}

// ── AUTO-REFRESH ──────────────────────────────────────────────
const REFRESH_INTERVAL = 60;
let countdown = REFRESH_INTERVAL, countTimer = null, refreshTimer = null;

function updateCountdown() {
  if ($('countdown')) $('countdown').textContent = countdown + 's';
  if (countdown <= 0) { autoRefresh(); return; }
  countdown--;
  countTimer = setTimeout(updateCountdown, 1000);
}

function startAutoRefresh() {
  stopAutoRefresh();
  countdown = REFRESH_INTERVAL;
  updateCountdown();
}

function stopAutoRefresh() {
  clearTimeout(countTimer);
  clearTimeout(refreshTimer);
}

async function autoRefresh() {
  try {
    const token = localStorage.getItem('auth_token') || '';
    if (!token) return;
    
    const manualUrl = localStorage.getItem('progestor_json_url') || '';
    let endpoint = 'data.php?_t=' + Date.now() + '&token=' + encodeURIComponent(token);
    if (manualUrl) {
      endpoint += '&url=' + encodeURIComponent(manualUrl);
    }
    const res = await fetch(endpoint, { cache: 'no-cache' });
    if (res.status === 401) {
      localStorage.removeItem('auth_token');
      hide('app');
      show('login-screen');
      $('btn-logout').style.display = 'none';
      stopAutoRefresh();
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const payload = await res.json();
    
    updateSessionData(payload);
    
    $('ts').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');
    $('status-txt').textContent = ALL.length + ' registros';
    if ($('sidebar-total')) $('sidebar-total').textContent = ALL.length.toLocaleString('pt-BR');
    buildFilters(); applyFilter();
  } catch (e) { $('status-txt').textContent = 'falha ao atualizar'; }
  countdown = REFRESH_INTERVAL;
  updateCountdown();
}

// ── MODO TV FILIAL ───────────────────────────────────────────
let TV_FIL = '',
  TV_FILS = [],
  TV_FIL_IDX = 0,
  TV_PERIODO = 'mes',
  TV_INTERVAL = 30,
  TV_ALERT_SOUND = true,   // toggle de som
  TV_ALERT_SOUND_PROFILE = 'padrao',
  TV_SNAPSHOTS = {},       // { "cod|periodo": { rowKey: rowSig } }
  TV_ALERT = null,         // alerta ativo { novo, alterado, total, changedNames, until }
  TV_BANNER_UNTIL = 0,
  TV_BANNER_TIMER = null,
  tvClockTimer = null,
  tvRefreshTimer = null,
  tvRotateTimer = null;

const TV_SOUND_PROFILES = {
  padrao: {
    wave: 'sine',
    gain: 0.55,
    step: 0.16,
    dur: 0.16,
    tones1: [1046, 1318],
    tones2: [988, 1318, 988],
    tones3: [1046, 1318, 1046, 1567]
  },
  alto: {
    wave: 'triangle',
    gain: 0.95,
    step: 0.12,
    dur: 0.18,
    tones1: [1174, 1567, 1760],
    tones2: [1318, 1760, 1318, 1760],
    tones3: [1567, 2093, 1567, 2349, 1760]
  },
  sirene: {
    wave: 'square',
    gain: 0.7,
    step: 0.09,
    dur: 0.11,
    tones1: [880, 1320, 990, 1480],
    tones2: [990, 1480, 990, 1480, 880],
    tones3: [1320, 1760, 1320, 1760, 1567, 2093]
  }
};

function setTvAlertSoundEnabled(enabled) {
  TV_ALERT_SOUND = !!enabled;
  localStorage.setItem('tv_alert_sound_enabled', TV_ALERT_SOUND ? '1' : '0');
}

function setTvSoundProfile(profile, preview = false) {
  const next = TV_SOUND_PROFILES[profile] ? profile : 'padrao';
  TV_ALERT_SOUND_PROFILE = next;
  localStorage.setItem('tv_alert_sound_profile', next);
  if (preview) playTvAlertSound(2, true);
}

function initTvSoundSettings() {
  const savedEnabled = localStorage.getItem('tv_alert_sound_enabled');
  if (savedEnabled !== null) TV_ALERT_SOUND = savedEnabled === '1';
  const savedProfile = localStorage.getItem('tv_alert_sound_profile');
  if (savedProfile && TV_SOUND_PROFILES[savedProfile]) TV_ALERT_SOUND_PROFILE = savedProfile;

  const toggle = $('tvAlertToggle');
  if (toggle) toggle.checked = TV_ALERT_SOUND;
  const profile = $('tvAlertProfile');
  if (profile) profile.value = TV_ALERT_SOUND_PROFILE;
}

// ── BUILD SELECT / CHECKBOXES DE FILIAL ──────────────────────
function buildTvFilSelect() {
  const codsPresentes = [...new Set(ALL.map(r => String(r.Filial || '')).filter(Boolean))];

  // Função que popula uma lista de checkboxes num container
  function populateList(container, onChangeFn) {
    if (!container) return;
    container.innerHTML = '';
    FILIAIS_ORDER.forEach(([cod, nome]) => {
      if (!codsPresentes.includes(cod)) return;
      const lbl = document.createElement('label');
      lbl.className = 'tv-fil-check-item' + (TV_FILS.includes(cod) ? ' sel' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = cod;
      cb.checked = TV_FILS.includes(cod);
      cb.addEventListener('change', () => {
        lbl.classList.toggle('sel', cb.checked);
        onChangeFn();
      });
      const span = document.createElement('span');
      span.textContent = nome;
      lbl.appendChild(cb);
      lbl.appendChild(span);
      container.appendChild(lbl);
    });
  }

  // Sidebar — lista inline
  populateList($('tvFil-list'), () => {
    TV_FILS = [...$('tvFil-list').querySelectorAll('input:checked')].map(i => i.value);
    updateTvFilCount();
    onTvFilsChange();
  });

  // Mobile — lista na gaveta
  populateList($('mob-tvFil-list'), () => {
    TV_FILS = [...$('mob-tvFil-list').querySelectorAll('input:checked')].map(i => i.value);
  });
}

function updateTvFilCount() {
  const el = $('tvFil-count');
  if (!el) return;
  if (TV_FILS.length === 0) { el.style.display = 'none'; el.textContent = ''; }
  else { el.style.display = 'inline'; el.textContent = TV_FILS.length + ' selecionada' + (TV_FILS.length > 1 ? 's' : ''); }
}

function onTvFilsChange() {
  const hasFils = TV_FILS.length > 0;
  const wrap = $('tv-periodo-wrap');
  const ivWrap = $('tv-interval-wrap');
  const fsBtn = $('tv-fullscreen-btn');
  if (wrap) wrap.style.display = hasFils ? 'block' : 'none';
  if (ivWrap) ivWrap.style.display = TV_FILS.length > 1 ? 'block' : 'none';
  if (fsBtn) fsBtn.style.display = hasFils ? 'block' : 'none';
  const empty = $('tv-empty');
  if (!hasFils) {
    stopTvRotation();
    stopGlobalAlertTimer();
    if (empty) empty.style.display = 'flex';
    const tc = $('tv-content'); if (tc) tc.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  TV_PERIODO = $('tvPeriodo') ? $('tvPeriodo').value : 'mes';
  TV_FIL_IDX = 0;
  TV_FIL = TV_FILS[0];
  // Inicializar IDs conhecidos sem disparar alertas
  initKnownIds();
  renderTv();
  if (TV_FILS.length > 1) startTvRotation();
  else stopTvRotation();
  // Iniciar timer global de alertas (funciona em qualquer aba)
  startGlobalAlertTimer();
}

function onTvFilChange() { onTvFilsChange(); }
function switchTvFilial() { onTvFilsChange(); }

function onTvPeriodoChange() {
  TV_PERIODO = $('tvPeriodo').value;
  const customWrap = $('tv-custom-range');
  if (customWrap) {
    customWrap.style.display = TV_PERIODO === 'custom' ? 'flex' : 'none';
  }
  if (TV_PERIODO !== 'custom') renderTv();
}

function getTvData(filCod) {
  const cod = filCod || TV_FIL;
  const now = new Date();
  let rows = ALL.filter(r => String(r.Filial) === cod);
  if (TV_PERIODO === 'mes') {
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    rows = rows.filter(r => getMes(r['Data da Liberação']) === ym || getMes(r['Data Comissao Loja']) === ym);
  } else if (TV_PERIODO === 'hoje') {
    const hoje = now.toISOString().slice(0, 10);
    rows = rows.filter(r => (r['Data da Liberação'] || '').slice(0, 10) === hoje);
  } else if (TV_PERIODO === 'custom') {
    const de = $('tvDe') ? $('tvDe').value : '';
    const ate = $('tvAte') ? $('tvAte').value : '';
    if (de || ate) {
      rows = rows.filter(r => {
        const lib = (r['Data da Liberação'] || '').slice(0, 10);
        const com = (r['Data Comissao Loja'] || '').slice(0, 10);
        const refLib = lib && (!de || lib >= de) && (!ate || lib <= ate);
        const refCom = com && (!de || com >= de) && (!ate || com <= ate);
        return refLib || refCom;
      });
    }
  } else {
    const dias = parseInt(TV_PERIODO);
    const limite = new Date(now - dias * 86400000).toISOString().slice(0, 10);
    rows = rows.filter(r => (r['Data da Liberação'] || '') >= limite);
  }
  return rows;
}

// IDs únicos de cada contrato para detecção de novos
// ── DETECÇÃO DE MUDANÇAS POR SNAPSHOT ────────────────────────
function getTvRowKey(r) { return (r.Contrato || '') + '|' + (r.CPF || ''); }
function getTvRowSig(r) { return val(r) + '|' + comTotal(r) + '|' + (r['Status Comissao Loja'] || '') + '|' + (r['Data Comissao Loja'] || ''); }

function detectTvChanges(rows, cod) {
  const key = cod + '|' + TV_PERIODO;
  const prev = TV_SNAPSHOTS[key];
  const cur = {};
  rows.forEach(r => { cur[getTvRowKey(r)] = getTvRowSig(r); });
  TV_SNAPSHOTS[key] = cur;
  if (!prev) return { novo: 0, alterado: 0, changedKeys: {} };
  let novo = 0, alterado = 0;
  const changedKeys = {};
  Object.keys(cur).forEach(k => {
    if (!(k in prev)) { novo++; changedKeys[k] = 'novo'; }
    else if (prev[k] !== cur[k]) { alterado++; changedKeys[k] = 'alt'; }
  });
  return { novo, alterado, changedKeys };
}

function initKnownIds() {
  // Inicializa snapshots sem disparar alertas
  TV_SNAPSHOTS = {};
  TV_FILS.forEach(cod => {
    const rows = getTvData(cod);
    const key = cod + '|' + TV_PERIODO;
    const snap = {};
    rows.forEach(r => { snap[getTvRowKey(r)] = getTvRowSig(r); });
    TV_SNAPSHOTS[key] = snap;
  });
  TV_ALERT = null;
  TV_BANNER_UNTIL = 0;
}

function checkAndNotify(newAll) {
  if (!TV_FILS.length) return;
  let totalNovo = 0, totalAlt = 0;
  const allChangedNames = [];

  TV_FILS.forEach(cod => {
    const rows = getRowsForFilial(newAll, cod);
    const diff = detectTvChanges(rows, cod);
    totalNovo += diff.novo;
    totalAlt += diff.alterado;
    if (diff.novo + diff.alterado > 0) {
      rows.filter(r => !!diff.changedKeys[getTvRowKey(r)])
        .forEach(r => { const n = (r.Nome || '').trim(); if (n) allChangedNames.push(n); });
    }
  });

  const total = totalNovo + totalAlt;
  if (total === 0) return;

  const uniqueNames = [...new Set(allChangedNames)];
  const nowMs = Date.now();
  TV_ALERT = { novo: totalNovo, alterado: totalAlt, total, changedNames: uniqueNames, until: nowMs + 15000 };
  TV_BANNER_UNTIL = nowMs + 10000;
  clearTimeout(TV_BANNER_TIMER);
  TV_BANNER_TIMER = setTimeout(() => { if (Date.now() >= TV_BANNER_UNTIL) renderTv(); }, 10100);

  const toggle = $('tvAlertToggle');
  if (!toggle || toggle.checked) playTvAlertSound(total);
  showToastAlert(TV_ALERT);
}

function getPeriodoLabel() {
  const p = $('tvPeriodo') ? $('tvPeriodo').value : TV_PERIODO;
  const now = new Date();
  if (p === 'mes') return MES[now.getMonth()] + '/' + String(now.getFullYear()).slice(2);
  if (p === 'hoje') return 'Hoje';
  if (p === 'custom') {
    const de = $('tvDe') ? $('tvDe').value : '';
    const ate = $('tvAte') ? $('tvAte').value : '';
    if (de && ate) return fmtData(de) + ' – ' + fmtData(ate);
    if (de) return 'A partir de ' + fmtData(de);
    if (ate) return 'Até ' + fmtData(ate);
    return 'Personalizado';
  }
  const dias = parseInt(p);
  if (!isNaN(dias)) return 'Últimos ' + dias + ' dias';
  return 'Todos';
}

function renderTv() {
  TV_PERIODO = $('tvPeriodo') ? $('tvPeriodo').value : TV_PERIODO;
  if (!TV_FIL || !TV_FILS.length) return;

  const rows = getTvData();
  const filNome = FILIAIS[TV_FIL] || TV_FIL;
  const now = new Date();

  const isTvProdOk = r => {
    if (TV_PERIODO === 'mes') {
      const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      return getMes(r['Data da Liberação']) === ym;
    } else if (TV_PERIODO === 'hoje') {
      const hoje = now.toISOString().slice(0, 10);
      return (r['Data da Liberação'] || '').slice(0, 10) === hoje;
    } else if (TV_PERIODO === 'custom') {
      const de = $('tvDe') ? $('tvDe').value : '';
      const ate = $('tvAte') ? $('tvAte').value : '';
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      return !!lib && (!de || lib >= de) && (!ate || lib <= ate);
    } else {
      const dias = parseInt(TV_PERIODO);
      const limite = new Date(now - dias * 86400000).toISOString().slice(0, 10);
      return (r['Data da Liberação'] || '') >= limite;
    }
  };

  const isTvComOk = r => {
    if (TV_PERIODO === 'mes') {
      const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      return getMes(r['Data Comissao Loja']) === ym;
    } else if (TV_PERIODO === 'hoje') {
      const hoje = now.toISOString().slice(0, 10);
      return (r['Data Comissao Loja'] || '').slice(0, 10) === hoje;
    } else if (TV_PERIODO === 'custom') {
      const de = $('tvDe') ? $('tvDe').value : '';
      const ate = $('tvAte') ? $('tvAte').value : '';
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      return !!com && (!de || com >= de) && (!ate || com <= ate);
    } else {
      const dias = parseInt(TV_PERIODO);
      const limite = new Date(now - dias * 86400000).toISOString().slice(0, 10);
      return (r['Data Comissao Loja'] || '') >= limite;
    }
  };

  // KPIs
  const prodRows = rows.filter(isTvProdOk);
  const nContratos = prodRows.length;
  const sumV = prodRows.reduce((a, r) => a + val(r), 0);

  const comRows = rows.filter(isTvComOk);
  const sumC = comRows.reduce((a, r) => a + comTotal(r), 0);
  const sumD = comRows.reduce((a, r) => a + (r['Desconto Loja'] || 0), 0);
  const sumL = sumC - sumD;

  // Ranking corretores
  const corrMap = {};
  rows.forEach(r => {
    const k = (r.Corretor || '—').trim();
    const prodOk = isTvProdOk(r);
    const comOk = isTvComOk(r);

    if (!prodOk && !comOk) return;

    if (!corrMap[k]) corrMap[k] = { n: 0, v: 0, c: 0, d: 0 };
    if (prodOk) {
      corrMap[k].n++;
      corrMap[k].v += val(r);
    }
    if (comOk) {
      corrMap[k].c += comTotal(r);
      corrMap[k].d += (r['Desconto Loja'] || 0);
    }
  });
  const ranking = Object.entries(corrMap).sort((a, b) => (b[1].c - b[1].d) - (a[1].c - a[1].d)).slice(0, 8);

  // Últimos contratos
  const ultimos = [...rows].sort((a, b) => (b['Data da Liberação'] || '').localeCompare(a['Data da Liberação'] || '')).slice(0, 6);

  const medals = ['🥇', '🥈', '🥉'];
  const medalClass = ['gold', 'silver', 'bronze'];

  // Detectar mudanças e disparar alerta
  const diff = detectTvChanges(rows, TV_FIL);
  if (diff.novo + diff.alterado > 0) {
    const nowMs = Date.now();
    const changedNames = rows
      .filter(r => !!diff.changedKeys[getTvRowKey(r)])
      .map(r => (r.Nome || '').trim()).filter(Boolean);
    TV_ALERT = {
      novo: diff.novo, alterado: diff.alterado, total: diff.novo + diff.alterado,
      changedNames: [...new Set(changedNames)], until: nowMs + 15000
    };
    TV_BANNER_UNTIL = nowMs + 10000;
    clearTimeout(TV_BANNER_TIMER);
    TV_BANNER_TIMER = setTimeout(() => { if (Date.now() >= TV_BANNER_UNTIL) renderTv(); }, 10100);
    playTvAlertSound(TV_ALERT.total);
    showToastAlert(TV_ALERT);
  }

  const showBanner = TV_ALERT && Date.now() < TV_BANNER_UNTIL;
  const bannerHtml = !showBanner ? '' : (() => {
    const extra = TV_ALERT.changedNames.length > 3 ? ' · +' + (TV_ALERT.changedNames.length - 3) : '';
    const names = TV_ALERT.changedNames.slice(0, 3).join(' · ') + extra;
    return `<div class="tv-center-banner">
      <div class="tv-center-banner-tag"><i class="ph ph-bell" style="vertical-align:-2px"></i> ATUALIZAÇÃO DETECTADA</div>
      <div class="tv-center-banner-main">${TV_ALERT.total} contrato${TV_ALERT.total > 1 ? 's' : ''} atualizado${TV_ALERT.total > 1 ? 's' : ''}</div>
      <div class="tv-center-banner-row">
        <span class="tv-banner-badge novo">${TV_ALERT.novo} novo${TV_ALERT.novo !== 1 ? 's' : ''}</span>
        <span class="tv-banner-badge alt">${TV_ALERT.alterado} alterado${TV_ALERT.alterado !== 1 ? 's' : ''}</span>
        <span class="tv-banner-time">${new Date().toLocaleTimeString('pt-BR')}</span>
      </div>
      ${names ? `<div class="tv-center-banner-names">${names}</div>` : ''}
    </div>`;
  })();

  const html = `
  <div class="tv-wrap">
    ${bannerHtml}
    <div class="tv-header">
      <div class="tv-brand">
        <div class="tv-brand-logo"><img src="assetsimg/IMG_0457.png" alt="Logo" style="width:100%;height:100%;border-radius:8px;object-fit:cover;"></div>
        <div>
          <div class="tv-brand-name">LF Promotora</div>
          <div class="tv-brand-filial">${filNome}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
        ${TV_FILS.length > 1 ? `
        <div>
          <div class="tv-filial-pills">
            ${TV_FILS.map((cod, i) => `<span class="tv-filial-pill${cod === TV_FIL ? ' active' : ''}">${FILIAIS[cod] || cod}</span>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
            <div class="tv-filial-dot"></div>
            <span style="font-size:9px;font-family:var(--mono);color:var(--t3)">alternando em</span>
            <div class="tv-rotate-bar"><div class="tv-rotate-fill" id="tv-rotate-progress" style="width:100%"></div></div>
          </div>
        </div>` : ''}
        <div class="tv-ticker">
          <div class="tv-live-dot"></div>
          <span style="color:var(--green)">AO VIVO</span>
          <div class="tv-ticker-bar"><div class="tv-ticker-fill" id="tv-progress" style="width:100%"></div></div>
        </div>
        <div class="tv-meta">
          <div class="tv-meta-periodo">${getPeriodoLabel()}</div>
          <div class="tv-meta-time" id="tv-clock">--:--:--</div>
          <div class="tv-meta-date" id="tv-date">--</div>
        </div>
      </div>
    </div>

    ${TV_ALERT && Date.now() < TV_BANNER_UNTIL ? `
    <div class="tv-alert-banner">
      <div class="tv-alert-banner-inner">
        <div class="tv-alert-icon"><i class="ph ph-lightning"></i></div>
        <div class="tv-alert-content">
          <div class="tv-alert-title">ATUALIZAÇÃO DETECTADA</div>
          <div class="tv-alert-main">
            ${TV_ALERT.total} atualização${TV_ALERT.total > 1 ? 'ões' : ''} · ${TV_ALERT.filNome || filNome}
            <span class="tv-alert-badge">${TV_ALERT.novo > 0 ? TV_ALERT.novo + ' novo' + (TV_ALERT.novo !== 1 ? 's' : '') : ''} ${TV_ALERT.alterado > 0 ? '· ' + TV_ALERT.alterado + ' alterado' + (TV_ALERT.alterado !== 1 ? 's' : '') : ''}</span>
          </div>
          ${TV_ALERT.changedNames.length ? `<div class="tv-alert-names">${TV_ALERT.changedNames.slice(0, 4).join(' · ')}${TV_ALERT.changedNames.length > 4 ? ' · +more' : ''}</div>` : ''}
        </div>
        <div class="tv-alert-time">${new Date().toLocaleTimeString('pt-BR')}</div>
      </div>
    </div>` : ''}

    <div class="tv-body">
      <!-- KPIs: apenas Valor liberado e Líquido loja -->
      <div class="tv-kpis" style="grid-template-columns:1fr 1fr">
        <div class="tv-kpi">
          <div class="tv-kpi-label">Valor liberado</div>
          <div class="tv-kpi-val" style="font-size:3rem">${fmt(sumV)}</div>
          <div class="tv-kpi-sub">${nContratos.toLocaleString('pt-BR')} contrato${nContratos !== 1 ? 's' : ''}</div>
          <div class="tv-kpi-icon"><i class="ph ph-currency-circle-dollar"></i></div>
        </div>
        <div class="tv-kpi" style="border-color:rgba(34,211,238,.2)">
          <div class="tv-kpi-label">Líquido loja</div>
          <div class="tv-kpi-val" style="font-size:3rem">${fmt(sumL)}</div>
          <div class="tv-kpi-sub">&nbsp;</div>
          <div class="tv-kpi-icon"><i class="ph ph-check-circle"></i></div>
        </div>
      </div>

      <!-- Ranking + Últimos -->
      <div class="tv-bottom">
        <!-- Ranking -->
        <div class="tv-card">
          <div class="tv-card-header">
            <div class="tv-card-title">Ranking de corretores</div>
            <span style="font-size:10px;font-family:var(--mono);color:var(--t3)">${ranking.length} corretores</span>
          </div>
          ${ranking.map(([nome, d], i) => `
          <div class="tv-rank-item">
            <div class="tv-rank-num ${i < 3 ? medalClass[i] : ''}">${i < 3 ? medals[i] : i + 1}</div>
            <div class="tv-rank-name">${nome}</div>
            <div class="tv-rank-vals">
              <div class="tv-rank-com" style="color:#22d3ee">${fmt(d.c - d.d)}</div>
              <div class="tv-rank-liq">lib. ${fmt(d.v)}</div>
              <div class="tv-rank-n">${d.n} contrato${d.n !== 1 ? 's' : ''}</div>
            </div>
          </div>`).join('')}
        </div>

        <!-- Últimos contratos -->
        <div class="tv-card">
          <div class="tv-card-header">
            <div class="tv-card-title">Últimos contratos</div>
            <span style="font-size:10px;font-family:var(--mono);color:var(--t3)">${rows.length} no período</span>
          </div>
          ${ultimos.map(r => `
          <div class="tv-contract-item">
            <div style="flex:1;min-width:0">
              <div class="tv-contract-nome">${r.Nome || '—'}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                <span class="badge ${TIPO_BADGE[(r.Tipo || '').trim()] || 'b-ac'}" style="font-size:9px">${(r.Tipo || '—').trim()}</span>
                <span class="tv-contract-data">${r.Corretor ? r.Corretor.trim() : ''}</span>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;min-width:120px">
              <div style="font-size:14px;font-weight:700;color:var(--y);font-family:var(--mono)">${fmt(val(r))}</div>
              <div class="tv-contract-data">${fmtData(r['Data da Liberação'])}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  const empty = $('tv-empty');
  if (empty) empty.style.display = 'none';
  const tvContent = $('tv-content');
  if (tvContent) tvContent.innerHTML = html;
  const inner = $('tv-inner');
  if (inner) inner.innerHTML = html;

  // Relógio
  updateTvClock();
  startTvProgress();
}

function updateTvClock() {
  clearTimeout(tvClockTimer);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timeStr = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  // atualiza em ambos os contextos (inline e modal)
  document.querySelectorAll('#tv-clock').forEach(el => el.textContent = timeStr);
  document.querySelectorAll('#tv-date').forEach(el => el.textContent = dateStr);
  tvClockTimer = setTimeout(updateTvClock, 1000);
}

// ── BARRA DE PROGRESSO DO REFRESH (60s) ──────────────────────
let tvProgressVal = 100;
function startTvProgress() {
  clearInterval(tvRefreshTimer);
  tvProgressVal = 100;
  tvRefreshTimer = setInterval(() => {
    tvProgressVal -= (100 / 60);
    if (tvProgressVal <= 0) {
      tvProgressVal = 100;
      autoRefreshTv();
    }
    document.querySelectorAll('#tv-progress').forEach(el => el.style.width = tvProgressVal + '%');
  }, 1000);
}

async function autoRefreshTv() {
  // Recarregar dados antes de renderizar para detectar novos contratos
  try {
    const manualUrl = localStorage.getItem('progestor_json_url');
    const endpoint = manualUrl
      ? 'proxy.php?url=' + encodeURIComponent(manualUrl)
      : 'trigger.php?_t=' + Date.now();
    const data = await fetchJSON(endpoint, manualUrl ? 10000 : 85000);
    ALL = data.map(r => ({
      ...r,
      'Valor Liberado': toNumber(r['Valor Liberado']),
      'Base Comissao': toNumber(r['Base Comissao']),
      'Comissao Loja': toNumber(r['Comissao Loja']),
      'Desconto Loja': toNumber(r['Desconto Loja']),
      'Bonus1': toNumber(r['R$ Bonus Loja 1']),
      'Bonus2': toNumber(r['R$ Bonus Loja 2'])
    }));
    checkNewContracts(); // detecta e notifica novos contratos
  } catch (e) { /* silencioso */ }
  renderTv();
}

// ── ROTAÇÃO DE FILIAIS ────────────────────────────────────────
let tvRotateVal = 100;
function startTvRotation() {
  clearInterval(tvRotateTimer);
  tvRotateVal = 100;
  tvRotateTimer = setInterval(() => {
    tvRotateVal -= (100 / TV_INTERVAL);
    document.querySelectorAll('#tv-rotate-progress').forEach(el => el.style.width = tvRotateVal + '%');
    if (tvRotateVal <= 0) {
      tvRotateVal = 100;
      nextTvFilial();
    }
  }, 1000);
}

function stopTvRotation() {
  clearInterval(tvRotateTimer);
  tvRotateTimer = null;
}

function nextTvFilial() {
  if (TV_FILS.length < 2) return;
  TV_FIL_IDX = (TV_FIL_IDX + 1) % TV_FILS.length;
  TV_FIL = TV_FILS[TV_FIL_IDX];
  renderTv();
}

// ── SOM + NOTIFICAÇÕES ───────────────────────────────────────
function playTvAlertSound(count, force = false) {
  if (!TV_ALERT_SOUND && !force) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const profile = TV_SOUND_PROFILES[TV_ALERT_SOUND_PROFILE] || TV_SOUND_PROFILES.padrao;
    const ctx = new AC();
    const t0 = ctx.currentTime;
    const tones = count > 3 ? profile.tones3
      : count > 1 ? profile.tones2
        : profile.tones1;
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile.wave;
      osc.frequency.value = freq;
      const start = t0 + i * profile.step;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(profile.gain, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + profile.dur - 0.02);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + profile.dur);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) { console.warn('som bloqueado:', e.message); }
}

// Toast simples para um contrato individual (mantido para compatibilidade)
function showToast(r, filNome) {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon"><i class="ph ph-files"></i></div>
    <div class="toast-body">
      <div class="toast-title">${r.Nome || '—'}</div>
      <div class="toast-val">${fmt(val(r))}</div>
      <div class="toast-sub">${(r.Tipo || '—').trim()} · ${r.BCO || '—'}</div>
      <div class="toast-filial">◉ ${filNome}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 350); }, 7000);
}

// Toast de alerta com resumo de mudanças
function showToastAlert(alert) {
  const container = $('toast-container');
  if (!container) return;
  // Remover toasts de alerta anteriores
  container.querySelectorAll('.toast-alert').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast toast-alert';
  const names = (alert.changedNames || []).slice(0, 3).join(', ')
    + ((alert.changedNames || []).length > 3 ? ` +${alert.changedNames.length - 3}` : '');
  toast.innerHTML = `
    <div class="toast-icon"><i class="ph ph-bell"></i></div>
    <div class="toast-body">
      <div class="toast-title" style="color:var(--y)">ATUALIZAÇÃO DETECTADA</div>
      <div class="toast-val">${alert.total} contrato${alert.total > 1 ? 's' : ''}</div>
      <div class="toast-sub">${alert.novo} novo${alert.novo !== 1 ? 's' : ''} · ${alert.alterado} alterado${alert.alterado !== 1 ? 's' : ''}</div>
      ${names ? `<div class="toast-filial">${names}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 350); }, 10000);
}

function openTvMode() {
  if (!TV_FILS.length && !TV_FIL) { return; }
  const modal = $('tv-modal');
  modal.style.display = 'block';
  renderTv();
  if (!$('tv-close-btn')) {
    const btn = document.createElement('button');
    btn.id = 'tv-close-btn';
    btn.className = 'tv-close';
    btn.textContent = '✕ Sair';
    btn.onclick = closeTvMode;
    document.body.appendChild(btn);
  }
  $('tv-close-btn').style.display = 'block';
  if (modal.requestFullscreen) modal.requestFullscreen().catch(() => { });
}

function closeTvMode() {
  const modal = $('tv-modal');
  modal.style.display = 'none';
  if ($('tv-close-btn')) $('tv-close-btn').style.display = 'none';
  clearInterval(tvRefreshTimer);
  stopTvRotation();
  if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
}

// ── MOBILE GAVETA + BOTTOM NAV ───────────────────────────────
function getActiveTab() {
  const p = document.querySelector('.panel.on');
  return p ? p.id.replace('p-', '') : 'visao';
}

function openMobDrawer() {
  const drawer = $('mob-drawer');
  const overlay = $('mob-overlay');
  if (!drawer || !overlay) return;

  const isFilial = (getActiveTab() === 'filial');

  // Mostrar seção correta
  const filtros = $('mob-drawer-content');
  const filCtrl = $('mob-filial-controls');
  if (filtros) filtros.style.display = isFilial ? 'none' : 'block';
  if (filCtrl) filCtrl.style.display = isFilial ? 'block' : 'none';

  if (isFilial) {
    // Popular checkboxes de filiais no mobile
    const mobList = $('mob-tvFil-list');
    if (mobList) {
      const codsPresentes = [...new Set(ALL.map(r => String(r.Filial || '')).filter(Boolean))];
      mobList.innerHTML = '';
      FILIAIS_ORDER.forEach(([cod, nome]) => {
        if (!codsPresentes.includes(cod)) return;
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;font-size:13px;color:#fafafa;border-bottom:1px solid rgba(255,255,255,.06)';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = cod; cb.checked = TV_FILS.includes(cod);
        cb.style.cssText = 'width:16px;height:16px;accent-color:#f7cb45;cursor:pointer;flex-shrink:0';
        cb.addEventListener('change', () => { TV_FILS = [...mobList.querySelectorAll('input:checked')].map(i => i.value); });
        lbl.appendChild(cb); lbl.appendChild(document.createTextNode(nome));
        mobList.appendChild(lbl);
      });
    }
    const per = $('mob-tvPeriodo');
    if (per) { per.value = TV_PERIODO || 'mes'; }
    const ivMob = $('mob-tvInterval');
    if (ivMob) { ivMob.value = TV_INTERVAL; $('mob-tvIntervalVal').textContent = TV_INTERVAL + 's'; }
  } else {
    syncMobFilters();
  }

  overlay.style.display = 'block';
  requestAnimationFrame(() => drawer.classList.add('open'));
}

function mobAplicarFilial() {
  const mobList = $('mob-tvFil-list');
  const per = $('mob-tvPeriodo');
  if (mobList) TV_FILS = [...mobList.querySelectorAll('input:checked')].map(i => i.value);
  TV_PERIODO = per ? per.value : 'mes';
  if (!TV_FILS.length) { alert('Escolha ao menos uma filial'); return; }
  TV_FIL = TV_FILS[0];
  TV_FIL_IDX = 0;
  const mainPer = $('tvPeriodo');
  if (mainPer) mainPer.value = TV_PERIODO;
  // Sync checkboxes desktop
  buildTvFilSelect();
  closeMobDrawer();
  const empty = $('tv-empty');
  if (empty) empty.style.display = 'none';
  initKnownIds();
  renderTv();
  if (TV_FILS.length > 1) startTvRotation(); else stopTvRotation();
}

function closeMobDrawer() {
  const d = $('mob-drawer');
  const o = $('mob-overlay');
  if (d) d.classList.remove('open');
  if (o) o.style.display = 'none';
}
// Swipe para fechar gaveta
document.addEventListener('DOMContentLoaded', () => {
  const drawer = $('mob-drawer');
  if (!drawer) return;
  let startY = 0;
  drawer.addEventListener('touchstart', e => { startY = e.touches[0].clientY }, { passive: true });
  drawer.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 60) closeMobDrawer();
  }, { passive: true });
});

function syncMobFilters() {
  // Sincroniza selects da gaveta com os principais
  ['fMes', 'fCorr', 'fTipo', 'fBco', 'fCanal', 'fParc', 'fConv'].forEach(id => {
    const mob = $('mob-' + id), main = $(id);
    if (!mob || !main) return;
    // Popular opções se vazias
    if (mob.options.length <= 1 && main.options.length > 1) {
      [...main.options].forEach(o => {
        const c = document.createElement('option');
        c.value = o.value; c.textContent = o.textContent;
        mob.appendChild(c);
      });
    }
    mob.value = main.value;
  });
  const mobSrch = $('mob-srch');
  if (mobSrch) mobSrch.value = $('srch').value;
}

// Rebuild gaveta ao carregar dados
function rebuildMobFilters() {
  ['fMes', 'fCorr', 'fTipo', 'fBco', 'fCanal', 'fParc', 'fConv'].forEach(id => {
    const mob = $('mob-' + id), main = $(id);
    if (!mob || !main) return;
    mob.innerHTML = '';
    [...main.options].forEach(o => {
      const c = document.createElement('option');
      c.value = o.value; c.textContent = o.textContent;
      if (o.selected) c.selected = true;
      mob.appendChild(c);
    });
  });
}

// ── DETECÇÃO GLOBAL DE NOVOS CONTRATOS ───────────────────────
// Roda a cada 60s independente da aba ativa
let globalAlertTimer = null;

function startGlobalAlertTimer() {
  clearInterval(globalAlertTimer);
  globalAlertTimer = setInterval(async () => {
    if (!TV_FILS.length) return;
    try {
      const token = localStorage.getItem('auth_token') || '';
      if (!token) return;
      
      const manualUrl = localStorage.getItem('progestor_json_url') || '';
      let endpoint = 'data.php?_t=' + Date.now() + '&token=' + encodeURIComponent(token);
      if (manualUrl) {
        endpoint += '&url=' + encodeURIComponent(manualUrl);
      }
      const res = await fetch(endpoint, { cache: 'no-cache' });
      if (res.status === 401) {
        localStorage.removeItem('auth_token');
        stopGlobalAlertTimer();
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const payload = await res.json();
      const rawData = payload.data || [];
      
      const newAll = rawData.map(r => ({
        ...r,
        'Valor Liberado': toNumber(r['Valor Liberado']),
        'Base Comissao': toNumber(r['Base Comissao']),
        'Comissao Loja': toNumber(r['Comissao Loja']),
        'Desconto Loja': toNumber(r['Desconto Loja']),
        'Bonus1': toNumber(r['R$ Bonus Loja 1']),
        'Bonus2': toNumber(r['R$ Bonus Loja 2'])
      }));

      // Checar mudanças ANTES de atualizar ALL
      checkAndNotify(newAll);

      // Atualizar dados globais
      ALL = newAll;
      $('status-txt').textContent = ALL.length + ' registros';
      $('ts').textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');

      // Re-renderizar conforme aba ativa
      const tab = getActiveTab();
      if (tab === 'filial') renderTv();
      else { buildFilters(); applyFilter(); }

    } catch (e) { console.warn('globalAlertTimer erro:', e.message); }
  }, 60000);
}

function stopGlobalAlertTimer() {
  clearInterval(globalAlertTimer);
}

// Filtrar rows por filial + período (versão que aceita array externo)
function getRowsForFilial(dataArr, cod) {
  const now = new Date();
  let rows = dataArr.filter(r => String(r.Filial) === cod);
  if (TV_PERIODO === 'mes') {
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    rows = rows.filter(r => getMes(r['Data da Liberação']) === ym || getMes(r['Data Comissao Loja']) === ym);
  } else if (TV_PERIODO === 'hoje') {
    const hoje = now.toISOString().slice(0, 10);
    rows = rows.filter(r => (r['Data da Liberação'] || '').slice(0, 10) === hoje);
  } else {
    const dias = parseInt(TV_PERIODO);
    const limite = new Date(now - dias * 86400000).toISOString().slice(0, 10);
    rows = rows.filter(r => (r['Data da Liberação'] || '') >= limite);
  }
  return rows;
}

// ── FILTROS PRÓPRIOS E EXCLUSIVOS DO MEU PAINEL ─────────────────────────
function buildCorrFilters() {
  const elMes = $('fCorrMes');
  const elBco = $('fCorrBco');
  const elTipo = $('fCorrTipo');
  if (!elMes || !elBco || !elTipo) return;

  const curM = elMes.value;
  const curB = elBco.value;
  const curT = elTipo.value;

  const mesesLib = ALL.map(r => r ? getMes(r['Data da Liberação']) : null).filter(Boolean);
  const mesesCom = ALL.map(r => r ? getMes(r['Data Comissao Loja']) : null).filter(Boolean);
  const meses = [...new Set([...mesesLib, ...mesesCom])].sort();
  
  elMes.innerHTML = '<option value="">Mês Atual (Padrão)</option>';
  meses.forEach(m => {
    if (!m || !m.includes('-')) return;
    const [y, mo] = m.split('-');
    const idx = parseInt(mo) - 1;
    const label = (MES[idx] || mo) + '/' + (y ? y.slice(2) : '');
    const o = document.createElement('option');
    o.value = m;
    o.textContent = label;
    if (m === curM) o.selected = true;
    elMes.appendChild(o);
  });

  const bcos = [...new Set(ALL.map(r => r ? r.BCO : null))].filter(Boolean).sort();
  elBco.innerHTML = '<option value="">Todos os Bancos</option>';
  bcos.forEach(b => {
    const o = document.createElement('option');
    o.value = o.textContent = b;
    if (b === curB) o.selected = true;
    elBco.appendChild(o);
  });

  const tiposPermitidos = Object.keys(TIPO_BADGE);
  const tipos = [...new Set(ALL.map(r => r ? r.Tipo : null))].filter(t => t && tiposPermitidos.includes(t)).sort();
  elTipo.innerHTML = '<option value="">Todos os Tipos</option>';
  tipos.forEach(t => {
    const o = document.createElement('option');
    o.value = o.textContent = t;
    if (t === curT) o.selected = true;
    elTipo.appendChild(o);
  });
}

function clearCorrFilters() {
  if ($('fCorrMes')) $('fCorrMes').value = '';
  if ($('fCorrDe')) $('fCorrDe').value = '';
  if ($('fCorrAte')) $('fCorrAte').value = '';
  if ($('fCorrBco')) $('fCorrBco').value = '';
  if ($('fCorrTipo')) $('fCorrTipo').value = '';
  renderCorretorDashboard();
}

// ── METAS E PAINEL COMPLETO DO CORRETOR (ESTILO FILIAL COM FILTROS PRÓPRIOS) ──
function renderCorretorDashboard() {
  if (USER_ROLE !== 'corretor') return;
  
  if ($('corr-welcome-title')) {
    $('corr-welcome-title').textContent = 'Olá, ' + (USER_NAME || 'Corretor') + '!';
  }

  buildCorrFilters();

  const corrMes = $('fCorrMes') ? $('fCorrMes').value : '';
  const corrDe = $('fCorrDe') ? $('fCorrDe').value : '';
  const corrAte = $('fCorrAte') ? $('fCorrAte').value : '';
  const corrBco = $('fCorrBco') ? $('fCorrBco').value : '';
  const corrTipo = $('fCorrTipo') ? $('fCorrTipo').value : '';

  const now = new Date();
  const currentYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // Filtra por base de dados do corretor (ALL) usando os FILTROS PRÓPRIOS do painel
  const isProdInPeriod = r => {
    if (corrBco && r.BCO !== corrBco) return false;
    if (corrTipo && r.Tipo !== corrTipo) return false;

    if (corrMes) {
      const mesLib = getMes(r['Data da Liberação']) || '';
      if (mesLib !== corrMes) return false;
    } else if (corrDe || corrAte) {
      const lib = (r['Data da Liberação'] || '').slice(0, 10);
      if (!lib || (corrDe && lib < corrDe) || (corrAte && lib > corrAte)) return false;
    } else {
      // Padrão sem filtro específico: Mês Atual
      const mesLib = getMes(r['Data da Liberação']) || '';
      if (mesLib !== currentYM) return false;
    }
    return true;
  };

  const isComInPeriod = r => {
    if (corrBco && r.BCO !== corrBco) return false;
    if (corrTipo && r.Tipo !== corrTipo) return false;

    if (corrMes) {
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (mesCom !== corrMes) return false;
    } else if (corrDe || corrAte) {
      const com = (r['Data Comissao Loja'] || '').slice(0, 10);
      if (!com || (corrDe && com < corrDe) || (corrAte && com > corrAte)) return false;
    } else {
      // Padrão sem filtro específico: Mês Atual
      const mesCom = getMes(r['Data Comissao Loja']) || '';
      if (mesCom !== currentYM) return false;
    }
    return true;
  };

  // 1. Total Liberado Bruto e Contratos Fechados (Data Liberação)
  const prodRows = ALL.filter(isProdInPeriod);
  const totalBruto = prodRows.reduce((a, r) => a + val(r), 0);
  const totalQty = prodRows.length;
  
  // 2. Produção Líquida (Base da Meta) e Valor Recebido do Consultor (Data Comissão Loja)
  const comRows = ALL.filter(isComInPeriod);
  const totalProduction = comRows.reduce((a, r) => {
    const comR = comTotal(r);
    const desc = parseFloat(r['Desconto Loja'] || 0);
    return a + (comR - desc);
  }, 0);
  
  const totalReceived = comRows.reduce((a, r) => a + valComCorretor(r), 0);
  
  if ($('kCorrBruto')) $('kCorrBruto').textContent = fmt(totalBruto);
  if ($('kCorrProd')) $('kCorrProd').textContent = fmt(totalProduction);
  if ($('kCorrComSec')) $('kCorrComSec').textContent = fmt(totalReceived);
  if ($('kCorrQty')) $('kCorrQty').textContent = totalQty.toLocaleString('pt-BR');
  
  // ── METAS DINÂMICAS DO CORRETOR ──
  // Normaliza lista de metas recebidas
  const cleanGoals = (Array.isArray(USER_GOALS) ? USER_GOALS : []).map((g, idx) => {
    if (typeof g === 'object' && g !== null) {
      return {
        name: g.name || `Meta ${idx + 1}`,
        value: parseFloat(g.value ?? g.val ?? 0) || 0
      };
    }
    return {
      name: `Meta ${idx + 1}`,
      value: parseFloat(g) || 0
    };
  }).filter(g => g.value > 0).sort((a, b) => a.value - b.value);

  // Badge do tipo de plano de consultor
  const planBadge = $('corr-plan-badge');
  if (planBadge) {
    if (USER_CONSULTANT_TYPE) {
      planBadge.textContent = USER_CONSULTANT_TYPE;
      planBadge.style.display = 'inline-block';
    } else {
      planBadge.style.display = 'none';
    }
  }

  // Renderiza marcadores dinamicamente na barra de progresso
  const wrap = $('goal-progress-bar-wrap');
  const fill = $('goal-progress-fill');
  const badge = $('goals-status-badge');
  const msg = $('goals-footer-msg');

  if (wrap) {
    // Preserva apenas o elemento #goal-progress-fill
    wrap.innerHTML = '<div class="goal-progress-bar-fill" id="goal-progress-fill" style="width: 0%;"></div>';
  }

  const N = cleanGoals.length;
  let pct = 0;

  if (N === 0) {
    if (badge) badge.textContent = 'Sem metas cadastradas';
    if (msg) msg.innerHTML = 'Nenhuma meta configurada para o seu perfil.';
  } else {
    // Cria os marcadores no DOM
    cleanGoals.forEach((g, idx) => {
      const posPct = ((idx + 1) / N) * 100;
      const isReached = totalProduction >= g.value && g.value > 0;
      const markerEl = document.createElement('div');
      markerEl.className = `goal-marker ${isReached ? 'reached' : ''}`;
      markerEl.style.left = `${posPct}%`;
      markerEl.innerHTML = `
        <div class="goal-marker-dot"></div>
        <div class="goal-marker-label">${g.name}<br><span>${fmtK(g.value)}</span></div>
      `;
      if (wrap) wrap.appendChild(markerEl);
    });

    // Calcula porcentagem preenchida da barra
    if (totalProduction < cleanGoals[0].value) {
      const segSize = 100 / N;
      pct = (totalProduction / cleanGoals[0].value) * (segSize * 0.95);
      if (badge) badge.textContent = `${cleanGoals[0].name} em andamento`;
      const falta = cleanGoals[0].value - totalProduction;
      if (msg) msg.innerHTML = `Falta apenas <strong style="color:var(--y)">${fmt(falta)}</strong> para atingir a <strong>${cleanGoals[0].name}</strong>!`;
    } else {
      let currentIdx = 0;
      for (let i = 0; i < N; i++) {
        if (totalProduction >= cleanGoals[i].value) {
          currentIdx = i;
        }
      }

      if (currentIdx === N - 1) {
        pct = 100;
        if (badge) badge.textContent = 'Meta Máxima Batida! 👑';
        if (msg) msg.innerHTML = `<strong style="color:var(--green)">Extraordinário!</strong> Você atingiu a ${cleanGoals[N - 1].name} e superou todos os limites este mês!`;
      } else {
        const curr = cleanGoals[currentIdx];
        const next = cleanGoals[currentIdx + 1];
        const segStart = ((currentIdx + 1) / N) * 100;
        const segSize = (1 / N) * 100;
        const segProgress = (totalProduction - curr.value) / (next.value - curr.value);
        pct = segStart + segProgress * (segSize * 0.95);

        if (badge) badge.textContent = `${curr.name} batida! 🎉`;
        const falta = next.value - totalProduction;
        if (msg) msg.innerHTML = `Excelente! ${curr.name} batida. Falta apenas <strong style="color:var(--y)">${fmt(falta)}</strong> para a <strong>${next.name}</strong>!`;
      }
    }
  }

  const fillEl = $('goal-progress-fill');
  if (fillEl) {
    fillEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  // --- Renderiza Gráficos Pessoais do Corretor ---
  if ($('cCorrBco') && $('cCorrTipo')) {
    const byBco = groupBy(prodRows, 'BCO', val).slice(0, 6);
    mkChart('cCorrBco', 'doughnut', byBco.map(x => x[0]), byBco.map(x => x[1]), COLORS.slice(0, byBco.length), { extra: { cutout: '60%' } });
    makeLegend($('lgCorrBco'), byBco.map(x => x[0]), COLORS);

    const byTipo = groupBy(prodRows, 'Tipo', val).slice(0, 6);
    mkChart('cCorrTipo', 'doughnut', byTipo.map(x => x[0]), byTipo.map(x => x[1]), COLORS.slice(3, 3 + byTipo.length), { extra: { cutout: '60%' } });
    makeLegend($('lgCorrTipo'), byTipo.map(x => x[0]), COLORS.slice(3));
  }

  // --- Renderiza Tabela de Propostas Recentes (Exibe 15 propostas) ---
  if ($('tbCorrRecent')) {
    const recent = [...prodRows].slice(0, 15);
    if (!recent.length) {
      $('tbCorrRecent').innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--t3); padding:1rem;">Nenhuma proposta encontrada.</td></tr>';
    } else {
      $('tbCorrRecent').innerHTML = recent.map(r => {
        const comR = comTotal(r);
        const desc = parseFloat(r['Desconto Loja'] || 0);
        const liq = comR - desc;
        return `<tr>
          <td style="font-weight:500">${r.Nome || '—'}</td>
          <td style="font-family:var(--mono);font-size:10px;color:var(--muted)">${r.CPF || '—'}</td>
          <td style="font-family:var(--mono);font-size:11px;color:var(--t1);white-space:nowrap">${fmtPhone(r.Celular || r['Celular'] || r.Telefone)}</td>
          <td style="font-family:var(--mono);font-size:10px">${r.Contrato || '—'}</td>
          <td style="font-size:11px">${r.BCO || '—'}</td>
          <td><span class="badge ${TIPO_BADGE[(r.Tipo || '').trim()] || 'b-ac'}">${(r.Tipo || '—').trim()}</span></td>
          <td style="font-family:var(--mono);text-align:right;white-space:nowrap">${fmt(val(r))}</td>
          <td style="font-family:var(--mono);text-align:right;white-space:nowrap;color:#22d3ee">${fmt(liq)}</td>
          <td style="font-family:var(--mono);text-align:right;white-space:nowrap;color:#38bdf8;font-weight:600">${fmt(valComCorretor(r))}</td>
          <td style="font-family:var(--mono);font-size:11px">${fmtData(r['Data da Liberação'])}</td>
        </tr>`;
      }).join('');
    }
  }
}

// ── AUTENTICAÇÃO, LOGIN E LOGOUT ─────────────────────────────
async function handleLogin(e) {
  if (e) e.preventDefault();
  const userEl = $('login-username');
  const passEl = $('login-password');
  const errorBox = $('login-error');
  const btnSubmit = $('btn-login-submit');
  
  if (!userEl || !passEl) return;
  const username = userEl.value.trim();
  const password = passEl.value.trim();
  
  if (!username || !password) return;
  
  try {
    if (errorBox) errorBox.style.display = 'none';
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Autenticando...';
    }
    
    const res = await fetch('login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Credenciais inválidas.');
    }
    
    // Salva o token de sessão do PostgreSQL localmente no navegador
    localStorage.setItem('auth_token', data.token);
    
    // Esconde a tela de login IMEDIATAMENTE após autenticação bem-sucedida
    hide('login-screen');
    show('loader');
    
    userEl.value = '';
    passEl.value = '';
    
    loadData();
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Entrar no Painel';
    }
  }
}

async function logoutUser() {
  try {
    stopAutoRefresh();
    const token = localStorage.getItem('auth_token') || '';
    const res = await fetch('logout.php?token=' + encodeURIComponent(token));
    if (res.ok) {
      localStorage.removeItem('auth_token');
      show('login-screen');
      hide('app');
      $('btn-logout').style.display = 'none';
      if ($('status-txt')) $('status-txt').textContent = 'desconectado';
      ALL = [];
      FILTERED = [];
    }
  } catch (e) {
    console.error('Erro ao deslogar:', e);
  }
}

// ── ADMIN: GERENCIAMENTO DE EQUIPE & PLANOS DE METAS (CRUD) ───
let ADMIN_USERS_CACHE = [];
let CONSULTANT_TYPES_CACHE = [];
let CURRENT_ADMIN_SUBTAB = 'users';

function switchAdminSubTab(tab) {
  CURRENT_ADMIN_SUBTAB = tab;
  const isUsers = tab === 'users';

  const btnUsers = $('tab-btn-team-users');
  const btnPlans = $('tab-btn-team-plans');
  const subtabUsers = $('subtab-users');
  const subtabPlans = $('subtab-plans');
  const actionsUsers = $('admin-actions-users');
  const actionsPlans = $('admin-actions-plans');

  if (btnUsers) btnUsers.className = isUsers ? 'btn' : 'btn-ghost';
  if (btnPlans) btnPlans.className = isUsers ? 'btn-ghost' : 'btn';
  if (subtabUsers) subtabUsers.style.display = isUsers ? 'block' : 'none';
  if (subtabPlans) subtabPlans.style.display = isUsers ? 'none' : 'block';
  if (actionsUsers) actionsUsers.style.display = isUsers ? 'block' : 'none';
  if (actionsPlans) actionsPlans.style.display = isUsers ? 'none' : 'block';
}

async function loadAdminUsers() {
  if (USER_ROLE !== 'admin') return;
  const token = localStorage.getItem('auth_token');
  try {
    // 1. Carrega tipos de consultor
    const resTypes = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_consultant_types', token })
    });
    const payloadTypes = await resTypes.json();
    if (payloadTypes.success) {
      CONSULTANT_TYPES_CACHE = payloadTypes.types || [];
      renderConsultantTypesTable();
    }

    // 2. Carrega usuários
    const resUsers = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', token })
    });
    const payloadUsers = await resUsers.json();
    if (payloadUsers.success) {
      ADMIN_USERS_CACHE = payloadUsers.users || [];
      renderAdminUsersTable();
    }
  } catch (e) {
    console.error('Erro ao carregar dados administrativos:', e);
  }
}

function renderAdminUsersTable() {
  const tbody = $('tbAdminUsers');
  if (!tbody) return;
  
  if (ADMIN_USERS_CACHE.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--t3)">Nenhum usuário cadastrado.</td></tr>';
    return;
  }
  
  tbody.innerHTML = ADMIN_USERS_CACHE.map(u => {
    let planBadge = '—';
    if (u.role === 'corretor') {
      if (u.consultant_type_name) {
        planBadge = `<span class="type-badge">${u.consultant_type_name}</span>`;
      } else {
        planBadge = '<span style="color:var(--muted); font-size:11px;">Sem plano</span>';
      }
    }
      
    const roleBadge = u.role === 'admin' ? '<span class="badge b-novo">Admin</span>'
      : u.role === 'supervisor' ? '<span class="badge b-port">Supervisor</span>'
      : '<span class="badge b-refin">Corretor</span>';
      
    return `<tr>
      <td style="font-weight:600; font-family:var(--mono);">${u.username}</td>
      <td>${u.name}</td>
      <td>${roleBadge}</td>
      <td style="font-family:var(--mono); font-size:11px;">${u.filial ? filialNome(u.filial) : '—'}</td>
      <td>${planBadge}</td>
      <td style="text-align:center;">
        <button class="btn-user-action" onclick="openUserModal('edit', '${u.username}')" title="Editar"><i class="ph ph-note-pencil"></i></button>
        <button class="btn-user-action delete" onclick="deleteUser('${u.username}')" title="Excluir"><i class="ph ph-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

function renderConsultantTypesTable() {
  const tbody = $('tbConsultantTypes');
  if (!tbody) return;

  if (CONSULTANT_TYPES_CACHE.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--t3)">Nenhum tipo de consultor cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = CONSULTANT_TYPES_CACHE.map(t => {
    const goalsTags = (t.goals || []).map(g => {
      const name = g.name || 'Meta';
      const val = parseFloat(g.value || g.val || 0);
      return `<span class="goal-tag">${name}: <strong>${fmt(val)}</strong></span>`;
    }).join('');

    return `<tr>
      <td style="font-weight:600; font-size:13px; color:var(--t1);"><span class="type-badge">${t.name}</span></td>
      <td><div class="goals-tag-list">${goalsTags || '—'}</div></td>
      <td style="text-align:center; font-family:var(--mono); font-weight:600; color:var(--y);">${t.users_count || 0}</td>
      <td style="text-align:center;">
        <button class="btn-user-action" onclick="openConsultantTypeModal('edit', ${t.id})" title="Editar Plano"><i class="ph ph-note-pencil"></i></button>
        <button class="btn-user-action delete" onclick="deleteConsultantType(${t.id}, '${t.name}')" title="Excluir Plano"><i class="ph ph-trash"></i></button>
      </td>
    </tr>`;
  }).join('');
}

// ── MODAL USUÁRIO ──
function openUserModal(mode, username = '') {
  const modal = $('modal-user');
  const title = $('user-modal-title');
  const usrInput = $('usr-username');
  const passLabel = $('usr-pass-label');
  const passInput = $('usr-password');
  const nameInput = $('usr-name');
  const roleSelect = $('usr-role');
  const filialSelect = $('usr-filial');
  const typeSelect = $('usr-consultant-type');
  const errBox = $('usr-error-msg');
  
  if (errBox) errBox.style.display = 'none';
  $('usr-mode').value = mode;
  
  // Popular filial select
  filialSelect.innerHTML = '<option value="">Nenhuma filial (Geral)</option>';
  FILIAIS_ORDER.forEach(([cod, nome]) => {
    const opt = document.createElement('option');
    opt.value = cod;
    opt.textContent = nome;
    filialSelect.appendChild(opt);
  });

  // Popular tipos de consultor
  typeSelect.innerHTML = '<option value="">Selecione um tipo de consultor...</option>';
  CONSULTANT_TYPES_CACHE.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${(t.goals || []).length} metas)`;
    typeSelect.appendChild(opt);
  });

  if (mode === 'create') {
    title.textContent = 'Novo Usuário';
    usrInput.value = '';
    usrInput.disabled = false;
    passLabel.textContent = 'Senha (Obrigatória)';
    passInput.required = true;
    passInput.value = '';
    nameInput.value = '';
    roleSelect.value = 'corretor';
    filialSelect.value = '';
    if (CONSULTANT_TYPES_CACHE.length > 0) {
      typeSelect.value = CONSULTANT_TYPES_CACHE[0].id;
    } else {
      typeSelect.value = '';
    }
  } else {
    // Modo de edição
    const user = ADMIN_USERS_CACHE.find(u => u.username === username);
    if (!user) return;
    
    title.textContent = 'Editar Usuário';
    usrInput.value = user.username;
    usrInput.disabled = true;
    passLabel.textContent = 'Mudar Senha (Opcional)';
    passInput.required = false;
    passInput.value = '';
    nameInput.value = user.name;
    roleSelect.value = user.role;
    filialSelect.value = user.filial || '';
    typeSelect.value = user.consultant_type_id || '';
  }
  
  onUserRoleChange();
  if (modal) modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = $('modal-user');
  if (modal) modal.style.display = 'none';
}

function onUserRoleChange() {
  const role = $('usr-role').value;
  const filialGroup = $('usr-filial-group');
  const typeGroup = $('usr-consultant-type-group');
  
  if (role === 'admin') {
    filialGroup.style.display = 'none';
    typeGroup.style.display = 'none';
  } else if (role === 'supervisor') {
    filialGroup.style.display = 'block';
    typeGroup.style.display = 'none';
  } else {
    // corretor
    filialGroup.style.display = 'block';
    typeGroup.style.display = 'block';
  }
}

async function saveUserSubmit(e) {
  if (e) e.preventDefault();
  const mode = $('usr-mode').value;
  const username = $('usr-username').value.trim();
  const password = $('usr-password').value;
  const name = $('usr-name').value.trim();
  const role = $('usr-role').value;
  const filial = $('usr-filial').value;
  const consultantTypeId = $('usr-consultant-type').value;
  const errBox = $('usr-error-msg');
  
  const payload = {
    action: mode,
    token: localStorage.getItem('auth_token'),
    username,
    name,
    role,
    filial,
    consultant_type_id: role === 'corretor' && consultantTypeId ? parseInt(consultantTypeId) : null
  };
  
  if (password) {
    payload.password = password;
  }
  
  try {
    if (errBox) errBox.style.display = 'none';
    
    const res = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao salvar usuário.');
    }
    
    closeUserModal();
    loadAdminUsers();
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  }
}

async function deleteUser(username) {
  if (!confirm(`Deseja realmente excluir a conta do usuário "${username}"?`)) return;
  try {
    const res = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', username, token: localStorage.getItem('auth_token') })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminUsers();
    } else {
      alert(data.error || 'Falha ao excluir usuário.');
    }
  } catch (e) {
    console.error(e);
  }
}

// ── MODAL TIPO DE CONSULTOR & METAS ──
function openConsultantTypeModal(mode, typeId = null) {
  const modal = $('modal-consultant-type');
  const title = $('type-modal-title');
  const idInput = $('type-id');
  const nameInput = $('type-name');
  const list = $('type-goals-list');
  const errBox = $('type-error-msg');

  if (errBox) errBox.style.display = 'none';
  if (list) list.innerHTML = '';

  if (mode === 'create') {
    title.textContent = 'Novo Tipo de Consultor';
    idInput.value = '';
    nameInput.value = '';
    // Adiciona 3 metas padrão para facilitar o preenchimento
    addTypeGoalRow('Meta 1', 1000);
    addTypeGoalRow('Meta 2', 2000);
    addTypeGoalRow('Meta 3', 3000);
  } else {
    const type = CONSULTANT_TYPES_CACHE.find(t => t.id === typeId);
    if (!type) return;

    title.textContent = 'Editar Tipo de Consultor';
    idInput.value = type.id;
    nameInput.value = type.name;

    const goals = type.goals || [];
    if (goals.length === 0) {
      addTypeGoalRow('Meta 1', 1000);
    } else {
      goals.forEach(g => {
        addTypeGoalRow(g.name || '', g.value || g.val || 0);
      });
    }
  }

  if (modal) modal.style.display = 'flex';
}

function closeConsultantTypeModal() {
  const modal = $('modal-consultant-type');
  if (modal) modal.style.display = 'none';
}

function addTypeGoalRow(name = '', val = '') {
  const list = $('type-goals-list');
  if (!list) return;

  const rowCount = list.querySelectorAll('.type-goal-row').length;
  const defaultName = name || `Meta ${rowCount + 1}`;

  const row = document.createElement('div');
  row.className = 'type-goal-row';
  row.innerHTML = `
    <div style="flex: 1.2;">
      <input type="text" class="modal-input goal-row-name" placeholder="Nome da Meta" value="${defaultName}" required style="font-size:12px; height:34px; padding:0 8px;">
    </div>
    <div style="flex: 1.2;">
      <input type="number" step="any" class="modal-input goal-row-val" placeholder="Valor (R$)" value="${val !== '' ? val : ''}" required style="font-size:12px; height:34px; padding:0 8px; font-family:var(--mono);">
    </div>
    <button type="button" class="btn-user-action delete" onclick="removeTypeGoalRow(this)" title="Remover Meta" style="height:34px; width:34px;">
      <i class="ph ph-trash"></i>
    </button>
  `;
  list.appendChild(row);
}

function removeTypeGoalRow(btn) {
  const list = $('type-goals-list');
  if (!list) return;
  const rows = list.querySelectorAll('.type-goal-row');
  if (rows.length <= 1) {
    alert('O plano deve ter pelo menos uma meta cadastrada.');
    return;
  }
  const row = btn.closest('.type-goal-row');
  if (row) row.remove();
}

async function saveConsultantTypeSubmit(e) {
  if (e) e.preventDefault();
  const idInput = $('type-id');
  const nameInput = $('type-name');
  const errBox = $('type-error-msg');
  const list = $('type-goals-list');

  const id = idInput.value ? parseInt(idInput.value) : null;
  const name = nameInput.value.trim().toUpperCase();

  if (!name) {
    if (errBox) {
      errBox.textContent = 'Informe o nome do tipo de consultor.';
      errBox.style.display = 'block';
    }
    return;
  }

  const rows = list ? list.querySelectorAll('.type-goal-row') : [];
  const goals = [];
  rows.forEach((r, idx) => {
    const nameVal = r.querySelector('.goal-row-name').value.trim() || `Meta ${idx + 1}`;
    const numVal = parseFloat(r.querySelector('.goal-row-val').value) || 0;
    goals.push({ name: nameVal, value: numVal });
  });

  if (goals.length === 0) {
    if (errBox) {
      errBox.textContent = 'Adicione pelo menos uma meta.';
      errBox.style.display = 'block';
    }
    return;
  }

  const payload = {
    action: 'save_consultant_type',
    token: localStorage.getItem('auth_token'),
    id,
    name,
    goals
  };

  try {
    if (errBox) errBox.style.display = 'none';

    const res = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Falha ao salvar tipo de consultor.');
    }

    closeConsultantTypeModal();
    loadAdminUsers();
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  }
}

async function deleteConsultantType(id, name) {
  if (!confirm(`Deseja realmente excluir o tipo de consultor "${name}"? Os consultores vinculados a este plano ficarão sem plano até serem reatribuídos.`)) return;
  try {
    const res = await fetch('manage_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_consultant_type', id, token: localStorage.getItem('auth_token') })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminUsers();
    } else {
      alert(data.error || 'Falha ao excluir tipo de consultor.');
    }
  } catch (e) {
    console.error(e);
  }
}

// ── START ─────────────────────────────────────────────────────
initTvSoundSettings();
loadData();
