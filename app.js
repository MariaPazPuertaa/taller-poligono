// Se utiliza para el manejo de errores, entonces avisa si Leaflet o Turf no se cargaron.
if (typeof L === 'undefined' || typeof turf === 'undefined') {
    document.getElementById('info').textContent =
        'No se pudieron cargar las librerías del mapa. Revisa tu conexión a internet.';
    throw new Error('El Leaflet o el Turf no se cargaron correctamente');
}

// Coordenadas iniciales del mapa, utilizadas si no se puede obtener la ubicación.
const CENTRO_INICIAL = [5.0689, -75.5174]; // Manizales, por si falla la ubicación

// Crea el mapa y establece su centro inicial y nivel de zoom.
const mapa = L.map('mapa').setView(CENTRO_INICIAL, 15);

// Recalcula el tamaño del mapa si el contenedor cambia, es decir, evita que se vea recortado.
window.addEventListener('load', () => mapa.invalidateSize());
new ResizeObserver(() => mapa.invalidateSize()).observe(document.getElementById('mapa'));

// Guarda el marcador que representa la ubicación actual.
let marcadorUsuario = null;

// Guarda el círculo que representa la precisión de la ubicación.
let circuloPrecision = null;

// Almacena las coordenadas de los vértices en formato [latitud, longitud].
let puntos = [];    // array de [lat, lng]

// Almacena los marcadores visibles que representan cada vértice o punto.
let vertices = [];  // marcadores visibles de cada vértice

// Guarda el polígono dibujado una vez que se recarga la página.
let poligono = null;

// Crea la línea provisional que conecta los vértices antes de cerrar el polígono.
const lineaGuia = L.polyline([], { color: '#e67e22', dashArray: '6 6' }).addTo(mapa);

// Carga la capa de mosaicos de OpenStreetMap que sirve como mapa de fondo.
const capaMosaicos = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

// Se utiliza el manejo de errores, entonces avisa si no se pueden cargar los mosaicos del mapa.
capaMosaicos.on('tileerror', () => {
    mostrarInfo('No se pudo cargar parte del mapa. Revisa tu conexión a internet.');
});

// Muestra un mensaje en el elemento que indica el estado de la página.
function mostrarInfo(texto) {
    document.getElementById('info').textContent = texto;
}

// Reto 1. Tabla de coordenadas
function actualizarTablaCoordenadas() {

  // Obtiene el cuerpo de la tabla donde se muestran los vértices.
  const tabla = document.getElementById('tablaCoordenadas');

  // Se utiliza para vaciar la tabla antes de actualizarla.
  tabla.innerHTML = '';

  // Comprueba si todavía no se ha agregado ningún vértice o punto.
  if (puntos.length === 0) {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');

    // Hace que el mensaje ocupe las tres columnas de la tabla.
    celda.colSpan = 3;
    celda.textContent = 'Todavía no hay vértices.';

    // Agrega la celda a la fila y la fila a la tabla.
    fila.appendChild(celda);
    tabla.appendChild(fila);

    return;
  }

  // Recorrer los puntos o vértices
  puntos.forEach((punto, indice) => {

    // Crea una fila para mostrar la información de cada vértice.
    const fila = document.createElement('tr');

    // Crea las columnas correspondientes al número, la latitud y la longitud.
    const celdaNumero = document.createElement('td');
    const celdaLatitud = document.createElement('td');
    const celdaLongitud = document.createElement('td');

    // Muestra el número del vértice o punto y sus coordenadas con seis decimales.
    celdaNumero.textContent = indice + 1;
    celdaLatitud.textContent = punto[0].toFixed(6);
    celdaLongitud.textContent = punto[1].toFixed(6);

    // Organiza las tres columnas dentro de la fila.
    fila.appendChild(celdaNumero);
    fila.appendChild(celdaLatitud);
    fila.appendChild(celdaLongitud);

    // Agrega la fila completa a la tabla.
    tabla.appendChild(fila);
  });
}

// Obtiene y muestra la ubicación actual en el mapa.
function ubicarUsuario() {
    // Comprueba si el navegador permite utilizar la geolocalización.
    if(!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    // Se muestra un mensaje de que se está intentando obtener la ubicación.
    mostrarInfo('Buscando tu ubicación...');

    // Solicita las coordenadas actuales al navegador.
    navigator.geolocation.getCurrentPosition(
    (pos) => {
        // Extrae la latitud, la longitud y la precisión de la ubicación obtenida.
        const { latitude, longitude, accuracy } = pos.coords;
        const punto = [latitude, longitude];

        // Elimina los elementos anteriores para mostrar únicamente la ubicación más reciente.
        if (marcadorUsuario) mapa.removeLayer(marcadorUsuario);
        if (circuloPrecision) mapa.removeLayer(circuloPrecision);

        // Coloca un marcador en la ubicación que se requiera y se muestra un mensaje emergente.
        marcadorUsuario = L.marker(punto).addTo(mapa).bindPopup('Estás aquí').openPopup();

        // Dibuja un círculo que representa el margen de precisión de la ubicación.
        circuloPrecision = L.circle(punto, { radius: accuracy, fillOpacity: 0.1
    }).addTo(mapa);

    // Centra el mapa en la ubicación obtenida y ajusta el zoom.
    mapa.setView(punto, 17);

    // Informa que se encontró la ubicación y muestra su precisión aproximada.
    mostrarInfo(`Ubicación encontrada (precisión: ${Math.round(accuracy)} m). Haz clic para dibujar.`);
},
    (err) => {
        // Define los mensajes que se mostrarán según el error de geolocalización.
        const mensajes = {
            1: 'El permiso fue denegado. Activa la ubicación en el navegador.',
            2: 'No se pudo determinar la ubicación.',
            3: 'Se agotó el tiempo de espera.'
        };

        // Muestra el mensaje al error recibido.
        mostrarInfo(mensajes[err.code] || 'Error desconocido.');
    },
    {
        // Solicita la mayor precisión disponible, establece el tiempo máximo de espera
        // y evita utilizar una ubicación almacenada anteriormente.
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    }
  );
}

// Empareja la función de geolocalización al botón correspondiente.
document.getElementById('btnUbicar').addEventListener('click', ubicarUsuario);

// Intenta obtener la ubicación al cargar la página.
ubicarUsuario();

// Detecta los clicks realizados sobre el mapa para agregar nuevos vértices.
mapa.on('click', (e) => {
    // Si ya está cerrado, no se agregan más puntos o vértices.
    if (poligono) return;

    // Obtiene las coordenadas del lugar donde se hizo el click.
    const { lat, lng } = e.latlng;
    puntos.push([lat, lng]);

    // Se llama a la función guardarPuntos() que guarda el nuevo vértice en el almacenamiento local del navegador.
    guardarPuntos();

    // Actualiza la tabla para agregar el vértice agregado.
    actualizarTablaCoordenadas();

    // Muestra las coordenadas en la consola.
    console.log(puntos);

    // Dibuja un marcador para representar el nuevo vértice graficamente.
    const v = L.circleMarker([lat, lng], {
        radius: 6,
        color: selectorColor.value,
        fillColor: selectorColor.value,
        fillOpacity: 1
    }).addTo(mapa);

    // Guarda el marcador para poder modificarlo o eliminarlo.
    vertices.push(v);

    // Actualiza la línea que conecta los vértices.
    lineaGuia.setLatLngs(puntos);

    // Actualiza los botones según la cantidad de vértices y el estado del polígono.
    actualizarBotones();

    // Informa cuántos vértices se han agregado y cuántos se necesitan para cerrarlo.
    mostrarInfo(`${puntos.length} vértice(s). Necesitas al menos 3 para cerrar.`);
});

// Habilita o deshabilita los botones según el estado actual del polígono.
function actualizarBotones() {
    // Solo permite cerrar el polígono cuando hay tres vértices o más y sigue abierto.
    document.getElementById('btnCerrar').disabled = puntos.length < 3 || poligono !== null;

    // Solo permite deshacer cuando existe algún vértice y el polígono sigue abierto.
    document.getElementById('btnDeshacer').disabled = puntos.length === 0 || poligono !== null;

    // Solo permite exportar cuando ya existe un polígono cerrado.
    document.getElementById('btnExportar').disabled = poligono === null;
}


// Reto 3. Dar la opción al usuario de que pueda ponerle un nombre al polígono.
function aGeoJSON(nombrePoligono = 'Mi polígono') {
    // Es uno de los manejos de errores donde si turf.polygon falla con menos de 3 vértices, se lanza el mensaje definido.
    if (puntos.length < 3) {
        throw new Error('Se necesitan al menos 3 vértices.');
    }

    // Convierte las coordenadas de [latitud, longitud] a [longitud, latitud], que es el orden requerido por el formato GeoJSON.
    const anillo = puntos.map(([lat, lng]) => [lng, lat]);

    // Repite el primer punto al final para cerrar el polígono.
    anillo.push(anillo[0]);

    // Crea y devuelve el polígono GeoJSON junto con su nombre y fecha de creación.
    return turf.polygon([anillo], {
        nombre: nombrePoligono,
        creado: new Date().toISOString()
    });
}


// Calcula el área y el perímetro del polígono utilizando Turf.js.
function medir() {
    // Convierte los vértices actuales a un polígono GeoJSON.
    const geo = aGeoJSON();

    // Calcula el área en metros cuadrados.
    const area = turf.area(geo); // metros cuadrados

    // Convierte el polígono en una línea y calcula su longitud en metros.
    const perimetro = turf.length(turf.polygonToLine(geo), { units: 'meters' });

    // Devuelve las medidas del polígono.
    return { area, perimetro };
}

// Cierra el polígono y muestra sus medidas cuando los vértices son válidos.
function cerrarPoligono() {
    // Es uno de los manejos de errores, entonces, comprueba los vértices antes de continuar.
    if (puntos.length < 3) {
        mostrarInfo('Necesitas al menos 3 vértices para cerrar el polígono.');
        return;
    }

    // Es uno de los manejos de errores, entonces, si el Turf falla al validar, se avisa en lugar de romper la página.
    let geo;
    let cruces;

    try {
        // Genera el polígono GeoJSON y comprueba si contiene cruces entre sus líneas.
        geo = aGeoJSON();
        cruces = turf.kinks(geo);
    } catch (error) {
        // Registra el error y muestra un mensaje.
        console.error(error);
        mostrarInfo('No se pudo validar el polígono. Revisa los vértices.');
        return;
    }

    // Muestra en la consola los puntos, el GeoJSON y los cruces detectados.
    console.log('Puntos dibujados:', puntos);
    console.log('Polígono GeoJSON:', geo);
    console.log('Cruces detectados:', cruces.features);

    // Reto 9: Detectar cruces en el polígono.
    if (cruces.features.length > 0) {
        // Evita cerrar el polígono si sus lados se cruzan entre sí.
        mostrarInfo(
            `Se detectaron ${cruces.features.length} cruces. ` +
            'Revisa el orden de los vértices.'
        );
        return;
    }

    // Si no hay cruces, continúa y dibuja el polígono con el color escogido y una transparencia en el relleno.
    poligono = L.polygon(puntos, {
        color: selectorColor.value,
        fillColor: selectorColor.value,
        fillOpacity: 0.35
    }).addTo(mapa);

    // Guarda el estado del polígono una vez que se ha cerrado.
    guardarPuntos();

    // Oculta la línea y ajusta el mapa para mostrar todo el polígono.
    lineaGuia.setLatLngs([]);
    mapa.fitBounds(poligono.getBounds());

    // Obtiene el área y el perímetro.
    const { area, perimetro } = medir();

    // Muestra el área y el perímetro en una ventana del polígono.
    poligono.bindPopup(
        `Área: ${area.toFixed(1)} m²<br>` +
        `Perímetro: ${perimetro.toFixed(1)} m`
    ).openPopup();

    // Muestra el área en metros cuadrados y hectáreas.
    mostrarInfo(
        `Polígono esta cerrado. Área: ${area.toFixed(1)} m² ` + `(${(area / 10000).toFixed(3)} ha).`
    );

    // Actualiza los botones después de cerrar el polígono.
    actualizarBotones();
}

// Asocia la función de cierre al botón correcto.
document.getElementById('btnCerrar').addEventListener('click', cerrarPoligono);

// Elimina el último vértice agregado mientras el polígono este abierto.
function deshacerPunto() {
    // No hace nada si no hay puntos o si el polígono ya está cerrado.
    if (puntos.length === 0 || poligono !== null) {
        return;
    }

    // Elimina el último punto de la lista de coordenadas.
    puntos.pop();

    // Retira el último marcador de la lista de vértices.
    const ultimoVertice = vertices.pop();

    // Elimina el marcador del mapa si existe.
    if (ultimoVertice) {
        mapa.removeLayer(ultimoVertice);
    }

    // Actualiza la línea para que coincida con los puntos restantes.
    lineaGuia.setLatLngs(puntos);

    // Guarda el estado actualizado y refresca la tabla y los botones.
    guardarPuntos();
    actualizarTablaCoordenadas();
    actualizarBotones();

    // Muestra cuántos vértices quedan.
    mostrarInfo(`${puntos.length} vértice(s).`);
}

// Elimina los vértices y el polígono para permitir comenzar de nuevo.
function limpiar() {
    // Detener la geocerca si está activa.
    if (seguimientoId !== null) {
        detenerGeocerca();
    }

    // Elimina los marcadores de los vértices.
    vertices.forEach((v) => mapa.removeLayer(v));
    vertices = [];

    // Vaciar los puntos.
    puntos = [];

    // Elimina el polígono y lo marcar como abierto.
    if (poligono) {
        mapa.removeLayer(poligono);
        poligono = null;
    }

    // Limpiar la línea.
    lineaGuia.setLatLngs([]);

    // Llama a la función de guardarPuntos() para guardar el estado vacío después de limpiar todo.
    guardarPuntos();

    // Llama a la función actualizarTablaCoordenadas() y actualiza la página visualmente.
    actualizarTablaCoordenadas();
    actualizarBotones();

    // Muestra que el mapa está listo para dibujar otro polígono.
    mostrarInfo('Mapa limpio. Haz clic para empezar de nuevo.');
}

// Asocia la función de deshacer al botón correcto.
document.getElementById('btnDeshacer').addEventListener('click', deshacerPunto);

// Asocia la función de limpieza al botón correcto.
document.getElementById('btnLimpiar').addEventListener('click', limpiar);


// Genera un archivo GeoJSON descargable con el polígono dibujado.
function exportar() {
    // Es uno de los manejos de errores, entonces, solo se exporta un polígono con 3 o más vértices.
    if (puntos.length < 3) {
        mostrarInfo('No hay un polígono para exportar.');
        return;
    }

    // Obtiene el campo de nombre y elimina los espacios al principio y al final.
    const campoNombre = document.getElementById('nombrePoligono');
    const nombre = campoNombre.value.trim();

    // Comprueba que el usuario haya escrito un nombre para el archivo.
    if (!nombre) {
        campoNombre.focus();
        campoNombre.setCustomValidity('Escribe un nombre para el polígono.');
        campoNombre.reportValidity();
        campoNombre.setCustomValidity('');
        return;
    }

    // Es uno de los manejos de errores, entonces, cualquier fallo al generar o descargar el archivo se captura.
    try {
        // Convierte el polígono a GeoJSON y transforma los datos en texto JSON.
        const geojson = aGeoJSON(nombre);
        const texto = JSON.stringify(geojson, null, 2);

        // Crea un archivo temporal con el contenido GeoJSON.
        const blob = new Blob([texto], {
            type: 'application/geo+json'
        });

        // Crea un enlace temporal para iniciar la descarga del archivo.
        const enlace = document.createElement('a');
        const url = URL.createObjectURL(blob);

        enlace.href = url;

        // Sustituye los caracteres no permitidos en nombres de archivo por guiones bajos.
        const nombreArchivo = nombre.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

        // Define el nombre del archivo y simula un click para descargarlo.
        enlace.download = nombreArchivo + '.geojson';
        enlace.click();

        // Libera la dirección temporal del archivo después de iniciar la descarga.
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        // Confirma que la exportación se realizó.
        mostrarInfo(`Polígono "${nombre}" exportado correctamente.`);
    } catch (error) {
        // Registra el error y avisa que no se pudo hacer la exportación.
        console.error(error);
        mostrarInfo('No se pudo exportar el polígono.');
    }
}

// Asocia la función de exportación al botón correcto.
document.getElementById('btnExportar').addEventListener('click', exportar);

// Obtiene el selector de color utilizado en el polígono.
const selectorColor = document.getElementById('colorPoligono');

// Detecta los cambios en el selector y actualiza los elementos del mapa.
selectorColor.addEventListener('input', (e) => {
    // Obtiene el nuevo color seleccionado por el usuario.
    const color = e.target.value;

    // Cambia el color del polígono cerrado.
    if (poligono) {
        poligono.setStyle({
            color: color,
            fillColor: color
        });
    }

    // Cambia el color de todos los vértices.
    vertices.forEach((vertice) => {
        vertice.setStyle({
            color: color,
            fillColor: color
        });
    });

    // Cambia el color de la línea.
    lineaGuia.setStyle({
        color: color
    });
});


// Reto 4. Agregar un vértice con la ubicación actual del usuario.
function agregarVerticeUbicacion() {

    if (poligono) {
        mostrarInfo('El polígono ya está cerrado. Pulsa Limpiar para empezar de nuevo.');
        return;
    }

    // Verifica si el navegador permite obtener la ubicación.
    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    // Muestra que se está solicitando la ubicación para agregar un vértice.
    mostrarInfo('Obteniendo tu ubicación actual...');

    // Obtener las coordenadas actuales del usuario.
    navigator.geolocation.getCurrentPosition(

        (pos) => {
            // Extrae la latitud y la longitud de la ubicación.
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // Crear el punto y agregarlo a la lista de vértices.
            const punto = [lat, lng];
            puntos.push(punto);

            // Guarda los puntos actualizados en el almacenamiento local.
            guardarPuntos();

            // Llama a la función actualizarTablaCoordenadas() y actualiza la tabla de coordenadas.
            actualizarTablaCoordenadas();

            // Dibuja un marcador en el mapa.
            const v = L.circleMarker(punto, {
                radius: 6,
                color: selectorColor.value,
                fillColor: selectorColor.value,
                fillOpacity: 1
            }).addTo(mapa);

            // Guarda el marcador para poder actualizarlo o eliminarlo.
            vertices.push(v);

            // Actualizar la línea que une los vértices.
            lineaGuia.setLatLngs(puntos);

            // Actualizar el estado de los botones.
            actualizarBotones();

            // Muestra las coordenadas del vértice agregado.
            mostrarInfo(
                `Vértice agregado: ${lat.toFixed(6)}, ${lng.toFixed(6)}.`
            );
        },

        (err) => {
            // Guarda los mensajes que se mostrarán si falla la geolocalización.
            const mensajes = {
                1: 'El permiso fue denegado. Activa la ubicación en el navegador.',
                2: 'No se pudo determinar la ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            // Muestra el mensaje del error.
            mostrarInfo(mensajes[err.code] || 'Error desconocido.');
        },

        {
            // Solicita una ubicación precisa, limita la espera y evita usar datos antiguos.
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Empareja la función al botón del Reto 4.
document.getElementById('btnAgregarUbicacion').addEventListener('click', agregarVerticeUbicacion);


// Reto 5. Guardar los puntos y el estado del polígono
function guardarPuntos() {
    // Es uno de los manejos de errores, entonces, el localStorage puede estar lleno o bloqueado.
    try {
        // Guarda la lista de coordenadas como una cadena JSON.
        localStorage.setItem(
            'puntosPoligono',
            JSON.stringify(puntos)
        );

        // Guarda si el polígono está cerrado o todavía está abierto.
        localStorage.setItem(
            'poligonoCerrado',
            JSON.stringify(poligono !== null)
        );

        // Guarda el color seleccionado para recuperarlo después.
        localStorage.setItem(
            'colorPoligono',
            document.getElementById('colorPoligono').value
        );
    } catch (error) {
        // Muestra si el navegador no permite guardar los datos.
        console.error(error);
        mostrarInfo('No se pudo guardar el progreso en el navegador.');
    }
}


// Recupera los puntos guardados al abrir la página.
function recuperarPuntos() {
    // Busca en el almacenamiento local las coordenadas guardadas anteriormente.
    const datosGuardados = localStorage.getItem('puntosPoligono');

    // Si no hay puntos guardados, recupera el color y actualiza la interfaz.
    if (!datosGuardados) {
        // Recupera el color guardado aunque todavía no haya puntos.
        const colorGuardado = localStorage.getItem('colorPoligono');

        // Comprueba que el color tenga el formato hexadecimal.
        if (colorGuardado && /^#[0-9a-fA-F]{6}$/.test(colorGuardado)) {
            selectorColor.value = colorGuardado;
        }

        // Actualiza la tabla y los botones antes de terminar la función.
        actualizarTablaCoordenadas();
        actualizarBotones();
        return;
    }

    // Es uno de los manejos de errores, entonces, si el dato guardado está dañado se descarta.
    let puntosGuardados;

    try {
        // Convierte la cadena JSON guardada en un arreglo.
        puntosGuardados = JSON.parse(datosGuardados);

        // Comprueba que cada punto sea un arreglo de dos coordenadas numéricas válidas.
        const formatoValido =
            Array.isArray(puntosGuardados) &&
            puntosGuardados.every((p) =>
                Array.isArray(p) &&
                p.length === 2 &&
                Number.isFinite(p[0]) &&
                Number.isFinite(p[1])
            );

        // Genera un error si los datos recuperados no tienen el formato esperado.
        if (!formatoValido) {
            throw new Error('Formato de puntos inválido');
        }
    } catch (error) {
        // Registra el problema y elimina los datos de puntos y estado que están dañados.
        console.error('Datos guardados dañados:', error);
        localStorage.removeItem('puntosPoligono');
        localStorage.removeItem('poligonoCerrado');

        // Deja la página en su estado inicial.
        actualizarTablaCoordenadas();
        actualizarBotones();
        return;
    }

    // Recuperar el color guardado del polígono.
    const colorGuardado = localStorage.getItem('colorPoligono');

    // Comprueba el formato del color antes de aplicarlo al selector.
    if (colorGuardado && /^#[0-9a-fA-F]{6}$/.test(colorGuardado)) {
        selectorColor.value = colorGuardado;
    }

    // Restaura la lista de puntos guardados en la variable principal.
    puntos = puntosGuardados;

    // Dibujar los vértices o puntos recuperados.
    puntos.forEach((punto) => {
        // Crea un marcador para cada coordenada recuperada.
        const v = L.circleMarker(punto, {
            radius: 6,
            color: selectorColor.value,
            fillColor: selectorColor.value,
            fillOpacity: 1
        }).addTo(mapa);

        // Guarda la referencia del marcador creado.
        vertices.push(v);
    });

    // Actualiza la tabla con los vértices recuperados.
    actualizarTablaCoordenadas();

    // Recuperar el estado del polígono.
    const cerrado = localStorage.getItem('poligonoCerrado') === 'true';

    // Comprueba si el polígino estaba cerrado y tiene vértices y vuelve a dibujar el polígono.
    if (cerrado && puntos.length >= 3) {
        poligono = L.polygon(puntos, {
            color: selectorColor.value,
            fillColor: selectorColor.value,
            fillOpacity: 0.35
        }).addTo(mapa);

        // Oculta la línea y ajusta la vista para mostrar el polígono.
        lineaGuia.setLatLngs([]);
        mapa.fitBounds(poligono.getBounds());

        // Calcula las medidas del polígono recuperado.
        const { area, perimetro } = medir();

        // Restaura la ventana emergente con el área y el perímetro.
        poligono.bindPopup(
            `Área: ${area.toFixed(1)} m²<br>Perímetro: ${perimetro.toFixed(1)} m`
        );

        // Muestra que se recuperó el polígono y muestra su área.
        mostrarInfo(
            `Polígono fue recuperado. Área: ${area.toFixed(1)} m².`
        );
    } else {
        // Si todavía no estaba cerrado, vuelve a mostrar la línea.
        lineaGuia.setLatLngs(puntos);
        mostrarInfo('Se recuperaron los vértices guardados.');
    }

    // Actualizar los botones después de recuperar el estado.
    actualizarBotones();
}


/* Reto 7. Detectar si el usuario está dentro o fuera del polígono */

// Obtiene la ubicación del usuario y comprueba si está dentro del polígono.
function verificarUbicacion() {
    // Comprueba si exista un polígono cerrado.
    if (poligono === null) {
        mostrarInfo('Primero debes dibujar y cerrar el polígono.');
        return;
    }

    // Comprueba si el navegador permite obtener la ubicación.
    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    // Muestra que se está realizando la comprobación.
    mostrarInfo('Comprobando si estás dentro del polígono...');

    // Solicita las coordenadas actuales.
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            // Es uno de los manejos de errores, entonces, si el Turf falla, no se rompe la página.
            try {
                // Extrae o guarda la latitud y la longitud.
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                // Guarda el punto Turf que utiliza el orden [longitud, latitud].
                const puntoUsuario = turf.point([lng, lat]);

                // Convertir el polígono dibujado a GeoJSON.
                const geo = aGeoJSON(
                    document.getElementById('nombrePoligono').value.trim()
                        || 'Mi polígono'
                );

                // Comprobar si la ubicación está dentro del polígono.
                const estaDentro = turf.booleanPointInPolygon(
                    puntoUsuario,
                    geo
                );

                // Muestra un mensaje diferente según la ubicación esté dentro o fuera.
                if (estaDentro) {
                    mostrarInfo('Estás adentro del polígono.');
                } else {
                    mostrarInfo('Estás afuera del polígono.');
                }

                // Mostrar la ubicación comprobada en el mapa.
                if (marcadorUsuario) {
                    // Actualiza el marcador que ya existe.
                    marcadorUsuario.setLatLng([lat, lng]);
                } else {
                    // Crea un marcador si todavía no existe.
                    marcadorUsuario = L.marker([lat, lng])
                        .addTo(mapa);
                }

                // Muestra el resultado de la comprobación en la ventana.
                marcadorUsuario
                    .bindPopup(
                        estaDentro
                            ? 'Estás dentro del polígono'
                            : 'Estás fuera del polígono'
                    )
                    .openPopup();

                // Centra el mapa en la ubicación comprobada.
                mapa.panTo([lat, lng]);
            } catch (error) {
                // Registra el error y muestra un mensaje si falla.
                console.error(error);
                mostrarInfo('No se pudo comprobar tu ubicación respecto al polígono.');
            }
        },
        (err) => {
            // Define los mensajes para los posibles errores de geolocalización.
            const mensajes = {
                1: 'Permiso denegado. Activa la ubicación en el navegador.',
                2: 'No se pudo determinar la ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            // Muestra el error que impidió obtener las coordenadas.
            mostrarInfo(
                mensajes[err.code] || 'No se pudo obtener tu ubicación.'
            );
        },
        {
            // Solicita una precisión alta, establece un tiempo máximo y evita datos antiguos.
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Empareja la comprobación de ubicación al botón del Reto 7.
document.getElementById('verificarUbicacion').addEventListener('click', verificarUbicacion);



/* Reto 8. Rastreo de usuario en tiempo real */

// Guarda el identificador del seguimiento de ubicación activo.
let seguimientoId = null;

// Guarda si la última posición comprobada estaba dentro o fuera de la geocerca.
let ultimaPosicionDentro = null;

// Inicia el seguimiento de la ubicación.
function iniciarGeocerca() {
    // Verifica si el polígono está dibujado y cerrado.
    if (poligono === null) {
        mostrarInfo('Primero debes dibujar y cerrar el polígono.');
        return;
    }

    // Evitar iniciar varios seguimientos al mismo tiempo.
    if (seguimientoId !== null) {
        mostrarInfo('El seguimiento ya está activo.');
        return;
    }

    // Comprueba si el navegador permite obtener la ubicación.
    if (!('geolocation' in navigator)) {
        mostrarInfo('Tu navegador no soporta geolocalización.');
        return;
    }

    // Reinicia el estado de la última posición y avisa que comenzó el seguimiento.
    ultimaPosicionDentro = null;
    mostrarInfo('Seguimiento activo. Comprobando tu ubicación...');

    // Deshabilita el botón de inicio de seguimiento y habilita el botón para detener el seguimiento.
    document.getElementById('btnIniciarGeocerca').disabled = true;
    document.getElementById('btnDetenerGeocerca').disabled = false;

    // Inicia el seguimiento continuo de la ubicación mediante la geolocalización.
    seguimientoId = navigator.geolocation.watchPosition(
        (pos) => {
            // Es uno de los manejos de errores, entonces un fallo en un cálculo no debe detener el seguimiento.
            try {
                // Obtiene las coordenadas de la posición actual.
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                // Convierte la ubicación a un punto GeoJSON y obtiene el polígono.
                const puntoUsuario = turf.point([lng, lat]);
                const geo = aGeoJSON();

                // Comprueba si la persona está dentro de los límites del polígono.
                const estaDentro = turf.booleanPointInPolygon(
                    puntoUsuario,
                    geo
                );

                // Actualizar o crear el marcador de ubicación
                if (marcadorUsuario) {
                    // Mueve el marcador que ya exite a la nueva posición.
                    marcadorUsuario.setLatLng([lat, lng]);
                } else {
                    // Crea un marcador si todavía no existe.
                    marcadorUsuario = L.marker([lat, lng]).addTo(mapa);
                }

                // Actualiza el mensaje según la posición actual.
                marcadorUsuario.bindPopup(
                    estaDentro
                        ? 'Estás dentro de la geocerca'
                        : '¡Estás fuera de la geocerca!'
                );

                // Avisa o se visualiza solamente cuando se cruza el límite de la geocerca o el polígono.
                if (
                    // Detecta el paso desde dentro hacia fuera.
                    ultimaPosicionDentro === true &&
                    estaDentro === false
                ) {
                    // Muestra una alerta cuando el usuario sale de la geocerca.
                    mostrarInfo('¡Atención! Has salido de la geocerca.');
                    alert('¡Atención! Has salido del polígono.');
                } else if (
                    // Detecta el paso desde fuera hacia dentro.
                    ultimaPosicionDentro === false &&estaDentro === true
                ) {
                    // Muestra cuando el usuario vuelve a entrar.
                    mostrarInfo('Has vuelto a estar adentro de la geocerca.');
                    alert('Has vuelto a estar adentro del polígono.');
                } else if (ultimaPosicionDentro === null) {
                    // Muestra si la primera ubicación comprobada está dentro o fuera.
                    mostrarInfo(
                        estaDentro
                            ? 'Seguimiento activo: Estás dentro de la geocerca.'
                            : 'Seguimiento activo: Estás fuera de la geocerca.'
                    );
                }

                // Guarda el resultado actual para compararlo con la siguiente posición.
                ultimaPosicionDentro = estaDentro;
            } catch (error) {
                // Registra o maneja el error.
                console.error(error);
                mostrarInfo('Error al procesar tu ubicación.');
            }
        },
        (err) => {
            if (err.code === 3) {
                mostrarInfo('Buscando señal de ubicación...');
                return;
            }

            // Define los mensajes de los errores de seguimiento.
            const mensajes = {
                1: 'El permiso de ubicación fue denegado.',
                2: 'No se pudo determinar tu ubicación.',
                3: 'Se agotó el tiempo de espera.'
            };

            // Primero se detiene sin mensaje y luego se muestra el error.
            detenerGeocerca(false);

            // Muestra el error sin repetirlo con el mensaje de seguimiento detenido.
            mostrarInfo(
                mensajes[err.code] || 'Error al rastrear la ubicación.'
            );
        },
        {
            // Configura la precisión, la antigüedad máxima de los datos y el tiempo de espera.
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        }
    );
}

// La variable mostrarMensaje en false evita sobrescribir un mensaje de error.
function detenerGeocerca(mostrarMensaje = true) {
    // Detiene el seguimiento si hay uno activo y limpia su identificador.
    if (seguimientoId !== null) {
        navigator.geolocation.clearWatch(seguimientoId);
        seguimientoId = null;
    }

    // Restablece el estado de los botones.
    document.getElementById('btnIniciarGeocerca').disabled = false;
    document.getElementById('btnDetenerGeocerca').disabled = true;

    // Reinicia el estado de la última ubicación o seguimiento.
    ultimaPosicionDentro = null;

    // Muestra el mensaje de detención solo si se solicitó.
    if (mostrarMensaje) {
        mostrarInfo('Seguimiento detenido.');
    }
}

// Empareja la función para iniciar la geocerca al botón correcto.
document.getElementById('btnIniciarGeocerca').addEventListener('click', iniciarGeocerca);

// Empareja la función para detener la geocerca al botón correcto.
document.getElementById('btnDetenerGeocerca').addEventListener('click', () => detenerGeocerca());

// Recupera los vértices, el color y el estado del polígono guardado.
recuperarPuntos();