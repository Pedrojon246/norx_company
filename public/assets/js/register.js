
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

        // Checkbox personalizado
        function setupCustomCheckboxes() {
            const checkboxes = document.querySelectorAll('.custom-checkbox');
            
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('click', function() {
                    this.classList.toggle('checked');
                    validateForm();
                });
            });
        }

        // Validação do formulário
        function validateForm() {
            const form = document.getElementById('registerForm');
            const termsChecked = document.getElementById('termsCheckbox').classList.contains('checked');
            const submitBtn = document.getElementById('submitBtn');
            
            const requiredFields = form.querySelectorAll('input[required], select[required]');
            let allFieldsFilled = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    allFieldsFilled = false;
                }
            });
            
            // Validar senhas iguais
            const password = form.querySelector('input[name="password"]').value;
            const confirmPassword = form.querySelector('input[name="confirmPassword"]').value;
            const passwordsMatch = password === confirmPassword && password.length >= 6;
            
            // Habilitar botão apenas se tudo estiver preenchido
            if (allFieldsFilled && termsChecked && passwordsMatch) {
                submitBtn.disabled = false;
            } else {
                submitBtn.disabled = true;
            }
        }

        // Máscara para CPF
        function formatCPF(value) {
            return value
                .replace(/\D/g, '')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})/, '$1-$2')
                .replace(/(-\d{2})\d+?$/, '$1');
        }

        // Máscara para telefone
        function formatPhone(value) {
            return value
                .replace(/\D/g, '')
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .replace(/(-\d{4})\d+?$/, '$1');
        }

        // Aplicar máscaras
        function setupMasks() {
            const cpfInput = document.querySelector('input[name="cpf"]');
            const phoneInput = document.querySelector('input[name="phone"]');
            
            cpfInput.addEventListener('input', function(e) {
                e.target.value = formatCPF(e.target.value);
                validateForm();
            });
            
            phoneInput.addEventListener('input', function(e) {
                e.target.value = formatPhone(e.target.value);
                validateForm();
            });
        }

        // Validação em tempo real
        function setupRealTimeValidation() {
            const form = document.getElementById('registerForm');
            const inputs = form.querySelectorAll('input, select');
            
            inputs.forEach(input => {
                input.addEventListener('input', validateForm);
                input.addEventListener('change', validateForm);
            });
        }

        // Submissão do formulário
        function handleFormSubmit() {
            const form = document.getElementById('registerForm');
            
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Coletar dados do formulário
                const formData = new FormData(form);
                const userData = Object.fromEntries(formData);
                
                // Adicionar dados extras
                userData.marketing = document.getElementById('marketingCheckbox').classList.contains('checked');
                userData.registrationDate = new Date().toISOString();
                userData.id = 'user_' + Date.now();
                
                // Simular salvamento (substituir por integração real)
                console.log('Dados do usuário:', userData);
                
                // Simular envio de email
                setTimeout(() => {
                    showSuccessModal();
                }, 1000);
            });
        }

        // Mostrar modal de sucesso
        function showSuccessModal() {
            document.getElementById('successModal').classList.add('active');
        }

        // Redirecionar para login
        function redirectToLogin() {
            window.location.href = 'login.html';
        }

        // Inicializar
        document.addEventListener('DOMContentLoaded', function() {
            createParticles();
            setupCustomCheckboxes();
            setupMasks();
            setupRealTimeValidation();
            handleFormSubmit();
            
            // Fechar modal ao clicar fora
            document.getElementById('successModal').addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        });

        // Validações específicas
        document.querySelector('input[name="email"]').addEventListener('blur', function() {
            const email = this.value;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email && !emailRegex.test(email)) {
                this.style.borderColor = '#f44336';
                setTimeout(() => {
                    this.style.borderColor = 'rgba(212, 175, 55, 0.3)';
                }, 2000);
            }
        });

        document.querySelector('input[name="confirmPassword"]').addEventListener('blur', function() {
            const password = document.querySelector('input[name="password"]').value;
            const confirmPassword = this.value;
            
            if (confirmPassword && password !== confirmPassword) {
                this.style.borderColor = '#f44336';
                setTimeout(() => {
                    this.style.borderColor = 'rgba(212, 175, 55, 0.3)';
                }, 2000);
            }
        });
