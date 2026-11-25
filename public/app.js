document.addEventListener('DOMContentLoaded', () => {
    obtenerObrasPublicas();
    inicializarMapa();
    inicializarChatbot();
    inyectarEstilosComentariosInteractivos();
    cargarComentariosPublicos();
    inicializarFormularioComentarios();
    inicializarMenuMovilYAnimaciones();
    inicializarAccesibilidad();
    inicializarGaleria();
    iniciarRotacionHero();
});

// Variables globales para sincronizar tabla y mapa
let mapaGlobal = null;
const marcadoresObras = {};
let zoomTextoActual = 100;
let accTamanoPx = 16;
let ultimoComentarioEnviado = { texto: '', timestamp: 0 };

function escaparHTML(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 1. GESTIÓN DE LA TABLA PÚBLICA

async function obtenerObrasPublicas() {
    try {
        const respuesta = await fetch('/obras');
        
        if (!respuesta.ok) {
            throw new Error('Error al conectar con el servidor para obtener las obras.');
        }

        const obras = await respuesta.json();
        const tablaBody = document.getElementById('tablaObrasBody');
        
        if (!tablaBody) return;
        tablaBody.innerHTML = '';

        if (obras.length === 0) {
            tablaBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No hay obras registradas actualmente.</td></tr>`;
            return;
        }

        obras.forEach(obra => {
            const fila = document.createElement('tr');
            fila.style.cursor = 'pointer'; 
            
            const brutoPorcentaje = obra.avance_porcentaje !== undefined && obra.avance_porcentaje !== null ? obra.avance_porcentaje : 
                                   (obra.porcentaje !== undefined && obra.porcentaje !== null ? obra.porcentaje : 
                                   (obra.avance !== undefined && obra.avance !== null ? obra.avance : 0));
            const porcentajeNum = Math.max(0, Math.min(100, Number(brutoPorcentaje) || 0));

            const fechaInicio = obra.fecha_inicio ? new Date(obra.fecha_inicio).toLocaleDateString() : 'N/D';
            const fechaFin = obra.fecha_fin ? new Date(obra.fecha_fin).toLocaleDateString() : 'N/D';

            fila.innerHTML = `
                <td>${escaparHTML(obra.nombre)}</td>
                <td>${escaparHTML(obra.sector)}</td>
                <td>$${Number(obra.presupuesto).toLocaleString()}</td>
                <td><span class="badge ${obtenerClaseEstado(obra.estado)}">${escaparHTML(obra.estado)}</span></td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="--progress-width: ${porcentajeNum}%; width: ${porcentajeNum}%;"></div>
                        <span>${porcentajeNum}%</span>
                    </div>
                </td>
                <td style="color: #475569; font-size: 0.9rem;">${fechaInicio}</td>
                <td style="color: #475569; font-size: 0.9rem;">${fechaFin}</td>
            `;
            
            fila.addEventListener('click', () => {
                if (marcadoresObras[obra.id] && mapaGlobal) {
                    const marker = marcadoresObras[obra.id];
                    mapaGlobal.flyTo(marker.getLatLng(), 15, { animate: true, duration: 1.5 });
                    marker.openPopup();
                }
            });
            
            tablaBody.appendChild(fila);
        });

    } catch (error) {
        console.error('Error:', error);
        const tablaBody = document.getElementById('tablaObrasBody');
        if (tablaBody) {
            tablaBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Error al cargar la información. Intente más tarde.</td></tr>`;
        }
    }
}

function obtenerClaseEstado(estado) {
    if (!estado) return '';
    const est = estado.toLowerCase();
    if (est.includes('completado') || est.includes('finalizado')) return 'estado-completado';
    if (est.includes('proceso') || est.includes('ejecución')) return 'estado-proceso';
    return 'estado-pendiente';
}

// 2. GESTIÓN DEL MAPA  

function inicializarMapa() {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    mapaGlobal = L.map('map', {
        minZoom: 12,
        maxZoom: 19
    }).setView([8.9564, -75.8369], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaGlobal);

    cargarMarcadoresEnMapa(mapaGlobal);
}

function obtenerColorPorEstado(estado, porcentaje) {
    if (porcentaje >= 100 || (estado && estado.toLowerCase().includes('completado'))) {
        return '#2ecc71';
    }
    if (estado && (estado.toLowerCase().includes('proceso') || estado.toLowerCase().includes('ejecución'))) {
        return '#f39c12';
    }
    return '#e74c3c';
}

async function cargarMarcadoresEnMapa(map) {
    try {
        const respuesta = await fetch('/obras');
        const obras = await respuesta.json();

        Object.values(marcadoresObras).forEach(m => map.removeLayer(m));

        obras.forEach(obra => {
            const lat = obra.latitud ? parseFloat(obra.latitud) : 8.9564;
            const lng = obra.longitud ? parseFloat(obra.longitud) : -75.8369;

            const brutoPorcentaje = obra.avance_porcentaje !== undefined && obra.avance_porcentaje !== null ? obra.avance_porcentaje : 
                                   (obra.porcentaje !== undefined && obra.porcentaje !== null ? obra.porcentaje : 
                                   (obra.avance !== undefined && obra.avance !== null ? obra.avance : 0));
            const porcentajeVal = brutoPorcentaje !== '' ? brutoPorcentaje : 0;

            const colorPin = obtenerColorPorEstado(obra.estado, porcentajeVal);

            const iconoPinSvg = L.divIcon({
                className: 'custom-pin',
                html: `
                    <svg width="30" height="42" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 3px rgba(0,0,0,0.3));">
                        <path d="M12 0C5.373 0 0 5.373 0 12C0 21 12 36 12 36C12 36 24 21 24 12C24 5.373 18.627 0 12 0Z" fill="${colorPin}"/>
                        <circle cx="12" cy="12" r="4.5" fill="white"/>
                    </svg>
                `,
                iconSize: [30, 42],
                iconAnchor: [15, 42],
                popupAnchor: [0, -38]
            });

            const marker = L.marker([lat, lng], { icon: iconoPinSvg }).addTo(map);

            const contenidoPopup = `
                <div style="font-family: Arial, sans-serif; min-width: 180px;">
                    <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${escaparHTML(obra.nombre)}</h4>
                    <p style="margin: 3px 0;"><strong>Sector:</strong> ${escaparHTML(obra.sector)}</p>
                    <p style="margin: 3px 0;"><strong>Presupuesto:</strong> $${Number(obra.presupuesto).toLocaleString()}</p>
                    <p style="margin: 3px 0;"><strong>Estado:</strong> ${escaparHTML(obra.estado)}</p>
                    <p style="margin: 3px 0;"><strong>Avance:</strong> ${porcentajeVal}%</p>
                </div>
            `;

            marker.bindPopup(contenidoPopup);
            marcadoresObras[obra.id] = marker;
        });

    } catch (error) {
        console.error('Error al cargar los marcadores en el mapa:', error);
    }
}

// 3. BUZÓN CIUDADANO: FILTRO, REACCIONES LIBRES, RESPUESTAS, ELIMINAR PROPIO Y REPORTES

const EMOJIS_RAPIDOS = ['👍', '❤️', '👏', '😮', '😢', '🔥', '🙌'];
const CATALOGO_EMOJIS_LIBRE = [
    '👍', '👎', '❤️', '🧡', '💛', '💚', '💙', '💜', '👏', '🙌',
    '🤝', '👌', '✌️', '🙏', '💪', '🔥', '⭐', '🎉', '🎊', '✅',
    '😊', '😄', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🤗', '🤔',
    '😮', '😲', '😯', '😢', '😭', '😡', '🤬', '😕', '😟', '😴'
];

function inyectarEstilosComentariosInteractivos() {
    if (document.getElementById('estilos-comentarios-interactivos')) return;
    const style = document.createElement('style');
    style.id = 'estilos-comentarios-interactivos';
    style.textContent = `
        .comentario-acciones-bar {
            margin-top: 6px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            font-size: 0.78rem;
            color: #64748b;
        }
        .comentario-acciones-izq,
        .comentario-acciones-der {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .btn-texto-limpio {
            width: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 0.78rem !important;
            font-weight: 500 !important;
            background: transparent !important;
            color: #64748b !important;
            border: none !important;
            box-shadow: none !important;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
        }
        .btn-texto-limpio:hover:not(:disabled) {
            color: #0f172a !important;
            text-decoration: underline;
        }
        .btn-texto-limpio:disabled {
            opacity: 0.55;
            cursor: default;
            text-decoration: none;
        }
        .btn-flecha-reaccion {
            font-size: 0.9rem !important;
            line-height: 1 !important;
            padding: 0 3px !important;
            text-decoration: none !important;
        }
        .btn-texto-eliminar {
            color: #dc2626 !important;
        }
        .btn-texto-eliminar:hover {
            color: #991b1b !important;
        }
        .reaccion-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
        }
        .reaccion-picker-popover {
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 6px 8px;
            display: none;
            flex-direction: column;
            gap: 6px;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
            z-index: 30;
            min-width: 196px;
        }
        .reaccion-picker-popover.abierto {
            display: flex;
        }
        .fila-emojis-rapidos {
            display: flex;
            align-items: center;
            gap: 2px;
        }
        .btn-emoji-opcion {
            width: auto !important;
            padding: 2px 5px !important;
            font-size: 0.98rem !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 6px !important;
            cursor: pointer;
            transition: transform 0.12s ease, background 0.12s ease;
        }
        .btn-emoji-opcion:hover {
            transform: scale(1.18);
            background: #f1f5f9 !important;
        }
        .btn-mas-emojis {
            font-weight: 700 !important;
            color: #0284c7 !important;
            padding: 2px 7px !important;
        }
        .grid-emojis-amplio {
            display: none;
            grid-template-columns: repeat(8, 1fr);
            gap: 2px;
            max-height: 120px;
            overflow-y: auto;
            padding-top: 6px;
            border-top: 1px solid #f1f5f9;
        }
        .grid-emojis-amplio.visible {
            display: grid;
        }
        .badge-reaccion-activa {
            width: auto !important;
            padding: 1px 6px !important;
            font-size: 0.72rem !important;
            border-radius: 999px !important;
            background: #f1f5f9 !important;
            color: #334155 !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
        }
        .badge-reaccion-activa.mia {
            background: #e0f2fe !important;
            border-color: #7dd3fc !important;
            color: #0369a1 !important;
            font-weight: 600;
        }
        .caja-respuesta-inline {
            margin-top: 8px;
            padding: 8px 10px;
            background: #f8fafc;
            border-left: 3px solid #08AFE6;
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .caja-respuesta-inline input,
        .caja-respuesta-inline textarea {
            font-size: 0.84rem !important;
            padding: 6px 9px !important;
            border-radius: 6px !important;
            border: 1px solid #cbd5e1 !important;
            width: 100%;
            background: #ffffff;
        }
        .lista-respuestas-hilo {
            margin-top: 8px;
            padding-left: 12px;
            border-left: 2px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .respuesta-item {
            padding: 2px 0;
            background: transparent;
            border: none;
        }
    `;
    document.head.appendChild(style);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.reaccion-wrapper')) {
            document.querySelectorAll('.reaccion-picker-popover.abierto').forEach((el) => {
                el.classList.remove('abierto');
            });
        }
    });
}

function obtenerDeviceId() {
    try {
        let id = localStorage.getItem('veeduriaDeviceId');
        if (!id) {
            id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            localStorage.setItem('veeduriaDeviceId', id);
        }
        return id;
    } catch (e) {
        return 'dev_anon';
    }
}

function obtenerTokensPropios() {
    try {
        return JSON.parse(localStorage.getItem('veeduriaMisComentariosTokens') || '{}');
    } catch (e) {
        return {};
    }
}

function guardarTokenPropio(comentarioId, token) {
    if (!comentarioId || !token) return;
    try {
        const tokens = obtenerTokensPropios();
        tokens[String(comentarioId)] = token;
        localStorage.setItem('veeduriaMisComentariosTokens', JSON.stringify(tokens));
    } catch (e) {}
}

function eliminarTokenPropio(comentarioId) {
    try {
        const tokens = obtenerTokensPropios();
        delete tokens[String(comentarioId)];
        localStorage.setItem('veeduriaMisComentariosTokens', JSON.stringify(tokens));
    } catch (e) {}
}

function validarComentarioAutomatico(nombre, texto) {
    const autorLimpio = (nombre || '').trim();
    const limpio = (texto || '').trim();

    if (autorLimpio.length < 2) {
        return { valido: false, motivo: 'Escribe tu nombre o "Anónimo" (mínimo 2 caracteres).' };
    }
    if (limpio.length < 3) {
        return { valido: false, motivo: 'Tu mensaje es muy corto; escribe al menos 3 caracteres.' };
    }
    if (limpio.length > 400) {
        return { valido: false, motivo: 'El comentario no puede superar los 400 caracteres.' };
    }

    const ahora = Date.now();
    if (
        ultimoComentarioEnviado.texto.toLowerCase() === limpio.toLowerCase() &&
        ahora - ultimoComentarioEnviado.timestamp < 15000
    ) {
        return { valido: false, motivo: 'Ya enviaste ese mismo mensaje hace unos segundos.' };
    }

    const tieneEnlace = /(https?:\/\/|www\.|\.(com|co|net|org|io|gg|me|ly)\b)/i.test(limpio);
    if (tieneEnlace) {
        return { valido: false, motivo: 'No se permiten enlaces ni direcciones web en el buzón ciudadano.' };
    }

    if (/(.)\1{6,}/i.test(limpio)) {
        return { valido: false, motivo: 'Evita repetir el mismo carácter muchas veces seguidas.' };
    }

    const palabrasBloqueadas = [
        'idiota', 'imbecil', 'imbécil', 'estupido', 'estúpido',
        'basura', 'mierda', 'puta', 'puto', 'malparido', 'gonorrea', 'hp'
    ];
    const textoNormalizado = limpio
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const encontrada = palabrasBloqueadas.find((palabra) => {
        const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escapada}\\b`, 'i').test(textoNormalizado);
    });

    if (encontrada) {
        return {
            valido: false,
            motivo: 'El filtro automático detectó lenguaje inadecuado; por favor exprésate con respeto.'
        };
    }

    return { valido: true, autor: autorLimpio, texto: limpio };
}

function mostrarAvisoComentario(mensaje, esError = true) {
    const aviso = document.getElementById('mensajeComentario');
    if (!aviso) {
        alert(mensaje);
        return;
    }
    aviso.textContent = mensaje;
    aviso.style.display = 'block';
    aviso.style.color = esError ? '#b91c1c' : '#166534';
}

function obtenerReportesGuardados() {
    try {
        return JSON.parse(localStorage.getItem('veeduriaReportesComentarios') || '{}');
    } catch (e) {
        return {};
    }
}

function guardarReportes(reportes) {
    try {
        localStorage.setItem('veeduriaReportesComentarios', JSON.stringify(reportes));
    } catch (e) {}
}

function obtenerIniciales(nombre) {
    if (!nombre || nombre.toLowerCase() === 'anónimo') return '👤';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
        return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].substring(0, 2).toUpperCase();
}

async function reaccionarComentario(comentarioId, emoji) {
    try {
        const resp = await fetch(`/obras/comentarios/${encodeURIComponent(comentarioId)}/reaccionar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emoji,
                deviceId: obtenerDeviceId()
            })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            if (err.error) alert(err.error);
            return;
        }
        await cargarComentariosPublicos();
    } catch (e) {
        console.error('Error al reaccionar:', e);
    }
}

async function eliminarComentarioPropio(comentarioId) {
    const tokens = obtenerTokensPropios();
    const token = tokens[String(comentarioId)];
    if (!token) return;

    if (!confirm('¿Deseas eliminar tu comentario?')) return;

    try {
        const respuesta = await fetch(`/obras/comentarios/${encodeURIComponent(comentarioId)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'x-delete-token': token
            },
            body: JSON.stringify({ delete_token: token })
        });

        if (respuesta.ok) {
            eliminarTokenPropio(comentarioId);
            await cargarComentariosPublicos();
        } else {
            const err = await respuesta.json().catch(() => ({}));
            alert(err.error || 'No se pudo eliminar el comentario.');
        }
    } catch (e) {
        console.error('Error al eliminar comentario propio:', e);
    }
}

async function reportarComentario(claveComentario, boton) {
    const reportesLocales = obtenerReportesGuardados();
    const marcadoLocal = Number(reportesLocales[claveComentario] || 0) + 1;
    reportesLocales[claveComentario] = marcadoLocal;
    guardarReportes(reportesLocales);

    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Reportado';
    }

    try {
        const respuesta = await fetch(`/obras/comentarios/${encodeURIComponent(claveComentario)}/reportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (respuesta.ok) {
            const datos = await respuesta.json().catch(() => ({}));
            const totalBD = Number(datos.reportes ?? 0);
            if (totalBD >= 3 || datos.oculto) {
                reportesLocales[claveComentario] = Math.max(marcadoLocal, totalBD);
                guardarReportes(reportesLocales);
            }
        }
    } catch (e) {
        console.error('No se pudo registrar el reporte en el servidor:', e);
    }

    await cargarComentariosPublicos();
}

function construirBarraAcciones(c, clave, reportesLocales, tokensPropios, permitirResponder = true) {
    const yaReportado = Number(reportesLocales[clave] || 0) > 0;
    const esMio = Boolean(c.id && tokensPropios[String(c.id)]);
    const reaccionesObj = c.reacciones || {};
    const miReaccion = c.mi_reaccion || null;

    const badgesHTML = Object.entries(reaccionesObj)
        .filter(([, count]) => Number(count) > 0)
        .map(([emoji, count]) => `
            <button type="button" class="badge-reaccion-activa ${miReaccion === emoji ? 'mia' : ''}" data-emoji="${escaparHTML(emoji)}">
                <span>${escaparHTML(emoji)}</span><span>${count}</span>
            </button>
        `)
        .join('');

    const rapidosHTML = EMOJIS_RAPIDOS
        .map((em) => `<button type="button" class="btn-emoji-opcion" data-emoji="${em}">${em}</button>`)
        .join('');

    const catalogoHTML = CATALOGO_EMOJIS_LIBRE
        .map((em) => `<button type="button" class="btn-emoji-opcion" data-emoji="${em}">${em}</button>`)
        .join('');

    const barra = document.createElement('div');
    barra.className = 'comentario-acciones-bar';
    barra.innerHTML = `
        <div class="comentario-acciones-izq">
            <div class="reaccion-wrapper">
                <button type="button" class="btn-texto-limpio btn-flecha-reaccion btn-toggle-reacciones" title="Elegir reacción" aria-label="Elegir reacción">▾</button>
                <div class="reaccion-picker-popover">
                    <div class="fila-emojis-rapidos">
                        ${rapidosHTML}
                        <button type="button" class="btn-emoji-opcion btn-mas-emojis" title="Más emojis">+</button>
                    </div>
                    <div class="grid-emojis-amplio">${catalogoHTML}</div>
                </div>
                ${badgesHTML}
            </div>
            ${permitirResponder ? `<button type="button" class="btn-texto-limpio btn-abrir-respuesta">Responder</button>` : ''}
        </div>
        <div class="comentario-acciones-der">
            ${esMio ? `<button type="button" class="btn-texto-limpio btn-texto-eliminar btn-eliminar-propio">Eliminar</button>` : ''}
            <button type="button" class="btn-texto-limpio btn-reportar-comentario" ${yaReportado ? 'disabled' : ''}>
                ${yaReportado ? 'Reportado' : 'Reportar'}
            </button>
        </div>
    `;

    const btnToggleReac = barra.querySelector('.btn-toggle-reacciones');
    const popover = barra.querySelector('.reaccion-picker-popover');
    const btnMas = barra.querySelector('.btn-mas-emojis');
    const gridAmplio = barra.querySelector('.grid-emojis-amplio');

    if (btnToggleReac && popover && c.id) {
        btnToggleReac.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.reaccion-picker-popover.abierto').forEach((otro) => {
                if (otro !== popover) otro.classList.remove('abierto');
            });
            popover.classList.toggle('abierto');
        });

        if (btnMas && gridAmplio) {
            btnMas.addEventListener('click', (e) => {
                e.stopPropagation();
                gridAmplio.classList.toggle('visible');
            });
        }

        popover.querySelectorAll('.btn-emoji-opcion[data-emoji]').forEach((btnEm) => {
            btnEm.addEventListener('click', (e) => {
                e.stopPropagation();
                popover.classList.remove('abierto');
                if (gridAmplio) gridAmplio.classList.remove('visible');
                reaccionarComentario(c.id, btnEm.dataset.emoji);
            });
        });

        barra.querySelectorAll('.badge-reaccion-activa').forEach((badge) => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                reaccionarComentario(c.id, badge.dataset.emoji);
            });
        });
    }

    const btnEliminar = barra.querySelector('.btn-eliminar-propio');
    if (btnEliminar && c.id) {
        btnEliminar.addEventListener('click', () => eliminarComentarioPropio(c.id));
    }

    const btnReportar = barra.querySelector('.btn-reportar-comentario');
    if (btnReportar && !yaReportado) {
        btnReportar.addEventListener('click', () => reportarComentario(clave, btnReportar));
    }

    return barra;
}

async function cargarComentariosPublicos() {
    const contenedorComentarios = document.getElementById('contenedorComentarios') || document.getElementById('listaComentarios');
    if (!contenedorComentarios) return;

    try {
        const deviceId = encodeURIComponent(obtenerDeviceId());
        const respuesta = await fetch(`/obras/comentarios?deviceId=${deviceId}`);
        const comentarios = await respuesta.json();
        const reportesLocales = obtenerReportesGuardados();
        const tokensPropios = obtenerTokensPropios();

        contenedorComentarios.innerHTML = '';

        if (!Array.isArray(comentarios) || comentarios.length === 0) {
            contenedorComentarios.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay comentarios registrados aún. ¡Sé el primero en opinar!</p>';
            return;
        }

        const visibles = comentarios.filter((c, idx) => {
            const clave = String(c.id ?? `${c.ciudadano || c.nombre || 'anon'}-${c.fecha || idx}`);
            const reportesBD = Number(c.reportes ?? c.total_reportes ?? 0);
            const reportesDispositivo = Number(reportesLocales[clave] || 0);
            return Math.max(reportesBD, reportesDispositivo) < 3;
        });

        const principales = visibles.filter((c) => !c.parent_id);
        const respuestasPorPadre = {};

        visibles
            .filter((c) => c.parent_id)
            .reverse()
            .forEach((resp) => {
                const pid = String(resp.parent_id);
                if (!respuestasPorPadre[pid]) respuestasPorPadre[pid] = [];
                respuestasPorPadre[pid].push(resp);
            });

        if (principales.length === 0) {
            contenedorComentarios.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay comentarios visibles en este momento.</p>';
            return;
        }

        principales.forEach((c, idx) => {
            const autor = c.ciudadano || c.nombre || 'Anónimo';
            const iniciales = obtenerIniciales(autor);
            const textoComentario = c.comentario || c.texto || '';
            const fechaFormateada = c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Reciente';
            const obraInfo = c.obra_nombre ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;">Obra: ${escaparHTML(c.obra_nombre)}</div>` : '';
            const clave = String(c.id ?? `${autor}-${c.fecha || idx}`);

            const divComentario = document.createElement('div');
            divComentario.className = 'comentario-item';
            divComentario.innerHTML = `
                <div class="comentario-avatar">${escaparHTML(iniciales)}</div>
                <div class="comentario-contenido">
                    <div class="comentario-header">
                        <span class="comentario-autor">${escaparHTML(autor)}</span>
                        <span class="comentario-fecha">${fechaFormateada}</span>
                    </div>
                    ${obraInfo}
                    <p class="comentario-texto">${escaparHTML(textoComentario)}</p>
                </div>
            `;

            const contenidoEl = divComentario.querySelector('.comentario-contenido');
            const barraAcciones = construirBarraAcciones(c, clave, reportesLocales, tokensPropios, true);
            contenidoEl.appendChild(barraAcciones);

            const btnResponder = barraAcciones.querySelector('.btn-abrir-respuesta');
            if (btnResponder && c.id) {
                btnResponder.addEventListener('click', () => {
                    let caja = contenidoEl.querySelector('.caja-respuesta-inline');
                    if (caja) {
                        caja.remove();
                        return;
                    }

                    caja = document.createElement('div');
                    caja.className = 'caja-respuesta-inline';
                    caja.innerHTML = `
                        <input type="text" class="input-resp-nombre" placeholder="Tu nombre o Anónimo" maxlength="60">
                        <textarea class="input-resp-texto" rows="2" placeholder="Escribe una respuesta para ${escaparHTML(autor)}..." maxlength="400"></textarea>
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 2px;">
                            <button type="button" class="btn-texto-limpio btn-cancelar-resp">Cancelar</button>
                            <button type="button" class="btn-texto-limpio btn-enviar-resp" style="color: #508C46 !important; font-weight: 600 !important;">Responder</button>
                        </div>
                    `;

                    caja.querySelector('.btn-cancelar-resp').addEventListener('click', () => caja.remove());
                    caja.querySelector('.btn-enviar-resp').addEventListener('click', async () => {
                        const nombreVal = caja.querySelector('.input-resp-nombre').value;
                        const textoVal = caja.querySelector('.input-resp-texto').value;
                        const validacion = validarComentarioAutomatico(nombreVal, textoVal);

                        if (!validacion.valido) {
                            alert(validacion.motivo);
                            return;
                        }

                        try {
                            const resp = await fetch('/obras/comentarios', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    ciudadano: validacion.autor,
                                    comentario: validacion.texto,
                                    parent_id: c.id
                                })
                            });

                            if (resp.ok) {
                                const data = await resp.json().catch(() => ({}));
                                if (data.id && data.delete_token) {
                                    guardarTokenPropio(data.id, data.delete_token);
                                }
                                ultimoComentarioEnviado = { texto: validacion.texto, timestamp: Date.now() };
                                await cargarComentariosPublicos();
                            } else {
                                const err = await resp.json().catch(() => ({}));
                                alert(err.error || 'No se pudo publicar la respuesta.');
                            }
                        } catch (e) {
                            alert('No se pudo conectar con el servidor.');
                        }
                    });

                    contenidoEl.appendChild(caja);
                });
            }

            const hijos = c.id ? (respuestasPorPadre[String(c.id)] || []) : [];
            if (hijos.length > 0) {
                const contenedorHijos = document.createElement('div');
                contenedorHijos.className = 'lista-respuestas-hilo';

                hijos.forEach((h, hIdx) => {
                    const hAutor = h.ciudadano || h.nombre || 'Anónimo';
                    const hTexto = h.comentario || h.texto || '';
                    const hFecha = h.fecha ? new Date(h.fecha).toLocaleDateString() : 'Reciente';
                    const hClave = String(h.id ?? `${hAutor}-${h.fecha || hIdx}`);

                    const divHijo = document.createElement('div');
                    divHijo.className = 'respuesta-item';
                    divHijo.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 2px;">
                            <span style="font-weight: 600; font-size: 0.84rem; color: #1e293b;">${escaparHTML(hAutor)}</span>
                            <span style="font-size: 0.74rem; color: #64748b;">${hFecha}</span>
                        </div>
                        <p style="margin: 0; font-size: 0.88rem; color: #334155;">${escaparHTML(hTexto)}</p>
                    `;

                    const barraHijo = construirBarraAcciones(h, hClave, reportesLocales, tokensPropios, false);
                    divHijo.appendChild(barraHijo);
                    contenedorHijos.appendChild(divHijo);
                });

                contenidoEl.appendChild(contenedorHijos);
            }

            contenedorComentarios.appendChild(divComentario);
        });

    } catch (error) {
        console.error('Error al cargar comentarios públicos:', error);
    }
}

// 4. ENVÍO DE NUEVOS COMENTARIOS (POST) CON FILTRO AUTOMÁTICO

function inicializarFormularioComentarios() {
    const form = document.getElementById('formComentario') || document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputNombre = document.getElementById('nombreUsuario') || document.querySelector('input[name="ciudadano"]') || document.querySelector('input[type="text"]');
        const inputTexto = document.getElementById('textoComentario') || document.querySelector('textarea');

        if (!inputNombre || !inputTexto) return;

        const validacion = validarComentarioAutomatico(inputNombre.value, inputTexto.value);
        if (!validacion.valido) {
            mostrarAvisoComentario(validacion.motivo, true);
            return;
        }

        const nuevoComentario = {
            ciudadano: validacion.autor,
            comentario: validacion.texto
        };

        try {
            const respuesta = await fetch('/obras/comentarios', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(nuevoComentario)
            });

            if (respuesta.ok) {
                const data = await respuesta.json().catch(() => ({}));
                if (data.id && data.delete_token) {
                    guardarTokenPropio(data.id, data.delete_token);
                }
                ultimoComentarioEnviado = {
                    texto: validacion.texto,
                    timestamp: Date.now()
                };
                inputNombre.value = '';
                inputTexto.value = '';
                mostrarAvisoComentario('Tu comentario fue publicado correctamente.', false);
                cargarComentariosPublicos();
            } else {
                const dataError = await respuesta.json().catch(() => ({}));
                mostrarAvisoComentario(dataError.error || 'No se pudo registrar el comentario.', true);
            }
        } catch (error) {
            console.error('Error de red al enviar el comentario:', error);
            mostrarAvisoComentario('No se pudo conectar con el servidor.', true);
        }
    });
}

// 5. CHATBOT

function inicializarChatbot() {
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatBox = document.getElementById('chat-box');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    if (!chatToggleBtn || !chatBox) return;

    chatBox.style.display = 'none';

    chatToggleBtn.addEventListener('click', () => {
        chatBox.style.display = chatBox.style.display === 'none' ? 'flex' : 'none';
    });

    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', () => {
            chatBox.style.display = 'none';
        });
    }

    async function enviarMensaje() {
        const texto = chatInput.value.trim();
        if (!texto) return;

        const userMsg = document.createElement('div');
        userMsg.className = 'message user-message';
        userMsg.textContent = texto;
        chatMessages.appendChild(userMsg);
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            const botMsg = document.createElement('div');
            botMsg.className = 'message bot-message';
            
            const lower = texto.toLowerCase();

            if (lower.includes('hola') || lower.includes('buenos dias') || lower.includes('buenas tardes') || lower.includes('saludos')) {
                botMsg.textContent = "¡Hola! Es un gusto saludarte. ¿Sobre cuál de las obras de San Pelayo te gustaría consultar hoy?";
            } else if (lower.includes('gracias') || lower.includes('muy amable') || lower.includes('excelente') || lower.includes('perfecto')) {
                botMsg.textContent = "Con gusto, fue un placer ayudarte. Si tienes alguna otra duda sobre las obras del municipio, aquí estaré.";
            } else if (lower.includes('gas') || lower.includes('pelayito') || lower.includes('brisas')) {
                botMsg.textContent = "La obra de Expansión de Gas Domiciliario en Pelayito y Brisas del Sinú tiene un presupuesto de $92,800,000 y un avance del 95% (En pruebas técnicas).";
            } else if (lower.includes('puente') || lower.includes('sabana') || lower.includes('cañuelar')) {
                botMsg.textContent = "La Reconstrucción y Mitigación del Puente Cañuelar en Sabana Nueva cuenta con un presupuesto de $87,000,000,000 y se encuentra finalizada (100%).";
            } else if (lower.includes('pavimentación') || lower.includes('guamas') || lower.includes('carrillo') || lower.includes('vial')) {
                botMsg.textContent = "La Pavimentación del Corredor Vial Carrillo - Las Guamas tiene un presupuesto de $10,000,000,000 y presenta un 50% de avance en ejecución.";
            } else {
                botMsg.textContent = "No logré identificar exactamente el proyecto del que hablas, pero puedes preguntarme libremente por el gas en Pelayito, el puente de Sabana Nueva o la vía a Las Guamas. ¿A cuál de ellas te refieres?";
            }

            chatMessages.appendChild(botMsg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 600);
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', enviarMensaje);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensaje();
        });
    }
}

// 6. MENÚ MÓVIL Y ANIMACIONES SCROLL REVEAL

function inicializarMenuMovilYAnimaciones() {
    const toggleBtn = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-links-menu');

    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
        
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navMenu.classList.remove('active'));
        });
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.section-container').forEach(sec => {
        observer.observe(sec);
    });
}

// 7. ACCESIBILIDAD INTEGRAL

function toggleAccMenu() {
    const panel = document.getElementById('accMenuPanel');
    const btn = document.getElementById('btnAccMenu');
    if (!panel) return;

    const oculto = panel.hasAttribute('hidden');
    if (oculto) {
        panel.removeAttribute('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        actualizarEtiquetaPx();
    } else {
        panel.setAttribute('hidden', '');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

function cambiarTabAccesibilidad(nombreTab) {
    document.querySelectorAll('.acc-tab').forEach((tab) => {
        tab.classList.toggle('is-active', tab.dataset.accTab === nombreTab);
    });
    document.querySelectorAll('.acc-tab-content').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.accPanel === nombreTab);
    });
}

function actualizarEtiquetaPx() {
    const label = document.getElementById('accTamanoLabel');
    if (label) {
        label.textContent = `${accTamanoPx}px`;
    }
}

function ajustarTamanoPx(deltaPx) {
    accTamanoPx = Math.min(26, Math.max(12, accTamanoPx + deltaPx));
    document.documentElement.style.fontSize = `${accTamanoPx}px`;
    actualizarEtiquetaPx();
    try {
        localStorage.setItem('veeduriaTamanoPx', accTamanoPx);
    } catch (e) {}
}

function toggleAltoContraste(activado) {
    setModoAccesibilidad(activado ? 'contraste' : 'normal');
}

function restablecerAccesibilidad() {
    accTamanoPx = 16;
    zoomTextoActual = 100;
    document.documentElement.style.fontSize = '';
    actualizarEtiquetaPx();

    document.body.classList.remove('acc-lectura-facil', 'acc-resaltar-enlaces');
    document.documentElement.classList.remove('acc-lectura-facil', 'acc-resaltar-enlaces');

    ['switchLecturaFacil', 'switchResaltarEnlaces', 'switchAltoContraste'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    setModoAccesibilidad('normal');
    detenerLectura();

    try {
        localStorage.removeItem('veeduriaTamanoPx');
        localStorage.removeItem('veeduriaZoomTexto');
        localStorage.removeItem('veeduria_acc-lectura-facil');
        localStorage.removeItem('veeduria_acc-resaltar-enlaces');
    } catch (e) {}
}

function leerPaginaEnVozAlta() {
    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta lectura en voz alta.');
        return;
    }
    window.speechSynthesis.cancel();

    const textoSeleccionado = window.getSelection().toString().trim();
    const secciones = ['inicio', 'objetivo', 'historia', 'comentarios', 'veeduria']
        .map(id => document.getElementById(id)?.innerText || '')
        .join('. ');

    const textoALeer = textoSeleccionado || secciones;
    const mensaje = new SpeechSynthesisUtterance(textoALeer);
    mensaje.lang = 'es-CO';
    mensaje.rate = 0.95;
    window.speechSynthesis.speak(mensaje);
}

function detenerLectura() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

function cambiarTamanoTexto(cambio) {
    if (cambio === 0) {
        zoomTextoActual = 100;
        accTamanoPx = 16;
        document.documentElement.style.fontSize = '';
    } else {
        zoomTextoActual = Math.min(140, Math.max(80, zoomTextoActual + cambio));
        accTamanoPx = Math.round((16 * zoomTextoActual) / 100);
        document.documentElement.style.fontSize = zoomTextoActual + '%';
    }
    actualizarEtiquetaPx();
    try {
        localStorage.setItem('veeduriaZoomTexto', zoomTextoActual);
        localStorage.setItem('veeduriaTamanoPx', accTamanoPx);
    } catch (e) {}
}

function toggleOpcionExtra(claseCss, idBoton, forzarEstado = null) {
    const control = document.getElementById(idBoton);
    let activo;

    if (typeof forzarEstado === 'boolean') {
        activo = forzarEstado;
    } else if (control && control.type === 'checkbox') {
        activo = control.checked;
    } else {
        activo = !document.body.classList.contains(claseCss);
    }

    document.body.classList.toggle(claseCss, activo);
    document.documentElement.classList.toggle(claseCss, activo);

    if (control && control.type === 'checkbox') {
        control.checked = activo;
    } else if (control) {
        control.classList.toggle('activo', activo);
    }

    try {
        localStorage.setItem('veeduria_' + claseCss, activo ? '1' : '0');
    } catch (e) {}
}

function setModoAccesibilidad(modo) {
    const modoValido = modo || 'normal';
    const root = document.documentElement;
    root.classList.remove(
        'acc-deuteranopia',
        'acc-protanopia',
        'acc-tritanopia',
        'acc-contraste'
    );

    if (modoValido !== 'normal') {
        root.classList.add('acc-' + modoValido);
    }

    const selector = document.querySelector('#accMenuPanel .acc-select, #accModoColorSelect');
    if (selector) selector.value = modoValido;

    const switchContraste = document.getElementById('switchAltoContraste');
    if (switchContraste) switchContraste.checked = modoValido === 'contraste';

    try {
        localStorage.setItem('modoAccesibilidadVeeduria', modoValido);
    } catch (e) {}
}

function inicializarAccesibilidad() {
    document.addEventListener('click', (e) => {
        const toolbar = document.querySelector('.acc-toolbar');
        const panel = document.getElementById('accMenuPanel');
        const btn = document.getElementById('btnAccMenu');
        if (toolbar && panel && !panel.hasAttribute('hidden') && !toolbar.contains(e.target)) {
            panel.setAttribute('hidden', '');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        }
    });

    try {
        const modo = localStorage.getItem('modoAccesibilidadVeeduria') || 'normal';
        setModoAccesibilidad(modo);

        const pxGuardado = parseInt(localStorage.getItem('veeduriaTamanoPx'), 10);
        if (pxGuardado && pxGuardado >= 12 && pxGuardado <= 26) {
            accTamanoPx = pxGuardado;
            document.documentElement.style.fontSize = `${accTamanoPx}px`;
        } else {
            const zoom = parseInt(localStorage.getItem('veeduriaZoomTexto'), 10);
            if (zoom && zoom >= 80 && zoom <= 140) {
                zoomTextoActual = zoom;
                accTamanoPx = Math.round((16 * zoomTextoActual) / 100);
                document.documentElement.style.fontSize = zoomTextoActual + '%';
            }
        }
        actualizarEtiquetaPx();

        if (localStorage.getItem('veeduria_acc-lectura-facil') === '1') {
            toggleOpcionExtra('acc-lectura-facil', 'switchLecturaFacil', true);
        }
        if (localStorage.getItem('veeduria_acc-resaltar-enlaces') === '1') {
            toggleOpcionExtra('acc-resaltar-enlaces', 'switchResaltarEnlaces', true);
        }
    } catch (e) {}
}

// 8. GALERÍA INTERACTIVA DE SAN PELAYO

const FOTOS_GALERIA_SAN_PELAYO = [
    {
        id: 'puente-sinu',
        titulo: 'Puente Metálico sobre el Río Sinú',
        categoria: 'infraestructura',
        etiqueta: 'Infraestructura y Río',
        imagen: '/galeria/puente-sinu.jpg',
        descripcion: 'Ícono de conectividad y movilidad que enlaza a San Pelayo con el resto de Córdoba.'
    },
    {
        id: 'planchon-sinu',
        titulo: 'Cruce Fluvial en el Río Sinú',
        categoria: 'infraestructura',
        etiqueta: 'Infraestructura y Río',
        imagen: '/galeria/planchon-sinu.jpg',
        descripcion: 'Transporte tradicional sobre el río Sinú que acompaña la vida cotidiana y productiva ribereña.'
    },
    {
        id: 'monumento-porro',
        titulo: 'Monumento a los Instrumentos del Porro',
        categoria: 'cultura',
        etiqueta: 'Cultura y Porro',
        imagen: '/galeria/monumento-porro.jpg',
        descripcion: 'Homenaje a las bandas y ritmos tradicionales que hacen de San Pelayo cuna del porro.'
    },
    {
        id: 'danza-porro',
        titulo: 'Danza y Tradición Folclórica',
        categoria: 'cultura',
        etiqueta: 'Cultura y Porro',
        imagen: '/galeria/danza-porro.jpg',
        descripcion: 'Expresión cultural con trajes coloridos y percusión que mantiene viva la identidad local.'
    },
    {
        id: 'plaza-sombreros',
        titulo: 'Plaza y Monumentos con Sombrero Vueltiao',
        categoria: 'espacio',
        etiqueta: 'Espacio Público',
        imagen: '/galeria/plaza-sombreros.jpg',
        descripcion: 'Entorno urbano central donde confluyen símbolos artesanales, música y encuentro ciudadano.'
    },
    {
        id: 'fuente-monumento',
        titulo: 'Fuente y Monumento Tradicional',
        categoria: 'espacio',
        etiqueta: 'Espacio Público',
        imagen: '/galeria/fuente-monumento.jpg',
        descripcion: 'Espacio comunitario y memoria local dentro del recorrido urbano de San Pelayo.'
    }
];

function inicializarGaleria() {
    const grid = document.getElementById('gridGaleria');
    const botonesFiltro = document.querySelectorAll('.filtro-btn');
    const modal = document.getElementById('modalGaleria');
    const cerrarModal = document.getElementById('cerrarModalGaleria');

    if (!grid) return;

    function abrirFotoModal(foto) {
        if (!modal) return;
        const catEl = document.getElementById('modalCategoria');
        document.getElementById('modalImagen').src = foto.imagen;
        document.getElementById('modalImagen').alt = foto.titulo;
        if (catEl) {
            catEl.textContent = '';
            catEl.style.display = 'none';
        }
        document.getElementById('modalTitulo').textContent = foto.titulo;
        document.getElementById('modalDescripcion').textContent = foto.descripcion;
        modal.removeAttribute('hidden');
    }

    function cerrarFotoModal() {
        if (!modal) return;
        modal.setAttribute('hidden', '');
    }

    function renderizarTarjetas(categoria = 'todas') {
        const filtradas = categoria === 'todas'
            ? FOTOS_GALERIA_SAN_PELAYO
            : FOTOS_GALERIA_SAN_PELAYO.filter(item => item.categoria === categoria);

        grid.innerHTML = '';

        filtradas.forEach(foto => {
            const card = document.createElement('article');
            card.className = 'galeria-card';
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Ver ${foto.titulo}`);

            card.innerHTML = `
                <img src="${foto.imagen}" alt="${foto.titulo}" loading="lazy">
                <div class="galeria-card-body">
                    <h3>${foto.titulo}</h3>
                    <p>${foto.descripcion}</p>
                </div>
            `;

            card.addEventListener('mouseenter', () => {
                grid.querySelectorAll('.galeria-card').forEach(c => c.classList.remove('activa'));
                card.classList.add('activa');
            });

            card.addEventListener('click', () => {
                const yaActiva = card.classList.contains('activa');
                grid.querySelectorAll('.galeria-card').forEach(c => c.classList.remove('activa'));
                if (!yaActiva) {
                    card.classList.add('activa');
                } else {
                    abrirFotoModal(foto);
                }
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    abrirFotoModal(foto);
                }
            });

            grid.appendChild(card);
        });
    }

    botonesFiltro.forEach(btn => {
        btn.addEventListener('click', () => {
            botonesFiltro.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            renderizarTarjetas(btn.dataset.categoria);
        });
    });

    if (cerrarModal) {
        cerrarModal.addEventListener('click', cerrarFotoModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarFotoModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) {
            cerrarFotoModal();
        }
    });

    renderizarTarjetas('todas');
}

// 9. ROTACIÓN AUTOMÁTICA DEL HERO (#inicio)

async function iniciarRotacionHero(intervaloMs = 7000) {
    const hero = document.querySelector('#inicio.hero');
    if (!hero) return;

    let listaHero = [];

    try {
        const resp = await fetch('/api/hero-imagenes');
        if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.imagenes)) {
                listaHero = data.imagenes.map(item => item.url_imagen).filter(Boolean);
            }
        }
    } catch (error) {
        console.warn('No se pudieron cargar imágenes dinámicas del hero:', error);
    }

    if (listaHero.length === 0) {
        listaHero = [
            '/hero/templo-san-pelayo.jpg',
            '/hero/palacio-porro.jpg',
            '/hero/bailarina-festival.jpg',
            '/hero/pescador-sinu.jpg'
        ];
    }

    let indice = 0;

    const aplicarFondo = (ruta) => {
        hero.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.55), rgba(15, 23, 42, 0.55)), url("${ruta}")`;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        hero.style.transition = 'background-image 0.7s ease-in-out';
    };

    aplicarFondo(listaHero[indice]);

    if (listaHero.length > 1) {
        setInterval(() => {
            indice = (indice + 1) % listaHero.length;
            aplicarFondo(listaHero[indice]);
        }, intervaloMs);
    }
}