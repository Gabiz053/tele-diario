/**
 * =======================================================================
 * 📝 08_FORMATEADOR_HELPERS.GS | Helpers de Render y Fusión
 * =======================================================================
 * Funciones auxiliares del formateador: bloques markdown, merge y utilidades.
 */

const CAMPOS_ENTIDAD_OBSIDIAN = [
  "emociones_detectadas",
  "personas_mencionadas",
  "lugares_mencionados",
  "proyectos_activos",
  "conceptos_clave",
  "salud_fisica_sintomas",
  "habitos_mencionados",
  "fricciones_y_obstaculos",
  "consumo_cultural",
];

const CARPETAS_ENTIDADES_OBSIDIAN = {
  personas_mencionadas: "Personas",
  lugares_mencionados: "Lugares",
  proyectos_activos: "Proyectos",
  conceptos_clave: "Conceptos",
  emociones_detectadas: "Emociones",
  fricciones_y_obstaculos: "Fricciones",
  salud_fisica_sintomas: "Salud",
  habitos_mencionados: "Habitos",
  consumo_cultural: "Consumo",
};

// -----------------------------------------------------------------------
// Constructores de bloques markdown
// -----------------------------------------------------------------------

/**
 * Renderiza el bloque narrativo principal en formato de párrafos.
 */
function construirBloqueRelatoExtenso(relato) {
  const textoBase = normalizarTexto(relato) || "Sin relato extenso.";
  const parrafos = textoBase
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parrafos.length === 0) {
    return `### 🧾 Relato Extenso del Día\n\nSin relato extenso.\n\n`;
  }

  return `### 🧾 Relato Extenso del Día\n\n` + parrafos.join("\n\n") + `\n\n`;
}

/**
 * Construye un bloque único con todas las entidades enlazables del JSON.
 */
function construirBloqueEntidadesEnlazadas(datos) {
  let out = `### 🔗 Entidades Enlazadas\n\n`;
  out += `- Personas: ${renderizarArrayWikiLinks(datos.personas_mencionadas, CARPETAS_ENTIDADES_OBSIDIAN.personas_mencionadas)}\n`;
  out += `- Lugares: ${renderizarArrayWikiLinks(datos.lugares_mencionados, CARPETAS_ENTIDADES_OBSIDIAN.lugares_mencionados)}\n`;
  out += `- Proyectos: ${renderizarArrayWikiLinks(datos.proyectos_activos, CARPETAS_ENTIDADES_OBSIDIAN.proyectos_activos)}\n`;
  out += `- Conceptos: ${renderizarArrayWikiLinks(datos.conceptos_clave, CARPETAS_ENTIDADES_OBSIDIAN.conceptos_clave)}\n`;
  out += `- Emociones: ${renderizarArrayWikiLinks(datos.emociones_detectadas, CARPETAS_ENTIDADES_OBSIDIAN.emociones_detectadas)}\n`;
  out += `- Fricciones: ${renderizarArrayWikiLinks(datos.fricciones_y_obstaculos, CARPETAS_ENTIDADES_OBSIDIAN.fricciones_y_obstaculos)}\n`;
  out += `- Salud: ${renderizarArrayWikiLinks(datos.salud_fisica_sintomas, CARPETAS_ENTIDADES_OBSIDIAN.salud_fisica_sintomas)}\n`;
  out += `- Hábitos: ${renderizarArrayWikiLinks(datos.habitos_mencionados, CARPETAS_ENTIDADES_OBSIDIAN.habitos_mencionados)}\n`;
  out += `- Consumo cultural: ${renderizarArrayWikiLinks(datos.consumo_cultural, CARPETAS_ENTIDADES_OBSIDIAN.consumo_cultural)}\n\n`;
  return out;
}

/**
 * Renderiza arrays como lista YAML segura (ej: ["a", "b"]).
 */
function renderizarArrayYaml(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "[]";
  return `[${arr.map((item) => `"${escaparYaml(item)}"`).join(", ")}]`;
}

/**
 * Renderiza arrays como lista de wikilinks para bloques de Obsidian.
 */
function renderizarArrayWikiLinks(arr, carpetaBase) {
  if (!Array.isArray(arr) || arr.length === 0) return "Ninguno";

  const links = [];
  for (let i = 0; i < arr.length; i++) {
    const link = construirWikiLinkConRuta(arr[i], carpetaBase);
    if (!link) continue;
    links.push(link);
  }

  if (links.length === 0) return "Ninguno";
  return links.join(", ");
}

/**
 * Construye wikilink de entidad usando ruta por carpeta + alias visible.
 */
function construirWikiLinkConRuta(etiqueta, carpetaBase) {
  const visibleOriginal = normalizarTexto(etiqueta);
  if (!visibleOriginal) return "";

  const tituloNota = limpiarNombreNotaObsidian(visibleOriginal);
  if (!tituloNota) return "";

  const textoVisible = limpiarTextoVisibleWikiLink(visibleOriginal) || tituloNota;
  const carpeta = limpiarNombreCarpetaObsidian(carpetaBase);

  if (!carpeta) {
    return `[[${tituloNota}|${textoVisible}]]`;
  }

  return `[[${carpeta}/${tituloNota}|${textoVisible}]]`;
}

/**
 * Limpia nombre de nota para evitar caracteres problemáticos en rutas.
 */
function limpiarNombreNotaObsidian(nombre) {
  return normalizarTexto(nombre)
    .replace(/[\\/]/g, " - ")
    .replace(/[#\[\]|^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Limpia nombre de carpeta para rutas de wikilinks.
 */
function limpiarNombreCarpetaObsidian(nombre) {
  return normalizarTexto(nombre)
    .replace(/[\\/]/g, " ")
    .replace(/\.+/g, "")
    .replace(/[#\[\]|^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evita romper sintaxis de alias en wikilinks.
 */
function limpiarTextoVisibleWikiLink(texto) {
  return normalizarTexto(texto)
    .replace(/[\[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Construye tags estables para filtrar diarios en Obsidian/Dataview.
 */
function construirTagsFrontmatterObsidian(datos, tipoEntrada, modeloIA) {
  const base = ["diario", "diario-ai", "telegram", "obsidian"];
  const tipo = slugificarTagObsidian(tipoEntrada);
  const modelo = slugificarTagObsidian(modeloIA);

  if (tipo) base.push("entrada-" + tipo);
  if (modelo) base.push("modelo-" + modelo);

  const emociones = Array.isArray(datos && datos.emociones_detectadas)
    ? datos.emociones_detectadas
    : [];
  for (let i = 0; i < emociones.length && i < 3; i++) {
    const tagEmocion = slugificarTagObsidian(emociones[i]);
    if (!tagEmocion) continue;
    base.push("emocion-" + tagEmocion);
  }

  const rayadas = construirRayadasImportantes(datos && datos.rayadas);
  if (rayadas.length > 0) {
    base.push("rayadas");
  }

  return normalizarArray(base);
}

/**
 * Convierte texto libre en slug seguro para tags de frontmatter.
 */
function slugificarTagObsidian(texto) {
  const limpio = normalizarTexto(texto);
  if (!limpio) return "";

  return limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Crea una sección markdown a partir de una lista, con soporte opcional de checklist.
 */
function construirSeccionListaMarkdown(titulo, items, usarChecklist) {
  if (!Array.isArray(items) || items.length === 0) return "";

  const lista = [];
  for (let i = 0; i < items.length; i++) {
    const texto = normalizarTexto(items[i]);
    if (!texto) continue;
    lista.push(texto);
  }

  if (lista.length === 0) return "";

  const prefijo = usarChecklist ? "- [ ] " : "- ";
  return `${titulo}\n\n${lista.map((item) => prefijo + item).join("\n")}\n\n`;
}

/**
 * Normaliza ideas espontáneas para tratarlas como "rayadas" importantes.
 */
function construirRayadasImportantes(rayadas) {
  return normalizarArray(rayadas);
}

/**
 * Devuelve siempre un array de strings no vacíos.
 */
function normalizarArray(valor) {
  if (!Array.isArray(valor)) return [];
  const salida = [];
  const vistos = {};

  for (let i = 0; i < valor.length; i++) {
    const texto = normalizarTexto(valor[i]);
    if (!texto) continue;

    const clave = texto.toLowerCase();
    if (vistos[clave]) continue;

    vistos[clave] = true;
    salida.push(texto);
  }

  return salida;
}

/**
 * Normaliza campos de entidades para evitar enlaces duplicados en Obsidian.
 */
function normalizarEntidadesObsidian(datos) {
  if (!datos || typeof datos !== "object") return datos;

  for (let i = 0; i < CAMPOS_ENTIDAD_OBSIDIAN.length; i++) {
    const campo = CAMPOS_ENTIDAD_OBSIDIAN[i];
    datos[campo] = normalizarArrayEntidadesObsidian(datos[campo]);
  }

  return datos;
}

/**
 * Limpia y deduplica entidades con clave canónica (case/acento-insensitive).
 */
function normalizarArrayEntidadesObsidian(valor) {
  if (!Array.isArray(valor)) return [];

  const salida = [];
  const vistos = {};

  for (let i = 0; i < valor.length; i++) {
    const etiqueta = limpiarEtiquetaEntidadObsidian(valor[i]);
    if (!etiqueta) continue;

    const clave = construirClaveCanonicaEntidad(etiqueta);
    if (!clave || vistos[clave]) continue;

    vistos[clave] = true;
    salida.push(etiqueta);
  }

  return salida;
}

/**
 * Retira ruido de bordes para que los wikilinks queden limpios.
 */
function limpiarEtiquetaEntidadObsidian(texto) {
  const limpio = normalizarTexto(texto)
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!?"'()\[\]{}]+/, "")
    .replace(/[\s,.;:!?"'()\[\]{}]+$/, "");

  return limpio;
}

/**
 * Crea clave canónica para comparar entidades sin perder formato visible.
 */
function construirClaveCanonicaEntidad(texto) {
  const limpio = normalizarTexto(texto);
  if (!limpio) return "";

  return limpio
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza la transcripción para soportar entrada string o array.
 */
function normalizarTranscripcion(valor) {
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarTexto(item)).filter(Boolean);
  }

  const texto = normalizarTexto(valor);
  return texto || "N/A";
}

/**
 * Fusiona datos previos y actuales para no perder propiedades históricas del día.
 */
function fusionarDatosDiario(datosPrevios, datosActuales) {
  const previo = normalizarRespuestaIA(datosPrevios || {});
  const actual = normalizarRespuestaIA(datosActuales || {});

  return {
    analisis_interno_oculto: elegirTextoConFallback(
      actual.analisis_interno_oculto,
      previo.analisis_interno_oculto,
    ),
    fecha: elegirTextoConFallback(actual.fecha, previo.fecha),
    vibracion_del_dia: elegirTextoConFallback(
      actual.vibracion_del_dia,
      previo.vibracion_del_dia,
    ),
    emociones_detectadas: fusionarArrayAcumulado(
      previo.emociones_detectadas,
      actual.emociones_detectadas,
    ),
    // Estos escalares deben reflejar siempre el analisis actual de IA.
    nivel_energia: normalizarEscala(actual.nivel_energia, 3),
    nivel_estres: normalizarEscala(actual.nivel_estres, 3),
    calidad_transcripcion: normalizarEscala(actual.calidad_transcripcion, 3),
    confianza_extraccion: normalizarEscala(actual.confianza_extraccion, 3),
    personas_mencionadas: fusionarArrayAcumulado(
      previo.personas_mencionadas,
      actual.personas_mencionadas,
    ),
    lugares_mencionados: fusionarArrayAcumulado(
      previo.lugares_mencionados,
      actual.lugares_mencionados,
    ),
    salud_fisica_sintomas: fusionarArrayAcumulado(
      previo.salud_fisica_sintomas,
      actual.salud_fisica_sintomas,
    ),
    momentos_gratitud: fusionarArrayAcumulado(
      previo.momentos_gratitud,
      actual.momentos_gratitud,
    ),
    consumo_cultural: fusionarArrayAcumulado(
      previo.consumo_cultural,
      actual.consumo_cultural,
    ),
    habitos_mencionados: fusionarArrayAcumulado(
      previo.habitos_mencionados,
      actual.habitos_mencionados,
    ),
    fricciones_y_obstaculos: fusionarArrayAcumulado(
      previo.fricciones_y_obstaculos,
      actual.fricciones_y_obstaculos,
    ),
    logros_micro: fusionarArrayAcumulado(
      previo.logros_micro,
      actual.logros_micro,
    ),
    rayadas: fusionarArrayAcumulado(
      previo.rayadas,
      actual.rayadas,
    ),
    nota_para_el_futuro: fusionarArrayAcumulado(
      previo.nota_para_el_futuro,
      actual.nota_para_el_futuro,
    ),
    tareas_pendientes: fusionarArrayAcumulado(
      previo.tareas_pendientes,
      actual.tareas_pendientes,
    ),
    proyectos_activos: fusionarArrayAcumulado(
      previo.proyectos_activos,
      actual.proyectos_activos,
    ),
    conceptos_clave: fusionarArrayAcumulado(
      previo.conceptos_clave,
      actual.conceptos_clave,
    ),
    eventos_clave_cronologicos: fusionarArrayAcumulado(
      previo.eventos_clave_cronologicos,
      actual.eventos_clave_cronologicos,
    ),
    insights_patrones: fusionarArrayAcumulado(
      previo.insights_patrones,
      actual.insights_patrones,
    ),
    alertas_emocionales: fusionarArrayAcumulado(
      previo.alertas_emocionales,
      actual.alertas_emocionales,
    ),
    acciones_recomendadas_24h: fusionarArrayAcumulado(
      previo.acciones_recomendadas_24h,
      actual.acciones_recomendadas_24h,
    ),
    resumen_narrativo: elegirTextoConFallback(
      actual.resumen_narrativo,
      previo.resumen_narrativo,
    ),
    transcripcion_anotada: elegirTranscripcionConFallback(
      actual.transcripcion_anotada,
      previo.transcripcion_anotada,
    ),
  };
}

/**
 * Acumula arrays de forma estable preservando orden previo + actual.
 */
function fusionarArrayAcumulado(valorPrevio, valorActual) {
  const combinado = [];
  if (Array.isArray(valorPrevio)) {
    for (let i = 0; i < valorPrevio.length; i++) combinado.push(valorPrevio[i]);
  }
  if (Array.isArray(valorActual)) {
    for (let i = 0; i < valorActual.length; i++) combinado.push(valorActual[i]);
  }

  return normalizarArray(combinado);
}

/**
 * Ordena eventos por secuencia del día lógico y evita perder la hora de la entrada actual.
 */
function normalizarEventosClaveCronologicos(
  eventos,
  horaEntradaActual,
  horaFrontera,
) {
  const lista = normalizarArray(eventos);
  const salida = [];

  for (let i = 0; i < lista.length; i++) {
    salida.push({
      texto: lista[i],
      indice: i,
      parseoHora: parsearHoraEventoClave(lista[i]),
    });
  }

  const hhmmEntrada = normalizarTexto(horaEntradaActual);
  if (/^\d{2}:\d{2}$/.test(hhmmEntrada) && !existeEventoConHora(salida, hhmmEntrada)) {
    const textoEntrada = hhmmEntrada + " - Registro de nueva entrada en el diario";
    salida.push({
      texto: textoEntrada,
      indice: salida.length,
      parseoHora: parsearHoraEventoClave(textoEntrada),
    });
  }

  const conHora = [];
  const sinHora = [];

  for (let i = 0; i < salida.length; i++) {
    const item = salida[i];
    if (item.parseoHora) conHora.push(item);
    else sinHora.push(item);
  }

  const fronteraInt = parseInt(horaFrontera, 10);
  const fronteraSegura = isNaN(fronteraInt) ? 12 : fronteraInt;

  conHora.sort(function (a, b) {
    const minutoA = calcularMinutoLogicoEvento(a.parseoHora, fronteraSegura);
    const minutoB = calcularMinutoLogicoEvento(b.parseoHora, fronteraSegura);

    if (minutoA !== minutoB) return minutoA - minutoB;
    return a.indice - b.indice;
  });

  const final = [];
  for (let i = 0; i < conHora.length; i++) final.push(conHora[i].texto);
  for (let i = 0; i < sinHora.length; i++) final.push(sinHora[i].texto);

  return normalizarArray(final);
}

/**
 * Intenta leer una hora HH:mm al inicio de un item de evento.
 */
function parsearHoraEventoClave(eventoTexto) {
  const texto = normalizarTexto(eventoTexto);
  if (!texto) return null;

  const match = texto.match(/^(\d{2}):(\d{2})\s*(?:[-:–—]|$)/);
  if (!match) return null;

  const hora = parseInt(match[1], 10);
  const minuto = parseInt(match[2], 10);
  if (isNaN(hora) || isNaN(minuto)) return null;
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

  return {
    hora: hora,
    minuto: minuto,
    hhmm: match[1] + ":" + match[2],
  };
}

/**
 * Comprueba si ya existe un evento para una hora exacta HH:mm.
 */
function existeEventoConHora(eventosNormalizados, hhmm) {
  const objetivo = normalizarTexto(hhmm);
  if (!objetivo) return false;

  for (let i = 0; i < eventosNormalizados.length; i++) {
    const parseo = eventosNormalizados[i].parseoHora;
    if (parseo && parseo.hhmm === objetivo) return true;
  }

  return false;
}

/**
 * Convierte hora de evento a minuto lógico, desplazando horas antes de frontera.
 */
function calcularMinutoLogicoEvento(parseoHora, horaFrontera) {
  const base = parseoHora.hora * 60 + parseoHora.minuto;
  const fronteraMinutos = horaFrontera * 60;

  if (base < fronteraMinutos) {
    return base + 24 * 60;
  }

  return base;
}

/**
 * Prioriza valor actual y cae a previo cuando el actual está vacío.
 */
function elegirTextoConFallback(actual, previo) {
  const actualTxt = normalizarTexto(actual);
  if (actualTxt && actualTxt !== "N/A") return actualTxt;

  const previoTxt = normalizarTexto(previo);
  if (previoTxt && previoTxt !== "N/A") return previoTxt;

  return "";
}

/**
 * Prioriza transcripción actual; si no existe, reutiliza la previa.
 */
function elegirTranscripcionConFallback(actual, previo) {
  if (Array.isArray(actual)) {
    const actualLista = actual
      .map((item) => normalizarTexto(item))
      .filter((item) => item && item !== "N/A");
    if (actualLista.length > 0) return actualLista;
  }

  const actualTxt = normalizarTexto(actual);
  if (actualTxt && actualTxt !== "N/A") return actualTxt;

  if (Array.isArray(previo)) {
    const previoLista = previo
      .map((item) => normalizarTexto(item))
      .filter((item) => item && item !== "N/A");
    if (previoLista.length > 0) return previoLista;
  }

  const previoTxt = normalizarTexto(previo);
  if (previoTxt && previoTxt !== "N/A") return previoTxt;

  return "N/A";
}

/**
 * Convierte cualquier valor a texto seguro para renderizado.
 */
function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

/**
 * Fuerza escalas numéricas a un rango fijo entre 1 y 5.
 */
function normalizarEscala(valor, valorPorDefecto) {
  const numero = parseInt(valor, 10);
  if (isNaN(numero)) return valorPorDefecto;
  if (numero < 1) return 1;
  if (numero > 5) return 5;
  return numero;
}

/**
 * Escapa comillas para no romper el frontmatter YAML.
 */
function escaparYaml(texto) {
  return String(texto).replace(/"/g, '\\"');
}
