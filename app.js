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
// ESTADO GLOBAL DA APLICAÇÃO
// =============================================
const state = {
    currentUser: null,
    isAdmin: false,
    currentPage: 'home',
    bookingData: {
        service: null,
        barber: null,
        date: null,
        time: null
    },
    services: [],
    barbers: [],
    appointments: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// =============================================
// ELEMENTOS DOM PRINCIPAIS
// =============================================
const elements = {
    // Navegação
    navbarLinks: document.querySelector('.nav-links'),
    menuToggle: document.querySelector('.menu-toggle'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userStatus: document.getElementById('user-status'),
    adminLink: document.querySelector('[data-page="admin"]'),
    
    // Modal de Login
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    recoverForm: document.getElementById('recover-form'),
    
    // Páginas
    pages: document.querySelectorAll('.page'),
    
    // Notificação
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notification-message'),
    notificationClose: document.querySelector('.notification-close'),
    
    // Loading
    loadingOverlay: document.getElementById('loading-overlay')
};

// =============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// =============================================
function initApp() {
    showLoading();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Inicializar Firebase Auth
    initFirebaseAuth();
    
    // Configurar navegação
    setupPageNavigation();
    
    // Carregar dados iniciais
    loadInitialData().then(() => {
        hideLoading();
    }).catch(error => {
        console.error('Erro ao inicializar app:', error);
        hideLoading();
    });
}

// =============================================
// CONFIGURAÇÃO DE EVENT LISTENERS
// =============================================
function setupEventListeners() {
    // Menu toggle
    elements.menuToggle.addEventListener('click', toggleMobileMenu);
    
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
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Fechar modais
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || 
            e.target.classList.contains('modal-close') ||
            e.target.closest('.modal-close')) {
            hideAllModals();
        }
    });
    
    // Fechar notificação
    if (elements.notificationClose) {
        elements.notificationClose.addEventListener('click', () => {
            elements.notification.classList.add('hidden');
        });
    }
    
    // Formulários de autenticação
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    
    if (elements.registerForm) {
        elements.registerForm.addEventListener('submit', handleRegister);
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = btn.dataset.tab;
            showTab(tabId, btn);
        });
    });
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = btn.dataset.tab;
            showAdminTab(tabId, btn);
        });
    });
    
    // Login modal tabs
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = btn.dataset.tab;
            showAuthTab(tab);
        });
    });
    
    // Recuperar senha
    const forgotPasswordBtn = document.getElementById('forgot-password');
    const backToLoginBtn = document.getElementById('back-to-login');
    
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', () => {
            showAuthTab('recover');
        });
    }
    
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            showAuthTab('login');
        });
    }
}

// =============================================
// FIREBASE AUTHENTICATION
// =============================================
function initFirebaseAuth() {
    auth.onAuthStateChanged(async (user) => {
        state.currentUser = user;
        updateUI();
        
        if (user) {
            // Carregar dados do usuário
            await loadUserData(user.uid);
            
            // Verificar se é admin
            await checkAdminStatus(user.uid);
            
            // Se estiver na página de agendamentos, carregar dados
            if (state.currentPage === 'meus-agendamentos') {
                loadUserAppointments();
            }
        } else {
            state.isAdmin = false;
            updateUI();
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    showLoading();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Login realizado com sucesso!', 'success');
        hideAllModals();
    } catch (error) {
        showNotification(getAuthErrorMessage(error.code), 'error');
    } finally {
        hideLoading();
    }
}

async function handleRegister(e) {
    e.preventDefault();
    showLoading();
    
    const name = document.getElementById('register-name').value;
    const phone = document.getElementById('register-phone').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    // Validações
    if (password !== confirmPassword) {
        showNotification('As senhas não coincidem!', 'error');
        hideLoading();
        return;
    }
    
    if (password.length < 6) {
        showNotification('A senha deve ter no mínimo 6 caracteres!', 'error');
        hideLoading();
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
    } finally {
        hideLoading();
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        showNotification('Logout realizado com sucesso!', 'success');
        showPage('home');
    } catch (error) {
        showNotification('Erro ao fazer logout', 'error');
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
        'auth/operation-not-allowed': 'Operação não permitida',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.'
    };
    return messages[code] || 'Erro na autenticação';
}

// =============================================
// UI E NAVEGAÇÃO
// =============================================
function updateUI() {
    if (state.currentUser) {
        // Atualizar status do usuário
        elements.userStatus.textContent = state.currentUser.email.split('@')[0];
        elements.loginBtn.classList.add('hidden');
        elements.logoutBtn.classList.remove('hidden');
        
        // Mostrar/ocultar link admin
        if (state.isAdmin) {
            elements.adminLink.classList.remove('hidden');
        } else {
            elements.adminLink.classList.add('hidden');
        }
    } else {
        elements.userStatus.textContent = 'Entrar';
        elements.loginBtn.classList.remove('hidden');
        elements.logoutBtn.classList.add('hidden');
        elements.adminLink.classList.add('hidden');
    }
}

function toggleMobileMenu() {
    elements.navbarLinks.classList.toggle('active');
    elements.menuToggle.classList.toggle('active');
}

function setupPageNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            
            // Fechar menu mobile se aberto
            if (elements.navbarLinks.classList.contains('active')) {
                toggleMobileMenu();
            }
            
            // Atualizar navegação ativa
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            link.classList.add('active');
            
            // Mostrar página
            showPage(page);
        });
    });
}

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
                } else {
                    showPage('home');
                }
                break;
        }
    }
}

// =============================================
// FUNÇÕES DE DADOS
// =============================================
async function loadInitialData() {
    await Promise.all([
        loadServices(),
        loadBarbers()
    ]);
}

async function loadUserData(userId) {
    try {
        const doc = await db.collection('usuarios').doc(userId).get();
        if (doc.exists) {
            const userData = doc.data();
            
            // Atualizar perfil
            document.getElementById('user-name').textContent = userData.nome;
            document.getElementById('user-email').textContent = userData.email;
            document.getElementById('user-phone').textContent = userData.telefone || 'Não informado';
            
            // Formatação da data de cadastro
            if (userData.dataCadastro) {
                const date = userData.dataCadastro.toDate();
                const options = { day: 'numeric', month: 'long', year: 'numeric' };
                document.getElementById('user-since').textContent = 
                    `Membro desde ${date.toLocaleDateString('pt-BR', options)}`;
            }
            
            // Preencher formulário de edição
            document.getElementById('edit-name').value = userData.nome;
            document.getElementById('edit-phone').value = userData.telefone || '';
            document.getElementById('edit-email').value = userData.email;
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
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showNotification('Erro ao carregar serviços', 'error');
    }
}

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
        
        // Atualizar contador na home
        document.getElementById('barber-count').textContent = state.barbers.length;
    } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
    }
}

// =============================================
// RENDERIZAÇÃO
// =============================================
function renderServices(containerId = 'services-list', selectable = false) {
    const container = document.getElementById(containerId);
    if (!container || !state.services.length) return;
    
    container.innerHTML = state.services.map(service => `
        <div class="service-card ${selectable ? 'selectable' : ''}" 
             data-service-id="${service.id}"
             onclick="${selectable ? `selectService('${service.id}')` : ''}">
            <div class="service-icon">
                <i class="fas fa-cut"></i>
            </div>
            <h3 class="service-title">${service.nome}</h3>
            <p class="service-description">${service.descricao || ''}</p>
            <div class="service-price">R$ ${service.preco.toFixed(2)}</div>
            <div class="service-duration">
                <i class="fas fa-clock"></i>
                <span>${service.duracao} minutos</span>
            </div>
        </div>
    `).join('');
}

function renderBarbers(containerId = 'barbers-grid', selectable = false) {
    const container = document.getElementById(containerId);
    if (!container || !state.barbers.length) return;
    
    container.innerHTML = state.barbers.map(barber => `
        <div class="barber-card ${selectable ? 'selectable' : ''}" 
             data-barber-id="${barber.id}"
             onclick="${selectable ? `selectBarber('${barber.id}')` : ''}">
            <div class="barber-avatar">
                <i class="fas fa-user-tie"></i>
            </div>
            <h3 class="barber-name">${barber.nome}</h3>
            <p class="barber-specialty">
                ${barber.servicos ? barber.servicos.length : 0} serviços
            </p>
        </div>
    `).join('');
}

// =============================================
// SISTEMA DE AGENDAMENTO
// =============================================
function initBookingPage() {
    if (!state.currentUser) {
        showLoginModal();
        showPage('home');
        return;
    }
    
    // Resetar dados do agendamento
    state.bookingData = {
        service: null,
        barber: null,
        date: null,
        time: null
    };
    
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
    
    // Atualizar seleção visual
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-service-id="${serviceId}"]`).classList.add('selected');
    
    // Salvar seleção
    state.bookingData.service = service;
    
    // Ativar próximo passo
    document.querySelector('#step-1 .next-step').disabled = false;
    
    // Atualizar confirmação
    updateConfirmation();
}

function selectBarber(barberId) {
    const barber = state.barbers.find(b => b.id === barberId);
    if (!barber) return;
    
    // Atualizar seleção visual
    document.querySelectorAll('.barber-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-barber-id="${barberId}"]`).classList.add('selected');
    
    // Salvar seleção
    state.bookingData.barber = barber;
    
    // Ativar próximo passo
    document.querySelector('#step-2 .next-step').disabled = false;
    
    // Atualizar confirmação
    updateConfirmation();
}

function initCalendar() {
    renderCalendar(state.currentMonth, state.currentYear);
    
    // Navegação do calendário
    document.getElementById('prev-month').addEventListener('click', () => {
        state.currentMonth--;
        if (state.currentMonth < 0) {
            state.currentMonth = 11;
            state.currentYear--;
        }
        renderCalendar(state.currentMonth, state.currentYear);
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        state.currentMonth++;
        if (state.currentMonth > 11) {
            state.currentMonth = 0;
            state.currentYear++;
        }
        renderCalendar(state.currentMonth, state.currentYear);
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
    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
    
    // Gerar calendário
    let calendarHTML = '';
    
    // Dias vazios no início
    for (let i = 0; i < startingDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
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
                <div class="${className}" onclick="selectCalendarDate(${year}, ${month}, ${day})">
                    ${day}
                </div>
            `;
        } else {
            calendarHTML += `<div class="${className}">${day}</div>`;
        }
    }
    
    container.innerHTML = calendarHTML;
}

function selectCalendarDate(year, month, day) {
    const date = new Date(year, month, day);
    state.bookingData.date = date;
    
    // Atualizar título dos horários
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('selected-date').textContent = 
        date.toLocaleDateString('pt-BR', options);
    
    // Atualizar seleção visual
    document.querySelectorAll('.calendar-day').forEach(dayEl => {
        dayEl.classList.remove('selected');
    });
    
    // Gerar horários disponíveis
    generateTimeSlots(date);
    
    // Atualizar confirmação
    updateConfirmation();
}

function generateTimeSlots(date) {
    const container = document.getElementById('time-slots');
    if (!container) return;
    
    // Horários padrão (9h às 18h, intervalo de 30min)
    const slots = [];
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute of ['00', '30']) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
        }
    }
    
    container.innerHTML = slots.map(time => `
        <div class="time-slot" onclick="selectTimeSlot('${time}')">
            ${time}
        </div>
    `).join('');
}

function selectTimeSlot(time) {
    state.bookingData.time = time;
    
    // Atualizar seleção visual
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
    // Navegação entre steps
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = btn.dataset.next;
            navigateToStep(nextStep);
        });
    });
    
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = btn.dataset.prev;
            navigateToStep(prevStep);
        });
    });
    
    // Confirmar agendamento
    document.getElementById('confirm-booking').addEventListener('click', confirmBooking);
}

function navigateToStep(stepNumber) {
    // Atualizar progresso visual
    document.querySelectorAll('.progress-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.toggle('active', stepNum <= stepNumber);
    });
    
    // Mostrar step selecionado
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`step-${stepNumber}`).classList.add('active');
}

function updateConfirmation() {
    if (state.bookingData.service) {
        document.getElementById('confirm-service').textContent = state.bookingData.service.nome;
        document.getElementById('confirm-price').textContent = `R$ ${state.bookingData.service.preco.toFixed(2)}`;
        document.getElementById('confirm-duration').textContent = `${state.bookingData.service.duracao} minutos`;
        document.getElementById('confirm-total').textContent = `R$ ${state.bookingData.service.preco.toFixed(2)}`;
    }
    
    if (state.bookingData.barber) {
        document.getElementById('confirm-barber').textContent = state.bookingData.barber.nome;
    }
    
    if (state.bookingData.date) {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('confirm-date').textContent = 
            state.bookingData.date.toLocaleDateString('pt-BR', options);
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
    
    showLoading();
    
    try {
        // Combinar data e hora
        const appointmentDate = new Date(state.bookingData.date);
        const [hours, minutes] = state.bookingData.time.split(':');
        appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Criar agendamento no Firestore
        const docRef = await db.collection('agendamentos').add({
            usuarioId: state.currentUser.uid,
            servicoId: state.bookingData.service.id,
            barbeiroId: state.bookingData.barber.id,
            data: appointmentDate,
            horario: state.bookingData.time,
            preco: state.bookingData.service.preco,
            status: 'pendente',
            dataCriacao: new Date()
        });
        
        showNotification('Agendamento realizado com sucesso!', 'success');
        
        // Resetar dados
        state.bookingData = {
            service: null,
            barber: null,
            date: null,
            time: null
        };
        
        // Voltar para home após 2 segundos
        setTimeout(() => {
            showPage('home');
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        showNotification('Erro ao realizar agendamento', 'error');
    } finally {
        hideLoading();
    }
}

// =============================================
// MEUS AGENDAMENTOS
// =============================================
async function loadUserAppointments() {
    if (!state.currentUser) return;
    
    showLoading();
    
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
        
        // Enriquecer com dados dos serviços e barbeiros
        const upcoming = await enrichAppointments(upcomingSnapshot);
        const history = await enrichAppointments(historySnapshot);
        
        // Renderizar
        renderAppointments('upcoming-list', upcoming, true);
        renderAppointments('history-list', history, false);
        
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showNotification('Erro ao carregar agendamentos', 'error');
    } finally {
        hideLoading();
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

function renderAppointments(containerId, appointments, showActions = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (appointments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>Nenhum agendamento encontrado</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = appointments.map(app => `
        <div class="appointment-item">
            <div class="appointment-header">
                <h3 class="appointment-title">${app.service?.nome || 'Serviço'}</h3>
                <span class="appointment-status status-${app.status}">
                    ${formatStatus(app.status)}
                </span>
            </div>
            <div class="appointment-details">
                <div class="appointment-detail">
                    <i class="fas fa-user-tie"></i>
                    <span>${app.barber?.nome || 'Especialista'}</span>
                </div>
                <div class="appointment-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${app.data?.toDate ? app.data.toDate().toLocaleDateString('pt-BR') : ''}</span>
                </div>
                <div class="appointment-detail">
                    <i class="fas fa-clock"></i>
                    <span>${app.horario || ''}</span>
                </div>
                <div class="appointment-detail">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>R$ ${app.preco?.toFixed(2) || '0.00'}</span>
                </div>
            </div>
            ${showActions && (app.status === 'pendente' || app.status === 'confirmado') ? `
                <div class="appointment-actions">
                    <button class="btn-danger" onclick="cancelAppointment('${app.id}')">
                        <i class="fas fa-times"></i>
                        <span>Cancelar</span>
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function cancelAppointment(appointmentId) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    
    showLoading();
    
    try {
        await db.collection('agendamentos').doc(appointmentId).update({
            status: 'cancelado',
            dataCancelamento: new Date()
        });
        
        showNotification('Agendamento cancelado com sucesso!', 'success');
        loadUserAppointments();
    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        showNotification('Erro ao cancelar agendamento', 'error');
    } finally {
        hideLoading();
    }
}

// =============================================
// PAINEL ADMIN
// =============================================
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
    
    // Configurar eventos
    setupAdminEvents();
}

async function loadAdminData() {
    showLoading();
    
    try {
        await Promise.all([
            loadAdminStats(),
            loadAdminAppointments(),
            loadAdminBarbers(),
            loadAdminServices()
        ]);
    } catch (error) {
        console.error('Erro ao carregar dados admin:', error);
        showNotification('Erro ao carregar dados administrativos', 'error');
    } finally {
        hideLoading();
    }
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
        document.getElementById('barbers-stats').textContent = state.barbers.length;
        
        // Receita do mês (simplificada)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const revenueSnapshot = await db.collection('agendamentos')
            .where('data', '>=', startOfMonth)
            .where('status', 'in', ['confirmado', 'realizado'])
            .get();
        
        let totalRevenue = 0;
        revenueSnapshot.forEach(doc => {
            totalRevenue += doc.data().preco || 0;
        });
        
        document.getElementById('revenue-stats').textContent = `R$ ${totalRevenue.toFixed(2)}`;
        
        // Atualizar contadores na home
        document.getElementById('appointments-today').textContent = todaySnapshot.size;
        
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
    
    if (appointments.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">Nenhum agendamento encontrado</td>
            </tr>
        `;
        return;
    }
    
    container.innerHTML = appointments.map(app => `
        <tr>
            <td>${app.user?.nome || 'Cliente'}</td>
            <td>${app.service?.nome || 'Serviço'}</td>
            <td>${app.barber?.nome || 'Especialista'}</td>
            <td>
                ${app.data?.toDate ? app.data.toDate().toLocaleDateString('pt-BR') : ''}
                ${app.horario ? ` às ${app.horario}` : ''}
            </td>
            <td>R$ ${app.preco?.toFixed(2) || '0.00'}</td>
            <td>
                <span class="appointment-status status-${app.status}">
                    ${formatStatus(app.status)}
                </span>
            </td>
            <td>
                <button class="btn-icon" onclick="editAdminAppointment('${app.id}')">
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
            <div class="admin-card">
                <div class="admin-card-header">
                    <div class="admin-card-icon">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div class="admin-card-actions">
                        <button class="btn-icon" onclick="editAdminBarber('${barber.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteAdminBarber('${barber.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="admin-card-body">
                    <h3 class="admin-card-title">${barber.nome}</h3>
                    <p class="admin-card-text">
                        ${barber.servicos?.length || 0} serviços
                    </p>
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
            <div class="admin-card">
                <div class="admin-card-header">
                    <div class="admin-card-icon">
                        <i class="fas fa-cut"></i>
                    </div>
                    <div class="admin-card-actions">
                        <button class="btn-icon" onclick="editAdminService('${service.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="deleteAdminService('${service.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="admin-card-body">
                    <h3 class="admin-card-title">${service.nome}</h3>
                    <p class="admin-card-text">${service.descricao || ''}</p>
                    <div class="admin-card-details">
                        <span class="admin-card-price">R$ ${service.preco.toFixed(2)}</span>
                        <span class="admin-card-duration">${service.duracao}min</span>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar serviços admin:', error);
    }
}

function setupAdminEvents() {
    // Adicionar barbeiro
    document.getElementById('add-barber-btn')?.addEventListener('click', () => {
        showBarberModal();
    });
    
    // Adicionar serviço
    document.getElementById('add-service-btn')?.addEventListener('click', () => {
        showServiceModal();
    });
    
    // Filtros
    document.getElementById('filter-date')?.addEventListener('change', filterAdminAppointments);
    document.getElementById('filter-barber')?.addEventListener('change', filterAdminAppointments);
    document.getElementById('filter-status')?.addEventListener('change', filterAdminAppointments);
}

// =============================================
// MODAIS E UTILITÁRIOS
// =============================================
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    showAuthTab('login');
}

function hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
}

function showAuthTab(tabName) {
    // Esconder todos os forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
        form.classList.add('hidden');
    });
    
    // Mostrar form selecionado
    document.getElementById(`${tabName}-form`).classList.remove('hidden');
    document.getElementById(`${tabName}-form`).classList.add('active');
    
    // Atualizar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
}

function showTab(tabId, button) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Mostrar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
}

function showAdminTab(tabId, button) {
    // Atualizar botões
    document.querySelectorAll('.admin-tab').forEach(btn => {
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
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    if (!notification || !messageEl) return;
    
    // Atualizar conteúdo
    messageEl.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    // Icone baseado no tipo
    const icon = notification.querySelector('.notification-icon i');
    if (icon) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        
        // Remover todas as classes de ícone
        icon.className = 'fas';
        icon.classList.add(icons[type] || icons.info);
    }
    
    // Fechar automaticamente após 5 segundos
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('hidden');
    }
}

function loadHomeData() {
    // Atualizar contadores
    document.getElementById('barber-count').textContent = state.barbers.length;
    
    // Tentar buscar agendamentos de hoje
    if (state.currentUser && state.isAdmin) {
        loadAdminStats();
    }
}

function formatStatus(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'realizado': 'Realizado',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', initApp);

// =============================================
// FUNÇÕES GLOBAIS (para uso em onclick)
// =============================================
window.selectService = selectService;
window.selectBarber = selectBarber;
window.selectCalendarDate = selectCalendarDate;
window.selectTimeSlot = selectTimeSlot;
window.cancelAppointment = cancelAppointment;
window.showLoginModal = showLoginModal;

// Funções admin (serão implementadas conforme necessário)
window.editAdminAppointment = (id) => {
    showNotification('Funcionalidade em desenvolvimento', 'info');
};

window.editAdminBarber = (id) => {
    showNotification('Funcionalidade em desenvolvimento', 'info');
};

window.deleteAdminBarber = (id) => {
    if (confirm('Tem certeza que deseja desativar este especialista?')) {
        showNotification('Especialista desativado', 'success');
    }
};

window.editAdminService = (id) => {
    showNotification('Funcionalidade em desenvolvimento', 'info');
};

window.deleteAdminService = (id) => {
    if (confirm('Tem certeza que deseja desativar este serviço?')) {
        showNotification('Serviço desativado', 'success');
    }
};

function showBarberModal() {
    // Implementar modal de barbeiro
    showNotification('Funcionalidade em desenvolvimento', 'info');
}

function showServiceModal() {
    // Implementar modal de serviço
    showNotification('Funcionalidade em desenvolvimento', 'info');
}

function filterAdminAppointments() {
    // Implementar filtros
    showNotification('Filtros aplicados', 'success');
}

// =============================================
// CONFIGURAÇÃO PWA BÁSICA
// =============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registrado:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker falhou:', error);
            });
    });
}

// Manifest para PWA
if ('serviceWorker' in navigator) {
    const manifest = {
        "name": "Precision Barbers",
        "short_name": "Precision",
        "description": "Sistema de agendamentos para barbearia",
        "start_url": ".",
        "display": "standalone",
        "background_color": "#000000",
        "theme_color": "#FF6B00",
        "icons": []
    };
}
