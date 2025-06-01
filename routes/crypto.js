// 📈 ROTAS DE MONITORAMENTO CRYPTO
// =================================

const express = require('express');
const { cryptoService, getCurrentPrices, convertCurrency, verifyTransaction } = require('../config/services');
const { optionalAuthMiddleware } = require('../middleware/auth');
const { logger } = require('../middleware/logging');

const router = express.Router();

// ================================
// PREÇOS ATUAIS
// ================================

router.get('/prices', async (req, res) => {
    try {
        const prices = await getCurrentPrices();
        
        res.json({
            success: true,
            data: {
                prices,
                timestamp: new Date().toISOString(),
                source: 'coingecko'
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter preços', { error });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível obter cotações atuais',
            code: 'PRICES_FETCH_ERROR'
        });
    }
});

// ================================
// PREÇO DE MOEDA ESPECÍFICA
// ================================

router.get('/prices/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const currency = req.query.currency || 'usd';
        
        const prices = await getCurrentPrices();
        const coinPrice = prices[symbol.toLowerCase()];
        
        if (!coinPrice) {
            return res.status(404).json({
                error: 'Moeda não encontrada',
                message: `Preço para ${symbol} não disponível`,
                code: 'COIN_NOT_FOUND'
            });
        }
        
        res.json({
            success: true,
            data: {
                symbol: symbol.toUpperCase(),
                price: coinPrice[currency.toLowerCase()] || coinPrice.usd,
                currency: currency.toUpperCase(),
                change_24h: coinPrice.change_24h,
                market_cap: coinPrice.market_cap_usd,
                volume_24h: coinPrice.volume_24h_usd,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter preço específico', { error, symbol: req.params.symbol });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível obter cotação',
            code: 'PRICE_FETCH_ERROR'
        });
    }
});

// ================================
// CONVERSÃO DE MOEDAS
// ================================

router.get('/convert', async (req, res) => {
    try {
        const { amount, from, to } = req.query;
        
        if (!amount || !from || !to) {
            return res.status(400).json({
                error: 'Parâmetros inválidos',
                message: 'Informe amount, from e to',
                code: 'MISSING_PARAMETERS'
            });
        }
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({
                error: 'Valor inválido',
                message: 'Amount deve ser um número positivo',
                code: 'INVALID_AMOUNT'
            });
        }
        
        const convertedAmount = await convertCurrency(amountNum, from, to);
        
        res.json({
            success: true,
            data: {
                original: {
                    amount: amountNum,
                    currency: from.toUpperCase()
                },
                converted: {
                    amount: convertedAmount,
                    currency: to.toUpperCase()
                },
                rate: convertedAmount / amountNum,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Erro na conversão', { error, query: req.query });
        res.status(400).json({
            error: 'Erro na conversão',
            message: error.message,
            code: 'CONVERSION_ERROR'
        });
    }
});

// ================================
// HISTÓRICO DE PREÇOS
// ================================

router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const days = parseInt(req.query.days) || 7;
        
        if (days < 1 || days > 365) {
            return res.status(400).json({
                error: 'Período inválido',
                message: 'Days deve estar entre 1 e 365',
                code: 'INVALID_PERIOD'
            });
        }
        
        const history = await cryptoService.getPriceHistory(symbol, days);
        
        if (!history) {
            return res.status(404).json({
                error: 'Histórico não encontrado',
                message: `Histórico para ${symbol} não disponível`,
                code: 'HISTORY_NOT_FOUND'
            });
        }
        
        // Formatar dados para gráfico
        const chartData = history.prices.map((price, index) => ({
            timestamp: price[0],
            date: new Date(price[0]).toISOString(),
            price: price[1],
            volume: history.total_volumes[index] ? history.total_volumes[index][1] : 0,
            market_cap: history.market_caps[index] ? history.market_caps[index][1] : 0
        }));
        
        res.json({
            success: true,
            data: {
                symbol: symbol.toUpperCase(),
                period: `${days} days`,
                data: chartData,
                summary: {
                    first_price: chartData[0]?.price || 0,
                    last_price: chartData[chartData.length - 1]?.price || 0,
                    highest: Math.max(...chartData.map(d => d.price)),
                    lowest: Math.min(...chartData.map(d => d.price)),
                    change_percent: chartData.length > 1 
                        ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100)
                        : 0
                }
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter histórico', { error, symbol: req.params.symbol });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível obter histórico',
            code: 'HISTORY_FETCH_ERROR'
        });
    }
});

// ================================
// VERIFICAR TRANSAÇÃO
// ================================

router.post('/verify-transaction', 
    optionalAuthMiddleware,
    async (req, res) => {
        try {
            const { hash, network } = req.body;
            
            if (!hash) {
                return res.status(400).json({
                    error: 'Hash obrigatório',
                    message: 'Informe o hash da transação',
                    code: 'MISSING_HASH'
                });
            }
            
            const verification = await verifyTransaction(hash, network);
            
            // Log da verificação (se usuário autenticado)
            if (req.user) {
                logger.info('Transação verificada por usuário', {
                    userId: req.user.id,
                    hash,
                    network,
                    valid: verification.valid
                });
            }
            
            res.json({
                success: true,
                data: verification
            });
            
        } catch (error) {
            logger.error('Erro ao verificar transação', { error, body: req.body });
            res.status(500).json({
                error: 'Erro interno',
                message: 'Não foi possível verificar transação',
                code: 'TRANSACTION_VERIFY_ERROR'
            });
        }
    }
);

// ================================
// INFORMAÇÕES DA NORXCOIN
// ================================

router.get('/norxcoin', async (req, res) => {
    try {
        const prices = await getCurrentPrices();
        const norxcoinData = prices.norxcoin || {
            usd: 0.025,
            brl: 0.1375,
            change_24h: 15.5,
            market_cap_usd: 25000000,
            volume_24h_usd: 500000
        };
        
        // Dados específicos da NORXCOIN
        const norxcoinInfo = {
            name: 'NORXCOIN',
            symbol: 'NORX',
            network: 'BSC (BEP20)',
            contract: process.env.NORX_CONTRACT || '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1',
            
            price: norxcoinData,
            
            supply: {
                total: 1000000000, // 1 bilhão
                circulating: 250000000, // 250 milhões
                burned: 50000000 // 50 milhões queimados
            },
            
            features: [
                'Pagamentos instantâneos',
                'Taxa zero nas transações NORX',
                'Staking com APY de até 20%',
                'Cashback em compras',
                'Governança descentralizada'
            ],
            
            links: {
                website: 'https://norxcompany.com.br',
                whitepaper: 'https://norxcompany.com.br/whitepaper.pdf',
                github: 'https://github.com/norxcompany/norxcoin',
                telegram: 'https://t.me/norxcompany',
                twitter: 'https://twitter.com/norxcompany'
            },
            
            stats: {
                holders: 15000,
                transactions_24h: 2500,
                partnerships: 50,
                exchanges: 5
            }
        };
        
        res.json({
            success: true,
            data: norxcoinInfo
        });
        
    } catch (error) {
        logger.error('Erro ao obter info NORXCOIN', { error });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível obter informações da NORXCOIN',
            code: 'NORXCOIN_INFO_ERROR'
        });
    }
});

// ================================
// RANKINGS DE CRYPTO
// ================================

router.get('/rankings', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const sort = req.query.sort || 'market_cap'; // market_cap, volume, change
        
        const prices = await getCurrentPrices();
        
        // Converter para array e adicionar dados
        const cryptos = Object.entries(prices).map(([symbol, data]) => ({
            symbol: symbol.toUpperCase(),
            name: getCryptoName(symbol),
            price_usd: data.usd,
            price_brl: data.brl,
            change_24h: data.change_24h,
            market_cap: data.market_cap_usd,
            volume_24h: data.volume_24h_usd
        }));
        
        // Ordenar
        cryptos.sort((a, b) => {
            switch (sort) {
                case 'volume':
                    return (b.volume_24h || 0) - (a.volume_24h || 0);
                case 'change':
                    return (b.change_24h || 0) - (a.change_24h || 0);
                default:
                    return (b.market_cap || 0) - (a.market_cap || 0);
            }
        });
        
        res.json({
            success: true,
            data: {
                rankings: cryptos.slice(0, limit),
                sort,
                total: cryptos.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        logger.error('Erro ao obter rankings', { error });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível obter rankings',
            code: 'RANKINGS_FETCH_ERROR'
        });
    }
});

// ================================
// CALCULADORA DE INVESTIMENTO
// ================================

router.get('/calculator', async (req, res) => {
    try {
        const { amount, coin, months } = req.query;
        
        if (!amount || !coin || !months) {
            return res.status(400).json({
                error: 'Parâmetros obrigatórios',
                message: 'Informe amount, coin e months',
                code: 'MISSING_PARAMETERS'
            });
        }
        
        const amountNum = parseFloat(amount);
        const monthsNum = parseInt(months);
        
        if (isNaN(amountNum) || amountNum <= 0 || isNaN(monthsNum) || monthsNum <= 0) {
            return res.status(400).json({
                error: 'Valores inválidos',
                message: 'Amount e months devem ser números positivos',
                code: 'INVALID_VALUES'
            });
        }
        
        const prices = await getCurrentPrices();
        const coinData = prices[coin.toLowerCase()];
        
        if (!coinData) {
            return res.status(404).json({
                error: 'Moeda não encontrada',
                code: 'COIN_NOT_FOUND'
            });
        }
        
        // Simulação de crescimento (baseado em histórico simulado)
        const monthlyGrowthRates = {
            bitcoin: 0.08, // 8% ao mês (histórico otimista)
            ethereum: 0.10, // 10% ao mês
            norxcoin: 0.15, // 15% ao mês (coin nova com potencial)
            usdt: 0.01 // 1% ao mês (stablecoin com staking)
        };
        
        const monthlyRate = monthlyGrowthRates[coin.toLowerCase()] || 0.05;
        const finalAmount = amountNum * Math.pow(1 + monthlyRate, monthsNum);
        const totalReturn = finalAmount - amountNum;
        const returnPercentage = (totalReturn / amountNum) * 100;
        
        // Projeção mensal
        const monthlyProjection = [];
        let currentAmount = amountNum;
        
        for (let i = 1; i <= monthsNum; i++) {
            currentAmount = currentAmount * (1 + monthlyRate);
            monthlyProjection.push({
                month: i,
                amount: Math.round(currentAmount * 100) / 100,
                profit: Math.round((currentAmount - amountNum) * 100) / 100
            });
        }
        
        res.json({
            success: true,
            data: {
                investment: {
                    amount: amountNum,
                    coin: coin.toUpperCase(),
                    period: `${monthsNum} months`,
                    current_price: coinData.usd
                },
                projection: {
                    final_amount: Math.round(finalAmount * 100) / 100,
                    total_return: Math.round(totalReturn * 100) / 100,
                    return_percentage: Math.round(returnPercentage * 100) / 100,
                    monthly_rate: Math.round(monthlyRate * 100 * 100) / 100
                },
                monthly_breakdown: monthlyProjection,
                disclaimer: 'Esta é apenas uma simulação baseada em projeções. Investimentos em criptomoedas envolvem riscos.'
            }
        });
        
    } catch (error) {
        logger.error('Erro na calculadora', { error, query: req.query });
        res.status(500).json({
            error: 'Erro interno',
            message: 'Não foi possível calcular projeção',
            code: 'CALCULATOR_ERROR'
        });
    }
});

// ================================
// UTILITÁRIOS
// ================================

function getCryptoName(symbol) {
    const names = {
        bitcoin: 'Bitcoin',
        ethereum: 'Ethereum',
        tether: 'Tether',
        usdt: 'Tether',
        binancecoin: 'BNB',
        norxcoin: 'NORXCOIN'
    };
    
    return names[symbol.toLowerCase()] || symbol.toUpperCase();
}

module.exports = router;