// Configuração do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Estado global da aplicação
const state = {
    currentUser: null,
    isAdmin: false,
    currentPage: 'home',
    bookingData: {},
    services: [],
    barbers: [],
    appointments: []
};

// Elementos DOM principais
const elements = {
    // Navbar
    navbarLinks: document.querySelector('.nav-links'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userStatus: document.getElementById('user-status'),
    adminLink: document.querySelector('[data-page="admin"]'),
    
    // Modal Login
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    recoverForm: document.getElementById('recover-form'),
    
    // Páginas
    pages: document.querySelectorAll('.page'),
    content: document.getElementById('content'),
    
    // Notificação
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notification-message')
};

// Inicializar a aplicação
function initApp() {
    setupEventListeners();
    initFirebaseAuth();
    loadInitialData();
    setupPageNavigation();
    showPage('home');
}

// Configurar event listeners
function setupEventListeners() {
    // Menu toggle
    document.querySelector('.menu-toggle').addEventListener('click', () => {
        elements.navbarLinks.classList.toggle('show');
    });
    
    // Login button
    elements.loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentUser) {
            showPage('meus-agendamentos');
        } else {
            showLoginModal();
        }
    });
    
    // Logout button
    elements.logoutBtn.addEventListener('click', () => {
        logout();
    });
    
    // Fechar modais
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.classList.contains('modal-close')) {
                hideAllModals();
            }
        });
    });
    
    // Login forms
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.registerForm.addEventListener('submit', handleRegister);
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            showTab(tabId, btn);
        });
    });
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            showAdminTab(tabId, btn);
        });
    });
}

// Firebase Authentication
function initFirebaseAuth() {
    auth.onAuthStateChanged(async (user) => {
        state.currentUser = user;
        updateUI();
        
        if (user) {
            // Carregar dados do usuário
            await loadUserData(user.uid);
            // Verificar se é admin
            await checkAdminStatus(user.uid);
            // Carregar dados específicos do usuário
            if (state.currentPage === 'meus-agendamentos') {
                loadUserAppointments();
            }
        }
    });
}

// Atualizar UI baseado no estado
function updateUI() {
    if (state.currentUser) {
        elements.userStatus.textContent = state.currentUser.email.split('@')[0];
        elements.loginBtn.querySelector('i').className = 'fas fa-user-check';
        elements.logoutBtn.classList.remove('hidden');
        elements.adminLink.classList.toggle('hidden', !state.isAdmin);
    } else {
        elements.userStatus.textContent = 'Login';
        elements.loginBtn.querySelector('i').className = 'fas fa-user';
        elements.logoutBtn.classList.add('hidden');
        elements.adminLink.classList.add('hidden');
    }
}

// Navegação entre páginas
function setupPageNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            // Fechar menu mobile
            elements.navbarLinks.classList.remove('show');
            
            // Atualizar nav active
            document.querySelectorAll('.nav-links a').forEach(a => {
                a.classList.remove('active');
            });
            link.classList.add('active');
            
            // Mostrar página
            showPage(page);
        });
    });
}

// Mostrar página específica
function showPage(page) {
    state.currentPage = page;
    
    // Esconder todas as páginas
    elements.pages.forEach(p => p.classList.remove('active'));
    
    // Mostrar página selecionada
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
        
        // Carregar dados específicos da página
        switch(page) {
            case 'home':
                loadHomeData();
                break;
            case 'agendar':
                initBookingPage();
                break;
            case 'meus-agendamentos':
                if (state.currentUser) {
                    loadUserAppointments();
                } else {
                    showLoginModal();
                    showPage('home');
                }
                break;
            case 'admin':
                if (state.isAdmin) {
                    initAdminPage();
                }
                break;
        }
    }
}

// Carregar dados iniciais
async function loadInitialData() {
    await loadServices();
    await loadBarbers();
}

// ======================
// MÓDULO DE AUTENTICAÇÃO
// ======================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Login realizado com sucesso!', 'success');
        hideAllModals();
    } catch (error) {
        showNotification(getAuthErrorMessage(error.code), 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const phone = document.getElementById('register-phone').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    if (password !== confirmPassword) {
        showNotification('As senhas não coincidem!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('A senha deve ter no mínimo 6 caracteres!', 'error');
        return;
    }
    
    try {
        // Criar usuário no Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Salvar dados adicionais no Firestore
        await db.collection('usuarios').doc(userCredential.user.uid).set({
            nome: name,
            email: email,
            telefone: phone,
            admin: false,
            dataCadastro: new Date()
        });
        
        showNotification('Conta criada com sucesso!', 'success');
        hideAllModals();
    } catch (error) {
        showNotification(getAuthErrorMessage(error.code), 'error');
    }
}

async function logout() {
    try {
        await auth.signOut();
        showNotification('Logout realizado!', 'success');
        showPage('home');
    } catch (error) {
        showNotification('Erro ao fazer logout', 'error');
    }
}

async function loadUserData(userId) {
    try {
        const doc = await db.collection('usuarios').doc(userId).get();
        if (doc.exists) {
            const userData = doc.data();
            document.getElementById('user-name').textContent = userData.nome;
            document.getElementById('user-email').textContent = userData.email;
            document.getElementById('user-phone').textContent = userData.telefone || 'Não informado';
            
            // Preencher formulário de edição
            document.getElementById('edit-name').value = userData.nome;
            document.getElementById('edit-phone').value = userData.telefone || '';
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

async function checkAdminStatus(userId) {
    try {
        const doc = await db.collection('usuarios').doc(userId).get();
        if (doc.exists) {
            state.isAdmin = doc.data().admin === true;
            updateUI();
        }
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
    }
}

function getAuthErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'E-mail inválido',
        'auth/user-disabled': 'Usuário desativado',
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/email-already-in-use': 'E-mail já está em uso',
        'auth/weak-password': 'Senha muito fraca',
        'auth/operation-not-allowed': 'Operação não permitida'
    };
    return messages[code] || 'Erro na autenticação';
}

// ======================
// MÓDULO DE SERVIÇOS
// ======================

async function loadServices() {
    try {
        const snapshot = await db.collection('servicos')
            .where('ativo', '==', true)
            .get();
        
        state.services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderServices();
        return state.services;
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        return [];
    }
}

function renderServices(containerId = 'services-list', selectable = false) {
    const container = document.getElementById(containerId);
    if (!container || !state.services.length) return;
    
    container.innerHTML = state.services.map(service => `
        <div class="service-card ${selectable ? 'selectable' : ''}" 
             data-service-id="${service.id}"
             ${selectable ? `onclick="selectService('${service.id}')"` : ''}>
            <div class="service-icon">
                <i class="fas fa-cut"></i>
            </div>
            <h3>${service.nome}</h3>
            <p>${service.descricao || ''}</p>
            <div class="service-price">
                R$ ${service.preco.toFixed(2)}
            </div>
            <div class="service-duration">
                <i class="fas fa-clock"></i> ${service.duracao} min
            </div>
        </div>
    `).join('');
}

// ======================
// MÓDULO DE BARBEIROS
// ======================

async function loadBarbers() {
    try {
        const snapshot = await db.collection('barbeiros')
            .where('ativo', '==', true)
            .get();
        
        state.barbers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderBarbers();
        return state.barbers;
    } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
        return [];
    }
}

function renderBarbers(containerId = 'barbers-grid', selectable = false) {
    const container = document.getElementById(containerId);
    if (!container || !state.barbers.length) return;
    
    container.innerHTML = state.barbers.map(barber => `
        <div class="barber-card ${selectable ? 'selectable' : ''}" 
             data-barber-id="${barber.id}"
             ${selectable ? `onclick="selectBarber('${barber.id}')"` : ''}>
            <div class="barber-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <h3>${barber.nome}</h3>
            ${!selectable ? `
                <p>${barber.servicos?.length || 0} serviços</p>
            ` : ''}
        </div>
    `).join('');
}

// ======================
// MÓDULO DE AGENDAMENTOS
// ======================

async function createAppointment(appointmentData) {
    try {
        const docRef = await db.collection('agendamentos').add({
            ...appointmentData,
            usuarioId: state.currentUser.uid,
            status: 'pendente',
            dataCriacao: new Date()
        });
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        return { success: false, error: error.message };
    }
}

async function loadUserAppointments() {
    if (!state.currentUser) return;
    
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Agendamentos futuros
        const upcomingSnapshot = await db.collection('agendamentos')
            .where('usuarioId', '==', state.currentUser.uid)
            .where('data', '>=', today)
            .orderBy('data')
            .get();
        
        // Histórico
        const historySnapshot = await db.collection('agendamentos')
            .where('usuarioId', '==', state.currentUser.uid)
            .where('data', '<', today)
            .orderBy('data', 'desc')
            .limit(20)
            .get();
        
        const upcoming = await enrichAppointments(upcomingSnapshot);
        const history = await enrichAppointments(historySnapshot);
        
        renderAppointments('upcoming-list', upcoming);
        renderAppointments('history-list', history);
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
    }
}

async function enrichAppointments(snapshot) {
    const appointments = [];
    
    for (const doc of snapshot.docs) {
        const appointment = { id: doc.id, ...doc.data() };
        
        // Buscar serviço
        if (appointment.servicoId) {
            const service = state.services.find(s => s.id === appointment.servicoId);
            appointment.service = service;
        }
        
        // Buscar barbeiro
        if (appointment.barbeiroId) {
            const barber = state.barbers.find(b => b.id === appointment.barbeiroId);
            appointment.barber = barber;
        }
        
        appointments.push(appointment);
    }
    
    return appointments;
}

function renderAppointments(containerId, appointments) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!appointments.length) {
        container.innerHTML = '<div class="empty-state">Nenhum agendamento encontrado</div>';
        return;
    }
    
    container.innerHTML = appointments.map(app => `
        <div class="appointment-item">
            <div class="appointment-header">
                <h3>${app.service?.nome || 'Serviço'}</h3>
                <span class="appointment-status status-${app.status}">
                    ${translateStatus(app.status)}
                </span>
            </div>
            <div class="appointment-details">
                <p><i class="fas fa-user-tie"></i> ${app.barber?.nome || 'Barbeiro'}</p>
                <p><i class="fas fa-calendar"></i> ${formatDate(app.data)}</p>
                <p><i class="fas fa-clock"></i> ${app.horario || ''}</p>
                <p><i class="fas fa-money-bill-wave"></i> R$ ${app.preco?.toFixed(2) || '0.00'}</p>
            </div>
            ${(app.status === 'pendente' || app.status === 'confirmado') ? `
                <div class="appointment-actions">
                    <button class="btn-danger btn-sm" onclick="cancelAppointment('${app.id}')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
    try {
        await db.collection('agendamentos').doc(appointmentId).update({
            status: 'cancelado',
            dataCancelamento: new Date()
        });
        
        showNotification('Agendamento cancelado com sucesso!', 'success');
        loadUserAppointments();
    } catch (error) {
        showNotification('Erro ao cancelar agendamento', 'error');
    }
}

// ======================
// MÓDULO DE AGENDAMENTO
// ======================

function initBookingPage() {
    if (!state.currentUser) {
        showLoginModal();
        showPage('home');
        return;
    }
    
    // Resetar dados do agendamento
    state.bookingData = {};
    
    // Renderizar serviços e barbeiros selecionáveis
    renderServices('booking-services', true);
    renderBarbers('booking-barbers', true);
    
    // Inicializar calendário
    initCalendar();
    
    // Configurar navegação dos steps
    setupBookingSteps();
}

function selectService(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    // Atualizar UI
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-service-id="${serviceId}"]`).classList.add('selected');
    
    // Salvar seleção
    state.bookingData.service = service;
    state.bookingData.serviceId = serviceId;
    
    // Ativar próximo passo
    document.querySelector('#step-1 .next-step').disabled = false;
    
    // Atualizar confirmação
    updateConfirmation();
}

function selectBarber(barberId) {
    const barber = state.barbers.find(b => b.id === barberId);
    if (!barber) return;
    
    // Atualizar UI
    document.querySelectorAll('.barber-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-barber-id="${barberId}"]`).classList.add('selected');
    
    // Salvar seleção
    state.bookingData.barber = barber;
    state.bookingData.barberId = barberId;
    
    // Ativar próximo passo
    document.querySelector('#step-2 .next-step').disabled = false;
    
    // Atualizar confirmação
    updateConfirmation();
}

function initCalendar() {
    const now = new Date();
    renderCalendar(now.getMonth(), now.getFullYear());
    
    // Navegação do calendário
    document.getElementById('prev-month').addEventListener('click', () => {
        const currentMonth = document.getElementById('current-month').dataset.month;
        const [year, month] = currentMonth.split('-').map(Number);
        const newDate = new Date(year, month - 1);
        newDate.setMonth(newDate.getMonth() - 1);
        renderCalendar(newDate.getMonth(), newDate.getFullYear());
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        const currentMonth = document.getElementById('current-month').dataset.month;
        const [year, month] = currentMonth.split('-').map(Number);
        const newDate = new Date(year, month - 1);
        newDate.setMonth(newDate.getMonth() + 1);
        renderCalendar(newDate.getMonth(), newDate.getFullYear());
    });
}

function renderCalendar(month, year) {
    const container = document.getElementById('calendar');
    if (!container) return;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Atualizar título
    const monthTitle = document.getElementById('current-month');
    monthTitle.textContent = `${monthNames[month]} ${year}`;
    monthTitle.dataset.month = `${year}-${month + 1}`;
    
    // Gerar calendário
    let calendarHTML = `
        <div class="calendar-day header">Dom</div>
        <div class="calendar-day header">Seg</div>
        <div class="calendar-day header">Ter</div>
        <div class="calendar-day header">Qua</div>
        <div class="calendar-day header">Qui</div>
        <div class="calendar-day header">Sex</div>
        <div class="calendar-day header">Sáb</div>
    `;
    
    // Dias vazios no início
    for (let i = 0; i < startingDay; i++) {
        calendarHTML += '<div class="calendar-day disabled"></div>';
    }
    
    // Dias do mês
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const isToday = currentDate.getTime() === today.getTime();
        const isSelected = state.bookingData.date && 
            currentDate.getDate() === state.bookingData.date.getDate() &&
            currentDate.getMonth() === state.bookingData.date.getMonth() &&
            currentDate.getFullYear() === state.bookingData.date.getFullYear();
        const isPast = currentDate < today;
        
        let className = 'calendar-day';
        if (isToday) className += ' today';
        if (isSelected) className += ' selected';
        if (isPast) className += ' disabled';
        
        if (!isPast) {
            calendarHTML += `
                <div class="${className}" 
                     onclick="selectDate('${currentDate.toISOString()}')">
                    ${day}
                </div>
            `;
        } else {
            calendarHTML += `<div class="${className}">${day}</div>`;
        }
    }
    
    container.innerHTML = calendarHTML;
}

function selectDate(dateString) {
    const date = new Date(dateString);
    state.bookingData.date = date;
    
    // Atualizar UI
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    const selectedDay = Array.from(document.querySelectorAll('.calendar-day'))
        .find(day => {
            const dayNum = parseInt(day.textContent);
            return dayNum && dayNum === date.getDate();
        });
    
    if (selectedDay) {
        selectedDay.classList.add('selected');
    }
    
    // Carregar horários disponíveis
    loadAvailableTimes(date);
}

async function loadAvailableTimes(date) {
    if (!state.bookingData.barberId) return;
    
    const container = document.getElementById('time-slots');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Carregando horários...</div>';
    
    try {
        // Simular horários disponíveis (implementação real precisa verificar agendamentos existentes)
        const availableTimes = generateTimeSlots(date);
        
        if (availableTimes.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum horário disponível</div>';
            return;
        }
        
        container.innerHTML = availableTimes.map(time => `
            <div class="time-slot" onclick="selectTime('${time}')">
                ${time}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        container.innerHTML = '<div class="empty-state">Erro ao carregar horários</div>';
    }
}

function generateTimeSlots(date) {
    const slots = [];
    const dayOfWeek = date.getDay();
    
    // Verificar se é dia útil (segunda a sábado)
    if (dayOfWeek === 0) return []; // Domingo
    
    // Horários base (9h às 18h)
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute of ['00', '30']) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
        }
    }
    
    return slots;
}

function selectTime(time) {
    state.bookingData.time = time;
    
    // Atualizar UI
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    const selectedSlot = Array.from(document.querySelectorAll('.time-slot'))
        .find(slot => slot.textContent.trim() === time);
    
    if (selectedSlot) {
        selectedSlot.classList.add('selected');
        document.querySelector('#step-3 .next-step').disabled = false;
        updateConfirmation();
    }
}

function setupBookingSteps() {
    // Próximo passo
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = btn.dataset.next;
            const currentStep = btn.closest('.step-content').id.split('-')[1];
            
            // Atualizar progresso
            updateProgress(currentStep, nextStep);
            
            // Mostrar próximo passo
            showStep(nextStep);
        });
    });
    
    // Voltar passo
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = btn.dataset.prev;
            const currentStep = btn.closest('.step-content').id.split('-')[1];
            
            // Atualizar progresso
            updateProgress(currentStep, prevStep);
            
            // Mostrar passo anterior
            showStep(prevStep);
        });
    });
    
    // Confirmar agendamento
    document.getElementById('confirm-booking').addEventListener('click', confirmBooking);
}

function updateProgress(fromStep, toStep) {
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.toggle('active', stepNum <= toStep);
    });
}

function showStep(stepNumber) {
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`step-${stepNumber}`).classList.add('active');
}

function updateConfirmation() {
    if (state.bookingData.service) {
        document.getElementById('confirm-service').textContent = state.bookingData.service.nome;
        document.getElementById('confirm-price').textContent = `R$ ${state.bookingData.service.preco.toFixed(2)}`;
    }
    
    if (state.bookingData.barber) {
        document.getElementById('confirm-barber').textContent = state.bookingData.barber.nome;
    }
    
    if (state.bookingData.date) {
        document.getElementById('confirm-date').textContent = formatDate(state.bookingData.date);
    }
    
    if (state.bookingData.time) {
        document.getElementById('confirm-time').textContent = state.bookingData.time;
    }
}

async function confirmBooking() {
    if (!state.bookingData.service || !state.bookingData.barber || !state.bookingData.date || !state.bookingData.time) {
        showNotification('Preencha todos os dados do agendamento', 'error');
        return;
    }
    
    try {
        // Combinar data e hora
        const appointmentDate = new Date(state.bookingData.date);
        const [hours, minutes] = state.bookingData.time.split(':');
        appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const result = await createAppointment({
            servicoId: state.bookingData.serviceId,
            barbeiroId: state.bookingData.barberId,
            data: appointmentDate,
            horario: state.bookingData.time,
            preco: state.bookingData.service.preco
        });
        
        if (result.success) {
            showNotification('Agendamento realizado com sucesso!', 'success');
            
            // Resetar agendamento
            state.bookingData = {};
            
            // Voltar para home
            setTimeout(() => {
                showPage('home');
            }, 2000);
        } else {
            showNotification('Erro ao realizar agendamento', 'error');
        }
    } catch (error) {
        showNotification('Erro ao confirmar agendamento', 'error');
    }
}

// ======================
// MÓDULO ADMIN
// ======================

async function initAdminPage() {
    if (!state.isAdmin) {
        document.getElementById('admin-access').classList.remove('hidden');
        document.getElementById('admin-content').classList.add('hidden');
        return;
    }
    
    document.getElementById('admin-access').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');
    
    // Carregar dados admin
    await loadAdminData();
    
    // Configurar eventos admin
    setupAdminEvents();
}

async function loadAdminData() {
    await loadAdminStats();
    await loadAdminAppointments();
    await loadAdminBarbers();
    await loadAdminServices();
}

async function loadAdminStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Agendamentos de hoje
        const todaySnapshot = await db.collection('agendamentos')
            .where('data', '>=', today)
            .where('data', '<', tomorrow)
            .get();
        
        document.getElementById('today-stats').textContent = todaySnapshot.size;
        
        // Agendamentos confirmados
        const confirmedSnapshot = await db.collection('agendamentos')
            .where('status', '==', 'confirmado')
            .get();
        
        document.getElementById('confirmed-stats').textContent = confirmedSnapshot.size;
        
        // Barbeiros ativos
        const barbersSnapshot = await db.collection('barbeiros')
            .where('ativo', '==', true)
            .get();
        
        document.getElementById('barbers-stats').textContent = barbersSnapshot.size;
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

async function loadAdminAppointments() {
    try {
        const snapshot = await db.collection('agendamentos')
            .orderBy('data', 'desc')
            .limit(50)
            .get();
        
        const appointments = await enrichAdminAppointments(snapshot);
        renderAdminAppointments(appointments);
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos admin:', error);
    }
}

async function enrichAdminAppointments(snapshot) {
    const appointments = [];
    
    for (const doc of snapshot.docs) {
        const appointment = { id: doc.id, ...doc.data() };
        
        // Buscar serviço
        if (appointment.servicoId) {
            const service = state.services.find(s => s.id === appointment.servicoId);
            appointment.service = service;
        }
        
        // Buscar barbeiro
        if (appointment.barbeiroId) {
            const barber = state.barbers.find(b => b.id === appointment.barbeiroId);
            appointment.barber = barber;
        }
        
        // Buscar usuário
        if (appointment.usuarioId) {
            const userDoc = await db.collection('usuarios').doc(appointment.usuarioId).get();
            if (userDoc.exists) {
                appointment.user = userDoc.data();
            }
        }
        
        appointments.push(appointment);
    }
    
    return appointments;
}

function renderAdminAppointments(appointments) {
    const container = document.getElementById('admin-appointments');
    if (!container) return;
    
    if (!appointments.length) {
        container.innerHTML = '<tr><td colspan="5">Nenhum agendamento</td></tr>';
        return;
    }
    
    container.innerHTML = appointments.map(app => `
        <tr>
            <td>${app.user?.nome || 'Cliente'}</td>
            <td>${app.service?.nome || 'Serviço'}</td>
            <td>${formatDate(app.data)} ${app.horario || ''}</td>
            <td>
                <span class="appointment-status status-${app.status}">
                    ${translateStatus(app.status)}
                </span>
            </td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editAppointment('${app.id}')">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function loadAdminBarbers() {
    const container = document.getElementById('admin-barbers');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('barbeiros').get();
        const barbers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        container.innerHTML = barbers.map(barber => `
            <div class="barber-card">
                <div class="barber-avatar">
                    <i class="fas fa-user-tie"></i>
                </div>
                <h3>${barber.nome}</h3>
                <p>${barber.servicos?.length || 0} serviços</p>
                <div class="card-actions">
                    <button class="btn-secondary btn-sm" onclick="editBarber('${barber.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteBarber('${barber.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar barbeiros admin:', error);
    }
}

async function loadAdminServices() {
    const container = document.getElementById('admin-services');
    if (!container) return;
    
    try {
        const snapshot = await db.collection('servicos').get();
        const services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        container.innerHTML = services.map(service => `
            <div class="service-card">
                <div class="service-icon">
                    <i class="fas fa-cut"></i>
                </div>
                <h3>${service.nome}</h3>
                <p>${service.descricao || ''}</p>
                <div class="service-price">R$ ${service.preco.toFixed(2)}</div>
                <div class="service-duration">${service.duracao} min</div>
                <div class="card-actions">
                    <button class="btn-secondary btn-sm" onclick="editService('${service.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteService('${service.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar serviços admin:', error);
    }
}

function setupAdminEvents() {
    // Adicionar barbeiro
    document.getElementById('add-barber-btn').addEventListener('click', () => {
        showBarberModal();
    });
    
    // Adicionar serviço
    document.getElementById('add-service-btn').addEventListener('click', () => {
        showServiceModal();
    });
    
    // Formulário barbeiro
    document.getElementById('barber-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveBarber();
    });
    
    // Formulário serviço
    document.getElementById('service-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveService();
    });
    
    // Filtro de data
    document.getElementById('filter-date').addEventListener('change', async (e) => {
        await filterAppointmentsByDate(e.target.value);
    });
}

function showBarberModal(barber = null) {
    document.getElementById('barber-modal-title').textContent = barber ? 'Editar Barbeiro' : 'Novo Barbeiro';
    
    if (barber) {
        document.getElementById('barber-id').value = barber.id;
        document.getElementById('barber-name').value = barber.nome;
    } else {
        document.getElementById('barber-id').value = '';
        document.getElementById('barber-name').value = '';
    }
    
    document.getElementById('barber-modal').style.display = 'flex';
}

function showServiceModal(service = null) {
    document.getElementById('service-modal-title').textContent = service ? 'Editar Serviço' : 'Novo Serviço';
    
    if (service) {
        document.getElementById('service-id').value = service.id;
        document.getElementById('service-name').value = service.nome;
        document.getElementById('service-price').value = service.preco;
        document.getElementById('service-duration').value = service.duracao;
    } else {
        document.getElementById('service-id').value = '';
        document.getElementById('service-name').value = '';
        document.getElementById('service-price').value = '';
        document.getElementById('service-duration').value = '30';
    }
    
    document.getElementById('service-modal').style.display = 'flex';
}

async function saveBarber() {
    const id = document.getElementById('barber-id').value;
    const name = document.getElementById('barber-name').value;
    
    try {
        if (id) {
            // Atualizar barbeiro existente
            await db.collection('barbeiros').doc(id).update({
                nome: name,
                updatedAt: new Date()
            });
            showNotification('Barbeiro atualizado com sucesso!', 'success');
        } else {
            // Criar novo barbeiro
            await db.collection('barbeiros').add({
                nome: name,
                ativo: true,
                servicos: [],
                createdAt: new Date()
            });
            showNotification('Barbeiro criado com sucesso!', 'success');
        }
        
        hideAllModals();
        await loadAdminBarbers();
        
    } catch (error) {
        showNotification('Erro ao salvar barbeiro', 'error');
    }
}

async function saveService() {
    const id = document.getElementById('service-id').value;
    const name = document.getElementById('service-name').value;
    const price = parseFloat(document.getElementById('service-price').value);
    const duration = parseInt(document.getElementById('service-duration').value);
    
    try {
        if (id) {
            // Atualizar serviço existente
            await db.collection('servicos').doc(id).update({
                nome: name,
                preco: price,
                duracao: duration,
                updatedAt: new Date()
            });
            showNotification('Serviço atualizado com sucesso!', 'success');
        } else {
            // Criar novo serviço
            await db.collection('servicos').add({
                nome: name,
                preco: price,
                duracao: duration,
                ativo: true,
                createdAt: new Date()
            });
            showNotification('Serviço criado com sucesso!', 'success');
        }
        
        hideAllModals();
        await loadAdminServices();
        await loadServices(); // Atualizar serviços globais
        
    } catch (error) {
        showNotification('Erro ao salvar serviço', 'error');
    }
}

async function editBarber(barberId) {
    try {
        const doc = await db.collection('barbeiros').doc(barberId).get();
        if (doc.exists) {
            showBarberModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        showNotification('Erro ao carregar barbeiro', 'error');
    }
}

async function editService(serviceId) {
    try {
        const doc = await db.collection('servicos').doc(serviceId).get();
        if (doc.exists) {
            showServiceModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        showNotification('Erro ao carregar serviço', 'error');
    }
}

async function deleteBarber(barberId) {
    if (!confirm('Tem certeza que deseja desativar este barbeiro?')) return;
    
    try {
        await db.collection('barbeiros').doc(barberId).update({
            ativo: false,
            updatedAt: new Date()
        });
        
        showNotification('Barbeiro desativado com sucesso!', 'success');
        await loadAdminBarbers();
        
    } catch (error) {
        showNotification('Erro ao desativar barbeiro', 'error');
    }
}

async function deleteService(serviceId) {
    if (!confirm('Tem certeza que deseja desativar este serviço?')) return;
    
    try {
        await db.collection('servicos').doc(serviceId).update({
            ativo: false,
            updatedAt: new Date()
        });
        
        showNotification('Serviço desativado com sucesso!', 'success');
        await loadAdminServices();
        await loadServices(); // Atualizar serviços globais
        
    } catch (error) {
        showNotification('Erro ao desativar serviço', 'error');
    }
}

async function filterAppointmentsByDate(dateString) {
    if (!dateString) {
        await loadAdminAppointments();
        return;
    }
    
    try {
        const date = new Date(dateString);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const snapshot = await db.collection('agendamentos')
            .where('data', '>=', date)
            .where('data', '<', nextDay)
            .orderBy('data')
            .get();
        
        const appointments = await enrichAdminAppointments(snapshot);
        renderAdminAppointments(appointments);
        
    } catch (error) {
        console.error('Erro ao filtrar agendamentos:', error);
    }
}

// ======================
// FUNÇÕES UTILITÁRIAS
// ======================

function showLoginModal() {
    hideAllModals();
    elements.loginModal.style.display = 'flex';
    showAuthTab('login');
}

function hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
}

function showAuthTab(tabName) {
    // Esconder todos os formulários
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Mostrar formulário selecionado
    document.getElementById(`${tabName}-form`).classList.add('active');
    
    // Atualizar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

function showTab(tabId, button) {
    // Atualizar botões
    button.parentElement.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Mostrar conteúdo
    button.closest('.tabs').parentElement.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

function showAdminTab(tabId, button) {
    // Atualizar botões
    button.parentElement.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Mostrar conteúdo
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

function showNotification(message, type = 'info') {
    elements.notificationMessage.textContent = message;
    elements.notification.className = `notification show ${type}`;
    
    // Fechar automaticamente após 5 segundos
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 5000);
    
    // Fechar manualmente
    elements.notification.querySelector('.notification-close').onclick = () => {
        elements.notification.classList.remove('show');
    };
}

function formatDate(date) {
    if (!date) return '';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function translateStatus(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'realizado': 'Realizado',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

function loadHomeData() {
    // Dados da home já são carregados no loadInitialData
}

// ======================
// INICIALIZAÇÃO
// ======================

// Quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);

// Expor funções para uso no HTML
window.selectService = selectService;
window.selectBarber = selectBarber;
window.selectDate = selectDate;
window.selectTime = selectTime;
window.cancelAppointment = cancelAppointment;
window.editBarber = editBarber;
window.editService = editService;
window.deleteBarber = deleteBarber;
window.deleteService = deleteService;

// Configurar PWA básico
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
            console.log('ServiceWorker falhou:', error);
        });
    });
}

// Manifest para PWA
const manifest = {
    "name": "Barbearia Vintage",
    "short_name": "Barbearia",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#1a1a1a",
    "theme_color": "#d4af37",
    "icons": []
};

// Armazenamento offline simples
const setupOfflineStorage = () => {
    if (!window.indexedDB) return;
    
    const request = indexedDB.open('BarbeariaDB', 1);
    
    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('agendamentos')) {
            db.createObjectStore('agendamentos', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('servicos')) {
            db.createObjectStore('servicos', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('barbeiros')) {
            db.createObjectStore('barbeiros', { keyPath: 'id' });
        }
    };
};

setupOfflineStorage();
