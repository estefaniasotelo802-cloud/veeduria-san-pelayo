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

// 3. GESTIÓN DE COMENTARIOS PÚBLICOS CON AVATAR

function obtenerIniciales(nombre) {
    if (!nombre || nombre.toLowerCase() === 'anónimo') return '👤';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
        return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return partes[0].substring(0, 2).toUpperCase();
}

async function cargarComentariosPublicos() {
    const contenedorComentarios = document.getElementById('contenedorComentarios') || document.getElementById('listaComentarios');
    if (!contenedorComentarios) return;

    try {
        const respuesta = await fetch('/obras/comentarios');
        const comentarios = await respuesta.json();

        contenedorComentarios.innerHTML = '';

        if (!Array.isArray(comentarios) || comentarios.length === 0) {
            contenedorComentarios.innerHTML = '<p style="text-align: center; color: #64748b; padding: 20px;">No hay comentarios registrados aún. ¡Sé el primero en opinar!</p>';
            return;
        }

        comentarios.forEach(c => {
            const autor = c.ciudadano || c.nombre || 'Anónimo';
            const iniciales = obtenerIniciales(autor);
            const textoComentario = c.comentario || c.texto || '';
            const fechaFormateada = c.fecha ? new Date(c.fecha).toLocaleDateString() : 'Reciente';
            const obraInfo = c.obra_nombre ? `<div style="font-size: 12px; color: #0284c7; margin-top: 2px;">Obra: ${escaparHTML(c.obra_nombre)}</div>` : '';

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
            contenedorComentarios.appendChild(divComentario);
        });

    } catch (error) {
        console.error('Error al cargar comentarios públicos:', error);
    }
}

// 4. ENVÍO DE NUEVOS COMENTARIOS (POST)

function inicializarFormularioComentarios() {
    const form = document.getElementById('formComentario') || document.querySelector('form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const inputNombre = document.getElementById('nombreUsuario') || document.querySelector('input[name="ciudadano"]') || document.querySelector('input[type="text"]');
        const inputTexto = document.getElementById('textoComentario') || document.querySelector('textarea');

        if (!inputNombre || !inputTexto) return;

        const nuevoComentario = {
            ciudadano: inputNombre.value.trim() || 'Anónimo',
            comentario: inputTexto.value.trim()
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
                inputNombre.value = '';
                inputTexto.value = '';
                cargarComentariosPublicos();
            } else {
                alert('Hubo un error al registrar el comentario en el servidor.');
            }
        } catch (error) {
            console.error('Error de red al enviar el comentario:', error);
            alert('No se pudo conectar con el servidor.');
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
        document.getElementById('modalImagen').src = foto.imagen;
        document.getElementById('modalImagen').alt = foto.titulo;
        document.getElementById('modalCategoria').textContent = foto.etiqueta;
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
                    <span class="galeria-tag">${foto.etiqueta}</span>
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