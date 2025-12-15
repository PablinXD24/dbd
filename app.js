// CONFIGURAÇÃO FIREBASE (Substitua se necessário, mas usei a sua)
const firebaseConfig = {
    apiKey: "AIzaSyCHR2POfEPFGG-AbajaEsnBk32bvrru5uM",
    authDomain: "dbyd-5201e.firebaseapp.com",
    projectId: "dbyd-5201e",
    storageBucket: "dbyd-5201e.firebasestorage.app",
    messagingSenderId: "376910752424",
    appId: "1:376910752424:web:d64d958c177bdd01e3f09d"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- ESTADO & SUPER ADMIN ---
const SUPER_ADMIN = "pablo11ssousa2@gmail.com"; // VOCÊ É O CHEFE
const state = {
    user: null,
    isAdmin: false,
    services: [],
    barbers: [],
    booking: { service: null, barber: null, date: null, time: null },
    today: new Date()
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadData();
    setupEvents();
    renderCalendar();
});

// 1. AUTENTICAÇÃO E PERMISSÕES
function initAuth() {
    auth.onAuthStateChanged(user => {
        state.user = user;
        if (user) {
            document.getElementById('login-btn').classList.add('hidden');
            document.getElementById('user-menu').classList.remove('hidden');
            document.getElementById('user-name-display').innerText = user.email.split('@')[0];

            // HARDCODED ADMIN CHECK (Segurança para o Frontend)
            if (user.email === SUPER_ADMIN) {
                state.isAdmin = true;
                document.querySelector('.admin-link').classList.remove('hidden');
                loadAdminData(); // Carrega dados do painel
            }
        } else {
            state.isAdmin = false;
            document.getElementById('login-btn').classList.remove('hidden');
            document.getElementById('user-menu').classList.add('hidden');
            document.querySelector('.admin-link').classList.add('hidden');
        }
    });
}

// 2. CARREGAMENTO DE DADOS (Públicos)
async function loadData() {
    // Serviços
    const sSnap = await db.collection('servicos').get();
    state.services = sSnap.docs.map(d => ({id: d.id, ...d.data()}));
    
    // Barbeiros
    const bSnap = await db.collection('barbeiros').get();
    state.barbers = bSnap.docs.map(d => ({id: d.id, ...d.data()}));

    renderHomeServices();
    renderBookingOptions();
    document.getElementById('barber-count').innerText = state.barbers.length;
}

function renderHomeServices() {
    const el = document.getElementById('services-list');
    el.innerHTML = state.services.map(s => `
        <div class="select-card" style="cursor:default">
            <h4>${s.nome}</h4>
            <div style="display:flex; justify-content:space-between; margin-top:10px; color:var(--text-light)">
                <span>${s.duracao} min</span>
                <span style="color:var(--primary); font-weight:700">R$ ${s.preco}</span>
            </div>
        </div>
    `).join('');
}

// 3. FLUXO DE AGENDAMENTO (WIZARD)
function renderBookingOptions() {
    // Step 1: Services
    document.getElementById('booking-services').innerHTML = state.services.map(s => `
        <div class="select-card" onclick="selectService('${s.id}', this)">
            <h4>${s.nome}</h4>
            <p>R$ ${s.preco}</p>
        </div>
    `).join('');

    // Step 2: Barbers
    document.getElementById('booking-barbers').innerHTML = state.barbers.map(b => `
        <div class="select-card" onclick="selectBarber('${b.id}', this)">
            <h4>${b.nome}</h4>
            <p>${b.especialidade || 'Geral'}</p>
        </div>
    `).join('');
}

window.selectService = (id, el) => {
    state.booking.service = state.services.find(s => s.id === id);
    document.querySelectorAll('#booking-services .select-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    setTimeout(() => goToStep(2), 300);
}

window.selectBarber = (id, el) => {
    state.booking.barber = state.barbers.find(b => b.id === id);
    document.querySelectorAll('#booking-barbers .select-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    setTimeout(() => goToStep(3), 300);
}

function goToStep(num) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${num}`).classList.add('active');
    
    // Atualiza barra
    const progress = num * 25;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('wizard-title').innerText = 
        ['Selecione Serviço', 'Escolha Profissional', 'Data e Hora', 'Confirmar'][num-1];

    if(num === 4) renderSummary();
}

// Calendário Simples
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const days = new Date(state.today.getFullYear(), state.today.getMonth() + 1, 0).getDate();
    
    document.getElementById('current-month-display').innerText = 
        state.today.toLocaleDateString('pt-BR', { month: 'long' });

    for(let i=1; i<=days; i++) {
        const d = document.createElement('div');
        d.className = 'cal-day';
        d.innerText = i;
        d.onclick = () => {
            document.querySelectorAll('.cal-day').forEach(cd => cd.classList.remove('active'));
            d.classList.add('active');
            state.booking.date = new Date(state.today.getFullYear(), state.today.getMonth(), i);
            document.getElementById('selected-date-text').innerText = `${i}/${state.today.getMonth()+1}`;
            renderTimeSlots();
        };
        grid.appendChild(d);
    }
}

function renderTimeSlots() {
    const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const el = document.getElementById('time-slots');
    el.innerHTML = slots.map(t => `<button class="time-btn" onclick="selectTime('${t}', this)">${t}</button>`).join('');
}

window.selectTime = (time, el) => {
    state.booking.time = time;
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    setTimeout(() => goToStep(4), 300);
}

function renderSummary() {
    const b = state.booking;
    document.getElementById('sum-service').innerText = b.service.nome;
    document.getElementById('sum-barber').innerText = b.barber.nome;
    document.getElementById('sum-date').innerText = `${b.date.toLocaleDateString()} às ${b.time}`;
    document.getElementById('sum-price').innerText = `R$ ${b.service.preco}`;
}

async function confirmBooking() {
    if(!state.user) {
        openModal('login-modal');
        return;
    }
    
    try {
        const b = state.booking;
        // Combinar Data e Hora
        const [h, m] = b.time.split(':');
        const finalDate = new Date(b.date);
        finalDate.setHours(h, m);

        await db.collection('agendamentos').add({
            clienteId: state.user.uid,
            clienteEmail: state.user.email,
            servico: b.service.nome,
            barbeiro: b.barber.nome,
            data: finalDate,
            preco: b.service.preco,
            status: 'pendente'
        });
        
        notify('Agendamento realizado com sucesso!');
        navigateTo('meus-agendamentos');
        // Reset wizard...
    } catch(err) {
        console.error(err);
        notify('Erro ao agendar.');
    }
}

// 4. ADMINISTRAÇÃO (Funções Corrigidas)
async function loadAdminData() {
    // 1. Dashboard KPI
    const snaps = await db.collection('agendamentos').get();
    document.getElementById('kpi-today').innerText = snaps.size; // Simplificado para demo
    document.getElementById('kpi-users').innerText = "10+";
    
    // 2. Tabelas
    renderAdminTable(snaps.docs);
    renderAdminServicesList();
    renderAdminBarbersList();
}

function renderAdminTable(docs) {
    const tbody = document.getElementById('admin-appointments-table');
    tbody.innerHTML = docs.map(doc => {
        const d = doc.data();
        const date = d.data.toDate();
        return `
            <tr>
                <td>${date.toLocaleDateString()}</td>
                <td>${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}</td>
                <td>${d.clienteEmail.split('@')[0]}</td>
                <td>${d.servico}</td>
                <td>${d.barbeiro}</td>
                <td><span style="color:${d.status === 'pendente' ? 'orange' : 'green'}">${d.status}</span></td>
                <td><button class="btn-text" onclick="deleteItem('agendamentos', '${doc.id}')">Excluir</button></td>
            </tr>
        `;
    }).join('');
}

// ADMIN: Serviços CRUD
function renderAdminServicesList() {
    const el = document.getElementById('admin-services-grid');
    el.innerHTML = state.services.map(s => `
        <div class="select-card">
            <h4>${s.nome}</h4>
            <p>R$ ${s.preco}</p>
            <div style="margin-top:10px">
                <button class="btn-text" onclick="openServiceEdit('${s.id}')">Editar</button>
                <button class="btn-text" style="color:red" onclick="deleteItem('servicos', '${s.id}')">Excluir</button>
            </div>
        </div>
    `).join('');
}

// ADMIN: Barbeiros CRUD
function renderAdminBarbersList() {
    const el = document.getElementById('admin-barbers-grid');
    el.innerHTML = state.barbers.map(b => `
        <div class="select-card">
            <h4>${b.nome}</h4>
            <p>${b.especialidade || '-'}</p>
            <div style="margin-top:10px">
                <button class="btn-text" onclick="openBarberEdit('${b.id}')">Editar</button>
                <button class="btn-text" style="color:red" onclick="deleteItem('barbeiros', '${b.id}')">Excluir</button>
            </div>
        </div>
    `).join('');
}

// Lógica de Salvar (Create/Update) unificada
async function saveAdminItem(e, collection, formId, idField) {
    e.preventDefault();
    const id = document.getElementById(idField).value;
    const form = document.getElementById(formId);
    
    // Pega dados do form
    const data = {};
    if(collection === 'servicos') {
        data.nome = document.getElementById('service-name').value;
        data.preco = parseFloat(document.getElementById('service-price').value);
        data.duracao = parseInt(document.getElementById('service-duration').value);
    } else {
        data.nome = document.getElementById('barber-name').value;
        data.especialidade = document.getElementById('barber-specialty').value;
    }

    try {
        if(id) {
            await db.collection(collection).doc(id).update(data);
        } else {
            await db.collection(collection).add(data);
        }
        closeModals();
        notify('Salvo com sucesso!');
        loadData(); // Recarrega front
        loadAdminData(); // Recarrega admin
    } catch(err) {
        console.error(err);
        notify('Erro ao salvar.');
    }
}

window.deleteItem = async (col, id) => {
    if(confirm('Tem certeza?')) {
        await db.collection(col).doc(id).delete();
        loadAdminData();
        loadData();
    }
}

// Edit helpers
window.openServiceEdit = (id) => {
    const s = state.services.find(i => i.id === id);
    document.getElementById('service-id').value = id;
    document.getElementById('service-name').value = s.nome;
    document.getElementById('service-price').value = s.preco;
    document.getElementById('service-duration').value = s.duracao;
    openModal('service-modal');
}

window.openBarberEdit = (id) => {
    const b = state.barbers.find(i => i.id === id);
    document.getElementById('barber-id').value = id;
    document.getElementById('barber-name').value = b.nome;
    document.getElementById('barber-specialty').value = b.especialidade;
    openModal('barber-modal');
}

// 5. EVENTOS GERAIS
function setupEvents() {
    // Nav
    document.querySelectorAll('a[data-page]').forEach(l => {
        l.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(l.dataset.page);
        });
    });

    // Modais
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = closeModals);
    window.onclick = e => { if(e.target.classList.contains('modal-overlay')) closeModals(); }

    // Forms
    document.getElementById('auth-form').onsubmit = async (e) => {
        e.preventDefault();
        const em = document.getElementById('email').value;
        const pw = document.getElementById('password').value;
        try {
            await auth.signInWithEmailAndPassword(em, pw);
            closeModals();
        } catch {
            try {
                await auth.createUserWithEmailAndPassword(em, pw);
                closeModals();
            } catch(err) { notify('Erro: ' + err.message); }
        }
    };

    document.getElementById('admin-service-form').onsubmit = (e) => saveAdminItem(e, 'servicos', 'admin-service-form', 'service-id');
    document.getElementById('admin-barber-form').onsubmit = (e) => saveAdminItem(e, 'barbeiros', 'admin-barber-form', 'barber-id');
    document.getElementById('confirm-booking-btn').onclick = confirmBooking;
    document.getElementById('login-btn').onclick = () => openModal('login-modal');
    document.getElementById('logout-btn').onclick = () => auth.signOut();
    
    // Admin Tabs
    document.querySelectorAll('.admin-nav').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.admin-nav').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('admin-' + btn.dataset.tab).classList.add('active');
        }
    });
}

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page + '-page').classList.add('active');
}

function openModal(id) { 
    document.getElementById(id).classList.remove('hidden'); 
    if(id.includes('service') || id.includes('barber')) {
        // Limpar form se for novo
        if(!document.getElementById(id).querySelector('input[type="hidden"]').value) {
            document.getElementById(id).querySelector('form').reset();
        }
    }
}
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); }
function notify(msg) {
    const n = document.getElementById('notification');
    n.innerText = msg; n.classList.remove('hidden'); n.style.display = 'block';
    setTimeout(() => { n.style.display = 'none'; }, 3000);
}
