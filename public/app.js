document.addEventListener('DOMContentLoaded', () => {
    obtenerObrasPublicas();
});

// Función para obtener las obras del servidor y pintarlas en la tabla pública
async function obtenerObrasPublicas() {
    try {
        const respuesta = await fetch('/obras');
        
        if (!respuesta.ok) {
            throw new Error('Error al conectar con el servidor para obtener las obras.');
        }

        const obras = await respuesta.json();
        const tablaBody = document.getElementById('tablaObrasBody');
        
        // Limpiamos la tabla antes de insertar
        tablaBody.innerHTML = '';

        if (obras.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay obras registradas actualmente.</td></tr>`;
            return;
        }

        // Recorremos cada obra y armamos la fila (Modo Lectura: Sin botones de acción)
        obras.forEach(obra => {
            const fila = document.createElement('tr');
            
            fila.innerHTML = `
                <td>${obra.nombre}</td>
                <td>${obra.sector}</td>
                <td>$${Number(obra.presupuesto).toLocaleString()}</td>
                <td><span class="badge ${obtenerClaseEstado(obra.estado)}">${obra.estado}</span></td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${obra.avance_porcentaje}%;"></div>
                        <span>${obra.avance_porcentaje}%</span>
                    </div>
                </td>
            `;
            
            tablaBody.appendChild(fila);
        });

    } catch (error) {
        console.error('Error:', error);
        const tablaBody = document.getElementById('tablaObrasBody');
        tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar la información. Intente más tarde.</td></tr>`;
    }
}

// Función auxiliar opcional para darle estilos al estado de la obra
function obtenerClaseEstado(estado) {
    if (!estado) return '';
    const est = estado.toLowerCase();
    if (est.includes('completado') || est.includes('finalizado')) return 'estado-completado';
    if (est.includes('proceso') || est.includes('ejecución')) return 'estado-proceso';
    return 'estado-pendiente';
}