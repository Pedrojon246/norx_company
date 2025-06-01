// 👥 ROTAS DE GESTÃO DE USUÁRIOS
// ==============================

const express = require('express');
const bcrypt = require('bcryptjs');
const { firestoreUtils } = require('../config/firebase');
const { validateUserUpdate, validatePasswordChange, sanitizeMiddleware } = require('../middleware/validation');
const { logger, logUserAction } = require('../middleware/logging');

const router = express.Router();

// ==============================
// OBTER PERFIL DO USUÁRIO
// ==============================

router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar dados completos do usuário
        const user = await firestoreUtils.get('users', userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Perfil não existe',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Dados públicos (sem senha)
        const publicProfile = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            balance: user.balance || 0,
            totalDeposits: user.totalDeposits || 0,
            totalEarnings: user.totalEarnings || 0,
            referralCode: user.referralCode,
            phone: user.phone || null,
            address: user.address || null,
            emailVerified: user.emailVerified || false,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            loginCount: user.loginCount || 0,
            preferences: user.preferences || {
                emailNotifications: true,
                pushNotifications: true,
                theme: 'dark'
            }
        };
        
        res.json({
            success: true,
            data: {
                user: publicProfile
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter perfil', { error, userId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar seu perfil',
            code: 'PROFILE_FETCH_ERROR'
        });
    }
});

// ==============================
// ATUALIZAR PERFIL
// ==============================

router.put('/profile',
    sanitizeMiddleware,
    validateUserUpdate,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { name, phone, address, preferences } = req.body;
            const userIP = req.ip || req.connection.remoteAddress;
            
            // Dados para atualização
            const updateData = {
                updatedAt: new Date().toISOString()
            };
            
            // Campos opcionais
            if (name) updateData.name = name.trim();
            if (phone) updateData.phone = phone.trim();
            if (address) updateData.address = address.trim();
            if (preferences) updateData.preferences = { ...preferences };
            
            // Atualizar no banco
            await firestoreUtils.update('users', userId, updateData);
            
            // Log da ação
            await logUserAction(userId, 'PROFILE_UPDATED', {
                fields: Object.keys(updateData),
                ip: userIP
            });
            
            logger.info('Perfil atualizado', { userId, fields: Object.keys(updateData) });
            
            res.json({
                success: true,
                message: 'Perfil atualizado com sucesso! ✅',
                data: {
                    updatedFields: Object.keys(updateData)
                }
            });
            
        } catch (error) {
            logger.error('Erro ao atualizar perfil', { error, userId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível atualizar seu perfil',
                code: 'PROFILE_UPDATE_ERROR'
            });
        }
    }
);

// ==============================
// ALTERAR SENHA
// ==============================

router.put('/password',
    sanitizeMiddleware,
    validatePasswordChange,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const userIP = req.ip || req.connection.remoteAddress;
            
            // Buscar usuário atual
            const user = await firestoreUtils.get('users', userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuário não encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            // Verificar senha atual
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            
            if (!isCurrentPasswordValid) {
                logger.warn('Tentativa de mudança de senha com senha incorreta', { userId, ip: userIP });
                return res.status(400).json({
                    error: 'Senha atual incorreta',
                    message: 'A senha atual não confere',
                    code: 'INVALID_CURRENT_PASSWORD'
                });
            }
            
            // Hash da nova senha
            const saltRounds = 12;
            const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
            
            // Atualizar senha
            await firestoreUtils.update('users', userId, {
                password: hashedNewPassword,
                updatedAt: new Date().toISOString(),
                passwordChangedAt: new Date().toISOString()
            });
            
            // Log da ação
            await logUserAction(userId, 'PASSWORD_CHANGED', {
                ip: userIP,
                userAgent: req.get('User-Agent')
            });
            
            logger.info('Senha alterada com sucesso', { userId, ip: userIP });
            
            res.json({
                success: true,
                message: 'Senha alterada com sucesso! 🔐'
            });
            
        } catch (error) {
            logger.error('Erro ao alterar senha', { error, userId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível alterar sua senha',
                code: 'PASSWORD_CHANGE_ERROR'
            });
        }
    }
);

// ==============================
// ESTATÍSTICAS DO USUÁRIO
// ==============================

router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar dados do usuário
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
        
        // Calcular estatísticas
        const stats = {
            balance: user.balance || 0,
            totalDeposits: user.totalDeposits || 0,
            totalEarnings: user.totalEarnings || 0,
            
            // Estatísticas de pagamentos
            paymentsCount: payments.length,
            pendingPayments: payments.filter(p => p.status === 'pending').length,
            confirmedPayments: payments.filter(p => p.status === 'confirmed').length,
            
            // Últimos pagamentos
            recentPayments: payments
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map(p => ({
                    id: p.id,
                    amount: p.amount,
                    status: p.status,
                    method: p.methodName,
                    createdAt: p.createdAt
                })),
            
            // Informações da conta
            accountInfo: {
                memberSince: user.createdAt,
                lastLogin: user.lastLogin,
                loginCount: user.loginCount || 0,
                referralCode: user.referralCode,
                emailVerified: user.emailVerified || false
            }
        };
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        logger.error('Erro ao obter estatísticas', { error, userId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar suas estatísticas',
            code: 'STATS_FETCH_ERROR'
        });
    }
});

// ==============================
// HISTÓRICO DE ATIVIDADES
// ==============================

router.get('/activity', async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // Buscar atividades do usuário
        const activities = await firestoreUtils.getMany(
            'user_actions',
            [{ field: 'userId', operator: '==', value: userId }],
            { field: 'timestamp', direction: 'desc' },
            limit
        );
        
        // Formatar atividades
        const formattedActivities = activities.map(activity => ({
            id: activity.id,
            action: activity.action,
            details: activity.details,
            timestamp: activity.timestamp,
            ip: activity.details?.ip || null
        }));
        
        res.json({
            success: true,
            data: {
                activities: formattedActivities,
                pagination: {
                    page,
                    limit,
                    total: activities.length,
                    hasMore: activities.length === limit
                }
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter atividades', { error, userId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar suas atividades',
            code: 'ACTIVITY_FETCH_ERROR'
        });
    }
});

// ==============================
// DELETAR CONTA
// ==============================

router.delete('/account',
    sanitizeMiddleware,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const { password, confirmation } = req.body;
            const userIP = req.ip || req.connection.remoteAddress;
            
            if (confirmation !== 'DELETE_MY_ACCOUNT') {
                return res.status(400).json({
                    error: 'Confirmação inválida',
                    message: 'Digite exatamente "DELETE_MY_ACCOUNT" para confirmar',
                    code: 'INVALID_CONFIRMATION'
                });
            }
            
            // Buscar usuário
            const user = await firestoreUtils.get('users', userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuário não encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }
            
            // Verificar senha
            const isPasswordValid = await bcrypt.compare(password, user.password);
            
            if (!isPasswordValid) {
                logger.warn('Tentativa de deletar conta com senha incorreta', { userId, ip: userIP });
                return res.status(400).json({
                    error: 'Senha incorreta',
                    message: 'Senha não confere',
                    code: 'INVALID_PASSWORD'
                });
            }
            
            // Verificar se não há saldo
            if (user.balance > 0) {
                return res.status(400).json({
                    error: 'Conta com saldo',
                    message: 'Você não pode deletar uma conta com saldo. Saque primeiro.',
                    code: 'ACCOUNT_HAS_BALANCE'
                });
            }
            
            // Marcar conta como deletada (soft delete)
            await firestoreUtils.update('users', userId, {
                status: 'deleted',
                deletedAt: new Date().toISOString(),
                deletionIP: userIP,
                email: `deleted_${Date.now()}@norx.deleted`, // Liberar email
                updatedAt: new Date().toISOString()
            });
            
            // Log da ação
            await logUserAction(userId, 'ACCOUNT_DELETED', {
                ip: userIP,
                userAgent: req.get('User-Agent'),
                reason: 'User request'
            });
            
            logger.info('Conta deletada pelo usuário', { userId, email: user.email, ip: userIP });
            
            res.json({
                success: true,
                message: 'Conta deletada com sucesso. Sentiremos sua falta! 😢'
            });
            
        } catch (error) {
            logger.error('Erro ao deletar conta', { error, userId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível deletar sua conta',
                code: 'ACCOUNT_DELETE_ERROR'
            });
        }
    }
);

module.exports = router;