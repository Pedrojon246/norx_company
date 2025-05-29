const express = require('express');
const crypto = require('crypto');
const { collections, dbOperations } = require('../config/firebase');
const { sendEmail, emailTemplates } = require('../config/email');
const { validatePayment } = require('../utils/validators');
const auth = require('../middleware/auth');

const router = express.Router();

// Service configurations
const SERVICES_CONFIG = {
    signals: {
        name: 'Sala de Sinais Forex',
        periods: {
            monthly: { usd: 16, brl: 85 },
            quarterly: { usd: 42, brl: 220 },
            yearly: { usd: 144, brl: 750 }
        },
        discount: 37.5
    },
    robot: {
        name: 'Licença do Robô Oficial',
        periods: {
            monthly: { usd: 36, brl: 190 },
            quarterly: { usd: 96, brl: 500 },
            yearly: { usd: 324, brl: 1690 },
            lifetime: { usd: 999, brl: 5200 }
        },
        discount: 16.7
    },
    prop: {
        name: 'Aluguel de Mesas Proprietárias',
        periods: {
            monthly: { usd: 390, brl: 2030 },
            quarterly: { usd: 1050, brl: 5470 },
            yearly: { usd: 3900, brl: 20300 }
        },
        discount: 15.4
    },
    investments: {
        name: 'Norx Group Investments',
        periods: {
            basic: { usd: 962, brl: 5000 },
            recommended: { usd: 4810, brl: 25000 },
            premium: { usd: 9620, brl: 50000 }
        },
        discount: 10
    }
};

const CONFIG = {
    norxTokenPrice: 0.0004,
    wallets: {
        usdt: process.env.USDT_WALLET || '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1',
        norx: process.env.NORX_WALLET || '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1',
        pix: process.env.PIX_KEY || 'support@norxcompany.com.br'
    }
};

// Generate unique ticket ID
function generateTicketId() {
    return 'NORX-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Create payment
router.post('/create', async (req, res) => {
    try {
        // Validate input
        const { errors, isValid } = validatePayment(req.body);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const {
            userId,
            serviceType,
            period,
            paymentMethod,
            userEmail,
            userName
        } = req.body;

        // Validate service and period
        const service = SERVICES_CONFIG[serviceType];
        if (!service) {
            return res.status(400).json({
                success: false,
                message: 'Serviço não encontrado'
            });
        }

        const pricing = service.periods[period];
        if (!pricing) {
            return res.status(400).json({
                success: false,
                message: 'Período não encontrado'
            });
        }

        // Calculate final price and tokens
        let finalPrice = pricing.usd;
        let tokensNeeded = 0;
        let displayAmount = '';

        if (paymentMethod === 'norx') {
            const discount = service.discount || 0;
            finalPrice = pricing.usd * (1 - discount / 100);
            tokensNeeded = Math.ceil(finalPrice / CONFIG.norxTokenPrice);
            displayAmount = `$${finalPrice.toFixed(2)} (${tokensNeeded.toLocaleString()} NORX)`;
        } else if (paymentMethod === 'pix') {
            displayAmount = `R$ ${pricing.brl.toLocaleString('pt-BR')}`;
        } else {
            displayAmount = `$${finalPrice.toFixed(2)}`;
        }

        // Generate payment data
        const ticketId = generateTicketId();
        const paymentId = crypto.randomBytes(16).toString('hex');
        
        const paymentData = {
            id: paymentId,
            ticketId: ticketId,
            userId: userId,
            userEmail: userEmail,
            userName: userName,
            serviceType: serviceType,
            serviceName: service.name,
            period: period,
            paymentMethod: paymentMethod,
            originalAmount: pricing.usd,
            finalAmount: finalPrice,
            tokensNeeded: tokensNeeded,
            currency: paymentMethod === 'pix' ? 'BRL' : 'USD',
            displayAmount: displayAmount,
            status: 'pending',
            walletAddress: CONFIG.wallets[paymentMethod] || CONFIG.wallets.pix,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            confirmedAt: null,
            metadata: {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                discount: paymentMethod === 'norx' ? service.discount : 0
            }
        };

        // Save payment to database
        const result = await dbOperations.create(collections.PAYMENTS, paymentId, paymentData);

        if (!result.success) {
            throw new Error(result.error);
        }

        // Send payment initiated email
        try {
            await sendEmail(
                userEmail,
                `Pagamento Iniciado - ${ticketId}`,
                emailTemplates.paymentInitiated(paymentData)
            );
        } catch (emailError) {
            console.error('Error sending payment email:', emailError);
            // Don't fail the payment creation if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Pagamento criado com sucesso',
            payment: {
                id: paymentData.id,
                ticketId: paymentData.ticketId,
                serviceName: paymentData.serviceName,
                period: paymentData.period,
                paymentMethod: paymentData.paymentMethod,
                originalAmount: paymentData.originalAmount,
                finalAmount: paymentData.finalAmount,
                tokensNeeded: paymentData.tokensNeeded,
                displayAmount: paymentData.displayAmount,
                walletAddress: paymentData.walletAddress,
                status: paymentData.status,
                expiresAt: paymentData.expiresAt
            }
        });

    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Confirm payment (Admin only)
router.post('/confirm/:paymentId', async (req, res) => {
    try {
        // Get payment data
        const paymentResult = await dbOperations.getById(collections.PAYMENTS, req.params.paymentId);
        
        if (!paymentResult.success) {
            return res.status(404).json({
                success: false,
                message: 'Pagamento não encontrado'
            });
        }

        const paymentData = paymentResult.data;

        if (paymentData.status === 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Pagamento já confirmado'
            });
        }

        // Update payment status
        const updateResult = await dbOperations.update(collections.PAYMENTS, req.params.paymentId, {
            status: 'confirmed',
            confirmedAt: new Date().toISOString(),
            confirmedBy: req.user?.id || 'admin'
        });

        if (!updateResult.success) {
            throw new Error(updateResult.error);
        }

        // Activate service for user
        if (paymentData.userId) {
            try {
                const userResult = await dbOperations.getById(collections.USERS, paymentData.userId);
                
                if (userResult.success) {
                    const userData = userResult.data;
                    const services = userData.services || [];
                    
                    if (!services.includes(paymentData.serviceType)) {
                        services.push(paymentData.serviceType);
                        await dbOperations.update(collections.USERS, paymentData.userId, { 
                            services: services,
                            lastServiceActivation: new Date().toISOString()
                        });
                    }
                }
            } catch (userError) {
                console.error('Error updating user services:', userError);
                // Don't fail the confirmation if user update fails
            }
        }

        // Send confirmation email
        try {
            await sendEmail(
                paymentData.userEmail,
                '✅ Pagamento Confirmado - Acesso Ativado!',
                emailTemplates.paymentConfirmation({
                    ...paymentData,
                    amount: paymentData.displayAmount,
                    method: paymentData.paymentMethod
                })
            );
        } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Don't fail the confirmation if email fails
        }

        res.json({
            success: true,
            message: 'Pagamento confirmado e acesso ativado com sucesso!',
            payment: {
                id: paymentData.id,
                ticketId: paymentData.ticketId,
                status: 'confirmed',
                confirmedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Get payment by ticket ID
router.get('/ticket/:ticketId', async (req, res) => {
    try {
        const paymentQuery = await dbOperations.query(
            collections.PAYMENTS,
            'ticketId',
            '==',
            req.params.ticketId
        );

        if (!paymentQuery.success || paymentQuery.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pagamento não encontrado'
            });
        }

        const paymentData = paymentQuery.data[0];

        res.json({
            success: true,
            payment: {
                ticketId: paymentData.ticketId,
                serviceName: paymentData.serviceName,
                period: paymentData.period,
                paymentMethod: paymentData.paymentMethod,
                displayAmount: paymentData.displayAmount,
                status: paymentData.status,
                createdAt: paymentData.createdAt,
                confirmedAt: paymentData.confirmedAt,
                expiresAt: paymentData.expiresAt
            }
        });

    } catch (error) {
        console.error('Error getting payment:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Get user payments
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const paymentsQuery = await dbOperations.query(
            collections.PAYMENTS,
            'userId',
            '==',
            req.params.userId
        );

        if (!paymentsQuery.success) {
            throw new Error(paymentsQuery.error);
        }

        const payments = paymentsQuery.data.map(payment => ({
            id: payment.id,
            ticketId: payment.ticketId,
            serviceName: payment.serviceName,
            period: payment.period,
            paymentMethod: payment.paymentMethod,
            displayAmount: payment.displayAmount,
            status: payment.status,
            createdAt: payment.createdAt,
            confirmedAt: payment.confirmedAt
        }));

        res.json({
            success: true,
            payments: payments
        });

    } catch (error) {
        console.error('Error getting user payments:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Cancel payment (if pending)
router.post('/cancel/:paymentId', async (req, res) => {
    try {
        const paymentResult = await dbOperations.getById(collections.PAYMENTS, req.params.paymentId);
        
        if (!paymentResult.success) {
            return res.status(404).json({
                success: false,
                message: 'Pagamento não encontrado'
            });
        }

        const paymentData = paymentResult.data;

        if (paymentData.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Apenas pagamentos pendentes podem ser cancelados'
            });
        }

        // Update payment status
        await dbOperations.update(collections.PAYMENTS, req.params.paymentId, {
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelledBy: req.user?.id || 'user'
        });

        res.json({
            success: true,
            message: 'Pagamento cancelado com sucesso'
        });

    } catch (error) {
        console.error('Error cancelling payment:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;