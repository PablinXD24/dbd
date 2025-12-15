// =============================================
// CONFIGURAÇÃO DO FIREBASE
// =============================================
const firebaseConfig = {
    apiKey: "AIzaSyCHR2POfEPFGG-AbajaEsnBk32bvrru5uM",
    authDomain: "dbyd-5201e.firebaseapp.com",
    projectId: "dbyd-5201e",
    storageBucket: "dbyd-5201e.firebasestorage.app",
    messagingSenderId: "376910752424",
    appId: "1:376910752424:web:d64d958c177bdd01e3f09d"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =============================================
// ESTADO GLOBAL & CONFIGURAÇÕES
// =============================================
// E-mail do Super Admin (HARDCODED PARA SEGURANÇA TOTAL DO ACESSO)
const SUPER_ADMIN_EMAIL = "pablo11ssousa2@gmail.com";

const state = {
    currentUser: null,
    isAdmin: false,
    currentPage: 'home',
    booking: {
        service: null,
        barber: null,
        date: null,
        time: null
    },
    services: [],
    barbers: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    initFirebaseAuth();
    loadPublicData();
}

function initFirebaseAuth() {
    auth.onAuthStateChanged(async (user) => {
        state.currentUser = user;
        
        if (user) {
            console.log("Usuário logado:", user.email);
            
            // VERIFICAÇÃO DE SUPER ADMIN
            if (user.email === SUPER_ADMIN_EMAIL) {
                console.log("ACESSO SUPER ADMIN CONCEDIDO");
                state.isAdmin = true;
                document.querySelector('.admin-badge').classList.remove('hidden');
                
                // Força atualização no banco se necessário
                db.collection('usuarios').doc(user.uid).set({
                    email: user.email,
                    admin: true,
                    role: 'super_admin'
                }, { merge: true });
            } else {
                // Verificação normal do banco
                const doc = await db.collection('usuarios').doc(user.uid).get();
                state.isAdmin = doc.exists && doc.data().admin === true;
            }

            updateUI(true);
        } else {
            state.isAdmin = false;
            updateUI(false);
        }
    });
}

// =============================================
// LOGICA DE UI & NAVEGAÇÃO
// =============================================
function updateUI(isLoggedIn) {
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userStatus = document.getElementById('user-status');
    const adminLink = document.querySelector('[data-page="admin"]');

    if (isLoggedIn) {
        loginBtn.classList.add('hidden');
        userMenu.classList.remove('hidden');
        userStatus.textContent = state.currentUser.email.split('@')[0];
        
        if (state.isAdmin) {
            adminLink.classList.remove('hidden');
        }
    } else {
        loginBtn.classList.remove('hidden');
        userMenu.classList.add('hidden');
        adminLink.classList.add('hidden');
    }
}

function setupEventListeners() {
    // Navegação
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
        });
    });

    // Login/Logout
    document.getElementById('login-btn').addEventListener('click', () => openModal('login-modal'));
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    
    // Auth Forms
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Tabs de Auth
    document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.auth-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const mode = e.target.dataset.tab;
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            document.getElementById(`${mode}-form`).classList.add('active');
        });
    });

    // Tabs de Admin
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const tabId = e.target.dataset.tab;
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Forms de Admin (CRUD)
    document.getElementById('barber-form-admin').addEventListener('submit', saveBarber);
    document.getElementById('service-form-admin').addEventListener('submit', saveService);

    // Agendamento Steps
    document.getElementById('confirm-booking').addEventListener('click', confirmBooking);
    
    // Calendário Nav
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    // Fechar modais
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModals);
    });
}

function navigateTo(pageId) {
    // Verifica permissão admin
    if (pageId === 'admin' && !state.isAdmin) {
        showNotification('Acesso negado.', 'error');
        return;
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`${pageId}-page`).classList.add('active');
    
    // Marca link ativo na nav
    const navLink = document.querySelector(`[data-page="${pageId}"]`);
    if(navLink) navLink.classList.add('active');

    // Carregar dados específicos
    if (pageId === 'agendar') initBookingFlow();
    if (pageId === 'meus-agendamentos') loadMyAppointments();
    if (pageId === 'admin') loadAdminDashboard();
}

// =============================================
// DADOS PÚBLICOS (Serviços e Barbeiros)
// =============================================
async function loadPublicData() {
    // Carregar Serviços
    const servicesSnap = await db.collection('servicos').where('ativo', '==', true).get();
    state.services = servicesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    renderServicesPublic();

    // Carregar Barbeiros
    const barbersSnap = await db.collection('barbeiros').where('ativo', '==', true).get();
    state.barbers = barbersSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

    // Atualizar stats da home
    document.getElementById('barber-count').textContent = state.barbers.length;
}

function renderServicesPublic() {
    const container = document.getElementById('services-list');
    container.innerHTML = state.services.map(s => `
        <div class="service-card">
            <h3>${s.nome}</h3>
            <p style="color:var(--text-secondary); font-size:0.9rem">${s.duracao} min</p>
            <div class="service-price">R$ ${parseFloat(s.preco).toFixed(2)}</div>
        </div>
    `).join('');
}

// =============================================
// ADMIN (CRUD COMPLETO)
// =============================================
async function loadAdminDashboard() {
    // Stats
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointmentsToday = await db.collection('agendamentos')
        .where('data', '>=', today)
        .where('data', '<', tomorrow).get();
    
    document.getElementById('today-stats').textContent = appointmentsToday.size;
    document.getElementById('barbers-stats').textContent = state.barbers.length;

    // Listas
    renderAdminBarbers();
    renderAdminServices();
    loadAdminAppointments();
}

// --- BARBEIROS CRUD ---
function renderAdminBarbers() {
    const container = document.getElementById('admin-barbers-list');
    container.innerHTML = state.barbers.map(b => `
        <div class="admin-card-item">
            <h4>${b.nome}</h4>
            <p>${b.especialidade || 'Geral'}</p>
            <div class="mt-4" style="display:flex; gap:10px">
                <button class="btn-secondary btn-sm" onclick="editBarber('${b.id}')">Editar</button>
                <button class="btn-primary btn-sm" style="background:var(--danger)" onclick="deleteBarber('${b.id}')">Excluir</button>
            </div>
        </div>
    `).join('');
}

window.openBarberModal = (id = null) => {
    document.getElementById('barber-modal').style.display = 'flex';
    const form = document.getElementById('barber-form-admin');
    form.reset();
    document.getElementById('admin-barber-id').value = '';

    if (id) {
        // Modo edição (implementar busca se necessário, mas aqui simplificado)
    }
};

async function saveBarber(e) {
    e.preventDefault();
    const id = document.getElementById('admin-barber-id').value;
    const data = {
        nome: document.getElementById('admin-barber-name').value,
        especialidade: document.getElementById('admin-barber-specialty').value,
        ativo: true
    };

    try {
        if (id) {
            await db.collection('barbeiros').doc(id).update(data);
        } else {
            await db.collection('barbeiros').add(data);
        }
        closeModals();
        showNotification('Profissional salvo!', 'success');
        loadPublicData().then(() => renderAdminBarbers()); // Recarrega
    } catch (err) {
        console.error(err);
        showNotification('Erro ao salvar.', 'error');
    }
}

window.deleteBarber = async (id) => {
    if(!confirm("Tem certeza?")) return;
    try {
        await db.collection('barbeiros').doc(id).update({ativo: false}); // Soft delete
        loadPublicData().then(() => renderAdminBarbers());
    } catch(err) { console.error(err); }
};

// --- SERVIÇOS CRUD ---
function renderAdminServices() {
    const container = document.getElementById('admin-services-list');
    container.innerHTML = state.services.map(s => `
        <div class="admin-card-item">
            <h4>${s.nome}</h4>
            <p>R$ ${s.preco} - ${s.duracao} min</p>
            <div class="mt-4" style="display:flex; gap:10px">
                <button class="btn-primary btn-sm" style="background:var(--danger)" onclick="deleteService('${s.id}')">Excluir</button>
            </div>
        </div>
    `).join('');
}

window.openServiceModal = () => {
    document.getElementById('service-modal').style.display = 'flex';
    document.getElementById('service-form-admin').reset();
};

async function saveService(e) {
    e.preventDefault();
    const data = {
        nome: document.getElementById('admin-service-name').value,
        preco: parseFloat(document.getElementById('admin-service-price').value),
        duracao: parseInt(document.getElementById('admin-service-duration').value),
        ativo: true
    };

    try {
        await db.collection('servicos').add(data);
        closeModals();
        showNotification('Serviço criado!', 'success');
        loadPublicData().then(() => renderAdminServices());
    } catch (err) {
        showNotification('Erro ao criar serviço.', 'error');
    }
}

window.deleteService = async (id) => {
    if(!confirm("Remover este serviço?")) return;
    await db.collection('servicos').doc(id).update({ativo: false});
    loadPublicData().then(() => renderAdminServices());
};

async function loadAdminAppointments() {
    const snap = await db.collection('agendamentos').orderBy('data', 'desc').limit(20).get();
    const list = document.getElementById('admin-appointments-list');
    
    list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const dateObj = d.data.toDate();
        return `
            <tr>
                <td>${d.usuarioNome || 'Cliente'}</td>
                <td>${d.servicoNome}</td>
                <td>${d.barbeiroNome}</td>
                <td>${dateObj.toLocaleDateString()} ${d.horario}</td>
                <td>${d.status}</td>
                <td>
                    <button onclick="deleteAppointment('${doc.id}')" style="color:red; background:none; border:none; cursor:pointer"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

window.deleteAppointment = async (id) => {
    if(confirm('Cancelar este agendamento?')) {
        await db.collection('agendamentos').doc(id).delete();
        loadAdminAppointments();
    }
}

// =============================================
// FLUXO DE AGENDAMENTO
// =============================================
function initBookingFlow() {
    state.booking = { service: null, barber: null, date: null, time: null };
    renderBookingSteps();
    renderCalendar(state.currentMonth, state.currentYear);
    
    // Configura botões de next/prev step
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const current = parseInt(btn.dataset.prev) + 1;
            changeStep(current - 1);
        });
    });
}

function renderBookingSteps() {
    // Step 1: Services
    const sList = document.getElementById('booking-services');
    sList.innerHTML = state.services.map(s => `
        <div class="service-card" onclick="selectBookingService('${s.id}', this)">
            <h3>${s.nome}</h3>
            <div class="service-price">R$ ${s.preco}</div>
            <p>${s.duracao} min</p>
        </div>
    `).join('');

    // Step 2: Barbers
    const bList = document.getElementById('booking-barbers');
    bList.innerHTML = state.barbers.map(b => `
        <div class="barber-card" onclick="selectBookingBarber('${b.id}', this)">
            <i class="fas fa-user-circle" style="font-size:2rem; margin-bottom:10px; color:var(--accent-color)"></i>
            <h4>${b.nome}</h4>
            <p>${b.especialidade || 'Especialista'}</p>
        </div>
    `).join('');
}

window.selectBookingService = (id, el) => {
    state.booking.service = state.services.find(s => s.id === id);
    document.querySelectorAll('#booking-services .service-card').forEach(c => c.classList.remove('card-selected'));
    el.classList.add('card-selected');
    setTimeout(() => changeStep(2), 300);
};

window.selectBookingBarber = (id, el) => {
    state.booking.barber = state.barbers.find(b => b.id === id);
    document.querySelectorAll('#booking-barbers .barber-card').forEach(c => c.classList.remove('card-selected'));
    el.classList.add('card-selected');
    setTimeout(() => changeStep(3), 300);
};

function changeStep(step) {
    document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    
    document.querySelectorAll('.progress-step').forEach(p => {
        p.classList.remove('active');
        if (parseInt(p.dataset.step) === step) p.classList.add('active');
    });

    if (step === 4) updateConfirmPage();
}

// Lógica do Calendário Simplificada
function renderCalendar(month, year) {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('current-month').innerText = `${monthNames[month]} ${year}`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for(let i=1; i<=daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerText = i;
        dayDiv.onclick = () => selectDate(i, month, year, dayDiv);
        calendar.appendChild(dayDiv);
    }
}

function selectDate(day, month, year, el) {
    state.booking.date = new Date(year, month, day);
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    el.classList.add('selected');
    
    document.getElementById('selected-date-display').innerText = `- ${day}/${month+1}`;
    generateTimeSlots();
}

function generateTimeSlots() {
    const slotsDiv = document.getElementById('time-slots');
    slotsDiv.innerHTML = '';
    
    const times = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    
    times.forEach(time => {
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.innerText = time;
        div.onclick = () => {
            state.booking.time = time;
            document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));
            div.classList.add('selected');
            setTimeout(() => changeStep(4), 300);
        };
        slotsDiv.appendChild(div);
    });
}

function updateConfirmPage() {
    const { service, barber, date, time } = state.booking;
    if(service) {
        document.getElementById('confirm-service').innerText = service.nome;
        document.getElementById('confirm-price').innerText = `R$ ${service.preco}`;
    }
    if(barber) document.getElementById('confirm-barber').innerText = barber.nome;
    if(date && time) document.getElementById('confirm-date-time').innerText = `${date.toLocaleDateString()} às ${time}`;
}

async function confirmBooking() {
    if (!state.currentUser) {
        showNotification('Faça login para finalizar!', 'error');
        openModal('login-modal');
        return;
    }

    try {
        const { service, barber, date, time } = state.booking;
        // Ajustar hora na data
        const [h, m] = time.split(':');
        date.setHours(h, m);

        await db.collection('agendamentos').add({
            usuarioId: state.currentUser.uid,
            usuarioNome: state.currentUser.email, // Idealmente pegar nome do perfil
            servicoId: service.id,
            servicoNome: service.nome,
            barbeiroId: barber.id,
            barbeiroNome: barber.nome,
            data: date,
            horario: time,
            status: 'pendente',
            criadoEm: new Date()
        });

        showNotification('Agendamento Confirmado!', 'success');
        navigateTo('home');
    } catch (err) {
        console.error(err);
        showNotification('Erro ao agendar.', 'error');
    }
}

// =============================================
// AUTH HANDLERS
// =============================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModals();
        showNotification('Bem-vindo!', 'success');
    } catch(err) {
        showNotification('Erro no login: ' + err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const pass = document.getElementById('register-password').value;
    
    try {
        await auth.createUserWithEmailAndPassword(email, pass);
        // Criar perfil
        await db.collection('usuarios').doc(auth.currentUser.uid).set({
            email: email,
            admin: false // Padrão
        });
        closeModals();
        showNotification('Conta criada!', 'success');
    } catch(err) {
        showNotification(err.message, 'error');
    }
}

// =============================================
// UTILITARIOS
// =============================================
function showNotification(msg, type) {
    const notif = document.getElementById('notification');
    const txt = document.getElementById('notification-msg');
    txt.innerText = msg;
    notif.style.borderLeftColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
    notif.classList.remove('hidden');
    setTimeout(() => notif.classList.add('hidden'), 3000);
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function changeMonth(delta) {
    state.currentMonth += delta;
    if(state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    if(state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    renderCalendar(state.currentMonth, state.currentYear);
}
