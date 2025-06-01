// 🔐 MIDDLEWARE DE AUTENTICAÇÃO JWT
// =====================================

const jwt = require('jsonwebtoken');
const admin = require('../config/firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'norx_company_secret_key_2025';

// =====================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =====================================

const authMiddleware = async (req, res, next) => {
    try {
        // Obter token do header
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'Token de acesso requerido',
                message: 'Faça login para continuar',
                code: 'NO_TOKEN'
            });
        }
        
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;
        
        if (!token) {
            return res.status(401).json({
                error: 'Token malformado',
                message: 'Token deve começar com "Bearer "',
                code: 'MALFORMED_TOKEN'
            });
        }
        
        // Verificar token JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Token expirado',
                    message: 'Sua sessão expirou. Faça login novamente.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            return res.status(401).json({
                error: 'Token inválido',
                message: 'Token fornecido é inválido',
                code: 'INVALID_TOKEN'
            });
        }
        
        // Buscar usuário no Firebase
        const userDoc = await admin.firestore()
            .collection('users')
            .doc(decoded.userId)
            .get();
        
        if (!userDoc.exists) {
            return res.status(401).json({
                error: 'Usuário não encontrado',
                message: 'Conta não existe mais',
                code: 'USER_NOT_FOUND'
            });
        }
        
        const userData = userDoc.data();
        
        // Verificar se usuário está ativo
        if (userData.status === 'blocked' || userData.status === 'suspended') {
            return res.status(403).json({
                error: 'Conta bloqueada',
                message: 'Sua conta foi suspensa. Entre em contato com o suporte.',
                code: 'ACCOUNT_BLOCKED'
            });
        }
        
        // Adicionar dados do usuário ao request
        req.user = {
            id: decoded.userId,
            email: userData.email,
            name: userData.name,
            role: userData.role || 'user',
            status: userData.status || 'active',
            createdAt: userData.createdAt,
            lastLogin: userData.lastLogin
        };
        
        // Atualizar último acesso
        await admin.firestore()
            .collection('users')
            .doc(decoded.userId)
            .update({
                lastAccess: admin.firestore.FieldValue.serverTimestamp(),
                lastIP: req.ip || req.connection.remoteAddress
            });
        
        next();
        
    } catch (error) {
        console.error('🔴 Erro no middleware de autenticação:', error);
        res.status(500).json({
            error: 'Erro interno de autenticação',
            message: 'Falha ao verificar credenciais',
            code: 'AUTH_INTERNAL_ERROR'
        });
    }
};

// =====================================
// MIDDLEWARE DE AUTORIZAÇÃO ADMIN
// =====================================

const adminMiddleware = (req, res, next) => {
    // Verificar se usuário existe no request (passou pelo authMiddleware)
    if (!req.user) {
        return res.status(401).json({
            error: 'Usuário não autenticado',
            message: 'Faça login primeiro',
            code: 'NOT_AUTHENTICATED'
        });
    }
    
    // Verificar se é admin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem acessar este recurso',
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    }
    
    next();
};

// =====================================
// MIDDLEWARE DE VERIFICAÇÃO OPCIONAL
// =====================================

const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            req.user = null;
            return next();
        }
        
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        // Tentar verificar token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(decoded.userId)
                .get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                req.user = {
                    id: decoded.userId,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role || 'user',
                    status: userData.status || 'active'
                };
            } else {
                req.user = null;
            }
        } catch {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        console.error('🔴 Erro no middleware de auth opcional:', error);
        req.user = null;
        next();
    }
};

// =====================================
// UTILITÁRIOS DE TOKEN
// =====================================

const generateToken = (userId, expiresIn = '7d') => {
    return jwt.sign(
        { 
            userId,
            iat: Math.floor(Date.now() / 1000),
            issuer: 'norx-company'
        }, 
        JWT_SECRET, 
        { expiresIn }
    );
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const refreshToken = async (oldToken) => {
    try {
        const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        
        // Verificar se token não é muito antigo (máximo 30 dias)
        const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
        const maxAge = 30 * 24 * 60 * 60; // 30 dias
        
        if (tokenAge > maxAge) {
            throw new Error('Token muito antigo para renovação');
        }
        
        // Gerar novo token
        return generateToken(decoded.userId);
        
    } catch (error) {
        throw new Error('Não foi possível renovar o token');
    }
};

// =====================================
// EXPORTS
// =====================================

module.exports = {
    authMiddleware,
    adminMiddleware,
    optionalAuthMiddleware,
    generateToken,
    verifyToken,
    refreshToken
};