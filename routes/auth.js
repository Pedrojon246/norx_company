// 🔐 ROTAS DE AUTENTICAÇÃO
// ============================

const express = require('express');
const bcrypt = require('bcrypt');
const admin = require('../config/firebase');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ============================
// REGISTRO DE USUÁRIO
// ============================

router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // Validações básicas
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email, senha e nome são obrigatórios'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres'
            });
        }
        
        // Verificar se usuário já existe
        const existingUser = await admin.firestore()
            .collection('users')
            .where('email', '==', email.toLowerCase())
            .get();
        
        if (!existingUser.empty) {
            return res.status(409).json({
                success: false,
                message: 'Email já está em uso'
            });
        }
        
        // Hash da senha
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Criar usuário no Firebase
        const userRef = admin.firestore().collection('users').doc();
        const userData = {
            id: userRef.id,
            email: email.toLowerCase(),
            name: name.trim(),
            password: hashedPassword,
            role: 'user',
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
            lastAccess: null,
            lastIP: req.ip || req.connection.remoteAddress
        };
        
        await userRef.set(userData);
        
        // Gerar token
        const token = generateToken(userRef.id);
        
        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            data: {
                token,
                user: {
                    id: userRef.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    status: userData.status
                }
            }
        });
        
    } catch (error) {
        console.error('🔴 Erro no registro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ============================
// LOGIN
// ============================

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validações
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }
        
        // Buscar usuário
        const userQuery = await admin.firestore()
            .collection('users')
            .where('email', '==', email.toLowerCase())
            .get();
        
        if (userQuery.empty) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        
        // Verificar status do usuário
        if (userData.status === 'blocked' || userData.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Conta bloqueada. Entre em contato com o suporte.'
            });
        }
        
        // Verificar senha
        const passwordMatch = await bcrypt.compare(password, userData.password);
        
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        // Atualizar último login
        await userDoc.ref.update({
            lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            lastIP: req.ip || req.connection.remoteAddress
        });
        
        // Gerar token
        const token = generateToken(userDoc.id);
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            data: {
                token,
                user: {
                    id: userDoc.id,
                    email: userData.email,
                    name: userData.name,
                    role: userData.role,
                    status: userData.status,
                    lastLogin: new Date().toISOString()
                }
            }
        });
        
    } catch (error) {
        console.error('🔴 Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ============================
// VERIFICAR TOKEN
// ============================

router.get('/verify', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Token válido',
        data: {
            user: req.user
        }
    });
});

// ============================
// LOGOUT (opcional - para invalidar token no frontend)
// ============================

router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Atualizar último logout no Firebase
        await admin.firestore()
            .collection('users')
            .doc(req.user.id)
            .update({
                lastLogout: admin.firestore.FieldValue.serverTimestamp()
            });
        
        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
        
    } catch (error) {
        console.error('🔴 Erro no logout:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ============================
// REFRESH TOKEN
// ============================

router.post('/refresh', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token é obrigatório'
            });
        }
        
        const { refreshToken } = require('../middleware/auth');
        const newToken = await refreshToken(token);
        
        res.json({
            success: true,
            message: 'Token renovado com sucesso',
            data: { token: newToken }
        });
        
    } catch (error) {
        console.error('🔴 Erro ao renovar token:', error);
        res.status(401).json({
            success: false,
            message: error.message || 'Não foi possível renovar o token'
        });
    }
});

module.exports = router;