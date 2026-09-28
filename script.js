// 1. CONFIGURAÇÃO OFICIAL DO FIREBASE COM REALTIME DATABASE
const firebaseConfig = {
  apiKey: "AIzaSyBUkwpOoOk4N3wsL-C6qP0n5Kuxn3AtIUo",
  authDomain: "ricpower-finance-4312b.firebaseapp.com",
  databaseURL: "https://ricpower-finance-4312b-default-rtdb.firebaseio.com",
  projectId: "ricpower-finance-4312b",
  storageBucket: "ricpower-finance-4312b.firebasestorage.app",
  messagingSenderId: "632169254200",
  appId: "1:632169254200:web:776e49224d4f61bc2e05cd"
};

// Inicialização segura do Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
    } catch (err) {
        console.warn("Erro ao inicializar Firebase:", err);
    }
}
const db = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;

// CONVERTE OBJETOS FIREBASE OU DADOS LOCAIS EM ARRAYS VÁLIDOS
function garantirArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(item => item !== null && item !== undefined);
    if (typeof val === 'object') return Object.values(val).filter(item => item !== null && item !== undefined);
    return [];
}

// PARSER UNIVERSAL DE DATA
function parseDateIso(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    if (s.includes(' ')) s = s.split(' ')[0];
    if (s.includes('T')) s = s.split('T')[0];
    
    if (s.includes('/')) {
        let parts = s.split('/');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
    }
    if (s.includes('-')) {
        let parts = s.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
    }
    let d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

// HELPERS DE FORMATAÇÃO
const getMesAtualStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

const mesAtual = getMesAtualStr();

// DADOS LOCAIS BASE
let contasPagar = garantirArray(JSON.parse(localStorage.getItem('ricpower_pagar'))) || [
    { id: '1', vencimento: `${mesAtual}-15`, pessoa: 'RGE Energia', descricao: 'Conta de Energia Elétrica', valor: 1000.00, centro: 'CUSTOS FIXOS', status: 'PAGO', dataPagamento: `${mesAtual}-15` },
    { id: '2', vencimento: `${mesAtual}-21`, pessoa: 'AliExpress', descricao: 'Lote de Placas e Chips', valor: 850.00, centro: 'PEÇAS & EQUIPAMENTOS', status: 'PENDENTE', dataPagamento: '' }
];

let contasReceber = garantirArray(JSON.parse(localStorage.getItem('ricpower_receber'))) || [
    { id: '1', vencimento: `${mesAtual}-18`, pessoa: 'Gabi', descricao: 'Reparo de GPU RTX 3080', valor: 450.00, centro: 'SERVIÇOS', status: 'PAGO', dataPagamento: `${mesAtual}-18` },
    { id: '2', vencimento: `${mesAtual}-20`, pessoa: 'Yuri', descricao: 'Troca de Telas e Peças', valor: 280.00, centro: 'COMERCIAL', status: 'PENDENTE', dataPagamento: '' }
];

let estoque = garantirArray(JSON.parse(localStorage.getItem('ricpower_estoque'))) || [
    { id: '1', sku: 'PEC-001', nome: 'Chip Mosfet VRM 40V', qtd: 14, custo: 12.50, venda: 45.00 },
    { id: '2', sku: 'PEC-002', nome: 'Pasta Térmica Alta Condutividade', qtd: 3, custo: 35.00, venda: 90.00 }
];

// VARIÁVEIS DE FILTRO E GRÁFICOS
let filtroDataAtivo = 'todos';
let filtroTextoAtivo = 'Todos os Registros';
let dataInicioCustom = '';
let dataFimCustom = '';
let chartFluxoInstance = null;
let chartCategoriaInstance = null;

function getStatusEfetivo(item) {
    if (String(item.status).toUpperCase() === 'PAGO') return 'PAGO';
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const dtVenc = parseDateIso(item.vencimento);
    if (dtVenc && dtVenc < hoje) return 'ATRASADO';
    return 'PENDENTE';
}

function salvarDadosLocal(skipNuvem = false) {
    contasPagar = garantirArray(contasPagar);
    contasReceber = garantirArray(contasReceber);
    estoque = garantirArray(estoque);

    localStorage.setItem('ricpower_pagar', JSON.stringify(contasPagar));
    localStorage.setItem('ricpower_receber', JSON.stringify(contasReceber));
    localStorage.setItem('ricpower_estoque', JSON.stringify(estoque));

    if (db && !skipNuvem) {
        db.ref('ricpower_dados').set({
            contasPagar: contasPagar,
            contasReceber: contasReceber,
            estoque: estoque
        }).catch(err => console.error("Erro ao enviar para o Firebase:", err));
    }
}

function escutarSincronizacaoNuvem() {
    const badge = document.getElementById('syncBadge');
    if (db) {
        db.ref('ricpower_dados').on('value', (snapshot) => {
            const dadosNuvem = snapshot.val();
            if (dadosNuvem) {
                contasPagar = garantirArray(dadosNuvem.contasPagar);
                contasReceber = garantirArray(dadosNuvem.contasReceber);
                estoque = garantirArray(dadosNuvem.estoque);

                salvarDadosLocal(true);
                renderizarTudo();
            } else {
                salvarDadosLocal();
            }
            if (badge) {
                badge.className = 'sync-badge online';
                badge.innerHTML = '<i class="fas fa-wifi"></i> Nuvem Sincronizada';
            }
        }, (err) => {
            if (badge) {
                badge.className = 'sync-badge offline';
                badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Modo Offline';
            }
        });
    } else if (badge) {
        badge.className = 'sync-badge offline';
        badge.innerHTML = '<i class="fas fa-database"></i> Modo Local';
    }
}

function carregarDados() {
    escutarSincronizacaoNuvem();
    renderizarTudo();
}

function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataBR(dataIso) {
    if (!dataIso) return '-';
    const dt = parseDateIso(dataIso);
    if (!dt) return dataIso;
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
}

/* AUTENTICAÇÃO DIRETA */
function realizarLogin(event) {
    if (event) {
        event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
    }

    const emailEl = document.getElementById('loginEmail');
    const senhaEl = document.getElementById('loginSenha');

    const email = emailEl ? emailEl.value.trim() : '';
    const senha = senhaEl ? senhaEl.value.trim() : '';

    if (email === 'admin@richard.com' && senha === 'admin123') {
        localStorage.setItem('ricpower_logged_user', email);
        
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.style.display = 'none';
        }

        try {
            iniciarAplicacao();
        } catch (e) {
            console.error(e);
        }
    } else {
        alert('E-mail ou senha incorretos! Credenciais de acesso: admin@richard.com / admin123');
    }
    return false;
}

function fazerLogout() {
    localStorage.removeItem('ricpower_logged_user');
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
}

function verificarSessao() {
    const user = localStorage.getItem('ricpower_logged_user');
    const loginScreen = document.getElementById('login-screen');

    if (user) {
        if (loginScreen) loginScreen.style.display = 'none';
        iniciarAplicacao();
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
    }
}

function iniciarAplicacao() {
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    try {
        escutarSincronizacaoNuvem();
        renderizarTudo();
    } catch (err) {
        console.error("Erro na inicialização dos dados:", err);
    }
}

function trocarAba(abaId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    const tabSelecionada = document.getElementById(`tab-${abaId}`);
    if (tabSelecionada) tabSelecionada.classList.add('active');

    if (element) element.classList.add('active');

    const titulos = {
        'dashboard': 'Visão Geral Financeira',
        'contas-pagar': 'Contas a Pagar (Saídas)',
        'contas-receber': 'Contas a Receber (Entradas)',
        'estoque': 'Controle de Estoque (Peças)',
        'dre': 'Demonstrativo do Resultado do Exercício (DRE)',
        'extensao': 'Backup & Integrações'
    };
    document.getElementById('pageTitle').innerText = titulos[abaId] || 'RICPOWER';

    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');

    renderizarTudo();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function toggleDateFilter() {
    const dropdown = document.getElementById('dateFilterDropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

function selecionarFiltroData(tipo, texto) {
    filtroDataAtivo = tipo;
    filtroTextoAtivo = texto;
    dataInicioCustom = '';
    dataFimCustom = '';

    document.getElementById('currentPeriodText').innerText = texto;
    document.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active-filter'));
    if (event && event.target) event.target.classList.add('active-filter');

    document.getElementById('dateFilterDropdown').classList.remove('show');
    renderizarTudo();
}

function aplicarDataPersonalizada() {
    const dtI = document.getElementById('dtInicio').value;
    const dtF = document.getElementById('dtFim').value;

    if (!dtI || !dtF) {
        alert("Por favor, selecione as datas de início e fim.");
        return;
    }

    filtroDataAtivo = 'custom';
    dataInicioCustom = dtI;
    dataFimCustom = dtF;

    const texto = `${formatarDataBR(dtI)} até ${formatarDataBR(dtF)}`;
    document.getElementById('currentPeriodText').innerText = texto;
    document.querySelectorAll('.filter-option').forEach(el => el.classList.remove('active-filter'));
    document.getElementById('dateFilterDropdown').classList.remove('show');

    renderizarTudo();
}

function limparFiltroData() {
    document.getElementById('dtInicio').value = '';
    document.getElementById('dtFim').value = '';
    selecionarFiltroData('todos', 'Todos os Registros');
}

function filtrarPorPeriodo(lista, campoData = 'vencimento') {
    const listaArray = garantirArray(lista);
    if (filtroDataAtivo === 'todos') return listaArray;

    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtualIndex = agora.getMonth();

    return listaArray.filter(item => {
        if (!item[campoData]) return true;
        const dataItem = parseDateIso(item[campoData]);
        if (!dataItem) return true;

        const anoItem = dataItem.getFullYear();
        const mesItem = dataItem.getMonth();

        if (filtroDataAtivo === 'este-mes') {
            return anoItem === anoAtual && mesItem === mesAtualIndex;
        } else if (filtroDataAtivo === 'mes-passado') {
            const mesPassado = mesAtualIndex === 0 ? 11 : mesAtualIndex - 1;
            const anoPassado = mesAtualIndex === 0 ? anoAtual - 1 : anoAtual;
            return anoItem === anoPassado && mesItem === mesPassado;
        } else if (filtroDataAtivo === 'este-ano') {
            return anoItem === anoAtual;
        } else if (filtroDataAtivo === 'custom' && dataInicioCustom && dataFimCustom) {
            const dtI = parseDateIso(dataInicioCustom);
            const dtF = parseDateIso(dataFimCustom);
            if (dtI) dtI.setHours(0,0,0,0);
            if (dtF) dtF.setHours(23,59,59,999);
            if (dtI && dtF) return dataItem >= dtI && dataItem <= dtF;
        }
        return true;
    });
}

function renderizarTudo() {
    renderizarKPIs();
    renderizarGraficos();
    renderizarContasPagar();
    renderizarContasReceber();
    renderizarEstoque();
    renderizarDRE();
}

function renderizarKPIs() {
    const pagarFiltrado = filtrarPorPeriodo(contasPagar);
    const receberFiltrado = filtrarPorPeriodo(contasReceber);

    const realIn = receberFiltrado.filter(r => getStatusEfetivo(r) === 'PAGO').reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
    const pendingIn = receberFiltrado.filter(r => getStatusEfetivo(r) !== 'PAGO').reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);

    const realOut = pagarFiltrado.filter(p => getStatusEfetivo(p) === 'PAGO').reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const pendingOut = pagarFiltrado.filter(p => getStatusEfetivo(p) !== 'PAGO').reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);

    const balanceReal = realIn - realOut;
    const balanceProjected = (realIn + pendingIn) - (realOut + pendingOut);

    const stockVal = garantirArray(estoque).reduce((acc, e) => acc + ((parseFloat(e.qtd) || 0) * (parseFloat(e.custo) || 0)), 0);

    if (document.getElementById('kpiRealIn')) document.getElementById('kpiRealIn').innerText = formatarMoeda(realIn);
    if (document.getElementById('kpiPendingIn')) document.getElementById('kpiPendingIn').innerText = formatarMoeda(pendingIn);
    if (document.getElementById('kpiRealOut')) document.getElementById('kpiRealOut').innerText = formatarMoeda(realOut);
    if (document.getElementById('kpiPendingOut')) document.getElementById('kpiPendingOut').innerText = formatarMoeda(pendingOut);
    if (document.getElementById('kpiBalanceReal')) document.getElementById('kpiBalanceReal').innerText = formatarMoeda(balanceReal);
    if (document.getElementById('kpiBalanceProjected')) document.getElementById('kpiBalanceProjected').innerText = formatarMoeda(balanceProjected);
    if (document.getElementById('kpiStockValue')) document.getElementById('kpiStockValue').innerText = formatarMoeda(stockVal);
}

function renderizarGraficos() {
    if (typeof Chart === 'undefined') return;

    try {
        const ctxFluxo = document.getElementById('chartFluxo');
        if (ctxFluxo) {
            if (chartFluxoInstance) chartFluxoInstance.destroy();

            const receberList = filtrarPorPeriodo(contasReceber);
            const pagarList = filtrarPorPeriodo(contasPagar);

            const recTotal = receberList.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
            const pagTotal = pagarList.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);

            chartFluxoInstance = new Chart(ctxFluxo.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Entradas (A Receber)', 'Saídas (A Pagar)'],
                    datasets: [{
                        label: 'Valor Total (R$)',
                        data: [recTotal, pagTotal],
                        backgroundColor: ['#2ecc71', '#e74c3c'],
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        const ctxCat = document.getElementById('chartCategoria');
        if (ctxCat) {
            if (chartCategoriaInstance) chartCategoriaInstance.destroy();

            const pagarList = filtrarPorPeriodo(contasPagar);
            const categoriasMap = {};
            pagarList.forEach(p => {
                const cat = p.centro || 'Geral';
                categoriasMap[cat] = (categoriasMap[cat] || 0) + (parseFloat(p.valor) || 0);
            });

            const labels = Object.keys(categoriasMap);
            const data = Object.values(categoriasMap);

            chartCategoriaInstance = new Chart(ctxCat.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels.length ? labels : ['Sem Saídas'],
                    datasets: [{
                        data: data.length ? data : [1],
                        backgroundColor: ['#FFD500', '#111111', '#e74c3c', '#3498db', '#8e44ad'],
                        borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            });
        }
    } catch (e) {
        console.warn("Erro ao carregar gráficos:", e);
    }
}

function renderizarContasPagar() {
    const tbody = document.getElementById('tbodyPagar');
    if (!tbody) return;

    let list = filtrarPorPeriodo(contasPagar);
    const termo = (document.getElementById('searchPagar')?.value || '').toLowerCase();
    const stFiltro = (document.getElementById('filterStatusPagar')?.value || '').toUpperCase();
    const centroFiltro = (document.getElementById('filterCentroPagar')?.value || '').toUpperCase();

    if (termo) {
        list = list.filter(p => (p.pessoa && p.pessoa.toLowerCase().includes(termo)) || (p.descricao && p.descricao.toLowerCase().includes(termo)));
    }
    if (stFiltro) {
        list = list.filter(p => getStatusEfetivo(p) === stFiltro);
    }
    if (centroFiltro) {
        list = list.filter(p => String(p.centro).toUpperCase() === centroFiltro);
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const st = getStatusEfetivo(p);
        return `
            <tr>
                <td>${formatarDataBR(p.vencimento)}</td>
                <td><b>${p.pessoa || '-'}</b></td>
                <td>${p.descricao || '-'}</td>
                <td style="color:var(--danger-color); font-weight:bold;">${formatarMoeda(p.valor)}</td>
                <td><span class="status-badge ${st.toLowerCase()}">${st}</span></td>
                <td><span class="badge-fixa">${p.centro || 'GERAL'}</span></td>
                <td>
                    <div class="action-btns">
                        ${st !== 'PAGO' ? `<button class="btn btn-success btn-sm" onclick="darBaixaPagar('${p.id}')"><i class="fas fa-check"></i> Pago</button>` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="abrirModalPagar('${p.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="excluirPagar('${p.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarTabelaPagar() { renderizarContasPagar(); }

function abrirModalPagar(id = null) {
    const form = document.getElementById('modalPagar');
    document.getElementById('pagarId').value = id || '';
    if (id) {
        const item = contasPagar.find(p => String(p.id) === String(id));
        if (item) {
            document.getElementById('titleModalPagar').innerText = 'Editar Conta a Pagar';
            document.getElementById('pagarPessoa').value = item.pessoa || '';
            document.getElementById('pagarDescricao').value = item.descricao || '';
            document.getElementById('pagarValor').value = item.valor || '';
            document.getElementById('pagarData').value = item.vencimento || '';
            document.getElementById('pagarStatus').value = item.status || 'PENDENTE';
            document.getElementById('pagarCentro').value = item.centro || 'ADMINISTRATIVO';
        }
    } else {
        document.getElementById('titleModalPagar').innerText = 'Nova Conta a Pagar';
        document.getElementById('pagarPessoa').value = '';
        document.getElementById('pagarDescricao').value = '';
        document.getElementById('pagarValor').value = '';
        document.getElementById('pagarData').value = new Date().toISOString().split('T')[0];
        document.getElementById('pagarStatus').value = 'PENDENTE';
        document.getElementById('pagarCentro').value = 'ADMINISTRATIVO';
    }
    form.style.display = 'flex';
}

function salvarPagar(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('pagarId').value;
    const novo = {
        id: id || Date.now().toString(),
        vencimento: document.getElementById('pagarData').value,
        pessoa: document.getElementById('pagarPessoa').value,
        descricao: document.getElementById('pagarDescricao').value,
        valor: parseFloat(document.getElementById('pagarValor').value) || 0,
        status: document.getElementById('pagarStatus').value,
        centro: document.getElementById('pagarCentro').value,
        dataPagamento: document.getElementById('pagarStatus').value === 'PAGO' ? new Date().toISOString().split('T')[0] : ''
    };

    if (id) {
        const idx = contasPagar.findIndex(p => String(p.id) === String(id));
        if (idx !== -1) contasPagar[idx] = novo;
    } else {
        contasPagar.push(novo);
    }

    salvarDadosLocal();
    fecharModal('modalPagar');
    renderizarTudo();
}

function darBaixaPagar(id) {
    const item = contasPagar.find(p => String(p.id) === String(id));
    if (item) {
        item.status = 'PAGO';
        item.dataPagamento = new Date().toISOString().split('T')[0];
        salvarDadosLocal();
        renderizarTudo();
    }
}

function excluirPagar(id) {
    if (confirm('Deseja realmente remover esta conta a pagar?')) {
        contasPagar = contasPagar.filter(p => String(p.id) !== String(id));
        salvarDadosLocal();
        renderizarTudo();
    }
}

function renderizarContasReceber() {
    const tbody = document.getElementById('tbodyReceber');
    if (!tbody) return;

    let list = filtrarPorPeriodo(contasReceber);
    const termo = (document.getElementById('searchReceber')?.value || '').toLowerCase();
    const stFiltro = (document.getElementById('filterStatusReceber')?.value || '').toUpperCase();
    const centroFiltro = (document.getElementById('filterCentroReceber')?.value || '').toUpperCase();

    if (termo) {
        list = list.filter(r => (r.pessoa && r.pessoa.toLowerCase().includes(termo)) || (r.descricao && r.descricao.toLowerCase().includes(termo)));
    }
    if (stFiltro) {
        list = list.filter(r => getStatusEfetivo(r) === stFiltro);
    }
    if (centroFiltro) {
        list = list.filter(r => String(r.centro).toUpperCase() === centroFiltro);
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registo encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(r => {
        const st = getStatusEfetivo(r);
        return `
            <tr>
                <td>${formatarDataBR(r.vencimento)}</td>
                <td><b>${r.pessoa || '-'}</b></td>
                <td>${r.descricao || '-'}</td>
                <td style="color:var(--success-color); font-weight:bold;">${formatarMoeda(r.valor)}</td>
                <td><span class="status-badge ${st.toLowerCase()}">${st}</span></td>
                <td><span class="badge-fixa">${r.centro || 'SERVIÇOS'}</span></td>
                <td>
                    <div class="action-btns">
                        ${st !== 'PAGO' ? `<button class="btn btn-success btn-sm" onclick="darBaixaReceber('${r.id}')"><i class="fas fa-check"></i> Pago</button>` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="abrirModalReceber('${r.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="excluirReceber('${r.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarTabelaReceber() { renderizarContasReceber(); }

function abrirModalReceber(id = null) {
    const form = document.getElementById('modalReceber');
    document.getElementById('receberId').value = id || '';
    if (id) {
        const item = contasReceber.find(r => String(r.id) === String(id));
        if (item) {
            document.getElementById('titleModalReceber').innerText = 'Editar Conta a Receber';
            document.getElementById('receberPessoa').value = item.pessoa || '';
            document.getElementById('receberDescricao').value = item.descricao || '';
            document.getElementById('receberValor').value = item.valor || '';
            document.getElementById('receberData').value = item.vencimento || '';
            document.getElementById('receberStatus').value = item.status || 'PENDENTE';
            document.getElementById('receberCentro').value = item.centro || 'SERVIÇOS';
        }
    } else {
        document.getElementById('titleModalReceber').innerText = 'Nova Conta a Receber';
        document.getElementById('receberPessoa').value = '';
        document.getElementById('receberDescricao').value = '';
        document.getElementById('receberValor').value = '';
        document.getElementById('receberData').value = new Date().toISOString().split('T')[0];
        document.getElementById('receberStatus').value = 'PENDENTE';
        document.getElementById('receberCentro').value = 'SERVIÇOS';
    }
    form.style.display = 'flex';
}

function salvarReceber(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('receberId').value;
    const novo = {
        id: id || Date.now().toString(),
        vencimento: document.getElementById('receberData').value,
        pessoa: document.getElementById('receberPessoa').value,
        descricao: document.getElementById('receberDescricao').value,
        valor: parseFloat(document.getElementById('receberValor').value) || 0,
        status: document.getElementById('receberStatus').value,
        centro: document.getElementById('receberCentro').value,
        dataPagamento: document.getElementById('receberStatus').value === 'PAGO' ? new Date().toISOString().split('T')[0] : ''
    };

    if (id) {
        const idx = contasReceber.findIndex(r => String(r.id) === String(id));
        if (idx !== -1) contasReceber[idx] = novo;
    } else {
        contasReceber.push(novo);
    }

    salvarDadosLocal();
    fecharModal('modalReceber');
    renderizarTudo();
}

function darBaixaReceber(id) {
    const item = contasReceber.find(r => String(r.id) === String(id));
    if (item) {
        item.status = 'PAGO';
        item.dataPagamento = new Date().toISOString().split('T')[0];
        salvarDadosLocal();
        renderizarTudo();
    }
}

function excluirReceber(id) {
    if (confirm('Deseja realmente remover esta conta a receber?')) {
        contasReceber = contasReceber.filter(r => String(r.id) !== String(id));
        salvarDadosLocal();
        renderizarTudo();
    }
}

function renderizarEstoque() {
    const tbody = document.getElementById('tbodyEstoque');
    if (!tbody) return;

    let list = [...garantirArray(estoque)];
    const termo = (document.getElementById('searchEstoque')?.value || '').toLowerCase();

    if (termo) {
        list = list.filter(e => (e.sku && e.sku.toLowerCase().includes(termo)) || (e.nome && e.nome.toLowerCase().includes(termo)));
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum produto cadastrado no estoque.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(e => {
        const totalInvestido = (parseFloat(e.qtd) || 0) * (parseFloat(e.custo) || 0);
        return `
            <tr>
                <td><code>${e.sku || '-'}</code></td>
                <td><b>${e.nome || '-'}</b></td>
                <td><span style="font-weight:bold; color:${e.qtd <= 5 ? 'red' : 'green'}">${e.qtd}</span></td>
                <td>${formatarMoeda(e.custo)}</td>
                <td>${formatarMoeda(e.venda)}</td>
                <td><b>${formatarMoeda(totalInvestido)}</b></td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-secondary btn-sm" onclick="abrirModalEstoque('${e.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="excluirEstoque('${e.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filtrarTabelaEstoque() { renderizarEstoque(); }

function abrirModalEstoque(id = null) {
    const form = document.getElementById('modalEstoque');
    document.getElementById('estoqueId').value = id || '';
    if (id) {
        const item = estoque.find(e => String(e.id) === String(id));
        if (item) {
            document.getElementById('titleModalEstoque').innerText = 'Editar Produto';
            document.getElementById('estoqueSku').value = item.sku || '';
            document.getElementById('estoqueNome').value = item.nome || '';
            document.getElementById('estoqueQtd').value = item.qtd || 0;
            document.getElementById('estoqueCusto').value = item.custo || 0;
            document.getElementById('estoqueVenda').value = item.venda || 0;
        }
    } else {
        document.getElementById('titleModalEstoque').innerText = 'Novo Produto';
        document.getElementById('estoqueSku').value = '';
        document.getElementById('estoqueNome').value = '';
        document.getElementById('estoqueQtd').value = '';
        document.getElementById('estoqueCusto').value = '';
        document.getElementById('estoqueVenda').value = '';
    }
    form.style.display = 'flex';
}

function salvarEstoque(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('estoqueId').value;
    const novo = {
        id: id || Date.now().toString(),
        sku: document.getElementById('estoqueSku').value,
        nome: document.getElementById('estoqueNome').value,
        qtd: parseInt(document.getElementById('estoqueQtd').value, 10) || 0,
        custo: parseFloat(document.getElementById('estoqueCusto').value) || 0,
        venda: parseFloat(document.getElementById('estoqueVenda').value) || 0
    };

    if (id) {
        const idx = estoque.findIndex(e => String(e.id) === String(id));
        if (idx !== -1) estoque[idx] = novo;
    } else {
        estoque.push(novo);
    }

    salvarDadosLocal();
    fecharModal('modalEstoque');
    renderizarTudo();
}

function excluirEstoque(id) {
    if (confirm('Deseja realmente remover este item do estoque?')) {
        estoque = estoque.filter(e => String(e.id) !== String(id));
        salvarDadosLocal();
        renderizarTudo();
    }
}

function renderizarDRE() {
    const container = document.getElementById('dreContainer');
    if (!container) return;

    const recList = filtrarPorPeriodo(contasReceber);
    const pagList = filtrarPorPeriodo(contasPagar);

    const receitaTotal = recList.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0);
    const despesaTotal = pagList.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
    const lucroLiquido = receitaTotal - despesaTotal;

    container.innerHTML = `
        <div class="dre-row"><span>Receita Operacional Bruta</span> <b>${formatarMoeda(receitaTotal)}</b></div>
        <div class="dre-row"><span>(-) Custos Fixos & Operacionais</span> <b style="color:var(--danger-color);">${formatarMoeda(despesaTotal)}</b></div>
        <div class="dre-row total"><span>(=) Resultado do Exercício (Lucro Líquido)</span> <b style="color:${lucroLiquido >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">${formatarMoeda(lucroLiquido)}</b></div>
    `;
}

/* IMPORTAÇÃO / CONVERSÃO DE EXCEL (.XLSX) VIA SHEETJS COM FILTRO DE ÚLTIMOS X DIAS */
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const respostaDias = prompt(
        "Deseja importar apenas os lançamentos dos últimos X dias da planilha?\n\n" +
        "• Digite a quantidade de dias (ex: 7, 15, 30, 60)\n" +
        "• Deixe em branco para importar toda a planilha:", 
        "30"
    );

    let limiteDias = null;
    if (respostaDias !== null && respostaDias.trim() !== '') {
        const diasNum = parseInt(respostaDias, 10);
        if (!isNaN(diasNum) && diasNum > 0) {
            limiteDias = diasNum;
        }
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            let novosPagar = [];
            let novosReceber = [];

            if (workbook.Sheets['CONTAS A PAGAR']) {
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets['CONTAS A PAGAR'], { header: 1 });
                novosPagar = processarAbaExcel(sheetData, 'PAGAR', limiteDias);
            }

            if (workbook.Sheets['CONTAS A RECEBER']) {
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets['CONTAS A RECEBER'], { header: 1 });
                novosReceber = processarAbaExcel(sheetData, 'RECEBER', limiteDias);
            }

            if (novosPagar.length > 0 || novosReceber.length > 0) {
                // MANTÉM OS DADOS ANTERIORES E ADICIONA OS NOVOS
                contasPagar = [...garantirArray(contasPagar), ...novosPagar];
                contasReceber = [...garantirArray(contasReceber), ...novosReceber];

                salvarDadosLocal();
                renderizarTudo();

                const msgFiltro = limiteDias ? ` (últimos ${limiteDias} dias)` : ' (todos os registros)';
                alert(`Novos registros adicionados com sucesso!\n\n` +
                      `- Contas a Pagar adicionadas: ${novosPagar.length}${msgFiltro}\n` +
                      `- Contas a Receber adicionadas: ${novosReceber.length}${msgFiltro}`);
            } else {
                alert('Nenhum lançamento válido foi encontrado na planilha para o período solicitado.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao processar o arquivo Excel.');
        }

        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

function processarAbaExcel(sheetData, tipo, limiteDias = null) {
    let items = [];
    let headerIdx = -1;

    let dataCorte = null;
    if (limiteDias && !isNaN(limiteDias)) {
        dataCorte = new Date();
        dataCorte.setDate(dataCorte.getDate() - parseInt(limiteDias, 10));
        dataCorte.setHours(0, 0, 0, 0);
    }

    for (let i = 0; i < sheetData.length; i++) {
        const rowStr = (sheetData[i] || []).join(' ').toUpperCase();
        if (rowStr.includes('DATA DE VENCIMENTO') || rowStr.includes('FORNECEDOR') || rowStr.includes('CLIENTE')) {
            headerIdx = i;
            break;
        }
    }

    if (headerIdx === -1) return items;

    for (let i = headerIdx + 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length === 0) continue;

        let dtVenc = row[1];
        if (typeof dtVenc === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(dtVenc);
            if (dateObj) {
                dtVenc = `${dateObj.y}-${String(dateObj.m).padStart(2,'0')}-${String(dateObj.d).padStart(2,'0')}`;
            }
        } else if (dtVenc) {
            dtVenc = String(dtVenc).split('T')[0];
        }

        const pessoa = row[2] ? String(row[2]).trim() : '';
        const desc = row[3] ? String(row[3]).trim() : '';
        const valor = parseFloat(row[4]) || 0;
        let status = row[5] ? String(row[5]).toUpperCase().trim() : 'PENDENTE';
        if (status.startsWith('=')) status = 'PENDENTE';
        const centro = row[8] ? String(row[8]).trim().toUpperCase() : (tipo === 'PAGAR' ? 'ADMINISTRATIVO' : 'SERVIÇOS');

        if (!pessoa && !valor) continue;

        // Se houver limite de dias, ignora o registro caso a data seja anterior à data limite
        if (dataCorte && dtVenc) {
            const dtObj = parseDateIso(dtVenc);
            if (dtObj && dtObj < dataCorte) {
                continue;
            }
        }

        items.push({
            id: String(Date.now() + Math.random()),
            vencimento: dtVenc || new Date().toISOString().split('T')[0],
            pessoa: pessoa || 'Não Informado',
            descricao: desc || 'Lançamento via Excel',
            valor: valor,
            status: status,
            centro: centro,
            dataPagamento: status === 'PAGO' ? (dtVenc || '') : ''
        });
    }

    return items;
}

function exportDataJSON() {
    const data = { contasPagar, contasReceber, estoque, dataExportacao: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_ricpower_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
    if (!event.target.closest('.modern-filter-container')) {
        const drop = document.getElementById('dateFilterDropdown');
        if (drop && drop.classList.contains('show')) drop.classList.remove('show');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    verificarSessao();
});
