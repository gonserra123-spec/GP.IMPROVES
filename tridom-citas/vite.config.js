import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// App aparte de la del mecánico: solo el formulario de cita del cliente. Habla con la API de tridom-taller (VITE_API_URL).
export default defineConfig({ plugins: [react()], server: { port: 5400, strictPort: true }, build: { target: 'es2022' } });
