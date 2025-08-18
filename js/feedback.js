document.addEventListener('DOMContentLoaded', () => {
    const feedbackInput = document.querySelector('.feedback-input');
    const feedbackInputIcon = document.querySelector('.feedback-input-icon');
    const feedbackForm = document.querySelector('.feedback-form');
    const feedbackFormClose = document.querySelector('.feedback-form-close');
    const feedbackFormElement = document.getElementById('feedbackForm');
    const feedbackComments = document.getElementById('feedbackComments');
    const loadMoreButton = document.querySelector('.load-more-button');
    const loadLessButton = document.querySelector('.load-less-button');

    function toggleFeedbackForm() {
        feedbackForm.classList.toggle('active');
        if (feedbackForm.classList.contains('active')) {
            document.getElementById('nome').focus();
            // Remover widget Turnstile existente para evitar erro de multi-render
            if (turnstile) turnstile.remove('#cf-turnstile-response');
            // Renderizar Turnstile
            turnstile.render('#cf-turnstile-response', {
                sitekey: 'SEU_SITEKEY_VALIDO_AQUI', // Crie no dashboard Cloudflare (veja instruções abaixo)
                callback: (token) => {
                    console.log('Turnstile token gerado com sucesso:', token);
                    feedbackFormElement.querySelector('input[name="cf-turnstile-response"]').value = token;
                },
                'error-callback': () => {
                    console.error('Erro ao carregar Turnstile: Verifique sitekey, hostname no dashboard ou conexão. Código: 400020 indica sitekey inválido.');
                    alert('Erro ao carregar CAPTCHA. Verifique o console para detalhes e tente novamente.');
                }
            });
        } else {
            feedbackFormElement.reset();
            if (turnstile) turnstile.reset('#cf-turnstile-response');
        }
    }

    if (feedbackInput && feedbackInputIcon && feedbackForm && feedbackFormClose) {
        feedbackInput.addEventListener('click', toggleFeedbackForm);
        feedbackInputIcon.addEventListener('click', toggleFeedbackForm);
        feedbackFormClose.addEventListener('click', toggleFeedbackForm);
        feedbackForm.addEventListener('click', e => {
            if (e.target === feedbackForm) toggleFeedbackForm();
        });
        feedbackInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                toggleFeedbackForm();
            }
        });
        feedbackInputIcon.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFeedbackForm();
            }
        });
    }

    async function loadFeedbacks() {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/feedbacks', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const feedbacks = await response.json();
            if (feedbackComments) {
                feedbackComments.innerHTML = '';
                if (feedbacks.length === 0) {
                    feedbackComments.innerHTML = '<p>Nenhum feedback disponível.</p>';
                } else {
                    feedbacks.forEach((feedback, index) => {
                        const feedbackElement = document.createElement('div');
                        feedbackElement.classList.add('feedback-comment');
                        if (index >= 3) feedbackElement.classList.add('hidden');
                        feedbackElement.innerHTML = `
                            <span>${feedback.nome_user}</span>
                            <p class="text-email">${feedback.email_user}</p>
                            <p>${feedback.mensagem_feedback}</p>
                        `;
                        feedbackComments.appendChild(feedbackElement);
                        const fadeObserver = new IntersectionObserver(entries => {
                            entries.forEach(entry => {
                                if (entry.isIntersecting) entry.target.classList.add('fade-in-up');
                            });
                        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
                        fadeObserver.observe(feedbackElement);
                    });
                }
                updateFeedbackVisibility();
            }
        } catch (error) {
            console.error('Erro ao carregar feedbacks:', error);
            if (feedbackComments) {
                feedbackComments.innerHTML = '<p>Erro ao carregar feedbacks. Verifique o backend.</p>';
            }
        }
    }

    if (feedbackFormElement) {
        feedbackFormElement.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(feedbackFormElement);
            const data = {
                nome_user: formData.get('nome'),
                email_user: formData.get('email'),
                mensagem_feedback: formData.get('mensagem')
            };
            const turnstileToken = formData.get('cf-turnstile-response');

            if (!data.nome_user || !data.email_user || !data.mensagem_feedback || !turnstileToken) {
                alert('Por favor, preencha todos os campos e complete a validação de segurança.');
                return;
            }

            try {
                const csrfResponse = await fetch('http://127.0.0.1:5000/api/csrf-token', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (!csrfResponse.ok) {
                    throw new Error('Falha ao obter token CSRF');
                }
                const csrfData = await csrfResponse.json();
                const csrfToken = csrfData.csrf_token;

                const response = await fetch('http://127.0.0.1:5000/api/feedbacks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken,
                        'cf-turnstile-response': turnstileToken
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    alert('Feedback enviado com sucesso!');
                    feedbackFormElement.reset();
                    feedbackForm.classList.remove('active');
                    turnstile.reset('#cf-turnstile-response');
                    loadFeedbacks();
                } else {
                    alert(`Erro ao enviar feedback: ${result.error}`);
                }
            } catch (error) {
                console.error('Erro ao enviar feedback:', error);
                alert('Erro ao enviar feedback. Tente novamente. Verifique o console.');
            }
        });
    }

    function updateFeedbackVisibility() {
        const feedbackItems = feedbackComments.querySelectorAll('.feedback-comment');
        const visibleCount = feedbackComments.querySelectorAll('.feedback-comment:not(.hidden)').length;
        loadMoreButton.style.display = feedbackItems.length > visibleCount ? 'inline-flex' : 'none';
        loadLessButton.style.display = visibleCount > 3 ? 'inline-flex' : 'none';
    }

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', () => {
            const hiddenFeedbacks = feedbackComments.querySelectorAll('.feedback-comment.hidden');
            hiddenFeedbacks.forEach((feedback, index) => {
                if (index < 3) feedback.classList.remove('hidden');
            });
            updateFeedbackVisibility();
        });
    }

    if (loadLessButton) {
        loadLessButton.addEventListener('click', () => {
            const visibleFeedbacks = feedbackComments.querySelectorAll('.feedback-comment:not(.hidden)');
            visibleFeedbacks.forEach((feedback, index) => {
                if (index >= 3) feedback.classList.add('hidden');
            });
            updateFeedbackVisibility();
        });
    }

    loadFeedbacks();
});