document.addEventListener('DOMContentLoaded', () => {
    obtenerObrasPublicas();
    inicializarMapa();
    inicializarChatbot();
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

function obtenerAvanceObra(obra) {
    const val = obra.avance_porcentaje ?? obra.porcentaje ?? obra.avance ?? 0;
    return val === '' ? 0 : val;
}

// 1. GESTIÓN DE LA TABLA PÚBLICA

async function obtenerObrasPublicas() {
    try {
        const respuesta = await fetch('/obras');
        if (!respuesta.ok) throw new Error('Error al conectar con el servidor para obtener las obras.');

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

            const porcentajeNum = Math.max(0, Math.min(100, Number(obtenerAvanceObra(obra)) || 0));
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

    mapaGlobal = L.map('map', { minZoom: 12, maxZoom: 19 }).setView([8.9564, -75.8369], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapaGlobal);

    cargarMarcadoresEnMapa(mapaGlobal);
}

function obtenerColorPorEstado(estado, porcentaje) {
    if (porcentaje >= 100 || (estado && estado.toLowerCase().includes('completado'))) return '#2ecc71';
    if (estado && (estado.toLowerCase().includes('proceso') || estado.toLowerCase().includes('ejecución'))) return '#f39c12';
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
            const porcentajeVal = obtenerAvanceObra(obra);
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
            marker.bindPopup(`
                <div style="font-family: Arial, sans-serif; min-width: 180px;">
                    <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${escaparHTML(obra.nombre)}</h4>
                    <p style="margin: 3px 0;"><strong>Sector:</strong> ${escaparHTML(obra.sector)}</p>
                    <p style="margin: 3px 0;"><strong>Presupuesto:</strong> $${Number(obra.presupuesto).toLocaleString()}</p>
                    <p style="margin: 3px 0;"><strong>Estado:</strong> ${escaparHTML(obra.estado)}</p>
                    <p style="margin: 3px 0;"><strong>Avance:</strong> ${porcentajeVal}%</p>
                </div>
            `);
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

document.addEventListener('click', (e) => {
    if (!e.target.closest('.reaccion-wrapper')) {
        cerrarPopoversReaccion();
    }
});

function cerrarPopoversReaccion() {
    document.querySelectorAll('.reaccion-picker-popover.abierto').forEach((el) => {
        el.classList.remove('abierto');
        const grid = el.querySelector('.grid-emojis-amplio');
        if (grid) grid.classList.remove('visible');
    });
}

function leerJSONLocal(clave, valorDefecto) {
    try {
        return JSON.parse(localStorage.getItem(clave) || JSON.stringify(valorDefecto));
    } catch (e) {
        return valorDefecto;
    }
}

function guardarJSONLocal(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {}
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

const obtenerTokensPropios = () => leerJSONLocal('veeduriaMisComentariosTokens', {});

function guardarTokenPropio(comentarioId, token) {
    if (!comentarioId || !token) return;
    const tokens = obtenerTokensPropios();
    tokens[String(comentarioId)] = token;
    guardarJSONLocal('veeduriaMisComentariosTokens', tokens);
}

function eliminarTokenPropio(comentarioId) {
    const tokens = obtenerTokensPropios();
    delete tokens[String(comentarioId)];
    guardarJSONLocal('veeduriaMisComentariosTokens', tokens);
}

function validarComentarioAutomatico(nombre, texto) {
    const autorLimpio = (nombre || '').trim();
    const limpio = (texto || '').trim();

    if (autorLimpio.length < 2) {
        return { valido: false, motivo: 'Escribe tu nombre (mínimo 2 caracteres).' };
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

    if (/(https?:\/\/|www\.|\.(com|co|net|org|io|gg|me|ly)\b)/i.test(limpio)) {
        return { valido: false, motivo: 'No se permiten enlaces ni direcciones web en el buzón ciudadano.' };
    }

    if (/(.)\1{6,}/i.test(limpio)) {
        return { valido: false, motivo: 'Evita repetir el mismo carácter muchas veces seguidas.' };
    }

    const palabrasBloqueadas = [
        'idiota', 'imbecil', 'imbécil', 'estupido', 'estúpido',
        'basura', 'mierda', 'puta', 'puto', 'malparido', 'gonorrea', 'hp'
    ];
    const normalizado = limpio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const encontrada = palabrasBloqueadas.find((palabra) => {
        const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escapada}\\b`, 'i').test(normalizado);
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

const obtenerReportesGuardados = () => leerJSONLocal('veeduriaReportesComentarios', {});
const guardarReportes = (reportes) => guardarJSONLocal('veeduriaReportesComentarios', reportes);

function obtenerIniciales(nombre) {
    if (!nombre) return '👤';
    const partes = nombre.trim().split(/\s+/);
    return partes.length >= 2
        ? (partes[0][0] + partes[1][0]).toUpperCase()
        : partes[0].substring(0, 2).toUpperCase();
}

async function reaccionarComentario(comentarioId, emoji) {
    try {
        const resp = await fetch(`/obras/comentarios/${encodeURIComponent(comentarioId)}/reaccionar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji, deviceId: obtenerDeviceId() })
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
    const token = obtenerTokensPropios()[String(comentarioId)];
    if (!token || !confirm('¿Deseas eliminar tu comentario?')) return;

    try {
        const respuesta = await fetch(`/obras/comentarios/${encodeURIComponent(comentarioId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-delete-token': token },
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
            const estabaAbierto = popover.classList.contains('abierto');
            cerrarPopoversReaccion();
            if (!estabaAbierto) popover.classList.add('abierto');
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
                cerrarPopoversReaccion();
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

    barra.querySelector('.btn-eliminar-propio')?.addEventListener('click', () => {
        if (c.id) eliminarComentarioPropio(c.id);
    });

    const btnReportar = barra.querySelector('.btn-reportar-comentario');
    if (btnReportar && !yaReportado) {
        btnReportar.addEventListener('click', () => reportarComentario(clave, btnReportar));
    }

    return barra;
}

async function enviarComentarioAlServidor(payload) {
    const resp = await fetch('/obras/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        throw new Error(data.error || 'No se pudo registrar el comentario.');
    }
    if (data.id && data.delete_token) {
        guardarTokenPropio(data.id, data.delete_token);
    }
    ultimoComentarioEnviado = { texto: payload.comentario, timestamp: Date.now() };
    return data;
}

function crearTarjetaComentarioHTML(autor, iniciales, fechaFormateada, obraInfo, textoComentario) {
    return `
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
            const total = Math.max(Number(c.reportes ?? c.total_reportes ?? 0), Number(reportesLocales[clave] || 0));
            return total < 3;
        });

        const principales = visibles.filter((c) => !c.parent_id);
        const respuestasPorPadre = {};

        visibles.filter((c) => c.parent_id).reverse().forEach((resp) => {
            const pid = String(resp.parent_id);
            (respuestasPorPadre[pid] ||= []).push(resp);
        });

        if (principales.length === 0) {
            contenedorComentarios.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay comentarios visibles en este momento.</p>';
            return;
        }

        principales.forEach((c, idx) => {
            const autor = c.ciudadano || c.nombre || 'Anónimo';
            const fechaFormateada = c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Reciente';
            const obraInfo = c.obra_nombre ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;">Obra: ${escaparHTML(c.obra_nombre)}</div>` : '';
            const clave = String(c.id ?? `${autor}-${c.fecha || idx}`);

            const divComentario = document.createElement('div');
            divComentario.className = 'comentario-item';
            divComentario.innerHTML = crearTarjetaComentarioHTML(
                autor,
                obtenerIniciales(autor),
                fechaFormateada,
                obraInfo,
                c.comentario || c.texto || ''
            );

            const contenidoEl = divComentario.querySelector('.comentario-contenido');
            const barraAcciones = construirBarraAcciones(c, clave, reportesLocales, tokensPropios, true);
            contenidoEl.appendChild(barraAcciones);

            const btnResponder = barraAcciones.querySelector('.btn-abrir-respuesta');
            if (btnResponder && c.id) {
                btnResponder.addEventListener('click', () => {
                    const cajaExistente = contenidoEl.querySelector('.caja-respuesta-inline');
                    if (cajaExistente) {
                        cajaExistente.remove();
                        return;
                    }

                    const caja = document.createElement('div');
                    caja.className = 'caja-respuesta-inline';
                    caja.innerHTML = `
                        <input type="text" class="input-resp-nombre" placeholder="Tu nombre" maxlength="60">
                        <textarea class="input-resp-texto" rows="2" placeholder="Escribe una respuesta para ${escaparHTML(autor)}..." maxlength="400"></textarea>
                        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 2px;">
                            <button type="button" class="btn-texto-limpio btn-cancelar-resp">Cancelar</button>
                            <button type="button" class="btn-texto-limpio btn-enviar-resp" style="color: #508C46 !important; font-weight: 600 !important;">Responder</button>
                        </div>
                    `;

                    caja.querySelector('.btn-cancelar-resp').addEventListener('click', () => caja.remove());
                    caja.querySelector('.btn-enviar-resp').addEventListener('click', async () => {
                        const validacion = validarComentarioAutomatico(
                            caja.querySelector('.input-resp-nombre').value,
                            caja.querySelector('.input-resp-texto').value
                        );
                        if (!validacion.valido) return alert(validacion.motivo);

                        try {
                            await enviarComentarioAlServidor({
                                ciudadano: validacion.autor,
                                comentario: validacion.texto,
                                parent_id: c.id
                            });
                            await cargarComentariosPublicos();
                        } catch (e) {
                            alert(e.message || 'No se pudo conectar con el servidor.');
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
                    const hFecha = h.fecha ? new Date(h.fecha).toLocaleDateString() : 'Reciente';
                    const hClave = String(h.id ?? `${hAutor}-${h.fecha || hIdx}`);

                    const divHijo = document.createElement('div');
                    divHijo.className = 'respuesta-item';
                    divHijo.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 2px;">
                            <span style="font-weight: 600; font-size: 0.84rem; color: #1e293b;">${escaparHTML(hAutor)}</span>
                            <span style="font-size: 0.74rem; color: #64748b;">${hFecha}</span>
                        </div>
                        <p style="margin: 0; font-size: 0.88rem; color: #334155;">${escaparHTML(h.comentario || h.texto || '')}</p>
                    `;
                    divHijo.appendChild(construirBarraAcciones(h, hClave, reportesLocales, tokensPropios, false));
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

        try {
            await enviarComentarioAlServidor({
                ciudadano: validacion.autor,
                comentario: validacion.texto
            });
            inputNombre.value = '';
            inputTexto.value = '';
            mostrarAvisoComentario('Tu comentario fue publicado correctamente.', false);
            cargarComentariosPublicos();
        } catch (error) {
            console.error('Error al enviar el comentario:', error);
            mostrarAvisoComentario(error.message || 'No se pudo conectar con el servidor.', true);
        }
    });
}

// 5. CHATBOT

function responderChatbot(texto) {
    const lower = texto.toLowerCase();
    if (/(hola|buenos dias|buenas tardes|saludos)/.test(lower)) {
        return '¡Hola! Es un gusto saludarte. ¿Sobre cuál de las obras de San Pelayo te gustaría consultar hoy?';
    }
    if (/(gracias|muy amable|excelente|perfecto)/.test(lower)) {
        return 'Con gusto, fue un placer ayudarte. Si tienes alguna otra duda sobre las obras del municipio, aquí estaré.';
    }
    if (/(gas|pelayito|brisas)/.test(lower)) {
        return 'La obra de Expansión de Gas Domiciliario en Pelayito y Brisas del Sinú tiene un presupuesto de $92,800,000 y un avance del 95% (En pruebas técnicas).';
    }
    if (/(puente|sabana|cañuelar)/.test(lower)) {
        return 'La Reconstrucción y Mitigación del Puente Cañuelar en Sabana Nueva cuenta con un presupuesto de $87,000,000,000 y se encuentra finalizada (100%).';
    }
    if (/(pavimentación|guamas|carrillo|vial)/.test(lower)) {
        return 'La Pavimentación del Corredor Vial Carrillo - Las Guamas tiene un presupuesto de $10,000,000,000 y presenta un 50% de avance en ejecución.';
    }
    return 'No logré identificar exactamente el proyecto del que hablas, pero puedes preguntarme libremente por el gas en Pelayito, el puente de Sabana Nueva o la vía a Las Guamas. ¿A cuál de ellas te refieres?';
}

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
    chatCloseBtn?.addEventListener('click', () => {
        chatBox.style.display = 'none';
    });

    function agregarMensaje(texto, clase) {
        const msg = document.createElement('div');
        msg.className = `message ${clase}`;
        msg.textContent = texto;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function enviarMensaje() {
        const texto = chatInput.value.trim();
        if (!texto) return;
        agregarMensaje(texto, 'user-message');
        chatInput.value = '';
        setTimeout(() => agregarMensaje(responderChatbot(texto), 'bot-message'), 600);
    }

    chatSendBtn?.addEventListener('click', enviarMensaje);
    chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarMensaje();
    });
}

// 6. MENÚ MÓVIL Y ANIMACIONES SCROLL REVEAL

function inicializarMenuMovilYAnimaciones() {
    const toggleBtn = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-links-menu');

    if (toggleBtn && navMenu) {
        toggleBtn.addEventListener('click', () => navMenu.classList.toggle('active'));
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navMenu.classList.remove('active'));
        });
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.section-container').forEach(sec => observer.observe(sec));
}

// 7. ACCESIBILIDAD INTEGRAL

function leerAccStorage(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
}

function guardarAccStorage(clave, valor) {
    try {
        if (valor === null) localStorage.removeItem(clave);
        else localStorage.setItem(clave, String(valor));
    } catch (e) {}
}

function aplicarEscalaFuente() {
    document.documentElement.style.fontSize = `${accTamanoPx}px`;
    const label = document.getElementById('accTamanoLabel');
    if (label) label.textContent = `${accTamanoPx}px`;
    guardarAccStorage('veeduriaTamanoPx', accTamanoPx);
    guardarAccStorage('veeduriaZoomTexto', zoomTextoActual);
}

function toggleAccMenu() {
    const panel = document.getElementById('accMenuPanel');
    const btn = document.getElementById('btnAccMenu');
    if (!panel) return;

    const oculto = panel.hasAttribute('hidden');
    if (oculto) {
        panel.removeAttribute('hidden');
        btn?.setAttribute('aria-expanded', 'true');
        aplicarEscalaFuente();
    } else {
        panel.setAttribute('hidden', '');
        btn?.setAttribute('aria-expanded', 'false');
    }
}

function cambiarTabAccesibilidad(nombreTab) {
    document.querySelectorAll('.acc-tab').forEach(tab => {
        tab.classList.toggle('is-active', tab.dataset.accTab === nombreTab);
    });
    document.querySelectorAll('.acc-tab-content').forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.accPanel === nombreTab);
    });
}

function actualizarEtiquetaPx() {
    const label = document.getElementById('accTamanoLabel');
    if (label) label.textContent = `${accTamanoPx}px`;
}

function ajustarTamanoPx(deltaPx) {
    accTamanoPx = Math.min(26, Math.max(12, accTamanoPx + deltaPx));
    zoomTextoActual = Math.round((accTamanoPx * 100) / 16);
    aplicarEscalaFuente();
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

    ['switchLecturaFacil', 'switchResaltarEnlaces', 'switchAltoContraste'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    setModoAccesibilidad('normal');
    detenerLectura();

    ['veeduriaTamanoPx', 'veeduriaZoomTexto', 'veeduria_acc-lectura-facil', 'veeduria_acc-resaltar-enlaces']
        .forEach(k => guardarAccStorage(k, null));
}

function leerPaginaEnVozAlta() {
    if (!('speechSynthesis' in window)) {
        return alert('Tu navegador no soporta lectura en voz alta.');
    }
    window.speechSynthesis.cancel();

    const textoSeleccionado = window.getSelection().toString().trim();
    const secciones = ['inicio', 'objetivo', 'historia', 'comentarios', 'veeduria']
        .map(id => document.getElementById(id)?.innerText || '')
        .join('. ');

    const mensaje = new SpeechSynthesisUtterance(textoSeleccionado || secciones);
    mensaje.lang = 'es-CO';
    mensaje.rate = 0.95;
    window.speechSynthesis.speak(mensaje);
}

function detenerLectura() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function cambiarTamanoTexto(cambio) {
    if (cambio === 0) {
        zoomTextoActual = 100;
        accTamanoPx = 16;
        document.documentElement.style.fontSize = '';
        actualizarEtiquetaPx();
        guardarAccStorage('veeduriaTamanoPx', null);
        guardarAccStorage('veeduriaZoomTexto', null);
        return;
    }
    zoomTextoActual = Math.min(140, Math.max(80, zoomTextoActual + cambio));
    accTamanoPx = Math.round((16 * zoomTextoActual) / 100);
    aplicarEscalaFuente();
}

function toggleOpcionExtra(claseCss, idBoton, forzarEstado = null) {
    const control = document.getElementById(idBoton);
    const activo = typeof forzarEstado === 'boolean'
        ? forzarEstado
        : (control && control.type === 'checkbox' ? control.checked : !document.body.classList.contains(claseCss));

    document.body.classList.toggle(claseCss, activo);
    document.documentElement.classList.toggle(claseCss, activo);

    if (control && control.type === 'checkbox') control.checked = activo;
    else control?.classList.toggle('activo', activo);

    guardarAccStorage('veeduria_' + claseCss, activo ? '1' : '0');
}

function setModoAccesibilidad(modo) {
    const modoValido = modo || 'normal';
    const root = document.documentElement;
    root.classList.remove('acc-deuteranopia', 'acc-protanopia', 'acc-tritanopia', 'acc-contraste');
    if (modoValido !== 'normal') root.classList.add('acc-' + modoValido);

    const selector = document.querySelector('#accMenuPanel .acc-select, #accModoColorSelect');
    if (selector) selector.value = modoValido;

    const switchContraste = document.getElementById('switchAltoContraste');
    if (switchContraste) switchContraste.checked = modoValido === 'contraste';

    guardarAccStorage('modoAccesibilidadVeeduria', modoValido);
}

function inicializarAccesibilidad() {
    document.addEventListener('click', (e) => {
        const toolbar = document.querySelector('.acc-toolbar');
        const panel = document.getElementById('accMenuPanel');
        const btn = document.getElementById('btnAccMenu');
        if (toolbar && panel && !panel.hasAttribute('hidden') && !toolbar.contains(e.target)) {
            panel.setAttribute('hidden', '');
            btn?.setAttribute('aria-expanded', 'false');
        }
    });

    setModoAccesibilidad(leerAccStorage('modoAccesibilidadVeeduria') || 'normal');

    const pxGuardado = parseInt(leerAccStorage('veeduriaTamanoPx'), 10);
    const zoomGuardado = parseInt(leerAccStorage('veeduriaZoomTexto'), 10);
    if (pxGuardado >= 12 && pxGuardado <= 26) {
        accTamanoPx = pxGuardado;
        document.documentElement.style.fontSize = `${accTamanoPx}px`;
    } else if (zoomGuardado >= 80 && zoomGuardado <= 140) {
        zoomTextoActual = zoomGuardado;
        accTamanoPx = Math.round((16 * zoomTextoActual) / 100);
        document.documentElement.style.fontSize = zoomTextoActual + '%';
    }
    actualizarEtiquetaPx();

    if (leerAccStorage('veeduria_acc-lectura-facil') === '1') {
        toggleOpcionExtra('acc-lectura-facil', 'switchLecturaFacil', true);
    }
    if (leerAccStorage('veeduria_acc-resaltar-enlaces') === '1') {
        toggleOpcionExtra('acc-resaltar-enlaces', 'switchResaltarEnlaces', true);
    }
}

// 8. GALERÍA INTERACTIVA DE SAN PELAYO

const FOTOS_GALERIA_SAN_PELAYO = [
    {
        id: 'puente-sinu',
        titulo: 'Puente Metálico sobre el Río Sinú',
        categoria: 'infraestructura',
        imagen: '/galeria/puente-sinu.jpg',
        descripcion: 'Ícono de conectividad y movilidad que enlaza a San Pelayo con el resto de Córdoba.'
    },
    {
        id: 'planchon-sinu',
        titulo: 'Cruce Fluvial en el Río Sinú',
        categoria: 'infraestructura',
        imagen: '/galeria/planchon-sinu.jpg',
        descripcion: 'Transporte tradicional sobre el río Sinú que acompaña la vida cotidiana y productiva ribereña.'
    },
    {
        id: 'monumento-porro',
        titulo: 'Monumento a los Instrumentos del Porro',
        categoria: 'cultura',
        imagen: '/galeria/monumento-porro.jpg',
        descripcion: 'Homenaje a las bandas y ritmos tradicionales que hacen de San Pelayo cuna del porro.'
    },
    {
        id: 'danza-porro',
        titulo: 'Danza y Tradición Folclórica',
        categoria: 'cultura',
        imagen: '/galeria/danza-porro.jpg',
        descripcion: 'Expresión cultural con trajes coloridos y percusión que mantiene viva la identidad local.'
    },
    {
        id: 'plaza-sombreros',
        titulo: 'Plaza y Monumentos con Sombrero Vueltiao',
        categoria: 'espacio',
        imagen: '/galeria/plaza-sombreros.jpg',
        descripcion: 'Entorno urbano central donde confluyen símbolos artesanales, música y encuentro ciudadano.'
    },
    {
        id: 'fuente-monumento',
        titulo: 'Fuente y Monumento Tradicional',
        categoria: 'espacio',
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

    const cerrarFotoModal = () => modal?.setAttribute('hidden', '');

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
                if (!yaActiva) card.classList.add('activa');
                else abrirFotoModal(foto);
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

    cerrarModal?.addEventListener('click', cerrarFotoModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) cerrarFotoModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hasAttribute('hidden')) cerrarFotoModal();
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