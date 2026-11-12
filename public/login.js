document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Usuario = 'cedula'
    const cedula = document.getElementById('cedula').value;
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        const respuesta = await fetch('/obras/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Enviamos 'cedula' en el cuerpo JSON de la petición
            body: JSON.stringify({ cedula, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Guardamos un "pase" en el navegador indicando que ya inició sesión
            localStorage.setItem('autenticado', 'true');
            
            localStorage.setItem('rol', resultado.rol);

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