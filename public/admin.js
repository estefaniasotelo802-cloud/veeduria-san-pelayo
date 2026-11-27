let obrasCache = [];

// Coordenadas de referencia por sector o vereda en San Pelayo, Córdoba
const COORDENADAS_SECTORES_SAN_PELAYO = {
    'san pelayo': [8.9564, -75.8369],
    'centro': [8.9564, -75.8369],
    'pelayito': [8.9465, -75.8240],
    'brisas del sinu': [8.9635, -75.8430],
    'brisas del sinú': [8.9635, -75.8430],
    'sabana nueva': [8.9780, -75.8175],
    'carrillo': [8.9410, -75.8360],
    'las guamas': [8.9320, -75.8190],
    'bonga mella': [8.9850, -75.8520],
    'el oco': [8.9280, -75.8450],
    'trementino': [8.9180, -75.8280],
    'valparaiso': [8.9690, -75.8540],
    'valparaíso': [8.9690, -75.8540]
};

function normalizarTextoSector(texto) {
    return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function parsearPresupuestoMiles(valor) {
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : NaN;
    }
    const limpio = String(valor ?? '')
        .trim()
        .replace(/\$/g, '')
        .replace(/\s+/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.');
    if (!limpio) return NaN;
    const num = Number(limpio);
    return Number.isFinite(num) ? num : NaN;
}

async function obtenerCoordenadasPorSector(sectorTexto) {
    const limpio = normalizarTextoSector(sectorTexto);
    if (!limpio) {
        return { latitud: 8.9564, longitud: -75.8369 };
    }

    // Buscar coincidencia directa o parcial en sectores conocidos (ej. "Pelayito / Carrillo")
    for (const [clave, coords] of Object.entries(COORDENADAS_SECTORES_SAN_PELAYO)) {
        const claveNorm = normalizarTextoSector(clave);
        if (limpio === claveNorm || limpio.includes(claveNorm)) {
            return { latitud: coords[0], longitud: coords[1] };
        }
    }

    // Respaldo con geocodificación enfocada en San Pelayo, Córdoba
    const partes = limpio.split(/[\/,-]+/).map(p => p.trim()).filter(Boolean);
    const terminoBusqueda = `${partes[0] || limpio}, San Pelayo, Cordoba, Colombia`;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(terminoBusqueda)}`;
        const resp = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        if (resp.ok) {
            const resultados = await resp.json();
            if (Array.isArray(resultados) && resultados.length > 0) {
                const lat = parseFloat(resultados[0].lat);
                const lon = parseFloat(resultados[0].lon);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                    return { latitud: lat, longitud: lon };
                }
            }
        }
    } catch (error) {
        console.warn('No se pudo geocodificar el sector externamente:', error);
    }

    return { latitud: 8.9564, longitud: -75.8369 };
}

function escaparHTMLAdmin(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function resumirTextoCorto(texto, limite = 95) {
    const limpio = String(texto || '').trim();
    if (!limpio) return '';
    return limpio.length > limite ? `${limpio.slice(0, limite).trim()}...` : limpio;
}

function obtenerReportesCiudadanos() {
    try {
        return JSON.parse(localStorage.getItem('veeduriaReportesComentarios') || '{}');
    } catch (e) {
        return {};
    }
}

function limpiarReporteGuardado(clave) {
    try {
        const reportes = obtenerReportesCiudadanos();
        delete reportes[clave];
        localStorage.setItem('veeduriaReportesComentarios', JSON.stringify(reportes));
    } catch (e) {}
}

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
            const detalleCorto = resumirTextoCorto(
                obra.justificacion || obra.ejecucion || obra.descripcion || obra.resumen || ''
            );

            const fila = document.createElement('tr');
            fila.style.borderBottom = '1px solid #e2e8f0';
            fila.innerHTML = `
                <td style="padding: 10px; vertical-align: top;">${obra.id}</td>
                <td style="padding: 10px; vertical-align: top;">
                    <div style="font-weight: 700; color: #0f172a;">${escaparHTMLAdmin(obra.nombre)}</div>
                    ${detalleCorto
                        ? `<div style="font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.35;">${escaparHTMLAdmin(detalleCorto)}</div>`
                        : `<div style="font-size: 12px; color: #94a3b8; font-style: italic; margin-top: 4px;">Sin descripción registrada</div>`
                    }
                </td>
                <td style="padding: 10px; vertical-align: top;">${escaparHTMLAdmin(obra.sector)}</td>
                <td style="padding: 10px; vertical-align: top; display: flex; gap: 8px;">
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

// Carga únicamente comentarios reportados por la comunidad para no sobrecargar al admin
async function cargarComentariosAdmin() {
    const tablaComentariosAdmin = document.getElementById('tablaComentariosAdmin');
    if (!tablaComentariosAdmin) return;

    try {
        const respuesta = await fetch('/obras/comentarios');
        const comentarios = await respuesta.json();
        const reportesLocales = obtenerReportesCiudadanos();

        tablaComentariosAdmin.innerHTML = '';

        if (!Array.isArray(comentarios) || comentarios.length === 0) {
            tablaComentariosAdmin.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #64748b;">La moderación diaria se gestiona automáticamente; no hay comentarios pendientes.</td></tr>';
            return;
        }

        const comentariosReportados = comentarios
            .map((c, idx) => {
                const autor = c.ciudadano || c.nombre || 'Anónimo';
                const clave = String(c.id ?? `${autor}-${c.fecha || idx}`);
                const reportesBD = Number(c.reportes ?? c.total_reportes ?? 0);
                const reportesDispositivo = Number(reportesLocales[clave] || 0);
                const cantidadReportes = Math.max(reportesBD, reportesDispositivo);
                return { comentarioObj: c, clave, cantidadReportes };
            })
            .filter(item => item.cantidadReportes > 0);

        if (comentariosReportados.length === 0) {
            tablaComentariosAdmin.innerHTML = '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #64748b;">No hay comentarios reportados por la comunidad. El filtro automático y el reporte ciudadano están activos.</td></tr>';
            return;
        }

        comentariosReportados.forEach(({ comentarioObj: c, clave, cantidadReportes }) => {
            const fila = document.createElement('tr');
            fila.style.borderBottom = '1px solid #e2e8f0';

            const autor = c.ciudadano || c.nombre || 'Anónimo';
            const obraTexto = c.obra_nombre ? c.obra_nombre : (c.obra_id ? 'Obra #' + c.obra_id : 'General');
            const textoComentario = c.comentario || c.texto || '';
            const fechaFormateada = c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Sin fecha';

            fila.innerHTML = `
                <td style="padding: 10px;">${c.id ?? '-'}</td>
                <td style="padding: 10px;"><strong>${escaparHTMLAdmin(autor)}</strong><br><span style="font-size: 11px; color: #64748b;">${escaparHTMLAdmin(obraTexto)} · ${cantidadReportes} reporte(s)</span></td>
                <td style="padding: 10px;">${escaparHTMLAdmin(textoComentario)}</td>
                <td style="padding: 10px; color: #64748b; font-size: 0.9rem;">${fechaFormateada}</td>
                <td style="padding: 10px;">
                    <button onclick="eliminarComentarioAdmin(${c.id}, '${escaparHTMLAdmin(clave)}')" style="background-color: #dc2626 !important; color: white !important; border: none !important; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Eliminar</button>
                </td>
            `;
            tablaComentariosAdmin.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar comentarios reportados en el panel:', error);
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
    const presupuestoParsed = parsearPresupuestoMiles(obra.presupuesto);
    document.getElementById('presupuesto').value = Number.isFinite(presupuestoParsed)
        ? presupuestoParsed.toLocaleString('es-CO')
        : (obra.presupuesto || '');
    document.getElementById('estado').value = obra.estado || 'En ejecución';
    document.getElementById('avance_porcentaje').value = obra.porcentaje ?? obra.avance_porcentaje ?? 0;

    const justificacionInput = document.getElementById('justificacion');
    const ejecucionInput = document.getElementById('ejecucion');
    if (justificacionInput) justificacionInput.value = obra.justificacion || obra.descripcion || '';
    if (ejecucionInput) ejecucionInput.value = obra.ejecucion || '';

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

window.eliminarComentarioAdmin = async function(id, clave = '') {
    if (confirm('¿Estás segura de que deseas eliminar este comentario reportado?')) {
        try {
            const respuesta = await fetch(`/obras/comentarios/${id}`, { method: 'DELETE' });
            if (respuesta.ok) {
                if (clave) limpiarReporteGuardado(clave);
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

            const id = obraIdInput ? obraIdInput.value.trim() : '';
            const sectorValor = document.getElementById('sector').value.trim();
            const presupuestoNum = parsearPresupuestoMiles(document.getElementById('presupuesto').value);
            if (!Number.isFinite(presupuestoNum) || presupuestoNum < 0) {
                alert('Ingresa un presupuesto válido (puedes usar puntos de miles, ej. 5.800.000.000).');
                return;
            }

            const avanceNum = Number(document.getElementById('avance_porcentaje').value) || 0;
            const coords = await obtenerCoordenadasPorSector(sectorValor);

            const justificacionInput = document.getElementById('justificacion');
            const ejecucionInput = document.getElementById('ejecucion');
            const justificacionValor = justificacionInput ? justificacionInput.value.trim() : '';
            const ejecucionValor = ejecucionInput ? ejecucionInput.value.trim() : '';

            const datosObra = {
                nombre: document.getElementById('nombre').value.trim(),
                sector: sectorValor,
                presupuesto: presupuestoNum,
                estado: document.getElementById('estado').value,
                porcentaje: avanceNum,
                avance_porcentaje: avanceNum,
                latitud: coords.latitud,
                longitud: coords.longitud,
                justificacion: justificacionValor,
                ejecucion: ejecucionValor
            };

            try {
                const url = id ? `/obras/${id}` : '/obras';
                const metodo = id ? 'PUT' : 'POST';

                const respuesta = await fetch(url, {
                    method: metodo,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosObra)
                });

                const resultado = await respuesta.json().catch(() => ({}));

                if (respuesta.ok) {
                    alert(id ? '¡Obra actualizada exitosamente!' : '¡Obra registrada exitosamente!');
                    formObra.reset();
                    if (obraIdInput) obraIdInput.value = '';
                    if (formTitle) formTitle.innerText = 'Registrar Nueva Obra';
                    if (btnSubmitForm) {
                        btnSubmitForm.innerText = 'Guardar Nueva Obra';
                        btnSubmitForm.style.backgroundColor = '';
                    }
                    cargarObrasAdmin();
                } else {
                    alert(resultado.mensaje || 'Hubo un error al procesar la solicitud.');
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