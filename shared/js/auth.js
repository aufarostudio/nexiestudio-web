// Funciones de Autenticación usando _supabase

const auth = {
    // Iniciar sesión con correo y contraseña
    async login(email, password) {
        if (!_supabase) {
            console.error('Supabase no está disponible');
            return { error: { message: 'Error de configuración del sistema' } };
        }

        try {
            const { data, error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;
            return { data, error: null };

        } catch (error) {
            console.error('Error en login:', error.message);
            return { data: null, error };
        }
    },

    // Cerrar sesión
    async logout() {
        if (!_supabase) return;

        const { error } = await _supabase.auth.signOut();
        if (error) {
            console.error('Error al cerrar sesión:', error.message);
        } else {
            console.log('Sesión cerrada');
            // Redirigir al login
            window.location.href = '../login/index.html';
        }
    },

    // Verificar sesión activa
    async checkSession() {
        if (!_supabase) return null;

        const { data: { session }, error } = await _supabase.auth.getSession();

        if (error || !session) {
            return null;
        }
        return session;
    },

    // Obtener usuario actual
    async getUser() {
        if (!_supabase) return null;
        const { data: { user } } = await _supabase.auth.getUser();
        return user;
    }
};
