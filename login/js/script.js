document.addEventListener('DOMContentLoaded', function () {
    // Initialize Materialize components
    M.AutoInit();

    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        let isValid = true;

        // Validate Email
        const emailValue = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailValue) {
            showError('El correo es obligatorio');
            emailInput.classList.add('invalid');
            isValid = false;
        } else if (!emailRegex.test(emailValue)) {
            showError('Formato de correo inválido');
            emailInput.classList.add('invalid');
            isValid = false;
        } else {
            emailInput.classList.remove('invalid');
            emailInput.classList.add('valid');
        }

        // Validate Password
        const passwordValue = passwordInput.value.trim();

        if (!passwordValue) {
            showError('La contraseña es obligatoria');
            passwordInput.classList.add('invalid');
            isValid = false;
        } else if (passwordValue.length < 3) {
            showError('La contraseña debe tener al menos 3 caracteres');
            passwordInput.classList.add('invalid');
            isValid = false;
        } else {
            passwordInput.classList.remove('invalid');
            passwordInput.classList.add('valid');
        }

        if (isValid) {
            // UI Loading State
            const loginBtn = document.querySelector('button[type="submit"]');
            const originalText = loginBtn.innerHTML;
            loginBtn.disabled = true;
            loginBtn.innerHTML = 'Cargando...';

            // Attempt Login
            auth.login(emailValue, passwordValue).then(result => {
                if (result.error) {
                    showError(result.error.message || 'Error al iniciar sesión');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalText;
                } else {
                    M.toast({ html: 'Login correcto. Redirigiendo...', classes: 'green rounded' });
                    setTimeout(() => {
                        window.location.href = '../admin/index.html';
                    }, 1000);
                }
            });
        }
    });

    function showError(message) {
        M.toast({ html: message, classes: 'red rounded', displayLength: 3000 });
    }

    // Clear validation classes on input
    emailInput.addEventListener('input', function () {
        this.classList.remove('invalid');
    });

    passwordInput.addEventListener('input', function () {
        this.classList.remove('invalid');
    });
});
