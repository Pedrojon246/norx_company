// 💰 SISTEMA DE PAGAMENTOS
// ========================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { firestoreUtils } = require('../config/firebase');
const { validatePayment, validatePaymentConfirmation, sanitizeMiddleware } = require('../middleware/validation');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { logger, logUserAction, logPaymentEvent } = require('../middleware/logging');
const emailService = require('../config/email');
const cryptoService = require('../config/services');

const router = express.Router();

// ============================
// CONFIGURAÇÕES DE PAGAMENTO
// ============================

const PAYMENT_CONFIG = {
    methods: {
        pix: {
            name: 'PIX',
            enabled: true,
            minAmount: 10,
            maxAmount: 100000,
            fee: 0, // sem taxa
            processingTime: '5-15 minutos'
        },
        usdt: {
            name: 'USDT (TRC20)',
            enabled: true,
            minAmount: 5, // em USDT
            maxAmount: 50000,
            fee: 0.02, // 2%
            processingTime: '10-30 minutos'
        },
        norxcoin: {
            name: 'NORXCOIN',
            enabled: true,
            minAmount: 1,
            maxAmount: 1000000,
            fee: 0,
            processingTime: 'Instantâneo'
        }
    },
    
    plans: {
        basic: {
            name: 'Plano Básico',
            price: 100,
            benefits: ['Acesso básico', 'Suporte por email'],
            duration: 30 // dias
        },
        premium: {
            name: 'Plano Premium',
            price: 500,
            benefits: ['Acesso premium', 'Suporte prioritário', 'Analytics avançado'],
            duration: 30
        },
        vip: {
            name: 'Plano VIP',
            price: 1000,
            benefits: ['Acesso total', 'Suporte 24/7', 'Consultoria exclusiva'],
            duration: 30
        }
    },
    
    wallets: {
        usdt: process.env.USDT_WALLET || '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1',
        norx: process.env.NORX_WALLET || '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1',
        pix: process.env.PIX_KEY || 'support@norxcompany.com.br'
    }
};

// ============================
// LISTAR MÉTODOS DE PAGAMENTO
// ============================

router.get('/methods', async (req, res) => {
    try {
        // Buscar cotações atuais
        const cryptoPrices = await cryptoService.getCurrentPrices();
        
        const methods = Object.entries(PAYMENT_CONFIG.methods).map(([key, method]) => ({
            id: key,
            ...method,
            currentRate: cryptoPrices[key] || null
        }));
        
        res.json({
            success: true,
            data: {
                methods,
                wallets: PAYMENT_CONFIG.wallets
            }
        });
        
    } catch (error) {
        logger.error('Erro ao listar métodos de pagamento', { error });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar métodos de pagamento'
        });
    }
});

// ============================
// LISTAR PLANOS
// ============================

router.get('/plans', async (req, res) => {
    try {
        const plans = Object.entries(PAYMENT_CONFIG.plans).map(([key, plan]) => ({
            id: key,
            ...plan
        }));
        
        res.json({
            success: true,
            data: plans
        });
        
    } catch (error) {
        logger.error('Erro ao listar planos', { error });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar planos'
        });
    }
});

// ============================
// CRIAR PAGAMENTO
// ============================

router.post('/create',
    paymentLimiter,
    sanitizeMiddleware,
    validatePayment,
    async (req, res) => {
        try {
            const { amount, method, plan, description } = req.body;
            const userId = req.user.id;
            const userIP = req.ip || req.connection.remoteAddress;
            
            // Validar método de pagamento
            const paymentMethod = PAYMENT_CONFIG.methods[method];
            if (!paymentMethod || !paymentMethod.enabled) {
                return res.status(400).json({
                    error: 'Método inválido',
                    message: 'Método de pagamento não disponível',
                    code: 'INVALID_PAYMENT_METHOD'
                });
            }
            
            // Validar valores mínimo e máximo
            if (amount < paymentMethod.minAmount || amount > paymentMethod.maxAmount) {
                return res.status(400).json({
                    error: 'Valor inválido',
                    message: `Valor deve estar entre ${paymentMethod.minAmount} e ${paymentMethod.maxAmount}`,
                    code: 'INVALID_AMOUNT'
                });
            }
            
            // Calcular taxa
            const fee = amount * (paymentMethod.fee || 0);
            const totalAmount = amount + fee;
            
            // Gerar ID único do pagamento
            const paymentId = `PAY_${Date.now()}_${uuidv4().slice(0, 8)}`;
            
            // Dados do pagamento
            const paymentData = {
                id: paymentId,
                userId,
                userEmail: req.user.email,
                userName: req.user.name,
                
                // Valores
                amount,
                fee,
                totalAmount,
                currency: method === 'pix' ? 'BRL' : method.toUpperCase(),
                
                // Método e detalhes
                method,
                methodName: paymentMethod.name,
                plan: plan || null,
                description: description || 'Depósito NORX Company',
                
                // Status
                status: 'pending',
                statusHistory: [{
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    note: 'Pagamento criado'
                }],
                
                // Informações técnicas
                ip: userIP,
                userAgent: req.get('User-Agent'),
                
                // Dados específicos do método
                paymentDetails: await generatePaymentDetails(method, totalAmount),
                
                // Timestamps
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hora
                
                // Metadados
                metadata: {
                    source: 'web',
                    version: '1.0'
                }
            };
            
            // Salvar pagamento
            await firestoreUtils.set('payments', paymentId, paymentData);
            
            // Log da ação
            await logUserAction(userId, 'PAYMENT_CREATED', {
                paymentId,
                amount,
                method,
                ip: userIP
            });
            
            await logPaymentEvent(paymentId, 'PAYMENT_CREATED', {
                userId,
                amount,
                method,
                totalAmount
            });
            
            logger.info('Pagamento criado', { 
                paymentId, 
                userId, 
                amount, 
                method, 
                totalAmount 
            });
            
            // Enviar email de confirmação
            emailService.sendPaymentInstructionsEmail(
                req.user.email,
                req.user.name,
                paymentData
            ).catch(error => {
                logger.error('Erro ao enviar email de instruções', { error, paymentId });
            });
            
            res.status(201).json({
                success: true,
                message: 'Pagamento criado com sucesso! 💰',
                data: {
                    payment: {
                        id: paymentId,
                        amount,
                        totalAmount,
                        method: paymentMethod.name,
                        status: 'pending',
                        paymentDetails: paymentData.paymentDetails,
                        expiresAt: paymentData.expiresAt
                    }
                }
            });
            
        } catch (error) {
            logger.error('Erro ao criar pagamento', { error, body: req.body, userId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível criar o pagamento. Tente novamente.',
                code: 'PAYMENT_CREATION_ERROR'
            });
        }
    }
);

// ============================
// CONFIRMAR PAGAMENTO
// ============================

router.post('/confirm',
    sanitizeMiddleware,
    validatePaymentConfirmation,
    async (req, res) => {
        try {
            const { paymentId, transactionHash, pixProof } = req.body;
            const userId = req.user.id;
            const userIP = req.ip || req.connection.remoteAddress;
            
            // Buscar pagamento
            const payment = await firestoreUtils.get('payments', paymentId);
            
            if (!payment) {
                return res.status(404).json({
                    error: 'Pagamento não encontrado',
                    message: 'ID do pagamento inválido',
                    code: 'PAYMENT_NOT_FOUND'
                });
            }
            
            // Verificar se o pagamento pertence ao usuário
            if (payment.userId !== userId) {
                return res.status(403).json({
                    error: 'Acesso negado',
                    message: 'Este pagamento não pertence a você',
                    code: 'PAYMENT_ACCESS_DENIED'
                });
            }
            
            // Verificar se pagamento ainda está pendente
            if (payment.status !== 'pending') {
                return res.status(400).json({
                    error: 'Status inválido',
                    message: `Pagamento já foi ${payment.status}`,
                    code: 'INVALID_PAYMENT_STATUS'
                });
            }
            
            // Verificar se não expirou
            const now = new Date();
            const expiresAt = new Date(payment.expiresAt);
            
            if (now > expiresAt) {
                // Marcar como expirado
                await firestoreUtils.update('payments', paymentId, {
                    status: 'expired',
                    statusHistory: [
                        ...payment.statusHistory,
                        {
                            status: 'expired',
                            timestamp: new Date().toISOString(),
                            note: 'Pagamento expirado'
                        }
                    ],
                    updatedAt: new Date().toISOString()
                });
                
                return res.status(400).json({
                    error: 'Pagamento expirado',
                    message: 'Este pagamento expirou. Crie um novo.',
                    code: 'PAYMENT_EXPIRED'
                });
            }
            
            // Atualizar dados de confirmação
            const confirmationData = {
                status: 'confirming',
                transactionHash: transactionHash || null,
                pixProof: pixProof || null,
                confirmedAt: new Date().toISOString(),
                confirmationIP: userIP,
                statusHistory: [
                    ...payment.statusHistory,
                    {
                        status: 'confirming',
                        timestamp: new Date().toISOString(),
                        note: 'Comprovante enviado pelo usuário',
                        data: {
                            transactionHash: transactionHash || null,
                            pixProof: pixProof || null,
                            ip: userIP
                        }
                    }
                ],
                updatedAt: new Date().toISOString()
            };
            
            await firestoreUtils.update('payments', paymentId, confirmationData);
            
            // Log da ação
            await logUserAction(userId, 'PAYMENT_PROOF_SUBMITTED', {
                paymentId,
                transactionHash: transactionHash || null,
                pixProof: pixProof || null,
                ip: userIP
            });
            
            await logPaymentEvent(paymentId, 'PROOF_SUBMITTED', {
                userId,
                transactionHash: transactionHash || null,
                pixProof: pixProof || null
            });
            
            logger.info('Comprovante de pagamento enviado', { 
                paymentId, 
                userId, 
                method: payment.method,
                hasHash: !!transactionHash,
                hasProof: !!pixProof
            });
            
            // Notificar admin (não bloquear response)
            emailService.sendPaymentConfirmationToAdmin(payment, confirmationData).catch(error => {
                logger.error('Erro ao notificar admin sobre pagamento', { error, paymentId });
            });
            
            res.json({
                success: true,
                message: 'Comprovante enviado com sucesso! ⏳',
                data: {
                    status: 'confirming',
                    message: 'Seu pagamento está sendo verificado. Você será notificado quando for aprovado.'
                }
            });
            
        } catch (error) {
            logger.error('Erro ao confirmar pagamento', { error, body: req.body, userId: req.user.id });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível processar sua confirmação. Tente novamente.',
                code: 'PAYMENT_CONFIRMATION_ERROR'
            });
        }
    }
);

// ============================
// LISTAR PAGAMENTOS DO USUÁRIO
// ============================

router.get('/history', async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        
        // Filtros
        const filters = [
            { field: 'userId', operator: '==', value: userId }
        ];
        
        if (status) {
            filters.push({ field: 'status', operator: '==', value: status });
        }
        
        // Buscar pagamentos
        const payments = await firestoreUtils.getMany(
            'payments',
            filters,
            { field: 'createdAt', direction: 'desc' },
            limit
        );
        
        // Formatar dados para resposta
        const formattedPayments = payments.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            totalAmount: payment.totalAmount,
            currency: payment.currency,
            method: payment.methodName,
            status: payment.status,
            description: payment.description,
            createdAt: payment.createdAt,
            confirmedAt: payment.confirmedAt || null,
            expiresAt: payment.expiresAt
        }));
        
        res.json({
            success: true,
            data: {
                payments: formattedPayments,
                pagination: {
                    page,
                    limit,
                    total: payments.length,
                    hasMore: payments.length === limit
                }
            }
        });
        
    } catch (error) {
        logger.error('Erro ao buscar histórico de pagamentos', { error, userId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar seu histórico',
            code: 'PAYMENT_HISTORY_ERROR'
        });
    }
});

// ============================
// BUSCAR PAGAMENTO ESPECÍFICO
// ============================

router.get('/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.user.id;
        
        const payment = await firestoreUtils.get('payments', paymentId);
        
        if (!payment) {
            return res.status(404).json({
                error: 'Pagamento não encontrado',
                message: 'ID do pagamento inválido',
                code: 'PAYMENT_NOT_FOUND'
            });
        }
        
        // Verificar se o pagamento pertence ao usuário
        if (payment.userId !== userId) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Este pagamento não pertence a você',
                code: 'PAYMENT_ACCESS_DENIED'
            });
        }
        
        res.json({
            success: true,
            data: {
                payment: {
                    id: payment.id,
                    amount: payment.amount,
                    totalAmount: payment.totalAmount,
                    currency: payment.currency,
                    method: payment.methodName,
                    status: payment.status,
                    description: payment.description,
                    paymentDetails: payment.paymentDetails,
                    statusHistory: payment.statusHistory,
                    createdAt: payment.createdAt,
                    confirmedAt: payment.confirmedAt || null,
                    expiresAt: payment.expiresAt
                }
            }
        });
        
    } catch (error) {
        logger.error('Erro ao buscar pagamento', { error, paymentId: req.params.paymentId, userId: req.user.id });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível carregar o pagamento',
            code: 'PAYMENT_FETCH_ERROR'
        });
    }
});

// ============================
// UTILITÁRIOS
// ============================

async function generatePaymentDetails(method, amount) {
    switch (method) {
        case 'pix':
            return {
                key: PAYMENT_CONFIG.wallets.pix,
                keyType: 'email',
                recipient: 'NORX Company Ltda',
                instructions: [
                    'Copie a chave PIX acima',
                    'Faça o pagamento em seu banco',
                    'Envie o comprovante',
                    'Aguarde a confirmação'
                ]
            };
            
        case 'usdt':
            return {
                wallet: PAYMENT_CONFIG.wallets.usdt,
                network: 'TRC20 (Tron)',
                currency: 'USDT',
                instructions: [
                    'Envie USDT para o endereço acima',
                    'Use apenas a rede TRC20',
                    'Aguarde 1 confirmação',
                    'Envie o hash da transação'
                ]
            };
            
        case 'norxcoin':
            return {
                wallet: PAYMENT_CONFIG.wallets.norx,
                network: 'BSC (BEP20)',
                currency: 'NORXCOIN',
                instructions: [
                    'Envie NORXCOIN para o endereço acima',
                    'Use a rede BSC (BEP20)',
                    'Processamento instantâneo',
                    'Envie o hash da transação'
                ]
            };
            
        default:
            return {};
    }
}

module.exports = router;