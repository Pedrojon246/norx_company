
        // Timer de contagem regressiva
        function startCountdown() {
            // Data de lançamento: 10 de junho de 2025, 00:00:00
            const launchDate = new Date('2025-06-10T00:00:00').getTime();
            
            function updateTimer() {
                const now = new Date().getTime();
                const distance = launchDate - now;
                
                if (distance < 0) {
                    // Lançamento aconteceu
                    document.getElementById('days').textContent = '00';
                    document.getElementById('hours').textContent = '00';
                    document.getElementById('minutes').textContent = '00';
                    document.getElementById('seconds').textContent = '00';
                    
                    // Mostrar mensagem de lançado
                    document.querySelector('.launch-title').textContent = '🎉 NORXCOIN LANÇADO!';
                    return;
                }
                
                // Calcular tempo restante
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                
                // Atualizar display
                document.getElementById('days').textContent = days.toString().padStart(2, '0');
                document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
                document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
                document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
            }
            
            // Atualizar imediatamente e depois a cada segundo
            updateTimer();
            setInterval(updateTimer, 1000);
        }

        // Smooth scroll para âncoras
        function setupSmoothScroll() {
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                });
            });
        }

        // Animações ao scroll
        function setupScrollAnimations() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            // Observar elementos que devem animar
            document.querySelectorAll('.tech-card, .tokenomics-item, .airdrop-step, .roadmap-item').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                observer.observe(el);
            });
        }

        // Copiar endereço do contrato
        function copyContract() {
            const contractAddress = '0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1';
            navigator.clipboard.writeText(contractAddress).then(() => {
                alert('Endereço do contrato copiado!');
            });
        }

        // Inicializar quando a página carregar
        document.addEventListener('DOMContentLoaded', function() {
            startCountdown();
            setupSmoothScroll();
            setupScrollAnimations();
            
            // Adicionar clique no endereço do contrato
            document.addEventListener('click', function(e) {
                if (e.target.textContent && e.target.textContent.includes('0x69BCFbC6533C94350D2EbCe457758D17dAbdB1b1')) {
                    copyContract();
                }
            });
        });
    