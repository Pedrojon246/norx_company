// 📧 SERVIÇO DE EMAIL SIMPLIFICADO
// =================================

// =================================
// EMAIL SIMULADO PARA TESTE
// =================================

const sendEmail = async (to, subject, htmlContent) => {
    try {
        console.log(`📧 Email simulado enviado:`);
        console.log(`   Para: ${to}`);
        console.log(`   Assunto: ${subject}`);
        console.log(`   Conteúdo: ${htmlContent.slice(0, 100)}...`);
        
        // Simular delay de envio
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return { 
            success: true, 
            messageId: `mock_${Date.now()}@norx.com` 
        };
        
    } catch (error) {
        console.error('🔴 Erro simulado ao enviar email:', error);
        throw error;
    }
};

// =================================
// TEMPLATES SIMPLES
// =================================

const getSimpleTemplate = (title, content) => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <h1>${title}</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                ${content}
            </div>
            <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
                <p>NORX Company - ${new Date().getFullYear()}</p>
            </div>
        </div>
    `;
};

// =================================
// EMAILS ESPECÍFICOS
// =================================

const sendWelcomeEmail = async (email, name, referralCode) => {
    const subject = '🔥 Bem-vindo à NORX Company!';
    const content = `
        <h2>Olá, ${name}! 👋</h2>
        <p>Sua conta foi criada com sucesso!</p>
        <p><strong>Seu código de indicação:</strong> ${referralCode || 'NORX' + Date.now().toString().slice(-6)}</p>
        <p>Agora você pode começar a investir e ganhar dinheiro!</p>
    `;
    const html = getSimpleTemplate('Bem-vindo!', content);
    return sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, name, resetUrl) => {
    const subject = '🔐 Redefinir sua senha - NORX Company';
    const content = `
        <h2>Olá, ${name}!</h2>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><a href="${resetUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir Senha</a></p>
        <p><small>Este link expira em 1 hora.</small></p>
    `;
    const html = getSimpleTemplate('Redefinir Senha', content);
    return sendEmail(email, subject, html);
};

const sendPaymentInstructionsEmail = async (email, userName, paymentData) => {
    const subject = `💰 Instruções de Pagamento #${paymentData.id}`;
    const content = `
        <h2>Olá, ${userName}!</h2>
        <p>Seu pagamento foi criado com sucesso!</p>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Pagamento #${paymentData.id}</strong><br>
            Valor: ${paymentData.currency} ${paymentData.totalAmount}<br>
            Método: ${paymentData.methodName}<br>
            Status: Aguardando pagamento
        </div>
        <p>Siga as instruções enviadas para completar o pagamento.</p>
    `;
    const html = getSimpleTemplate('Instruções de Pagamento', content);
    return sendEmail(email, subject, html);
};

const sendPaymentConfirmationEmail = async (email, userName, paymentData, newBalance) => {
    const subject = '🎉 Pagamento Confirmado - NORX Company';
    const content = `
        <h2>Parabéns, ${userName}! 🚀</h2>
        <p>Seu pagamento foi confirmado e processado!</p>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>✅ Pagamento Aprovado</strong><br>
            ID: #${paymentData.id}<br>
            Valor: ${paymentData.currency} ${paymentData.amount}<br>
            Novo saldo: R$ ${newBalance}
        </div>
        <p>O valor já está disponível em sua conta!</p>
    `;
    const html = getSimpleTemplate('Pagamento Confirmado!', content);
    return sendEmail(email, subject, html);
};

const sendPaymentConfirmationToAdmin = async (paymentData, confirmationData) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@norxcompany.com.br';
    const subject = `🔔 Nova Confirmação: Pagamento #${paymentData.id}`;
    const content = `
        <h2>Nova confirmação de pagamento</h2>
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <strong>Usuário:</strong> ${paymentData.userName} (${paymentData.userEmail})<br>
            <strong>Pagamento:</strong> #${paymentData.id}<br>
            <strong>Valor:</strong> ${paymentData.currency} ${paymentData.totalAmount}<br>
            <strong>Método:</strong> ${paymentData.methodName}
        </div>
        <p>Acesse o painel administrativo para analisar.</p>
    `;
    const html = getSimpleTemplate('Nova Confirmação', content);
    return sendEmail(adminEmail, subject, html);
};

// =================================
// TESTE DE CONECTIVIDADE
// =================================

const testEmailConnection = async () => {
    try {
        console.log('✅ Teste de email: Conexão simulada OK');
        return { success: true, message: 'Conexão simulada OK' };
    } catch (error) {
        console.error('🔴 Erro no teste de email:', error);
        return { success: false, error: error.message };
    }
};

// =================================
// EXPORTS
// =================================

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendPaymentInstructionsEmail,
    sendPaymentConfirmationEmail,
    sendPaymentConfirmationToAdmin,
    testEmailConnection
};