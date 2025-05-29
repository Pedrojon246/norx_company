// config/email.js - Email Configuration and Templates
const nodemailer = require('nodemailer');

// Email transporter configuration
let emailTransporter = null;

const initializeEmailTransporter = () => {
    try {
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('⚠️ Email credentials not provided');
            return null;
        }

        emailTransporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        console.log('✅ Email transporter initialized');
        return emailTransporter;
    } catch (error) {
        console.error('❌ Error initializing email transporter:', error);
        return null;
    }
};

// Initialize on module load
initializeEmailTransporter();

// Send email function
const sendEmail = async (to, subject, htmlContent) => {
    try {
        if (!emailTransporter) {
            throw new Error('Email transporter not initialized');
        }

        const mailOptions = {
            from: `"NORX COMPANY" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        
        return { 
            success: true, 
            messageId: info.messageId,
            to: to,
            subject: subject
        };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { 
            success: false, 
            error: error.message,
            to: to,
            subject: subject
        };
    }
};

// Email templates
const emailTemplates = {
    // Welcome email template
    welcome: (userData) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bem-vindo à NORX COMPANY</title>
            <style>
                body { 
                    font-family: 'Arial', sans-serif; 
                    background: #000; 
                    color: white; 
                    margin: 0; 
                    padding: 20px; 
                    line-height: 1.6;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); 
                    border-radius: 20px; 
                    padding: 40px; 
                    border: 2px solid #D4AF37; 
                }
                .logo { 
                    font-size: 48px; 
                    font-weight: 900; 
                    color: #D4AF37; 
                    text-align: center; 
                    margin-bottom: 20px; 
                    text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
                }
                .title { 
                    font-size: 24px; 
                    font-weight: 700; 
                    color: #D4AF37; 
                    margin-bottom: 20px; 
                    text-align: center; 
                }
                .content { 
                    line-height: 1.6; 
                    margin-bottom: 30px; 
                }
                .button { 
                    background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); 
                    color: #000; 
                    padding: 15px 30px; 
                    border-radius: 10px; 
                    text-decoration: none; 
                    display: inline-block; 
                    font-weight: 700; 
                    margin: 20px 0; 
                }
                .info-box {
                    background: rgba(212, 175, 55, 0.1);
                    border: 1px solid #D4AF37;
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .footer { 
                    border-top: 1px solid #333; 
                    padding-top: 20px; 
                    margin-top: 30px; 
                    text-align: center; 
                    color: #666; 
                    font-size: 12px; 
                }
                ul { padding-left: 20px; }
                li { margin-bottom: 8px; }
                h3 { color: #D4AF37; margin-top: 25px; margin-bottom: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">NORX</div>
                <div class="title">🎉 Bem-vindo à NORX COMPANY!</div>
                
                <div class="content">
                    <p>Olá <strong>${userData.firstName}</strong>,</p>
                    
                    <p>Sua conta foi criada com sucesso! Agora você faz parte da comunidade mais exclusiva de trading do Brasil.</p>
                    
                    <div class="info-box">
                        <h3>📊 Seus Dados:</h3>
                        <ul>
                            <li><strong>Nome:</strong> ${userData.firstName} ${userData.lastName}</li>
                            <li><strong>Email:</strong> ${userData.email}</li>
                            <li><strong>WhatsApp:</strong> ${userData.phone}</li>
                            <li><strong>Interesse:</strong> ${userData.interest}</li>
                        </ul>
                    </div>
                    
                    <h3>🚀 Próximos Passos:</h3>
                    <ol>
                        <li>Acesse nossa plataforma e explore os serviços</li>
                        <li>Entre no nosso Telegram oficial para receber sinais gratuitos</li>
                        <li>Participe do airdrop NORXCOIN e ganhe tokens grátis</li>
                    </ol>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL || 'https://norxcompany.com.br'}/dashboard.html" class="button">🎯 Acessar Plataforma</a>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>NORX COMPANY</strong> - O futuro dos investimentos</p>
                    <p>📱 WhatsApp: (22) 99754-7731 | 💬 Telegram: @norxcompanyoficial</p>
                    <p>Este é um email automático. Para suporte, responda este email.</p>
                </div>
            </div>
        </body>
        </html>
    `,

    // Payment confirmation template
    paymentConfirmation: (paymentData) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pagamento Confirmado - NORX COMPANY</title>
            <style>
                body { 
                    font-family: 'Arial', sans-serif; 
                    background: #000; 
                    color: white; 
                    margin: 0; 
                    padding: 20px; 
                    line-height: 1.6;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); 
                    border-radius: 20px; 
                    padding: 40px; 
                    border: 2px solid #4CAF50; 
                }
                .logo { 
                    font-size: 48px; 
                    font-weight: 900; 
                    color: #D4AF37; 
                    text-align: center; 
                    margin-bottom: 20px; 
                }
                .title { 
                    font-size: 24px; 
                    font-weight: 700; 
                    color: #4CAF50; 
                    margin-bottom: 20px; 
                    text-align: center; 
                }
                .protocol { 
                    background: rgba(76, 175, 80, 0.2); 
                    padding: 20px; 
                    border-radius: 15px; 
                    text-align: center; 
                    margin: 20px 0; 
                    border: 2px solid #4CAF50; 
                }
                .protocol-number { 
                    font-size: 28px; 
                    font-weight: 900; 
                    color: #4CAF50; 
                    margin: 10px 0;
                }
                .payment-details { 
                    background: rgba(212, 175, 55, 0.1); 
                    padding: 20px; 
                    border-radius: 15px; 
                    margin: 20px 0; 
                    border: 1px solid #D4AF37;
                }
                .contact-info {
                    background: rgba(76, 175, 80, 0.1);
                    padding: 20px;
                    border-radius: 15px;
                    margin: 20px 0;
                    border: 1px solid #4CAF50;
                }
                .footer { 
                    border-top: 1px solid #333; 
                    padding-top: 20px; 
                    margin-top: 30px; 
                    text-align: center; 
                    color: #666; 
                    font-size: 12px; 
                }
                ul { padding-left: 20px; }
                li { margin-bottom: 8px; }
                h3 { color: #D4AF37; margin-bottom: 15px; }
                .success { color: #4CAF50; font-weight: 600; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">NORX</div>
                <div class="title">✅ Pagamento Confirmado!</div>
                
                <div class="protocol">
                    <div>Protocolo de Pagamento:</div>
                    <div class="protocol-number">${paymentData.ticketId}</div>
                    <div style="font-size: 14px; opacity: 0.8;">Guarde este número para referência</div>
                </div>
                
                <div class="content">
                    <p>Olá <strong>${paymentData.userName}</strong>,</p>
                    
                    <p class="success">🎉 Seu pagamento foi confirmado com sucesso! Seu acesso foi ativado automaticamente.</p>
                    
                    <div class="payment-details">
                        <h3>💰 Detalhes do Pagamento:</h3>
                        <ul>
                            <li><strong>Serviço:</strong> ${paymentData.serviceName}</li>
                            <li><strong>Período:</strong> ${paymentData.period}</li>
                            <li><strong>Valor:</strong> ${paymentData.displayAmount || paymentData.amount}</li>
                            <li><strong>Método:</strong> ${paymentData.method || paymentData.paymentMethod}</li>
                            <li><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</li>
                        </ul>
                    </div>
                    
                    <div class="contact-info">
                        <h3 class="success">🎯 Seu acesso está ativo!</h3>
                        <p>Entre em contato conosco para receber suas credenciais de acesso:</p>
                        <ul>
                            <li>📱 <strong>WhatsApp:</strong> (22) 99754-7731</li>
                            <li>💬 <strong>Telegram:</strong> @norxcompanyoficial</li>
                            <li>📧 <strong>Email:</strong> support@norxcompany.com.br</li>
                        </ul>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>NORX COMPANY</strong> - Seu sucesso no trading começa aqui</p>
                    <p>Para suporte, responda este email com seu protocolo: <strong>${paymentData.ticketId}</strong></p>
                </div>
            </div>
        </body>
        </html>
    `,

    // Payment initiated template
    paymentInitiated: (paymentData) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pagamento Iniciado - NORX COMPANY</title>
            <style>
                body { 
                    font-family: 'Arial', sans-serif; 
                    background: #000; 
                    color: white; 
                    margin: 0; 
                    padding: 20px; 
                    line-height: 1.6;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); 
                    border-radius: 20px; 
                    padding: 40px; 
                    border: 2px solid #D4AF37; 
                }
                .logo { 
                    font-size: 48px; 
                    font-weight: 900; 
                    color: #D4AF37; 
                    text-align: center; 
                    margin-bottom: 20px; 
                }
                .title { 
                    font-size: 24px; 
                    font-weight: 700; 
                    color: #D4AF37; 
                    margin-bottom: 20px; 
                    text-align: center; 
                }
                .protocol { 
                    background: rgba(212, 175, 55, 0.2); 
                    padding: 20px; 
                    border-radius: 15px; 
                    text-align: center; 
                    margin: 20px 0; 
                    border: 2px solid #D4AF37; 
                }
                .payment-details { 
                    background: rgba(212, 175, 55, 0.1); 
                    padding: 20px; 
                    border-radius: 15px; 
                    margin: 20px 0; 
                }
                .wallet-address {
                    background: rgba(0, 0, 0, 0.5);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 15px 0;
                    font-family: 'Courier', monospace;
                    font-size: 14px;
                    word-break: break-all;
                    border: 1px solid #D4AF37;
                    text-align: center;
                }
                .footer { 
                    border-top: 1px solid #333; 
                    padding-top: 20px; 
                    margin-top: 30px; 
                    text-align: center; 
                    color: #666; 
                    font-size: 12px; 
                }
                ul { padding-left: 20px; }
                li { margin-bottom: 8px; }
                h3 { color: #D4AF37; margin-bottom: 15px; }
                .warning { color: #ff9800; font-weight: 600; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">NORX</div>
                <div class="title">💳 Pagamento Iniciado</div>
                
                <div class="protocol">
                    <div>Protocolo de Pagamento:</div>
                    <div style="font-size: 28px; font-weight: 900; color: #D4AF37; margin: 10px 0;">${paymentData.ticketId}</div>
                    <div style="font-size: 14px; opacity: 0.8;">Guarde este número para acompanhar seu pagamento</div>
                </div>
                
                <div class="content">
                    <p>Olá <strong>${paymentData.userName}</strong>,</p>
                    
                    <p>Seu pagamento foi iniciado com sucesso. Siga as instruções abaixo para completar:</p>
                    
                    <div class="payment-details">
                        <h3>💰 Detalhes do Pagamento:</h3>
                        <ul>
                            <li><strong>Serviço:</strong> ${paymentData.serviceName}</li>
                            <li><strong>Período:</strong> ${paymentData.period}</li>
                            <li><strong>Valor:</strong> ${paymentData.displayAmount}</li>
                            <li><strong>Método:</strong> ${paymentData.paymentMethod.toUpperCase()}</li>
                        </ul>
                        
                        <h3>📍 Endereço para Pagamento:</h3>
                        <div class="wallet-address">${paymentData.walletAddress}</div>
                        
                        ${paymentData.tokensNeeded > 0 ? `
                            <h3>🪙 Tokens NORX Necessários:</h3>
                            <div style="text-align: center; font-size: 20px; font-weight: bold; color: #D4AF37;">
                                ${paymentData.tokensNeeded.toLocaleString()} NORX
                            </div>
                        ` : ''}
                    </div>
                    
                    <p class="warning">⚠️ Importante: Após realizar o pagamento, entre em contato conosco para ativação:</p>
                    <ul>
                        <li>📱 <strong>WhatsApp:</strong> (22) 99754-7731</li>
                        <li>💬 <strong>Telegram:</strong> @norxcompanyoficial</li>
                    </ul>
                </div>
                
                <div class="footer">
                    <p><strong>NORX COMPANY</strong> - Processamento de pagamentos</p>
                    <p>Para suporte, responda este email com seu protocolo: <strong>${paymentData.ticketId}</strong></p>
                </div>
            </div>
        </body>
        </html>
    `
};

module.exports = {
    sendEmail,
    emailTemplates,
    initializeEmailTransporter
};