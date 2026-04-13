/**
 * =======================================================================
 * 💬 10_MENSAJES_PIPELINE.GS | Mensajes de Ejecución, Errores y Cierre
 * =======================================================================
 * Mensajes del flujo operativo (audio/manual), errores y debug de pipeline.
 */

// -----------------------------------------------------------------------
// Mensajes de ejecución normal
// -----------------------------------------------------------------------

/**
 * Mensaje para updates no compatibles con el flujo del bot.
 */
function msgTipoEntradaNoSoportado() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "Tipo de mensaje no soportado",
    "Envíame texto o nota de voz.",
  );
}

/**
 * Acuse de recibo para mensajes de texto (sin guardado remoto).
 */
function msgTextoRegistrado(texto) {
  const preview = recortarTextoPlano(texto, 220);
  return formatearMensaje(
    TIPOS_MENSAJE.OK,
    "Texto registrado",
    preview ? `Contenido: "${preview}"` : "No se detectó contenido útil.",
  );
}

/**
 * Mensaje inicial al comenzar procesamiento de audio.
 */
function msgAudioInicio() {
  return formatearMensaje(
    TIPOS_MENSAJE.PROGRESO,
    "Recibí tu audio",
    "Estoy procesándolo ahora. Esto puede tardar unos segundos.",
  );
}

/**
 * Mensaje cuando existe contexto previo del mismo día.
 */
function msgAudioContextoRecuperado() {
  return formatearMensaje(
    TIPOS_MENSAJE.INFO,
    "Continuamos tu diario de hoy",
    "Voy a sumar esta nota a lo que ya registraste antes.",
  );
}

/**
 * Mensaje cuando se trata de la primera nota del día.
 */
function msgAudioPrimerRegistro() {
  return formatearMensaje(
    TIPOS_MENSAJE.INFO,
    "Primera nota del día",
    "Esta entrada iniciará tu diario de hoy.",
  );
}

// -----------------------------------------------------------------------
// Mensajes de error
// -----------------------------------------------------------------------

/**
 * Error de lectura de contexto diario desde GitHub.
 */
function msgErrorConsultaGitHub() {
  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "No se pudo consultar GitHub",
    "No pude cargar el contexto diario actual.",
  );
}

/**
 * Error de descarga o resolución del audio desde Telegram.
 */
function msgErrorDescargaAudio() {
  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "No se pudo descargar el audio",
    "Telegram no devolvió el archivo correctamente.",
  );
}

/**
 * Error de llamada a Gemini con detalle opcional en debug.
 */
function msgErrorGemini(resultadoIA, isDebug) {
  const lineas = [
    resultadoIA.mensaje || "Gemini no pudo completar la solicitud.",
  ];

  if (isDebug && resultadoIA.detalle) {
    lineas.push("Detalle: " + resultadoIA.detalle);
  }

  lineas.push("No hay reintentos automáticos para evitar gasto extra de API.");
  lineas.push("Reenvía el mensaje manualmente para intentarlo de nuevo.");
  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "Error al procesar en Gemini",
    lineas,
  );
}

/**
 * Error de sincronización final en GitHub.
 */
function msgErrorSyncGitHub() {
  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "No se pudo guardar en GitHub",
    "La entrada no pudo sincronizarse en esta ejecución.",
  );
}

/**
 * Error de validación cuando la respuesta de IA no es parseable.
 */
function msgErrorFormatoIA() {
  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "Respuesta IA inválida",
    "No se guardó nada para proteger el diario. Reenvía el mensaje manualmente.",
  );
}

/**
 * Mensaje genérico para errores no controlados en capa superior.
 */
function msgErrorProcesamientoGeneral() {
  return "Hubo un error en el procesamiento. Reenvía el mensaje manualmente.";
}

/**
 * Mensaje crítico para fallo global del pipeline de audio.
 */
function msgErrorPipelineAudio() {
  return "Error crítico en el procesamiento del audio. Reenvía el mensaje manualmente.";
}

/**
 * Mensaje crítico para fallo global del pipeline de entrada manual.
 */
function msgErrorPipelineEntradaManual() {
  return "Error crítico al procesar la entrada manual. Reenvía manualmente con /fin_entrada.";
}

/**
 * Construye detalle de debug antes de sincronizar con GitHub.
 */
function detalleDebugAntesDeGitHub(datosMarkdown, rutaDestino) {
  if (!datosMarkdown || !datosMarkdown.valido) {
    return [
      "Ruta destino: " + (rutaDestino || "N/A"),
      "JSON válido: no",
      "Guardado cancelado para proteger integridad del diario.",
    ];
  }

  const json = datosMarkdown.rawJson || {};
  const transcripcion = obtenerTextoTranscripcion(json.transcripcion_anotada);
  const previewTranscripcion = recortarTextoPlano(transcripcion, 220) || "N/A";
  const previewResumen =
    recortarTextoPlano(json.resumen_narrativo || "", 180) || "N/A";
  const personasDetectadas = Array.isArray(json.personas_mencionadas)
    ? json.personas_mencionadas
    : [];
  const previewPersonas =
    personasDetectadas.length > 0
      ? recortarTextoPlano(personasDetectadas.join(", "), 180)
      : "Ninguna";

  return [
    "Ruta destino: " + (rutaDestino || "N/A"),
    "JSON válido: sí",
    "Vibración: " + (json.vibracion_del_dia || "N/A"),
    "Energía/Estrés: " +
      (json.nivel_energia || 3) +
      "/5 - " +
      (json.nivel_estres || 3) +
      "/5",
    "Calidad/Confianza: " +
      (json.calidad_transcripcion || 3) +
      "/5 - " +
      (json.confianza_extraccion || 3) +
      "/5",
    "Conteo: emociones=" +
      (json.emociones_detectadas || []).length +
      ", personas=" +
      (json.personas_mencionadas || []).length +
      ", tareas=" +
      (json.tareas_pendientes || []).length +
      ", eventos=" +
      (json.eventos_clave_cronologicos || []).length,
    "Personas detectadas: " + previewPersonas,
    "Preview resumen: " + previewResumen,
    "Preview transcripción: " + previewTranscripcion,
  ];
}

/**
 * Unifica transcripción string/array para poder mostrar un preview estable.
 */
function obtenerTextoTranscripcion(transcripcionAnotada) {
  if (Array.isArray(transcripcionAnotada)) {
    return transcripcionAnotada.join(" | ");
  }

  if (transcripcionAnotada === null || transcripcionAnotada === undefined) {
    return "";
  }

  return String(transcripcionAnotada);
}

// -----------------------------------------------------------------------
// Mensajes de cierre
// -----------------------------------------------------------------------

/**
 * Mensaje de confirmación final tras guardar y sincronizar.
 */
function msgRegistroGuardado(_datosMarkdown, syncGit, isDebug) {
  return construirMensajeRegistroGuardado(
    "Tu audio ya está guardado en el diario.",
    syncGit,
    isDebug,
  );
}

/**
 * Confirmación final para entradas guardadas desde /nueva_entrada.
 */
function msgRegistroGuardadoEntradaManual(_datosMarkdown, syncGit, isDebug) {
  return construirMensajeRegistroGuardado(
    "Tu entrada de texto ya está guardada en el diario.",
    syncGit,
    isDebug,
  );
}

/**
 * Crea el mensaje final de guardado para audio y entrada manual.
 */
function construirMensajeRegistroGuardado(mensajeBase, syncGit, isDebug) {
  const lineas = [mensajeBase];

  if (syncGit && syncGit.modo === "PRIMER REGISTRO DEL DIA") {
    lineas.push("Se creó la primera entrada de hoy.");
  } else {
    lineas.push("Se actualizó tu entrada del día.");
  }

  lineas.push("Todo sincronizado con Obsidian.");

  if (isDebug) {
    lineas.push("Ruta: " + (syncGit && syncGit.ruta ? syncGit.ruta : "N/A"));
    if (syncGit && syncGit.modo) {
      lineas.push("Operación: " + syncGit.modo);
    }
    lineas.push("Debug: pipeline finalizado sin errores.");
  }

  return formatearMensaje(TIPOS_MENSAJE.OK, "Entrada guardada", lineas);
}
