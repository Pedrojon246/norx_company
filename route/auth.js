const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { collections, dbOperations } = require('../config/firebase.js');
const { sendEmail, emailTemplates } = require('../config/email.js');
const { validateRegister, validateLogin } = require('../utils/validators.js');


const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
    try {
        // Validate input
        const { errors, isValid } = validateRegister(req.body);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            cpf,
            password,
            interest,
            marketing
        } = req.body;

        // Check if user already exists
        const existingUser = await dbOperations.query(
            collections.USERS,
            'email',
            '==',
            email.toLowerCase()
        );

        if (existingUser.success && existingUser.data.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Usuário já existe com este email'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate user ID
        const userId = crypto.randomBytes(16).toString('hex');

        // Create user data
        const userData = {
            id: userId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            cpf: cpf.trim(),
            password: hashedPassword,
            interest: interest || '',
            marketing: marketing || false,
            status: 'active',
            services: [],
            payments: [],
            emailVerified: true, // Auto-verify for now
            lastLogin: null,
            loginAttempts: 0,
            lockUntil: null
        };

        // Save user to database
        const result = await dbOperations.create(collections.USERS, userId, userData);

        if (!result.success) {
            throw new Error(result.error);
        }

        // Send welcome email
        try {
            await sendEmail(
                userData.email,
                '🎉 Bem-vindo à NORX COMPANY!',
                emailTemplates.welcome(userData)
            );
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Don't fail the registration if email fails
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: userData.id, email: userData.email },
            process.env.JWT_SECRET || 'norx-secret-key',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso!',
            token,
            user: {
                id: userData.id,
                name: `${userData.firstName} ${userData.lastName}`,
                email: userData.email,
                services: userData.services,
                status: userData.status
            }
        });

    } catch (error) {
        console.error('Error in register:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        // Validate input
        const { errors, isValid } = validateLogin(req.body);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        const { email, password } = req.body;

        // Find user by email
        const userQuery = await dbOperations.query(
            collections.USERS,
            'email',
            '==',
            email.toLowerCase()
        );

        if (!userQuery.success || userQuery.data.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Email ou senha incorretos'
            });
        }

        const userData = userQuery.data[0];

        // Check if account is locked
        if (userData.lockUntil && userData.lockUntil > Date.now()) {
            return res.status(423).json({
                success: false,
                message: 'Conta temporariamente bloqueada. Tente novamente mais tarde.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, userData.password);

        if (!isPasswordValid) {
            // Increment login attempts
            const attempts = (userData.loginAttempts || 0) + 1;
            const updateData = { loginAttempts: attempts };

            // Lock account after 5 failed attempts for 30 minutes
            if (attempts >= 5) {
                updateData.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
            }

            await dbOperations.update(collections.USERS, userData.id, updateData);

            return res.status(401).json({
                success: false,
                message: 'Email ou senha incorretos'
            });
        }

        // Reset login attempts and update last login
        await dbOperations.update(collections.USERS, userData.id, {
            lastLogin: new Date().toISOString(),
            loginAttempts: 0,
            lockUntil: null
        });

        // Generate JWT token
        const token = jwt.sign(
            { userId: userData.id, email: userData.email },
            process.env.JWT_SECRET || 'norx-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            user: {
                id: userData.id,
                name: `${userData.firstName} ${userData.lastName}`,
                email: userData.email,
                services: userData.services || [],
                status: userData.status
            }
        });

    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// Verify token
router.get('/verify', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token não fornecido'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'norx-secret-key');
        
        // Get user data
        const userResult = await dbOperations.getById(collections.USERS, decoded.userId);

        if (!userResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }

        const userData = userResult.data;

        res.json({
            success: true,
            user: {
                id: userData.id,
                name: `${userData.firstName} ${userData.lastName}`,
                email: userData.email,
                services: userData.services || [],
                status: userData.status
            }
        });

    } catch (error) {
        console.error('Error in verify:', error);
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        // Find user
        const userQuery = await dbOperations.query(
            collections.USERS,
            'email',
            '==',
            email.toLowerCase()
        );

        if (!userQuery.success || userQuery.data.length === 0) {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'Se o email existir, você receberá instruções para redefinir sua senha'
            });
        }

        const userData = userQuery.data[0];

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

        // Save reset token
        await dbOperations.update(collections.USERS, userData.id, {
            resetPasswordToken: resetToken,
            resetPasswordExpiry: resetTokenExpiry
        });

        // Send reset email (implement template as needed)
        // For now, just log the token
        console.log(`Password reset token for ${email}: ${resetToken}`);

        res.json({
            success: true,
            message: 'Se o email existir, você receberá instruções para redefinir sua senha'
        });

    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = authRoutes;