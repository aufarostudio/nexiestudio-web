// Variables de entorno (REEMPLAZAR CON TUS DATOS REALES)
const SUPABASE_URL = 'https://vhcazxvzesnzdpftjlwg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoY2F6eHZ6ZXNuemRwZnRqbHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjUyMDIsImV4cCI6MjA3OTg0MTIwMn0.Ol6-V8G0qnuRdTcKKs7hmAK8twcevGjXd7QwVvDYBhk';

// Inicializar cliente de Supabase
// Se asume que la librería se carga vía CDN y expone el objeto global 'supabase'
let _supabase;

if (typeof supabase !== 'undefined') {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase inicializado correctamente.');
} else {
    console.error('La librería de Supabase no se ha cargado. Asegúrate de incluir el script del CDN.');
}
