// 📝 SISTEMA DE LOGGING SIMPLIFICADO
// ===================================

// ===================================
// LOGGER SIMPLES
// ===================================

class SimpleLogger {
    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const color = this.getColor(level);
        const reset = '\x1b[0m';
        
        console.log(`${color}[${timestamp}] ${level}: ${message}${reset}`, 
                   Object.keys(meta).length > 0 ? meta : '');
    }
    
    getColor(level) {
        const colors = {
            ERROR: '\x1b[31m', // Vermelho
            WARN: '\x1b[33m',  // Amarelo
            INFO: '\x1b[36m',  // Ciano
            DEBUG: '\x1b[35m'  // Magenta
        };
        return colors[level] || '\x1b[0m';
    }
    
    error(message, meta = {}) {
        this.log('ERROR', message, meta);
    }
    
    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }
    
    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }
    
    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }
}

const logger = new SimpleLogger();

// ===================================
// MIDDLEWARE DE LOGGING HTTP
// ===================================

const httpLoggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id || null
        };
        
        if (res.statusCode >= 500) {
            logger.error(`HTTP ${res.statusCode}`, logData);
        } else if (res.statusCode >= 400) {
            logger.warn(`HTTP ${res.statusCode}`, logData);
        } else {
            logger.info(`HTTP ${res.statusCode}`, logData);
        }
        
        return originalSend.call(this, data);
    };
    
    next();
};

// ===================================
// FUNÇÕES DE LOG DE AÇÕES
// ===================================

const logUserAction = async (userId, action, details = {}) => {
    try {
        logger.info(`Ação do usuário: ${action}`, {
            userId,
            action,
            details,
            timestamp: new Date().toISOString()
        });
        
        // Em produção, salvar no banco de dados
        // Por enquanto, apenas log no console
        
    } catch (error) {
        logger.error('Erro ao registrar ação do usuário', { error, userId, action });
    }
};

const logPaymentEvent = async (paymentId, event, details = {}) => {
    try {
        logger.info(`Evento de pagamento: ${event}`, {
            paymentId,
            event,
            details,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Erro ao registrar evento de pagamento', { error, paymentId, event });
    }
};

// ===================================
// EXPORTS
// ===================================

module.exports = {
    logger,
    httpLoggingMiddleware,
    logUserAction,
    logPaymentEvent
};