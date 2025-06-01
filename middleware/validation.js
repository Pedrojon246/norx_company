// ✅ MIDDLEWARE DE VALIDAÇÃO SIMPLIFICADO
// =====================================

// =====================================
// UTILITÁRIOS DE VALIDAÇÃO
// =====================================

const handleValidationErrors = (errors) => {
    if (errors && errors.length > 0) {
        return {
            error: 'Dados inválidos',
            message: 'Verifique os campos enviados',
            code: 'VALIDATION_ERROR',
            details: errors
        };
    }
    return null;
};

// Sanitizar strings
const sanitizeString = (value) => {
    if (typeof value !== 'string') return value;
    return value.trim().replace(/[<>]/g, '');
};

// Middleware de sanitização
const sanitizeMiddleware = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        }
    }
    
    if (req.query && typeof req.query === 'object') {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        }
    }
    
    next();
};

// =====================================
// VALIDAÇÕES BÁSICAS
// =====================================

const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

const validatePassword = (password) => {
    // Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 símbolo
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return re.test(password);
};

// =====================================
// MIDDLEWARES DE VALIDAÇÃO
// =====================================

const validateRegister = (req, res, next) => {
    const { name, email, password, confirmPassword, terms } = req.body;
    const errors = [];
    
    if (!name || name.length < 2 || name.length > 50) {
        errors.push({ field: 'name', message: 'Nome deve ter entre 2 e 50 caracteres' });
    }
    
    if (!email || !validateEmail(email)) {
        errors.push({ field: 'email', message: 'Email inválido' });
    }
    
    if (!password || !validatePassword(password)) {
        errors.push({ 
            field: 'password', 
            message: 'Senha deve ter 8+ caracteres, maiúscula, minúscula, número e símbolo' 
        });
    }
    
    if (password !== confirmPassword) {
        errors.push({ field: 'confirmPassword', message: 'Confirmação de senha não confere' });
    }
    
    if (terms !== 'true' && terms !== true) {
        errors.push({ field: 'terms', message: 'Você deve aceitar os termos de uso' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];
    
    if (!email || !validateEmail(email)) {
        errors.push({ field: 'email', message: 'Email inválido' });
    }
    
    if (!password) {
        errors.push({ field: 'password', message: 'Senha é obrigatória' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validatePayment = (req, res, next) => {
    const { amount, method } = req.body;
    const errors = [];
    
    if (!amount || isNaN(amount) || amount < 10 || amount > 100000) {
        errors.push({ 
            field: 'amount', 
            message: 'Valor deve estar entre R$ 10,00 e R$ 100.000,00' 
        });
    }
    
    if (!method || !['pix', 'usdt', 'norxcoin'].includes(method)) {
        errors.push({ field: 'method', message: 'Método de pagamento inválido' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validatePaymentConfirmation = (req, res, next) => {
    const { paymentId } = req.body;
    const errors = [];
    
    if (!paymentId || paymentId.length < 10) {
        errors.push({ field: 'paymentId', message: 'ID do pagamento é obrigatório' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validateUserUpdate = (req, res, next) => {
    const { name } = req.body;
    const errors = [];
    
    if (name && (name.length < 2 || name.length > 50)) {
        errors.push({ field: 'name', message: 'Nome deve ter entre 2 e 50 caracteres' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validatePasswordChange = (req, res, next) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const errors = [];
    
    if (!currentPassword) {
        errors.push({ field: 'currentPassword', message: 'Senha atual é obrigatória' });
    }
    
    if (!newPassword || !validatePassword(newPassword)) {
        errors.push({ 
            field: 'newPassword', 
            message: 'Nova senha deve ter 8+ caracteres, maiúscula, minúscula, número e símbolo' 
        });
    }
    
    if (newPassword !== confirmNewPassword) {
        errors.push({ field: 'confirmNewPassword', message: 'Confirmação da nova senha não confere' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validateAdminUserUpdate = (req, res, next) => {
    const { status, role, balance } = req.body;
    const errors = [];
    
    if (status && !['active', 'blocked', 'suspended'].includes(status)) {
        errors.push({ field: 'status', message: 'Status inválido' });
    }
    
    if (role && !['user', 'admin', 'superadmin'].includes(role)) {
        errors.push({ field: 'role', message: 'Função inválida' });
    }
    
    if (balance !== undefined && (isNaN(balance) || balance < 0)) {
        errors.push({ field: 'balance', message: 'Saldo deve ser um número positivo' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validateAdminPaymentUpdate = (req, res, next) => {
    const { status } = req.body;
    const errors = [];
    
    if (!status || !['pending', 'confirmed', 'rejected', 'cancelled'].includes(status)) {
        errors.push({ field: 'status', message: 'Status inválido' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validatePagination = (req, res, next) => {
    const { page, limit } = req.query;
    const errors = [];
    
    if (page && (isNaN(page) || parseInt(page) < 1)) {
        errors.push({ field: 'page', message: 'Página deve ser um número positivo' });
    }
    
    if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
        errors.push({ field: 'limit', message: 'Limite deve estar entre 1 e 100' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validatePasswordReset = (req, res, next) => {
    const { email } = req.body;
    const errors = [];
    
    if (!email || !validateEmail(email)) {
        errors.push({ field: 'email', message: 'Email inválido' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

const validateNewPassword = (req, res, next) => {
    const { token, password, confirmPassword } = req.body;
    const errors = [];
    
    if (!token) {
        errors.push({ field: 'token', message: 'Token é obrigatório' });
    }
    
    if (!password || !validatePassword(password)) {
        errors.push({ 
            field: 'password', 
            message: 'Senha deve ter 8+ caracteres, maiúscula, minúscula, número e símbolo' 
        });
    }
    
    if (password !== confirmPassword) {
        errors.push({ field: 'confirmPassword', message: 'Confirmação de senha não confere' });
    }
    
    const validationError = handleValidationErrors(errors);
    if (validationError) {
        return res.status(400).json(validationError);
    }
    
    next();
};

// =====================================
// EXPORTS
// =====================================

module.exports = {
    // Utilitários
    handleValidationErrors,
    sanitizeMiddleware,
    
    // Autenticação
    validateRegister,
    validateLogin,
    validatePasswordReset,
    validateNewPassword,
    
    // Pagamentos
    validatePayment,
    validatePaymentConfirmation,
    
    // Usuários
    validateUserUpdate,
    validatePasswordChange,
    
    // Admin
    validateAdminUserUpdate,
    validateAdminPaymentUpdate,
    
    // Query params
    validatePagination
};