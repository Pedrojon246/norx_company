
        // Criar partículas
        function createParticles() {
            const particles = document.getElementById('particles');
            
            for (let i = 0; i < 50; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (Math.random() * 3 + 4) + 's';
                particles.appendChild(particle);
            }
        }

        // Função para criar som de moedas (sintético)
        function playMoneySound() {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Som de caixa registradora
            function createCashRegisterSound() {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
                oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.3);
            }
            
            // Som de moedas caindo
            function createCoinSound(delay) {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(1200 + Math.random() * 400, audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
                    
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.1);
                }, delay);
            }
            
            // Tocar sons
            createCashRegisterSound();
            
            // Moedas caindo em sequência
            for (let i = 0; i < 15; i++) {
                createCoinSound(i * 100 + 500);
            }
        }

        // Criar chuva de moedas
        function createMoneyRain() {
            const moneyRain = document.getElementById('moneyRain');
            const coins = ['💰', '🪙', '💎', '💵', '💳'];
            
            for (let i = 0; i < 25; i++) {
                setTimeout(() => {
                    const coin = document.createElement('div');
                    coin.className = 'coin';
                    coin.textContent = coins[Math.floor(Math.random() * coins.length)];
                    coin.style.left = Math.random() * 100 + '%';
                    coin.style.animationDelay = Math.random() * 0.5 + 's';
                    moneyRain.appendChild(coin);
                    
                    setTimeout(() => {
                        coin.remove();
                    }, 2500);
                }, i * 80);
            }
        }

        // Animação ÉPICA de login
        function showEpicLoginAnimation() {
            const successAnimation = document.getElementById('successAnimation');
            
            // Mostrar animação
            successAnimation.classList.add('active');
            
            // Tocar som de dinheiro
            setTimeout(playMoneySound, 800);
            
            // Criar chuva de moedas
            setTimeout(createMoneyRain, 1200);
            
            // Esconder e redirecionar após 4 segundos
            setTimeout(() => {
                successAnimation.classList.remove('active');
                
                // Aqui você redirecionaria para o dashboard
                window.location.href = 'dashboard.html';
                
            }, 4000);
        }

        // Event listeners
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;
            
            // Validação básica
            if (!email || !password) {
                alert('Por favor, preencha todos os campos!');
                return;
            }
            
            // Mostrar loading
            const submitBtn = e.target.querySelector('.login-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Entrando...';
            submitBtn.disabled = true;
            
            try {
                // Fazer requisição para API
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Salvar dados do usuário
                    localStorage.setItem('norx_user', JSON.stringify(data.user));
                    
                    // Mostrar animação épica
                    showEpicLoginAnimation();
                } else {
                    // Mostrar erro
                    alert(data.message || 'Erro ao fazer login');
                    
                    // Restaurar botão
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
                
            } catch (error) {
                console.error('Erro no login:', error);
                alert('Erro de conexão. Tente novamente.');
                
                // Restaurar botão
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });

        // Atualizar preços do ticker (simulado)
        function updateTicker() {
            const prices = document.querySelectorAll('.ticker-price');
            
            prices.forEach(price => {
                if (price.style.color === 'rgb(212, 175, 55)') return; // Não atualizar NORX
                
                const currentValue = parseFloat(price.textContent.replace(/[^\d.-]/g, ''));
                const change = (Math.random() - 0.5) * 0.01; // Variação de -0.5% a +0.5%
                const newValue = currentValue * (1 + change);
                
                // Atualizar valor
                if (price.textContent.includes('.')) {
                    price.textContent = newValue.toFixed(4);
                } else {
                    price.textContent = Math.round(newValue).toLocaleString();
                }
                
                // Atualizar cor
                if (change > 0) {
                    price.className = 'ticker-price up';
                } else {
                    price.className = 'ticker-price down';
                }
            });
        }

        // Inicializar
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            
            // Atualizar ticker a cada 5 segundos
            setInterval(updateTicker, 5000);
        });

        // Efeito de digitação no placeholder
        function typeWriter(element, text, speed = 100) {
            let i = 0;
            element.placeholder = '';
            
            function type() {
                if (i < text.length) {
                    element.placeholder += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                }
            }
            
            type();
        }

        // Aplicar efeito de digitação aos inputs
        setTimeout(() => {
            const inputs = document.querySelectorAll('.form-input');
            typeWriter(inputs[0], '📧 Seu e-mail', 50);
            setTimeout(() => {
                typeWriter(inputs[1], '🔒 Sua senha', 50);
            }, 1000);
        }, 1000);
    