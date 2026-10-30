document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value;
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        const respuesta = await fetch('/obras/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usuario, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Guardamos un "pase" en el navegador indicando que ya inició sesión
            localStorage.setItem('autenticado', 'true');
            // Redirigimos al panel de administración
            window.location.href = '/admin.html';
        } else {
            mensajeError.textContent = resultado.mensaje || 'Credenciales incorrectas';
        }
    } catch (error) {
        console.error('Error en el login:', error);
        mensajeError.textContent = 'Hubo un error al conectar con el servidor';
    }
});