document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();

    const cedula = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        const respuesta = await fetch('/obras/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cedula, usuario: cedula, password })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            // Guardamos el pase de autenticación
            localStorage.setItem('autenticado', 'true');
            
            // El rol viene dentro del objeto 'usuario'
            if (resultado.usuario && resultado.usuario.rol !== undefined) {
                localStorage.setItem('rol', resultado.usuario.rol);
            }

            // Redirigimos al panel de administración
            window.location.href = '/admin';
        } else {
            mensajeError.textContent = resultado.mensaje || 'Credenciales incorrectas';
        }
    } catch (error) {
        console.error('Error en el login:', error);
        mensajeError.textContent = 'Hubo un error al conectar con el servidor';
    }
});