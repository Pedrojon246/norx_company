// ⏱️ RATE LIMITER SIMPLIFICADO
// ============================

// ============================
// STORAGE EM MEMÓRIA
// ============================

const rateLimitStore = new Map();

// Limpar dados antigos a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.resetTime > data.windowMs) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

// ============================
// FUNÇÃO DE RATE LIMIT
// ============================

const createRateLimit = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutos
        max = 100, // máximo de requests
        message = 'Muitas requisições',
        keyGenerator = (req) => req.ip || 'unknown'
    } = options;
    
    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        
        let record = rateLimitStore.get(key);
        
        if (!record || now - record.resetTime > windowMs) {
            // Criar novo record ou resetar
            record = {
                count: 0,
                resetTime: now,
                windowMs
            };
        }
        
        record.count++;
        rateLimitStore.set(key, record);
        
        // Headers de rate limit
        res.set({
            'X-RateLimit-Limit': max,
            'X-RateLimit-Remaining': Math.max(0, max - record.count),
            'X-RateLimit-Reset': new Date(record.resetTime + windowMs)
        });
        
        if (record.count > max) {
            console.log(`🔴 Rate limit excedido: ${key} (${record.count}/${max})`);
            return res.status(429).json({
                error: 'Rate limit excedido',
                message,
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((record.resetTime + windowMs - now) / 1000)
            });
        }
        
        next();
    };
};

// ============================
// RATE LIMITS ESPECÍFICOS
// ============================

const loginLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas de login
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    keyGenerator: (req) => `login_${req.ip}_${req.body?.email || ''}`
});

const registerLimiter = createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 registros por hora
    message: 'Máximo 3 registros por hora permitidos.',
    keyGenerator: (req) => `register_${req.ip}`
});

const paymentLimiter = createRateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // 10 tentativas de pagamento
    message: 'Muitas tentativas de pagamento. Aguarde 5 minutos.',
    keyGenerator: (req) => `payment_${req.ip}_${req.user?.id || 'anonymous'}`
});

const apiLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requests por IP
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
});

const adminLimiter = createRateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 50, // 50 requests para admin
    message: 'Muitas operações administrativas. Aguarde 10 minutos.',
    keyGenerator: (req) => `admin_${req.user?.id || req.ip}`
});

const passwordResetLimiter = createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 tentativas de reset
    message: 'Máximo 3 tentativas de reset de senha por hora.',
    keyGenerator: (req) => `reset_${req.body?.email || req.ip}`
});

// ============================
// MIDDLEWARE DINÂMICO
// ============================

const dynamicRateLimit = (req, res, next) => {
    const path = req.path;
    const method = req.method;
    
    // Aplicar rate limit específico baseado na rota
    if (path.includes('/login') && method === 'POST') {
        return loginLimiter(req, res, next);
    }
    
    if (path.includes('/register') && method === 'POST') {
        return registerLimiter(req, res, next);
    }
    
    if (path.includes('/payment')) {
        return paymentLimiter(req, res, next);
    }
    
    if (path.includes('/admin')) {
        return adminLimiter(req, res, next);
    }
    
    if (path.includes('/password-reset') || path.includes('/forgot-password')) {
        return passwordResetLimiter(req, res, next);
    }
    
    // Rate limit geral
    return apiLimiter(req, res, next);
};

// ============================
// EXPORTS
// ============================

module.exports = {
    createRateLimit,
    loginLimiter,
    registerLimiter,
    paymentLimiter,
    apiLimiter,
    adminLimiter,
    passwordResetLimiter,
    dynamicRateLimit
};