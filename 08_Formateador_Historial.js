/**
 * =======================================================================
 * 📝 08_FORMATEADOR_HISTORIAL.GS | Snapshot e Historial de Transcripciones
 * =======================================================================
 * Helpers de snapshot JSON, historial y extractores de fecha/hora en markdown.
 */

const HISTORIAL_MARCA_SIN_FECHA = "Sin fecha";
const HISTORIAL_TEXTO_NA = "N/A";

/**
 * Enriquece el snapshot JSON con historial acumulado y metadatos de conteo.
 */
function construirSnapshotJson(datos, historialTranscripciones) {
  const snapshot = JSON.parse(JSON.stringify(datos || {}));
  const historial = Array.isArray(historialTranscripciones)
    ? historialTranscripciones
    : [];

  const historialNormalizado = [];
  for (let i = 0; i < historial.length; i++) {
    const item = historial[i] || {};
    const marca = normalizarTexto(item.fechaHora) || HISTORIAL_MARCA_SIN_FECHA;
    const texto = normalizarTexto(item.texto);

    if (!texto || texto === HISTORIAL_TEXTO_NA) continue;
    historialNormalizado.push({
      fecha_hora: marca,
      texto: texto,
    });
  }

  snapshot.historial_transcripciones = historialNormalizado;
  snapshot.total_transcripciones = historialNormalizado.length;
  return snapshot;
}

/**
 * Recupera el último snapshot JSON del markdown previo para fusionar contexto.
 */
function extraerSnapshotJsonDesdeMarkdown(markdown) {
  const texto = normalizarTexto(markdown);
  if (!texto) return null;

  const regex = /###\s+🧾\s+Snapshot JSON[\s\S]*?```json\s*([\s\S]*?)\s*```/g;
  let match = regex.exec(texto);
  let ultimoBloqueJson = "";

  while (match) {
    ultimoBloqueJson = normalizarTexto(match[1]);
    match = regex.exec(texto);
  }

  if (!ultimoBloqueJson) return null;

  const parseo = parsearJsonSeguro(ultimoBloqueJson);
  if (!parseo.ok || !parseo.data || typeof parseo.data !== "object") {
    return null;
  }

  return parseo.data;
}

/**
 * Construye la sección numerada del historial de transcripciones.
 */
function construirBloqueHistorialTranscripciones(historial) {
  const total = Array.isArray(historial) ? historial.length : 0;
  let out = `### 📝 Historial de Transcripciones\n\n`;
  out += `> [!note]- Ver historial completo (${total})\n`;

  if (total === 0) {
    out += `> 1. **${HISTORIAL_MARCA_SIN_FECHA}**\n> _${HISTORIAL_TEXTO_NA}_`;
    return out;
  }

  for (let i = 0; i < total; i++) {
    const item = historial[i] || {};
    const marca = normalizarTexto(item.fechaHora) || HISTORIAL_MARCA_SIN_FECHA;
    const texto = normalizarTexto(item.texto) || HISTORIAL_TEXTO_NA;

    out += `> 1. **${marca}**\n`;
    out += renderizarTextoHistorialEnCallout(texto);
    if (i < total - 1) out += `\n`;
  }

  return out;
}

/**
 * Renderiza texto de historial en líneas de callout sin romper el bloque.
 */
function renderizarTextoHistorialEnCallout(texto) {
  const lineas = String(texto || "")
    .split(/\r?\n/)
    .map((linea) => normalizarTexto(linea))
    .filter(Boolean);

  if (lineas.length === 0) {
    return `> _${HISTORIAL_TEXTO_NA}_`;
  }

  return lineas.map((linea) => `> _${linea}_`).join("\n");
}

/**
 * Transforma la transcripción actual en items de historial con marca temporal.
 */
function construirHistorialTranscripcionActual(
  transcripcionAnotada,
  marcaEntrada,
) {
  const marca = normalizarTexto(marcaEntrada) || HISTORIAL_MARCA_SIN_FECHA;
  const fechaBase = extraerFechaBaseDesdeMarcaEntrada(marca);

  if (Array.isArray(transcripcionAnotada)) {
    const lista = [];
    for (let i = 0; i < transcripcionAnotada.length; i++) {
      const texto = normalizarTexto(transcripcionAnotada[i]);
      if (!texto || texto === HISTORIAL_TEXTO_NA) continue;

      const segmentos = extraerSegmentosTranscripcionConHora(texto, fechaBase);
      if (segmentos.length > 0) {
        for (let j = 0; j < segmentos.length; j++) {
          lista.push(segmentos[j]);
        }
        continue;
      }

      lista.push({ fechaHora: marca, texto: texto });
    }
    return lista;
  }

  const texto = normalizarTexto(transcripcionAnotada);
  if (!texto || texto === HISTORIAL_TEXTO_NA) return [];

  const segmentos = extraerSegmentosTranscripcionConHora(texto, fechaBase);
  if (segmentos.length > 0) {
    return segmentos;
  }

  return [{ fechaHora: marca, texto: texto }];
}

/**
 * Extrae YYYY-MM-DD desde una marca de entrada tipo "YYYY-MM-DD HH:mm".
 */
function extraerFechaBaseDesdeMarcaEntrada(marcaEntrada) {
  const marca = normalizarTexto(marcaEntrada);
  const match = marca.match(/^(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : "";
}

/**
 * Divide transcripciones con múltiples marcas [HH:mm:ss] en items separados.
 */
function extraerSegmentosTranscripcionConHora(texto, fechaBase) {
  const source = normalizarTexto(texto);
  if (!source) return [];

  const regexHora = /\[(\d{2}):(\d{2})(?::\d{2})?\]/g;
  const marcas = [];
  let match = regexHora.exec(source);

  while (match) {
    marcas.push({
      inicio: match.index,
      hhmm: match[1] + ":" + match[2],
    });
    match = regexHora.exec(source);
  }

  if (marcas.length === 0) return [];

  const salida = [];
  for (let i = 0; i < marcas.length; i++) {
    const actual = marcas[i];
    const siguiente = marcas[i + 1];
    const inicio = actual.inicio;
    const fin = siguiente ? siguiente.inicio : source.length;
    const segmentoTexto = normalizarTexto(source.substring(inicio, fin));
    if (!segmentoTexto) continue;

    const marca = fechaBase
      ? fechaBase + " " + actual.hhmm
      : HISTORIAL_MARCA_SIN_FECHA + " " + actual.hhmm;

    salida.push({
      fechaHora: marca,
      texto: segmentoTexto,
    });
  }

  return salida;
}

/**
 * Fusiona historial previo y actual, eliminando duplicados exactos.
 */
function fusionarHistorialTranscripciones(historialPrevio, historialActual) {
  const base = [];
  // Conservamos orden de aparición: primero histórico previo, luego entrada actual.
  if (Array.isArray(historialPrevio)) {
    for (let i = 0; i < historialPrevio.length; i++)
      base.push(historialPrevio[i]);
  }
  if (Array.isArray(historialActual)) {
    for (let i = 0; i < historialActual.length; i++)
      base.push(historialActual[i]);
  }

  const salida = [];
  const vistos = {};

  // Dedupe por marca+texto para evitar colisiones entre entradas similares.
  for (let i = 0; i < base.length; i++) {
    const item = base[i] || {};
    const marca = normalizarTexto(item.fechaHora) || HISTORIAL_MARCA_SIN_FECHA;
    const texto = normalizarTexto(item.texto);
    if (!texto || texto === HISTORIAL_TEXTO_NA) continue;

    const clave = (marca + "||" + texto).toLowerCase();
    if (vistos[clave]) continue;

    vistos[clave] = true;
    salida.push({
      fechaHora: marca,
      texto: texto,
    });
  }

  return salida;
}

// -----------------------------------------------------------------------
// Extractores de historial y fechas
// -----------------------------------------------------------------------

/**
 * Extrae historial previo desde markdown soportando formato nuevo y legado.
 */
function extraerHistorialTranscripcionesDesdeMarkdown(markdown, fechaFallback) {
  const texto = normalizarTexto(markdown);
  if (!texto) return [];

  // Trabajamos solo sobre el último bloque de historial detectado en el documento.
  const bloque = extraerBloqueHistorialMarkdown(texto);
  if (!bloque) return [];

  // 1) Formato actual numerado dentro de callout: "> 1. **YYYY-MM-DD HH:mm**".
  const numerado = extraerHistorialNumeradoDesdeBloque(bloque);
  if (numerado.length > 0) return numerado;

  const resultado = [];
  let match;

  // 2) Formato legacy "Audio N" con hora reconstruida desde títulos de entrada.
  const regexLegacy =
    /\*\*Audio\s+\d+:\*\*\s*\n>\s*_(.+?)_\s*(?=\n\*\*Audio|\n###|\n\n###|$)/gs;
  const horasLegacy = extraerHorasEntradasDesdeMarkdown(texto);
  const fechaBase =
    extraerFechaDesdeFrontmatterMarkdown(texto) || fechaFallback;

  match = regexLegacy.exec(bloque);
  let idx = 0;
  // Mapeamos cada match al índice de hora detectada en encabezados de entrada.
  while (match) {
    const hora = horasLegacy[idx] || "00:00";
    resultado.push({
      fechaHora: `${fechaBase || HISTORIAL_MARCA_SIN_FECHA} ${hora}`.trim(),
      texto: normalizarTexto(match[1]),
    });
    idx += 1;
    match = regexLegacy.exec(bloque);
  }

  if (resultado.length > 0) return resultado;

  // 3) Último fallback: quotes sueltas sin encabezado estructurado.
  const regexQuote = />\s*_(.+?)_\s*(?=\n>\s*_|\n###|\n\n###|$)/gs;
  const horasQuote = extraerHorasEntradasDesdeMarkdown(texto);
  const fechaQuote =
    extraerFechaDesdeFrontmatterMarkdown(texto) || fechaFallback;
  let idxQuote = 0;
  match = regexQuote.exec(bloque);
  // Fallback final: conserva orden y asigna hora aproximada por posicion.
  while (match) {
    const hora = horasQuote[idxQuote] || "00:00";
    resultado.push({
      fechaHora: `${fechaQuote || HISTORIAL_MARCA_SIN_FECHA} ${hora}`.trim(),
      texto: normalizarTexto(match[1]),
    });
    idxQuote += 1;
    match = regexQuote.exec(bloque);
  }

  return resultado;
}

/**
 * Extrae items del formato numerado moderno, incluyendo bloques callout (>).
 */
function extraerHistorialNumeradoDesdeBloque(bloque) {
  const lineas = String(bloque || "").split(/\r?\n/);
  const items = [];
  let actual = null;

  function cerrarActual() {
    if (!actual) return;

    const texto = limpiarTextoItemHistorial(actual.lineasTexto);
    if (!texto) {
      actual = null;
      return;
    }

    items.push({
      fechaHora:
        normalizarTexto(actual.fechaHora) || HISTORIAL_MARCA_SIN_FECHA,
      texto: texto,
    });
    actual = null;
  }

  for (let i = 0; i < lineas.length; i++) {
    let linea = normalizarTexto(lineas[i]);
    if (!linea) continue;

    // Remueve prefijos de quote/callout para leer estructura real.
    linea = linea.replace(/^\s*>\s?/, "");
    while (/^>\s?/.test(linea)) {
      linea = linea.replace(/^>\s?/, "");
    }

    if (!linea) continue;
    if (/^\[!note\]/i.test(linea)) continue;

    const matchCabecera = linea.match(/^\d+\.\s+\*\*([^\n*]+)\*\*\s*$/);
    if (matchCabecera) {
      cerrarActual();
      actual = {
        fechaHora:
          normalizarTexto(matchCabecera[1]) || HISTORIAL_MARCA_SIN_FECHA,
        lineasTexto: [],
      };
      continue;
    }

    if (!actual) continue;
    actual.lineasTexto.push(linea);
  }

  cerrarActual();
  return items;
}

/**
 * Limpia líneas del texto de un item de historial y quita envoltorio itálico.
 */
function limpiarTextoItemHistorial(lineasTexto) {
  if (!Array.isArray(lineasTexto) || lineasTexto.length === 0) return "";

  const lineasLimpias = lineasTexto
    .map((linea) => normalizarTexto(linea))
    .filter(Boolean)
    .map((linea) => {
      let limpio = linea;
      if (limpio.startsWith("_")) {
        limpio = limpio.substring(1);
      }
      if (limpio.endsWith("_")) {
        limpio = limpio.substring(0, limpio.length - 1);
      }
      return normalizarTexto(limpio);
    })
    .filter(Boolean);

  if (lineasLimpias.length === 0) return "";

  const texto = lineasLimpias.join("\n");

  return normalizarTexto(texto);
}

/**
 * Recupera únicamente el bloque de historial más reciente del documento.
 */
function extraerBloqueHistorialMarkdown(markdown) {
  const titulo = "### 📝 Historial de Transcripciones";
  const inicio = markdown.lastIndexOf(titulo);
  if (inicio === -1) return "";

  const despuesTitulo = markdown.substring(inicio);
  const siguienteHeader = despuesTitulo.indexOf("\n### ", titulo.length);

  if (siguienteHeader === -1) {
    return despuesTitulo;
  }

  return despuesTitulo.substring(0, siguienteHeader);
}

/**
 * Lee la fecha del frontmatter YAML cuando está disponible.
 */
function extraerFechaDesdeFrontmatterMarkdown(markdown) {
  const match = markdown.match(/^fecha:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
  return match ? match[1] : "";
}

/**
 * Extrae horas de entradas de audio para reconstrucción de histórico legado.
 */
function extraerHorasEntradasDesdeMarkdown(markdown) {
  const horas = [];
  const regex = /##\s+🎙️[^\n]*?(\d{2}:\d{2})/g;
  let match = regex.exec(markdown);

  while (match) {
    horas.push(match[1]);
    match = regex.exec(markdown);
  }

  return horas;
}

/**
 * Obtiene la fecha canónica desde una ruta diaria (YYYY-MM-DD.md).
 */
function extraerFechaDesdeRutaDiario(rutaDiaria) {
  const ruta = normalizarTexto(rutaDiaria);
  const match = ruta.match(/(\d{4}-\d{2}-\d{2})\.md$/);
  return match ? match[1] : "";
}

/**
 * Resuelve la fecha de entrada a partir de timestamp o fecha actual.
 */
function resolverFechaEntrada(timestampEntradaMs) {
  const ms = parseInt(timestampEntradaMs, 10);
  if (!isNaN(ms) && ms > 0) {
    return new Date(ms);
  }

  return new Date();
}
