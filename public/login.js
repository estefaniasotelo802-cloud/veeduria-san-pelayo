document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    const cedula = document.getElementById('cedula').value;
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        const respuesta = await fetch('/obras/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cedula, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Guardamos el pase de autenticación
            localStorage.setItem('autenticado', 'true');
            
            // Corregido: el rol viene dentro del objeto 'usuario'
            if (resultado.usuario && resultado.usuario.rol !== undefined) {
                localStorage.setItem('rol', resultado.usuario.rol);
            }

            // Redirigimos correctamente a la ruta del panel de administración en el router de obras
            window.location.href = '/obras/admin';
        } else {
            mensajeError.textContent = resultado.mensaje || 'Credenciales incorrectas';
        }
    } catch (error) {
        console.error('Error en el login:', error);
        mensajeError.textContent = 'Hubo un error al conectar con el servidor';
    }
});