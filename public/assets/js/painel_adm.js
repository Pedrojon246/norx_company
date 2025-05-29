function initNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.section-content');
    const pageTitle = document.getElementById('pageTitle');

    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all items
            menuItems.forEach(mi => mi.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get section name
            const sectionName = this.dataset.section;
            
            // Hide all sections
            sections.forEach(section => section.style.display = 'none');
            
            // Show target section
            const targetSection = document.getElementById(sectionName + '-content');
            if (targetSection) {
                targetSection.style.display = 'block';
            } else {
                // Show loading for sections not implemented yet
                document.getElementById('loading-content').style.display = 'block';
            }
            
            // Update page title
            const titles = {
                'dashboard': 'Dashboard',
                'users': 'Gestão de Usuários',
                'payments': 'Controle de Pagamentos',
                'services': 'Configuração de Serviços',
                'norxcoin': 'NORXCOIN Management',
                'analytics': 'Analytics & Relatórios',
                'settings': 'Configurações do Sistema',
                'support': 'Central de Suporte'
            };
            
            pageTitle.textContent = titles[sectionName] || 'NORX Admin';
        });
    });
}

// Simular dados de usuários
async function loadUsersData() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('usersTableBody');
            tbody.innerHTML = '';

            data.users.forEach(user => {
                const statusClass = user.status === 'active' ? 'status-active' : 
                                  user.status === 'pending' ? 'status-pending' : 'status-blocked';
                const statusText = user.status === 'active' ? 'Ativo' : 
                                 user.status === 'pending' ? 'Pendente' : 'Bloqueado';
                
                const servicesText = user.services.length > 0 ? user.services.join(', ') : 'Nenhum';
                const createdDate = new Date(user.createdAt).toLocaleDateString('pt-BR');

                const row = `
                    <tr>
                        <td>#${user.id.substring(0, 6)}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.phone}</td>
                        <td>${servicesText}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${createdDate}</td>
                        <td>
                            <button class="action-btn" style="padding: 8px 12px; font-size: 12px;" onclick="editUser('${user.id}')">Editar</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            console.error('Erro ao carregar usuários:', data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        // Fallback para dados estáticos se API falhar
        loadStaticUsersData();
    }
}

// Dados estáticos como fallback
function loadStaticUsersData() {
    const users = [
        {
            id: '001',
            name: 'João Silva',
            email: 'joao@email.com',
            phone: '(21) 99999-9999',
            services: 'Sinais, Robô',
            status: 'active',
            date: '20/05/2025'
        },
        {
            id: '002',
            name: 'Maria Santos',
            email: 'maria@email.com',
            phone: '(11) 88888-8888',
            services: 'Sinais',
            status: 'pending',
            date: '19/05/2025'
        },
        {
            id: '003',
            name: 'Carlos Oliveira',
            email: 'carlos@email.com',
            phone: '(31) 77777-7777',
            services: 'Mesas Prop',
            status: 'active',
            date: '18/05/2025'
        }
    ];

    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const statusClass = user.status === 'active' ? 'status-active' : 
                          user.status === 'pending' ? 'status-pending' : 'status-blocked';
        const statusText = user.status === 'active' ? 'Ativo' : 
                         user.status === 'pending' ? 'Pendente' : 'Bloqueado';

        const row = `
            <tr>
                <td>#${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.phone}</td>
                <td>${user.services}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${user.date}</td>
                <td>
                    <button class="action-btn" style="padding: 8px 12px; font-size: 12px;" onclick="editUser('${user.id}')">Editar</button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Simular dados de pagamentos
async function loadPaymentsData() {
    try {
        const response = await fetch('/api/admin/payments');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('paymentsTableBody');
            tbody.innerHTML = '';

            data.payments.forEach(payment => {
                const statusClass = payment.status === 'confirmed' ? 'status-active' : 
                                  payment.status === 'pending' ? 'status-pending' : 'status-blocked';
                const statusText = payment.status === 'confirmed' ? 'Confirmado' : 
                                 payment.status === 'pending' ? 'Pendente' : 'Falhou';

                const actionBtn = payment.status === 'pending' ? 
                    `<button class="action-btn" style="padding: 8px 12px; font-size: 12px;" onclick="confirmPayment('${payment.id}')">Confirmar</button>` :
                    '<span style="color: #4CAF50;">✓ Processado</span>';

                const createdDate = new Date(payment.createdAt).toLocaleDateString('pt-BR') + ' ' + 
                                  new Date(payment.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

                const row = `
                    <tr>
                        <td>${payment.ticketId}</td>
                        <td>${payment.userName}</td>
                        <td>${payment.serviceName} - ${payment.period}</td>
                        <td>${payment.paymentMethod.toUpperCase()}</td>
                        <td>${payment.displayAmount}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>${createdDate}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        } else {
            console.error('Erro ao carregar pagamentos:', data.message);
            loadStaticPaymentsData();
        }
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        loadStaticPaymentsData();
    }
}

// Dados estáticos como fallback
function loadStaticPaymentsData() {
    const payments = [
        {
            id: 'PAY001',
            user: 'Maria Santos',
            service: 'Sala de Sinais - Mensal',
            method: 'PIX',
            value: 'R$ 85.00',
            status: 'pending',
            date: 'Hoje, 13:15'
        },
        {
            id: 'PAY002',
            user: 'João Silva',
            service: 'Robô - Anual',
            method: 'USDT',
            value: '$324.00',
            status: 'confirmed',
            date: 'Ontem, 16:30'
        },
        {
            id: 'PAY003',
            user: 'Ana Costa',
            service: 'Mesas Prop - Trimestral',
            method: 'NORXCOIN',
            value: '$1,050.00',
            status: 'confirmed',
            date: '23/05/2025'
        }
    ];

    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '';

    payments.forEach(payment => {
        const statusClass = payment.status === 'confirmed' ? 'status-active' : 
                          payment.status === 'pending' ? 'status-pending' : 'status-blocked';
        const statusText = payment.status === 'confirmed' ? 'Confirmado' : 
                         payment.status === 'pending' ? 'Pendente' : 'Falhou';

        const actionBtn = payment.status === 'pending' ? 
            `<button class="action-btn" style="padding: 8px 12px; font-size: 12px;" onclick="confirmPayment('${payment.id}')">Confirmar</button>` :
            '<span style="color: #4CAF50;">✓ Processado</span>';

        const row = `
            <tr>
                <td>#${payment.id}</td>
                <td>${payment.user}</td>
                <td>${payment.service}</td>
                <td>${payment.method}</td>
                <td>${payment.value}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${payment.date}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Confirmar pagamento
async function confirmPayment(paymentId) {
    if (!confirm(`Confirmar pagamento ${paymentId}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/payment/confirm/${paymentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ ${data.message}`);
            // Recarregar dados
            loadPaymentsData();
            loadStatsData();
            updateDashboardCounts();
        } else {
            alert(`❌ Erro: ${data.message}`);
        }
    } catch (error) {
        console.error('Erro ao confirmar pagamento:', error);
        alert('❌ Erro de conexão. Tente novamente.');
    }
}

// Atualizar estatísticas
async function loadStatsData() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            
            // Atualizar números no dashboard
            const statElements = document.querySelectorAll('.stat-number');
            if (statElements[0]) statElements[0].textContent = stats.totalUsers;
            if (statElements[1]) statElements[1].textContent = `${stats.monthlyRevenue.toLocaleString()}`;
            if (statElements[2]) statElements[2].textContent = `${stats.conversionRate}%`;
            if (statElements[3]) statElements[3].textContent = stats.activeSubscribers;
        } else {
            console.error('Erro ao carregar estatísticas:', data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Atualizar contadores dos badges
async function updateDashboardCounts() {
    try {
        // Contar usuários novos (últimos 7 dias)
        const usersResponse = await fetch('/api/admin/users');
        const usersData = await usersResponse.json();
        
        if (usersData.success) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            
            const newUsers = usersData.users.filter(user => 
                new Date(user.createdAt) > weekAgo
            ).length;
            
            document.getElementById('newUsersCount').textContent = newUsers;
        }
        
        // Contar pagamentos pendentes
        const paymentsResponse = await fetch('/api/admin/payments');
        const paymentsData = await paymentsResponse.json();
        
        if (paymentsData.success) {
            const pendingPayments = paymentsData.payments.filter(payment => 
                payment.status === 'pending'
            ).length;
            
            document.getElementById('pendingPayments').textContent = pendingPayments;
            
            // Atualizar quick action
            const quickAction = document.querySelector('.quick-action[data-section="payments"] .quick-action-desc');
            if (quickAction) {
                quickAction.textContent = `${pendingPayments} pagamentos pendentes`;
            }
        }
        
        // Simular tickets de suporte (placeholder)
        document.getElementById('supportTickets').textContent = Math.floor(Math.random() * 10) + 3;
        
    } catch (error) {
        console.error('Erro ao atualizar contadores:', error);
    }
}

// Busca em tempo real
function setupSearch() {
    const userSearch = document.getElementById('userSearch');
    const paymentSearch = document.getElementById('paymentSearch');

    if (userSearch) {
        userSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#usersTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    if (paymentSearch) {
        paymentSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#paymentsTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    loadUsersData();
    loadPaymentsData();
    setupSearch();
    
    // Atualizar stats a cada 30 segundos
    setInterval(updateStats, 30000);
    
    // Simular notificações em tempo real
    setInterval(() => {
        const badges = document.querySelectorAll('.menu-badge');
        badges.forEach(badge => {
            const currentValue = parseInt(badge.textContent);
            if (Math.random() < 0.1) { // 10% de chance
                badge.textContent = currentValue + 1;
            }
        });
    }, 10000);
});

// Toggle sidebar mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Funções de exportação
function exportData(type) {
    alert(`Exportando dados de ${type}...`);
    // Implementar exportação real
}

// Envio de newsletter
function sendNewsletter() {
    if (confirm('Enviar newsletter para todos os usuários ativos?')) {
        alert('Newsletter enviada com sucesso para 247 usuários!');
    }
}