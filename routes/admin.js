// 🔑 ROTAS ADMINISTRATIVAS
// ========================

const express = require('express');
const { firestoreUtils } = require('../config/firebase');
const { adminMiddleware } = require('../middleware/auth');  
const { validateAdminUserUpdate, validateAdminPaymentUpdate, validatePagination, sanitizeMiddleware } = require('../middleware/validation');
const { logger, logUserAction } = require('../middleware/logging');
const emailService = require('../config/email');

const router = express.Router();

// Aplicar middleware de admin em todas as rotas
router.use(adminMiddleware);

// ============================
// DASHBOARD ADMINISTRATIVO
// ============================

router.get('/dashboard', async (req, res) => {
    try {
        // Estatísticas gerais
        const [users, payments, recentActivity] = await Promise.all([
            // Total de usuários
            firestoreUtils.getMany('users', []),
            
            // Total de pagamentos
            firestoreUtils.getMany('payments', []),
            
            // Atividades recentes
            firestoreUtils.getMany(
                'user_actions',
                [],
                { field: 'timestamp', direction: 'desc' },
                10
            )
        ]);
        
        // Calcular métricas
        const stats = {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.status === 'active').length,
            blockedUsers: users.filter(u => u.status === 'blocked').length,
            
            totalPayments: payments.length,
            pendingPayments: payments.filter(p => p.status === 'pending').length,
            confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
            
            totalRevenue: payments
                .filter(p => p.status === 'confirmed')
                .reduce((sum, p) => sum + (p.amount || 0), 0),
                
            todayRegistrations: users.filter(u => {
                const today = new Date().toDateString();
                const userDate = new Date(u.createdAt).toDateString();
                return today === userDate;
            }).length,
            
            recentActivity: recentActivity.map(activity => ({
                id: activity.id,
                userId: activity.userId,
                action: activity.action,
                timestamp: activity.timestamp,
                details: activity.details
            }))
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        logger.error('Erro no dashboard admin', { error, adminId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar dashboard',
            code: 'ADMIN_DASHBOARD_ERROR'
        });
    }
});

// ============================
// GESTÃO DE USUÁRIOS
// ============================

// Listar usuários
router.get('/users',
    validatePagination,
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status;
            const search = req.query.q;
            
            // Filtros
            let filters = [];
            if (status) {
                filters.push({ field: 'status', operator: '==', value: status });
            }
            
            // Buscar usuários
            let users = await firestoreUtils.getMany(
                'users',
                filters,
                { field: 'createdAt', direction: 'desc' },
                limit * 2 // Buscar mais para filtrar por search
            );
            
            // Filtro de busca por texto
            if (search) {
                const searchLower = search.toLowerCase();
                users = users.filter(user => 
                    user.name?.toLowerCase().includes(searchLower) ||
                    user.email?.toLowerCase().includes(searchLower) ||
                    user.id?.toLowerCase().includes(searchLower)
                );
            }
            
            // Paginação manual
            const startIndex = (page - 1) * limit;
            const paginatedUsers = users.slice(startIndex, startIndex + limit);
            
            // Formato de resposta (sem senhas)
            const formattedUsers = paginatedUsers.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                balance: user.balance || 0,
                totalDeposits: user.totalDeposits || 0,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                loginCount: user.loginCount || 0
            }));
            
            res.json({
                success: true,
                data: {
                    users: formattedUsers,
                    pagination: {
                        page,
                        limit,
                        total: users.length,
                        hasMore: users.length > startIndex + limit
                    }
                }
            });
            
        } catch (error) {
            logger.error('Erro ao listar usuários', { error, adminId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível carregar usuários',
                code: 'ADMIN_USERS_LIST_ERROR'
            });
        }
    }
);

// Obter usuário específico
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await firestoreUtils.get('users', userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Buscar pagamentos do usuário
        const payments = await firestoreUtils.getMany('payments', [
            { field: 'userId', operator: '==', value: userId }
        ]);
        
        // Buscar atividades recentes
        const activities = await firestoreUtils.getMany(
            'user_actions',
            [{ field: 'userId', operator: '==', value: userId }],
            { field: 'timestamp', direction: 'desc' },
            10
        );
        
        // Dados completos (sem senha)
        const completeUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            balance: user.balance || 0,
            totalDeposits: user.totalDeposits || 0,
            totalEarnings: user.totalEarnings || 0,
            referralCode: user.referralCode,
            phone: user.phone,
            address: user.address,
            emailVerified: user.emailVerified || false,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            loginCount: user.loginCount || 0,
            registrationIP: user.registrationIP,
            lastLoginIP: user.lastLoginIP,
            
            // Estatísticas
            paymentsCount: payments.length,
            pendingPayments: payments.filter(p => p.status === 'pending').length,
            confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
            
            // Históricos
            recentPayments: payments.slice(0, 5),
            recentActivities: activities
        };
        
        res.json({
            success: true,
            data: {
                user: completeUser
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter usuário', { error, userId: req.params.userId, adminId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar usuário',
            code: 'ADMIN_USER_FETCH_ERROR'
        });
    }
});

// Atualizar usuário
router.put('/users/:userId',
    sanitizeMiddleware,
    validateAdminUserUpdate,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { status, role, balance, adminNotes } = req.body;
            const adminId = req.user.id;
            const adminIP = req.ip || req.connection.remoteAddress;
            
            // Verificar se usuário existe
            const user = await firestoreUtils.get('users', userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuário não encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            // Dados para atualização
            const updateData = {
                updatedAt: new Date().toISOString(),
                lastModifiedBy: adminId
            };
            
            if (status) updateData.status = status;
            if (role) updateData.role = role;
            if (balance !== undefined) updateData.balance = balance;
            if (adminNotes) updateData.adminNotes = adminNotes;
            
            // Atualizar usuário
            await firestoreUtils.update('users', userId, updateData);
            
            // Log da ação
            await logUserAction(adminId, 'ADMIN_USER_UPDATED', {
                targetUserId: userId,
                targetUserEmail: user.email,
                changes: updateData,
                ip: adminIP
            });
            
            logger.info('Usuário atualizado por admin', { 
                userId, 
                adminId, 
                changes: Object.keys(updateData) 
            });
            
            res.json({
                success: true,
                message: 'Usuário atualizado com sucesso! ✅',
                data: {
                    updatedFields: Object.keys(updateData)
                }
            });
            
        } catch (error) {
            logger.error('Erro ao atualizar usuário', { error, userId: req.params.userId, adminId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível atualizar usuário',
                code: 'ADMIN_USER_UPDATE_ERROR'
            });
        }
    }
);

// ============================
// GESTÃO DE PAGAMENTOS
// ============================

// Listar pagamentos
router.get('/payments',
    validatePagination,
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status;
            const method = req.query.method;
            
            // Filtros
            let filters = [];
            if (status) {
                filters.push({ field: 'status', operator: '==', value: status });
            }
            if (method) {
                filters.push({ field: 'method', operator: '==', value: method });
            }
            
            // Buscar pagamentos
            const payments = await firestoreUtils.getMany(
                'payments',
                filters,
                { field: 'createdAt', direction: 'desc' },
                limit
            );
            
            res.json({
                success: true,
                data: {
                    payments,
                    pagination: {
                        page,
                        limit,
                        total: payments.length,
                        hasMore: payments.length === limit
                    }
                }
            });
            
        } catch (error) {
            logger.error('Erro ao listar pagamentos', { error, adminId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível carregar pagamentos',
                code: 'ADMIN_PAYMENTS_LIST_ERROR'
            });
        }
    }
);

// Atualizar status do pagamento
router.put('/payments/:paymentId',
    sanitizeMiddleware,
    validateAdminPaymentUpdate,
    async (req, res) => {
        try {
            const { paymentId } = req.params;
            const { status, adminNotes } = req.body;
            const adminId = req.user.id;
            const adminIP = req.ip || req.connection.remoteAddress;
            
            // Buscar pagamento
            const payment = await firestoreUtils.get('payments', paymentId);
            
            if (!payment) {
                return res.status(404).json({
                    error: 'Pagamento não encontrado',
                    code: 'PAYMENT_NOT_FOUND'
                });
            }
            
            // Dados de atualização
            const updateData = {
                status,
                adminNotes: adminNotes || null,
                processedBy: adminId,
                processedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                statusHistory: [
                    ...payment.statusHistory,
                    {
                        status,
                        timestamp: new Date().toISOString(),
                        note: `Atualizado por admin: ${adminNotes || 'Sem observações'}`,
                        adminId
                    }
                ]
            };
            
            // Se aprovado, atualizar saldo do usuário
            if (status === 'confirmed' && payment.status !== 'confirmed') {
                const user = await firestoreUtils.get('users', payment.userId);
                
                if (user) {
                    const newBalance = (user.balance || 0) + payment.amount;
                    const newTotalDeposits = (user.totalDeposits || 0) + payment.amount;
                    
                    await firestoreUtils.update('users', payment.userId, {
                        balance: newBalance,
                        totalDeposits: newTotalDeposits,
                        updatedAt: new Date().toISOString()
                    });
                    
                    // Enviar email de confirmação
                    emailService.sendPaymentConfirmationEmail(
                        user.email,
                        user.name,
                        payment,
                        newBalance
                    ).catch(error => {
                        logger.error('Erro ao enviar email de confirmação', { error, paymentId });
                    });
                }
            }
            
            // Atualizar pagamento
            await firestoreUtils.update('payments', paymentId, updateData);
            
            // Log da ação
            await logUserAction(adminId, 'ADMIN_PAYMENT_UPDATED', {
                paymentId,
                userId: payment.userId,
                oldStatus: payment.status,
                newStatus: status,
                amount: payment.amount,
                ip: adminIP
            });
            
            logger.info('Pagamento atualizado por admin', { 
                paymentId, 
                adminId, 
                oldStatus: payment.status,
                newStatus: status,
                amount: payment.amount
            });
            
            res.json({
                success: true,
                message: `Pagamento ${status === 'confirmed' ? 'aprovado' : 'atualizado'} com sucesso! ✅`
            });
            
        } catch (error) {
            logger.error('Erro ao atualizar pagamento', { error, paymentId: req.params.paymentId, adminId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível atualizar pagamento',
                code: 'ADMIN_PAYMENT_UPDATE_ERROR'
            });
        }
    }
);

// ============================
// ESTATÍSTICAS AVANÇADAS
// ============================

router.get('/stats', async (req, res) => {
    try {
        const period = req.query.period || '7d'; // 1d, 7d, 30d, 90d
        
        let startDate;
        const now = new Date();
        
        switch (period) {
            case '1d':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        
        // Buscar dados do período
        const [users, payments] = await Promise.all([
            firestoreUtils.getMany('users', [
                { field: 'createdAt', operator: '>=', value: startDate.toISOString() }
            ]),
            firestoreUtils.getMany('payments', [
                { field: 'createdAt', operator: '>=', value: startDate.toISOString() }
            ])
        ]);
        
        // Calcular estatísticas
        const stats = {
            period,
            newUsers: users.length,
            totalPayments: payments.length,
            pendingPayments: payments.filter(p => p.status === 'pending').length,
            confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
            rejectedPayments: payments.filter(p => p.status === 'rejected').length,
            
            revenue: payments
                .filter(p => p.status === 'confirmed')
                .reduce((sum, p) => sum + (p.amount || 0), 0),
                
            averagePayment: payments.length > 0 
                ? payments.reduce((sum, p) => sum + (p.amount || 0), 0) / payments.length 
                : 0,
                
            paymentMethods: payments.reduce((acc, p) => {
                acc[p.method] = (acc[p.method] || 0) + 1;
                return acc;
            }, {}),
            
            dailyStats: generateDailyStats(payments, startDate, now)
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        logger.error('Erro ao obter estatísticas', { error, adminId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar estatísticas',
            code: 'ADMIN_STATS_ERROR'
        });
    }
});

// ============================
// UTILITÁRIOS
// ============================

function generateDailyStats(payments, startDate, endDate) {
    const dailyStats = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
        
        const dayPayments = payments.filter(p => {
            const paymentDate = new Date(p.createdAt);
            return paymentDate >= dayStart && paymentDate < dayEnd;
        });
        
        dailyStats.push({
            date: currentDate.toISOString().split('T')[0],
            payments: dayPayments.length,
            revenue: dayPayments
                .filter(p => p.status === 'confirmed')
                .reduce((sum, p) => sum + (p.amount || 0), 0)
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dailyStats;
}

module.exports = router;