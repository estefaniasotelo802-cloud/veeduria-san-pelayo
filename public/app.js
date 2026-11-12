document.addEventListener('DOMContentLoaded', () => {
    obtenerObrasPublicas();
    inicializarMapa();
    inicializarChatbot();
});

// Variables globales para sincronizar tabla y mapa
let mapaGlobal = null;
const marcadoresObras = {};

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
            tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay obras registradas actualmente.</td></tr>`;
            return;
        }

        obras.forEach(obra => {
            const fila = document.createElement('tr');
            fila.style.cursor = 'pointer'; 
            
            const brutoPorcentaje = obra.avance_porcentaje !== undefined && obra.avance_porcentaje !== null ? obra.avance_porcentaje : 
                                   (obra.porcentaje !== undefined && obra.porcentaje !== null ? obra.porcentaje : 
                                   (obra.avance !== undefined && obra.avance !== null ? obra.avance : 0));
            const porcentajeVal = brutoPorcentaje !== '' ? brutoPorcentaje : 0;

            fila.innerHTML = `
                <td>${obra.nombre}</td>
                <td>${obra.sector}</td>
                <td>$${Number(obra.presupuesto).toLocaleString()}</td>
                <td><span class="badge ${obtenerClaseEstado(obra.estado)}">${obra.estado}</span></td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${porcentajeVal}%;"></div>
                        <span>${porcentajeVal}%</span>
                    </div>
                </td>
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
            tablaBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error al cargar la información. Intente más tarde.</td></tr>`;
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
        return '#2ecc71'; // Verde (Completado)
    }
    if (estado && (estado.toLowerCase().includes('proceso') || estado.toLowerCase().includes('ejecución'))) {
        return '#f39c12'; // Naranja (En proceso)
    }
    return '#e74c3c'; // Rojo (Pendiente)
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
                    <h4 style="margin: 0 0 5px 0; color: #2c3e50;">${obra.nombre}</h4>
                    <p style="margin: 3px 0;"><strong>Sector:</strong> ${obra.sector}</p>
                    <p style="margin: 3px 0;"><strong>Presupuesto:</strong> $${Number(obra.presupuesto).toLocaleString()}</p>
                    <p style="margin: 3px 0;"><strong>Estado:</strong> ${obra.estado}</p>
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

// 3. CHATBOT

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
        userMsg.style.cssText = "background: #8b0000; color: white; padding: 10px 14px; border-radius: 12px; border-bottom-right-radius: 4px; max-width: 85%; align-self: flex-end; word-break: break-word; line-height: 1.4; box-shadow: 0px 2px 5px rgba(0,0,0,0.03);";
        userMsg.textContent = texto;
        chatMessages.appendChild(userMsg);
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        setTimeout(() => {
            const botMsg = document.createElement('div');
            botMsg.style.cssText = "background: #ffffff; color: #334155; padding: 10px 14px; border-radius: 12px; border-bottom-left-radius: 4px; max-width: 85%; align-self: flex-start; word-break: break-word; line-height: 1.4; box-shadow: 0px 2px 5px rgba(0,0,0,0.03); border: 1px solid #f1f5f9;";
            
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