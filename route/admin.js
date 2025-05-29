// routes/admin.js - Admin Routes
const express = require('express');
const { collections, dbOperations } = require('../config/firebase');
const { sendEmail } = require('../config/email');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// Get all users
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, search, status, service } = req.query;
        
        // Get all users (with basic filtering)
        const usersResult = await dbOperations.getAll(collections.USERS, 'createdAt', 'desc');
        
        if (!usersResult.success) {
            throw new Error(usersResult.error);
        }

        let users = usersResult.data;

        // Apply filters
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(user => 
                user.firstName?.toLowerCase().includes(searchLower) ||
                user.lastName?.toLowerCase().includes(searchLower) ||
                user.email?.toLowerCase().includes(searchLower) ||
                user.phone?.includes(search)
            );
        }

        if (status) {
            users = users.filter(user => user.status === status);
        }

        if (service) {
            users = users.filter(user => 
                user.services && user.services.includes(service)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        // Format user data for response
        const formattedUsers = paginatedUsers.map(user => ({
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            phone: user.phone,
            cpf: user.cpf,
            services: user.services || [],
            status: user.status || 'active',
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            interest: user.interest,
            marketing: user.marketing,
            emailVerified: user.emailVerified
        }));

        res.json({
            success: true,
            users: formattedUsers,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(users.length / limit),
                count: paginatedUsers.length,
                totalUsers: users.length
            }
        });

    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Get user by ID
router.get('/users/:userId', adminAuth, async (req, res) => {
    try {
        const userResult = await dbOperations.getById(collections.USERS, req.params.userId);
        
        if (!userResult.success) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        const user = userResult.data;

        // Get user's payments
        const paymentsQuery = await dbOperations.query(
            collections.PAYMENTS,
            'userId',
            '==',
            req.params.userId
        );

        const payments = paymentsQuery.success ? paymentsQuery.data : [];

        res.json({
            success: true,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                cpf: user.cpf,
                services: user.services || [],
                status: user.status,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                interest: user.interest,
                marketing: user.marketing,
                emailVerified: user.emailVerified,
                loginAttempts: user.loginAttempts || 0
            },
            payments: payments.map(payment => ({
                id: payment.id,
                ticketId: payment.ticketId,
                serviceName: payment.serviceName,
                period: payment.period,
                paymentMethod: payment.paymentMethod,
                displayAmount: payment.displayAmount,
                status: payment.status,
                createdAt: payment.createdAt,
                confirmedAt: payment.confirmedAt
            }))
        });

    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Update user
router.put('/users/:userId', adminAuth, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            status,
            services,
            notes
        } = req.body;

        const updateData = {};
        
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email.toLowerCase();
        if (phone !== undefined) updateData.phone = phone;
        if (status !== undefined) updateData.status = status;
        if (services !== undefined) updateData.services = services;
        if (notes !== undefined) updateData.adminNotes = notes;
        
        updateData.lastModifiedBy = req.admin.id;
        updateData.lastModifiedAt = new Date().toISOString();

        const result = await dbOperations.update(collections.USERS, req.params.userId, updateData);

        if (!result.success) {
            throw new Error(result.error);
        }

        res.json({
            success: true,
            message: 'Usuário atualizado com sucesso'
        });

    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Get all payments
router.get('/payments', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 50, status, method, search } = req.query;

        // Get all payments
        const paymentsResult = await dbOperations.getAll(collections.PAYMENTS, 'createdAt', 'desc');
        
        if (!paymentsResult.success) {
            throw new Error(paymentsResult.error);
        }

        let payments = paymentsResult.data;

        // Apply filters
        if (status) {
            payments = payments.filter(payment => payment.status === status);
        }

        if (method) {
            payments = payments.filter(payment => payment.paymentMethod === method);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            payments = payments.filter(payment =>
                payment.ticketId?.toLowerCase().includes(searchLower) ||
                payment.userName?.toLowerCase().includes(searchLower) ||
                payment.userEmail?.toLowerCase().includes(searchLower)
            );
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedPayments = payments.slice(startIndex, endIndex);

        res.json({
            success: true,
            payments: paginatedPayments,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(payments.length / limit),
                count: paginatedPayments.length,
                totalPayments: payments.length
            }
        });

    } catch (error) {
        console.error('Error getting payments:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Get statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        // Get users
        const usersResult = await dbOperations.getAll(collections.USERS);
        const users = usersResult.success ? usersResult.data : [];

        // Get payments
        const paymentsResult = await dbOperations.getAll(collections.PAYMENTS);
        const payments = paymentsResult.success ? paymentsResult.data : [];

        // Calculate statistics
        const totalUsers = users.length;
        
        // Active subscribers (users with services)
        const activeSubscribers = users.filter(user => 
            user.services && user.services.length > 0
        ).length;

        // Monthly revenue (confirmed payments this month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        const monthlyRevenue = payments
            .filter(payment => {
                if (payment.status !== 'confirmed' || !payment.confirmedAt) return false;
                const paymentDate = new Date(payment.confirmedAt);
                return paymentDate.getMonth() === currentMonth && 
                       paymentDate.getFullYear() === currentYear;
            })
            .reduce((sum, payment) => sum + (payment.finalAmount || 0), 0);

        // Conversion rate
        const conversionRate = totalUsers > 0 ? (activeSubscribers / totalUsers) * 100 : 0;

        // New users this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const newUsersThisWeek = users.filter(user => 
            new Date(user.createdAt) > weekAgo
        ).length;

        // Pending payments
        const pendingPayments = payments.filter(payment => 
            payment.status === 'pending'
        ).length;

        // Revenue by service
        const revenueByService = payments
            .filter(payment => payment.status === 'confirmed')
            .reduce((acc, payment) => {
                const service = payment.serviceType || 'unknown';
                acc[service] = (acc[service] || 0) + (payment.finalAmount || 0);
                return acc;
            }, {});

        // Payment methods distribution
        const paymentMethods = payments
            .filter(payment => payment.status === 'confirmed')
            .reduce((acc, payment) => {
                const method = payment.paymentMethod || 'unknown';
                acc[method] = (acc[method] || 0) + 1;
                return acc;
            }, {});

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeSubscribers,
                monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
                conversionRate: Math.round(conversionRate * 10) / 10,
                newUsersThisWeek,
                pendingPayments,
                revenueByService,
                paymentMethods,
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Send newsletter/broadcast email
router.post('/broadcast', adminAuth, async (req, res) => {
    try {
        const { subject, content, recipients = 'all', serviceFilter } = req.body;

        if (!subject || !content) {
            return res.status(400).json({
                success: false,
                message: 'Assunto e conteúdo são obrigatórios'
            });
        }

        // Get target users
        const usersResult = await dbOperations.getAll(collections.USERS);
        if (!usersResult.success) {
            throw new Error(usersResult.error);
        }

        let targetUsers = usersResult.data.filter(user => 
            user.status === 'active' && user.email
        );

        // Apply filters
        if (recipients === 'marketing') {
            targetUsers = targetUsers.filter(user => user.marketing === true);
        } else if (recipients === 'service' && serviceFilter) {
            targetUsers = targetUsers.filter(user => 
                user.services && user.services.includes(serviceFilter)
            );
        }

        // Send emails
        const emailPromises = targetUsers.map(user => 
            sendEmail(
                user.email,
                subject,
                content.replace('{{firstName}}', user.firstName || 'Cliente')
                      .replace('{{lastName}}', user.lastName || '')
                      .replace('{{email}}', user.email)
            )
        );

        const results = await Promise.allSettled(emailPromises);
        
        const successful = results.filter(result => 
            result.status === 'fulfilled' && result.value.success
        ).length;

        const failed = results.length - successful;

        res.json({
            success: true,
            message: `Email enviado para ${successful} usuários`,
            stats: {
                total: targetUsers.length,
                successful,
                failed
            }
        });

    } catch (error) {
        console.error('Error sending broadcast:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Export data
router.get('/export/:type', adminAuth, async (req, res) => {
    try {
        const { type } = req.params;
        const { format = 'json' } = req.query;

        let data = [];
        let filename = '';

        switch (type) {
            case 'users':
                const usersResult = await dbOperations.getAll(collections.USERS);
                data = usersResult.success ? usersResult.data : [];
                filename = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
                break;

            case 'payments':
                const paymentsResult = await dbOperations.getAll(collections.PAYMENTS);
                data = paymentsResult.success ? paymentsResult.data : [];
                filename = `payments_export_${new Date().toISOString().split('T')[0]}.${format}`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de exportação inválido'
                });
        }

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            // Convert to CSV (basic implementation)
            const csv = data.map(item => Object.values(item).join(',')).join('\n');
            res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.json({
                success: true,
                data: data,
                exportedAt: new Date().toISOString(),
                count: data.length
            });
        }

    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = adminRoutes;