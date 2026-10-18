const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicación 
 
const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15); 

let marcadorUsuario = null; 
let circuloPrecision = null; 
let puntos = [];    // array de [lat, lng] 
let vertices = [];  // marcadores visibles de cada vértice 
let poligono = null; 
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa); 
 
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    maxZoom: 19, 
    attribution: '&copy; OpenStreetMap contributors' 
}).addTo(mapa); 
 
function mostrarInfo(texto) { 
    document.getElementById('info').textContent = texto; 
} 
 
// Reto 1. Tabla de coordenadas
function actualizarTablaCoordenadas() {
  const tabla = document.getElementById('tablaCoordenadas');

  // Vaciar la tabla antes de actualizarla
  tabla.innerHTML = '';

  if (puntos.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');

    celda.colSpan = 3;
    celda.textContent = 'Todavía no hay vértices.';

    fila.appendChild(celda);
    tabla.appendChild(fila);

    return;
  }

  // Recorrer los puntos
  puntos.forEach((punto, indice) => {
    const fila = document.createElement('tr');

    const celdaNumero = document.createElement('td');
    const celdaLatitud = document.createElement('td');
    const celdaLongitud = document.createElement('td');

    celdaNumero.textContent = indice + 1;
    celdaLatitud.textContent = punto[0].toFixed(6);
    celdaLongitud.textContent = punto[1].toFixed(6);

    fila.appendChild(celdaNumero);
    fila.appendChild(celdaLatitud);
    fila.appendChild(celdaLongitud);

    tabla.appendChild(fila);
  });
}

function ubicarUsuario() { 
    if(!('geolocation' in navigator)) { 
        mostrarInfo('Tu navegador no soporta geolocalización.'); 
        return; 
    } 
    mostrarInfo('Buscando tu ubicación...'); 
 
    navigator.geolocation.getCurrentPosition( 
    (pos) => { 
        const { latitude, longitude, accuracy } = pos.coords; 
        const punto = [latitude, longitude]; 
 
        if (marcadorUsuario) mapa.removeLayer(marcadorUsuario); 
        if (circuloPrecision) mapa.removeLayer(circuloPrecision); 
 
        marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup(); 
        circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1 
    }).addTo(mapa); 
    mapa.setView(punto, 17); 
    mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`); 
}, 
    (err) => { 
        const mensajes = { 
            1: 'Permiso denegado. Activa la ubicación en el navegador.', 
            2: 'No se pudo determinar la ubicación.', 
            3: 'Se agotó el tiempo de espera.' 
        }; 
        mostrarInfo(mensajes[err.code] || 'Error desconocido.'); 
    }, 
    { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
    } 
  ); 
} 
 
document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario); 
ubicarUsuario(); 


mapa.on('click', (e) => { 
    if (poligono) return; // si ya está cerrado, no se agregan más puntos 
 
    const { lat, lng } = e.latlng; 
    puntos.push([lat, lng]); 

    guardarPuntos();

    actualizarTablaCoordenadas();

    console.log(puntos);
 
    const v = L.circleMarker([lat, lng], {
        radius: 6,
        color: selectorColor.value,
        fillColor: selectorColor.value,
        fillOpacity: 1
    }).addTo(mapa);

    lineaGuia.setLatLngs(puntos); 
    actualizarBotones(); 
    mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`); 
}); 
 
function actualizarBotones() { 
    document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null; 
    document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null; 
    document.getElementById('btnExportar').disabled = poligono === null; 
} 


// Reto 3. Dar la opción al usuario de que pueda ponerle un nombre al polígono
function aGeoJSON(nombrePoligono = 'Mi polígono') {
    const anillo = puntos.map(([lat, lng]) => [lng, lat]);
    anillo.push(anillo[0]);

    return turf.polygon([anillo], {
        nombre: nombrePoligono,
        creado: new Date().toISOString()
    });
}


 
function medir() { 
    const geo = aGeoJSON(); 
    const area = turf.area(geo); // metros cuadrados 
    const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' }); 
    return { area, perimetro }; 
} 
 
function cerrarPoligono() { 
    poligono = L.polygon(puntos, {
        color: selectorColor.value,
        fillColor: selectorColor.value,
        fillOpacity: 0.35
    }).addTo(mapa);

    guardarPuntos();

    lineaGuia.setLatLngs([]); 
    mapa.fitBounds(poligono.getBounds()); 
 
    const { area, perimetro } = medir(); 
    poligono.bindPopup(`Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`).openPopup(); 
    mostrarInfo(`Polígono cerrado. Área: ${area.toFixed(1)} m² (${(area / 10000).toFixed(3)} ha).`); 
    actualizarBotones(); 
} 
document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

function deshacerPunto() { 
    puntos.pop(); 
    guardarPuntos();
    mapa.removeLayer(vertices.pop()); 
    lineaGuia.setLatLngs(puntos); 
    actualizarBotones(); 
    mostrarInfo(`${puntos.length} vértice(s).`); 
} 
 
function limpiar() { 
    puntos = []; 
    guardarPuntos();
    vertices.forEach((v) => mapa.removeLayer(v)); 
    vertices = []; 
    lineaGuia.setLatLngs([]); 
    if (poligono) { 
        mapa.removeLayer(poligono); 
        poligono = null; 
    } 

    actualizarBotones(); 
    mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.'); 
} 
 
document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto); 
document.getElementById('btnLimpiar').addEventListener('click', limpiar);



function exportar() {
    const campoNombre = document.getElementById('nombrePoligono');
    const nombre = campoNombre.value.trim();

    if (!nombre) {
        campoNombre.focus();
        campoNombre.setCustomValidity('Escribe un nombre para el polígono.');
        campoNombre.reportValidity();
        campoNombre.setCustomValidity('');
        return;
    }

    const geojson = aGeoJSON(nombre);
    const texto = JSON.stringify(geojson, null, 2);

    const blob = new Blob([texto], {
        type: 'application/geo+json'
    });

    const enlace = document.createElement('a');
    const url = URL.createObjectURL(blob);

    enlace.href = url;

    const nombreArchivo = nombre.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

    enlace.download = nombreArchivo + '.geojson';
    enlace.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    mostrarInfo(`Polígono "${nombre}" exportado correctamente.`);
}


document.getElementById('btnExportar').addEventListener('click', exportar); 


const selectorColor = document.getElementById('colorPoligono');


selectorColor.addEventListener('input', (e) => {
    const color = e.target.value;

    // Cambiar el color del polígono cerrado
    if (poligono) {
        poligono.setStyle({
            color: color,
            fillColor: color
        });
    }

    // Cambiar el color de todos los vértices existentes
    vertices.forEach((vertice) => {
        vertice.setStyle({
            color: color,
            fillColor: color
        });
    });

    // Cambiar el color de la línea guía
    lineaGuia.setStyle({
        color: color
    });
});


// Reto 4. Agregar un vértice con la ubicación actual del usuario
function agregarVerticeUbicacion() {

    // Verificar si el navegador permite obtener la ubicación
    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    mostrarInfo('Obteniendo tu ubicación actual...');

    // Obtener las coordenadas actuales del usuario
    navigator.geolocation.getCurrentPosition(

        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // Crear el punto y agregarlo a la lista de vértices
            const punto = [lat, lng];
            puntos.push(punto);

            guardarPuntos();

            // Actualizar la tabla de coordenadas
            actualizarTablaCoordenadas();

            // Dibujar un marcador en el mapa
            const v = L.circleMarker(punto, {
                radius: 6,
                color: selectorColor.value,
                fillColor: selectorColor.value,
                fillOpacity: 1
            }).addTo(mapa);

            vertices.push(v);

            // Actualizar la línea que une los vértices
            lineaGuia.setLatLngs(puntos);

            // Actualizar el estado de los botones
            actualizarBotones();

            mostrarInfo(
                `Vértice agregado: ${lat.toFixed(6)}, ${lng.toFixed(6)}.`
            );
        },

        (err) => {
            const mensajes = {
                1: 'Permiso denegado. Activa la ubicación en el navegador.',
                2: 'No se pudo determinar la ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            mostrarInfo(mensajes[err.code] || 'Error desconocido.');
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Asocia la función al botón del Reto 4
document.getElementById('btnAgregarUbicacion').addEventListener('click', agregarVerticeUbicacion);


// Reto 5. Guardar los puntos y el estado del polígono
function guardarPuntos() {
    localStorage.setItem(
        'puntosPoligono',
        JSON.stringify(puntos)
    );

    localStorage.setItem(
        'poligonoCerrado',
        JSON.stringify(poligono !== null)
    );
}

// Recuperar los puntos guardados al abrir la página
function recuperarPuntos() {
    const datosGuardados = localStorage.getItem('puntosPoligono');

    if (datosGuardados) {
        puntos = JSON.parse(datosGuardados);

        // Dibujar los vértices recuperados
        puntos.forEach((punto) => {
            const v = L.circleMarker(punto, {
                radius: 6,
                color: selectorColor.value,
                fillColor: selectorColor.value,
                fillOpacity: 1
            }).addTo(mapa);

            vertices.push(v);
        });

        // Volver a mostrar la línea y la tabla
        lineaGuia.setLatLngs(puntos);
        actualizarTablaCoordenadas();
        actualizarBotones();

        const cerrado = JSON.parse(localStorage.getItem('poligonoCerrado') || 'false');

        if (cerrado && puntos.length >= 3) {
            poligono = L.polygon(puntos, {
            color: selectorColor.value,
            fillColor: selectorColor.value,
            fillOpacity: 0.35
        }).addTo(mapa);

        lineaGuia.setLatLngs([]);
        mapa.fitBounds(poligono.getBounds());

        const { area, perimetro } = medir();

        poligono.bindPopup(
            `Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`
        );

        mostrarInfo(
            `Polígono recuperado. Área: ${area.toFixed(1)} m².`
        );
    }

        mostrarInfo('Se recuperaron los vértices guardados.');
    }
}

recuperarPuntos();
