let obrasCache = [];

// Función global para cargar las obras en el panel de administración
async function cargarObrasAdmin() {
    const tablaAdminBody = document.getElementById('tablaAdminBody');
    if (!tablaAdminBody) return;

    try {
        const respuesta = await fetch('/obras');
        const obras = await respuesta.json();
        obrasCache = obras;
        
        tablaAdminBody.innerHTML = '';
        
        if (!Array.isArray(obras) || obras.length === 0) {
            tablaAdminBody.innerHTML = '<tr><td colspan="4" style="padding: 15px; text-align: center; color: #64748b;">No hay obras registradas aún.</td></tr>';
            return;
        }

        obras.forEach(obra => {
            const fila = document.createElement('tr');
            fila.style.borderBottom = '1px solid #e2e8f0';
            fila.innerHTML = `
                <td style="padding: 10px;">${obra.id}</td>
                <td style="padding: 10px;">${obra.nombre}</td>
                <td style="padding: 10px;">${obra.sector}</td>
                <td style="padding: 10px; display: flex; gap: 8px;">
                    <button onclick="prepararEdicionPorId(${obra.id})" style="background-color: #0284c7 !important; color: white !important; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Editar</button>
                    <button onclick="eliminarObra(${obra.id})" style="background-color: #dc2626 !important; color: white !important; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>
                </td>
            `;
            tablaAdminBody.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar las obras:', error);
    }
}

// Función global para cargar los comentarios en el panel de administración
async function cargarComentariosAdmin() {
    const tablaComentariosAdmin = document.getElementById('tablaComentariosAdmin');
    if (!tablaComentariosAdmin) return;

    try {
        const respuesta = await fetch('/obras/comentarios');
        const comentarios = await respuesta.json();

        tablaComentariosAdmin.innerHTML = '';

        if (!Array.isArray(comentarios) || comentarios.length === 0) {
            tablaComentariosAdmin.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #64748b;">No hay comentarios registrados aún.</td></tr>';
            return;
        }

        comentarios.forEach(c => {
            const fila = document.createElement('tr');
            fila.style.borderBottom = '1px solid #e2e8f0';
            
            const autor = c.ciudadano || c.nombre || 'Anónimo';
            const obraTexto = c.obra_nombre ? c.obra_nombre : (c.obra_id ? 'Obra #' + c.obra_id : 'General');
            const textoComentario = c.comentario || c.texto || '';
            const fechaFormateada = c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Sin fecha';

            fila.innerHTML = `
                <td style="padding: 10px;">${c.id}</td>
                <td style="padding: 10px;"><strong>${autor}</strong><br><span style="font-size: 11px; color: #64748b;">${obraTexto}</span></td>
                <td style="padding: 10px;">${textoComentario}</td>
                <td style="padding: 10px; color: #64748b; font-size: 0.9rem;">${fechaFormateada}</td>
                <td style="padding: 10px;">
                    <button onclick="eliminarComentarioAdmin(${c.id})" style="background-color: #dc2626 !important; color: white !important; border: none !important; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>
                </td>
            `;
            tablaComentariosAdmin.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar comentarios en el panel:', error);
    }
}

// Funciones globales de edición y eliminación
window.prepararEdicionPorId = function(id) {
    const obra = obrasCache.find(o => o.id === id);
    if (obra) {
        window.prepararEdicion(obra);
    }
};

window.prepararEdicion = function(obra) {
    const obraIdInput = document.getElementById('obraId');
    const formTitle = document.getElementById('formTitle');
    const btnSubmitForm = document.getElementById('btnSubmitForm');

    if (obraIdInput) obraIdInput.value = obra.id;
    document.getElementById('nombre').value = obra.nombre || '';
    document.getElementById('sector').value = obra.sector || '';
    document.getElementById('presupuesto').value = obra.presupuesto || '';
    document.getElementById('estado').value = obra.estado || 'En ejecución';
    document.getElementById('avance_porcentaje').value = obra.porcentaje || obra.avance_porcentaje || 0;
    document.getElementById('fecha_inicio').value = obra.fecha_inicio ? obra.fecha_inicio.split('T')[0] : '';
    document.getElementById('fecha_fin').value = obra.fecha_fin ? obra.fecha_fin.split('T')[0] : '';

    if (formTitle) formTitle.innerText = 'Actualizar Obra Registrada';
    if (btnSubmitForm) {
        btnSubmitForm.innerText = 'Actualizar Obra';
        btnSubmitForm.style.backgroundColor = '#0284c7';
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.eliminarObra = async function(id) {
    if (confirm('¿Estás segura de que deseas eliminar esta obra?')) {
        try {
            const respuesta = await fetch(`/obras/${id}`, { method: 'DELETE' });
            if (respuesta.ok) {
                alert('Obra eliminada correctamente');
                cargarObrasAdmin();
            } else {
                alert('No se pudo eliminar la obra.');
            }
        } catch (error) {
            console.error('Error al eliminar obra:', error);
        }
    }
};

window.eliminarComentarioAdmin = async function(id) {
    if (confirm('¿Estás segura de que deseas eliminar este comentario?')) {
        try {
            const respuesta = await fetch(`/obras/comentarios/${id}`, { method: 'DELETE' });
            if (respuesta.ok) {
                cargarComentariosAdmin();
            } else {
                alert('No se pudo eliminar el comentario.');
            }
        } catch (error) {
            console.error('Error al eliminar comentario:', error);
        }
    }
};

// Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    const formObra = document.getElementById('formObra');
    const obraIdInput = document.getElementById('obraId');
    const formTitle = document.getElementById('formTitle');
    const btnSubmitForm = document.getElementById('btnSubmitForm');

    if (formObra) {
        formObra.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = obraIdInput ? obraIdInput.value : '';
            const datosObra = {
                nombre: document.getElementById('nombre').value,
                sector: document.getElementById('sector').value,
                presupuesto: document.getElementById('presupuesto').value,
                estado: document.getElementById('estado').value,
                porcentaje: document.getElementById('avance_porcentaje').value,
                fecha_inicio: document.getElementById('fecha_inicio').value,
                fecha_fin: document.getElementById('fecha_fin').value
            };

            try {
                let respuesta;
                if (id) {
                    respuesta = await fetch(`/obras/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(datosObra)
                    });
                } else {
                    respuesta = await fetch('/obras', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(datosObra)
                    });
                }

                if (respuesta.ok) {
                    alert(id ? '¡Obra actualizada exitosamente!' : '¡Obra registrada exitosamente!');
                    formObra.reset();
                    if (obraIdInput) obraIdInput.value = '';
                    if (formTitle) formTitle.innerText = 'Registrar Nueva Obra';
                    if (btnSubmitForm) {
                        btnSubmitForm.innerText = 'Guardar Nueva Obra';
                        btnSubmitForm.style.backgroundColor = '#10b981';
                    }
                    cargarObrasAdmin();
                } else {
                    alert('Hubo un error al procesar la solicitud.');
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('No se pudo conectar con el servidor.');
            }
        });
    }

    cargarObrasAdmin();
    cargarComentariosAdmin();
});