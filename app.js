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

    vertices.push(v);

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
    const geo = aGeoJSON();
    const cruces = turf.kinks(geo);

    console.log('Puntos dibujados:', puntos);
    console.log('Polígono GeoJSON:', geo);
    console.log('Cruces detectados:', cruces.features);

    if (cruces.features.length > 0) {
        mostrarInfo(
            `Se detectaron ${cruces.features.length} cruces. ` +
            'Revisa el orden de los vértices.'
        );
        return;
    }

    // Reto 9: detectar cruces
    if (turf.kinks(geo).features.length > 0) {
        mostrarInfo(
            '¡Error! El polígono se cruza consigo mismo. ' +
            'Modifica los vértices antes de cerrarlo.'
        );
        return;
    }

    // Si no hay cruces, continúa tu código original
    poligono = L.polygon(puntos, {
        color: selectorColor.value,
        fillColor: selectorColor.value,
        fillOpacity: 0.35
    }).addTo(mapa);

    guardarPuntos();
    lineaGuia.setLatLngs([]);
    mapa.fitBounds(poligono.getBounds());

    const { area, perimetro } = medir();

    poligono.bindPopup(
        `Área: ${area.toFixed(1)} m²<br>` +
        `Perímetro: ${perimetro.toFixed(1)} m`
    ).openPopup();

    mostrarInfo(
        `Polígono cerrado. Área: ${area.toFixed(1)} m² ` +
        `(${(area / 10000).toFixed(3)} ha).`
    );

    actualizarBotones();
}
document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

function deshacerPunto() {
    if (puntos.length === 0 || poligono !== null) {
        return;
    }

    puntos.pop();

    const ultimoVertice = vertices.pop();

    if (ultimoVertice) {
        mapa.removeLayer(ultimoVertice);
    }

    lineaGuia.setLatLngs(puntos);

    guardarPuntos();
    actualizarTablaCoordenadas();
    actualizarBotones();

    mostrarInfo(`${puntos.length} vértice(s).`);
}
 
function limpiar() {
    // Eliminar los marcadores de los vértices
    vertices.forEach((v) => mapa.removeLayer(v));
    vertices = [];

    // Vaciar los puntos
    puntos = [];

    // Eliminar el polígono y marcarlo como abierto
    if (poligono) {
        mapa.removeLayer(poligono);
        poligono = null;
    }

    // Limpiar la línea guía
    lineaGuia.setLatLngs([]);

    // Guardar el estado después de limpiar todo
    guardarPuntos();

    // Actualizar la interfaz
    actualizarTablaCoordenadas();
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

    if (!datosGuardados) {
        actualizarTablaCoordenadas();
        actualizarBotones();
        return;
    }

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

    actualizarTablaCoordenadas();

    // Recuperar el estado del polígono
    const cerrado = JSON.parse(
        localStorage.getItem('poligonoCerrado') || 'false'
    );

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
    } else {
        lineaGuia.setLatLngs(puntos);
        mostrarInfo('Se recuperaron los vértices guardados.');
    }

    // Actualizar los botones después de recuperar el estado
    actualizarBotones();
}



/* Reto 6. Importar un archivo GeoJSON */
document.getElementById('archivoGeoJSON').addEventListener('change', (e) => {
    const archivo = e.target.files[0];

    // Verificar que se haya seleccionado un archivo
    if (!archivo) {
        return;
    }

    // Leer el contenido del archivo
    const lector = new FileReader();

    lector.onload = (evento) => {
        try {
            // Convertir el texto del archivo a un objeto JavaScript
            const datos = JSON.parse(evento.target.result);

            // Dibujar los datos GeoJSON en el mapa
            const capaImportada = L.geoJSON(datos, {
                style: {
                    color: selectorColor.value,
                    fillColor: selectorColor.value,
                    fillOpacity: 0.35
                },
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, {
                        radius: 6,
                        color: selectorColor.value,
                        fillColor: selectorColor.value,
                        fillOpacity: 1
                    });
                }
            }).addTo(mapa);

            // Ajustar el mapa para mostrar los datos importados
            if (capaImportada.getLayers().length > 0) {
                mapa.fitBounds(capaImportada.getBounds());
                mostrarInfo('Archivo GeoJSON importado correctamente.');
            } else {
                mostrarInfo('El archivo no contiene elementos para dibujar.');
                mapa.removeLayer(capaImportada);
            }

        } catch (error) {
            mostrarInfo('Error: el archivo no contiene un GeoJSON válido.');
            console.error(error);
        }
    };

    lector.onerror = () => {
        mostrarInfo('No se pudo leer el archivo seleccionado.');
    };

    lector.readAsText(archivo);

    // Permitir seleccionar el mismo archivo nuevamente
    e.target.value = '';
});


/* Reto 7. Detectar si el usuario está dentro o fuera del polígono */

function verificarUbicacion() {
    // Comprobar que exista un polígono cerrado
    if (poligono === null) {
        mostrarInfo('Primero debes dibujar y cerrar el polígono.');
        return;
    }

    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    mostrarInfo('Comprobando si estás dentro del polígono...');

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // Turf utiliza el orden [longitud, latitud]
            const puntoUsuario = turf.point([lng, lat]);

            // Convertir el polígono dibujado a GeoJSON
            const geo = aGeoJSON(
                document.getElementById('nombrePoligono').value.trim()
                    || 'Mi polígono'
            );

            // Comprobar si la ubicación está dentro del polígono
            const estaDentro = turf.booleanPointInPolygon(
                puntoUsuario,
                geo
            );

            if (estaDentro) {
                mostrarInfo('Estás DENTRO del polígono.');
            } else {
                mostrarInfo('Estás FUERA del polígono.');
            }

            // Mostrar la ubicación comprobada en el mapa
            if (marcadorUsuario) {
                marcadorUsuario.setLatLng([lat, lng]);
            } else {
                marcadorUsuario = L.marker([lat, lng])
                    .addTo(mapa);
            }

            marcadorUsuario
                .bindPopup(
                    estaDentro
                        ? 'Estás dentro del polígono'
                        : 'Estás fuera del polígono'
                )
                .openPopup();

            mapa.panTo([lat, lng]);
        },
        (err) => {
            const mensajes = {
                1: 'Permiso denegado. Activa la ubicación en el navegador.',
                2: 'No se pudo determinar la ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            mostrarInfo(
                mensajes[err.code] || 'No se pudo obtener tu ubicación.'
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

document.getElementById('verificarUbicacion').addEventListener('click', verificarUbicacion);



/* Reto 8. Geocerca en tiempo real */

let seguimientoId = null;
let ultimaPosicionDentro = null;

function iniciarGeocerca() {
    // El polígono debe estar cerrado
    if (poligono === null) {
        mostrarInfo('Primero debes dibujar y cerrar el polígono.');
        return;
    }

    // Evitar iniciar varios seguimientos simultáneos
    if (seguimientoId !== null) {
        mostrarInfo('El seguimiento ya está activo.');
        return;
    }

    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    ultimaPosicionDentro = null;
    mostrarInfo('Seguimiento activo. Comprobando tu ubicación...');

    document.getElementById('btnIniciarGeocerca').disabled = true;
    document.getElementById('btnDetenerGeocerca').disabled = false;

    seguimientoId = navigator.geolocation.watchPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            const puntoUsuario = turf.point([lng, lat]);
            const geo = aGeoJSON();

            const estaDentro = turf.booleanPointInPolygon(
                puntoUsuario,
                geo
            );

            // Actualizar o crear el marcador de ubicación
            if (marcadorUsuario) {
                marcadorUsuario.setLatLng([lat, lng]);
            } else {
                marcadorUsuario = L.marker([lat, lng]).addTo(mapa);
            }

            marcadorUsuario.bindPopup(
                estaDentro
                    ? 'Estás dentro de la geocerca'
                    : '¡Estás fuera de la geocerca!'
            );

            // Avisar solamente cuando se cruza el límite
            if (
                ultimaPosicionDentro === true &&
                estaDentro === false
            ) {
                mostrarInfo('¡ALERTA! Has salido de la geocerca.');
                alert('¡Atención! Has salido del polígono.');
            } else if (
                ultimaPosicionDentro === false &&
                estaDentro === true
            ) {
                mostrarInfo('Has vuelto a entrar en la geocerca.');
                alert('Has vuelto a entrar en el polígono.');
            } else if (ultimaPosicionDentro === null) {
                mostrarInfo(
                    estaDentro
                        ? 'Seguimiento activo: estás dentro de la geocerca.'
                        : 'Seguimiento activo: estás fuera de la geocerca.'
                );
            }

            ultimaPosicionDentro = estaDentro;
        },
        (err) => {
            const mensajes = {
                1: 'Permiso de ubicación denegado.',
                2: 'No se pudo determinar tu ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            mostrarInfo(
                mensajes[err.code] || 'Error al rastrear la ubicación.'
            );

            detenerGeocerca();
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

function detenerGeocerca() {
    if (seguimientoId !== null) {
        navigator.geolocation.clearWatch(seguimientoId);
        seguimientoId = null;
    }

    document.getElementById('btnIniciarGeocerca').disabled = false;
    document.getElementById('btnDetenerGeocerca').disabled = true;

    ultimaPosicionDentro = null;
    mostrarInfo('Seguimiento detenido.');
}

document.getElementById('btnIniciarGeocerca').addEventListener('click', iniciarGeocerca);

document.getElementById('btnDetenerGeocerca').addEventListener('click', detenerGeocerca);


recuperarPuntos();
