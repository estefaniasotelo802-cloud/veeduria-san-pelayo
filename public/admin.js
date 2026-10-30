document.addEventListener('DOMContentLoaded', () => {
    const formObra = document.getElementById('formObra');
    const tablaAdminBody = document.getElementById('tablaAdminBody');

    // Función para cargar las obras en el panel de administración
    async function cargarObrasAdmin() {
        try {
            const respuesta = await fetch('/obras');
            const obras = await respuesta.json();
            
            tablaAdminBody.innerHTML = '';
            obras.forEach(obra => {
                const fila = document.createElement('tr');
                fila.style.borderBottom = '1px solid #e2e8f0';
                fila.innerHTML = `
                    <td style="padding: 10px;">${obra.id}</td>
                    <td style="padding: 10px;">${obra.nombre}</td>
                    <td style="padding: 10px;">${obra.sector}</td>
                    <td style="padding: 10px;">
                        <button onclick="eliminarObra(${obra.id})" style="background-color: #e53e3e; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>
                    </td>
                `;
                tablaAdminBody.appendChild(fila);
            });
        } catch (error) {
            console.error('Error al cargar las obras:', error);
        }
    }

    // Registrar nueva obra
    formObra.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nuevaObra = {
            nombre: document.getElementById('nombre').value,
            sector: document.getElementById('sector').value,
            presupuesto: document.getElementById('presupuesto').value,
            estado: document.getElementById('estado').value,
            avance_porcentaje: document.getElementById('avance_porcentaje').value
        };

        try {
            const respuesta = await fetch('/obras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevaObra)
            });

            if (respuesta.ok) {
                alert('¡Obra registrada exitosamente!');
                formObra.reset();
                cargarObrasAdmin(); // Recargamos la tabla automáticamente
            } else {
                alert('Hubo un error al registrar la obra.');
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('No se pudo conectar con el servidor.');
        }
    });

    // Función global para eliminar obra
    window.eliminarObra = async function(id) {
        if (confirm('¿Estás segura de que deseas eliminar esta obra?')) {
            try {
                const respuesta = await fetch(`/obras/${id}`, {
                    method: 'DELETE'
                });

                if (respuesta.ok) {
                    alert('Obra eliminada correctamente');
                    cargarObrasAdmin(); // Actualizamos la tabla
                } else {
                    alert('No se pudo eliminar la obra.');
                }
            } catch (error) {
                console.error('Error al eliminar:', error);
            }
        }
    };

    // Cargar las obras al abrir la página
    cargarObrasAdmin();
});