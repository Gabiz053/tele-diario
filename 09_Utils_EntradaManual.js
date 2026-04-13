/**
 * =======================================================================
 * 🧰 09_UTILS_ENTRADA_MANUAL.GS | Deduplicación y Sesiones Manuales
 * =======================================================================
 * Maneja deduplicación de updates y buffer temporal para /nueva_entrada.
 */

/**
 * Configuración de deduplicación para evitar reprocesar la misma entrada.
 */
const DEDUPE_ENTRADAS = {
  PREFIJO_CACHE: "DEDUPE_EVT_",
  // Cubre ejecuciones largas para evitar doble procesamiento por reintentos tardíos.
  TTL_CACHE_SEC: 300,
};

/**
 * Configuración para el modo /nueva_entrada basado en sesión temporal por chat.
 */
const ENTRADA_MANUAL = {
  PREFIJO_CACHE: "ENTRADA_MANUAL_",
  TTL_CACHE_SEC: 21600,
  MAX_MENSAJES: 200,
  MAX_CHARS: 50000,
};

const ENTRADA_MANUAL_ESTADO = {
  CHAT_FALLBACK: "unknown",
  MARCA_SIN_FECHA: "Sin fecha",
  ERROR_SESION_INEXISTENTE: "SESION_INEXISTENTE",
  ERROR_TEXTO_VACIO: "TEXTO_VACIO",
  ERROR_MAX_MENSAJES: "MAX_MENSAJES",
  ERROR_MAX_CHARS: "MAX_CHARS",
};

/**
 * Verifica si la entrada ya fue procesada y la registra en caché temporal.
 */
function verificarYRegistrarEntradaTelegram(payload, message) {
  const claves = construirClavesDeduplicacionEntrada(payload, message);
  if (claves.length === 0) {
    return { duplicado: false, claves: [] };
  }

  if (esEntradaDuplicadaEnCache(claves)) {
    return { duplicado: true, claves: claves };
  }

  registrarEntradaEnCache(claves);
  return { duplicado: false, claves: claves };
}

/**
 * Libera claves de dedupe cuando el procesamiento falla y requiere reintento.
 */
function liberarRegistroEntradaTelegram(claves) {
  if (!Array.isArray(claves) || claves.length === 0) return false;

  try {
    const cache = CacheService.getScriptCache();
    for (let i = 0; i < claves.length; i++) {
      cache.remove(DEDUPE_ENTRADAS.PREFIJO_CACHE + claves[i]);
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Construye claves estables para detectar reintentos y duplicados de contenido.
 */
function construirClavesDeduplicacionEntrada(payload, message) {
  const claves = [];

  const updateId = payload && payload.update_id;
  if (updateId !== null && updateId !== undefined && String(updateId).trim()) {
    claves.push("u:" + String(updateId).trim());
  }

  const chatId = normalizarChatId(message && message.chat && message.chat.id);
  const messageId = String((message && message.message_id) || "").trim();

  if (chatId && messageId) {
    claves.push(["m", chatId, messageId].join(":"));
  }

  const firmaContenido = construirFirmaContenidoEntrada(message);
  if (chatId && firmaContenido) {
    claves.push("c:" + chatId + ":" + firmaContenido);
  }

  return deduplicarClavesDeduplicacion(claves);
}

/**
 * Crea una firma de contenido para bloquear reenvíos del mismo audio.
 */
function construirFirmaContenidoEntrada(message) {
  if (!message) return "";

  if (message.voice) {
    const fileUniqueId = String(message.voice.file_unique_id || "").trim();
    if (fileUniqueId) return "voice:" + fileUniqueId;

    const fileId = String(message.voice.file_id || "").trim();
    if (fileId) return "voice_file:" + fileId;
  }

  if (message.audio) {
    const audioUniqueId = String(message.audio.file_unique_id || "").trim();
    if (audioUniqueId) return "audio:" + audioUniqueId;
  }

  return "";
}

/**
 * Elimina claves repetidas para minimizar ruido en el registro.
 */
function deduplicarClavesDeduplicacion(claves) {
  const salida = [];
  const vistas = {};

  for (let i = 0; i < claves.length; i++) {
    const clave = String(claves[i] || "").trim();
    if (!clave || vistas[clave]) continue;
    vistas[clave] = true;
    salida.push(clave);
  }

  return salida;
}

/**
 * Revisa caché de ejecución para cortar reintentos rápidos.
 */
function esEntradaDuplicadaEnCache(claves) {
  try {
    const cache = CacheService.getScriptCache();
    for (let i = 0; i < claves.length; i++) {
      const token = cache.get(DEDUPE_ENTRADAS.PREFIJO_CACHE + claves[i]);
      if (token) return true;
    }
  } catch (error) {
    // Si cache falla, no bloqueamos el flujo y tratamos la entrada como nueva.
  }

  return false;
}

/**
 * Registra claves en caché para deduplicación de corto plazo.
 */
function registrarEntradaEnCache(claves) {
  try {
    const cache = CacheService.getScriptCache();
    for (let i = 0; i < claves.length; i++) {
      cache.put(
        DEDUPE_ENTRADAS.PREFIJO_CACHE + claves[i],
        "1",
        DEDUPE_ENTRADAS.TTL_CACHE_SEC,
      );
    }
  } catch (error) {
    // Si cache falla, no bloqueamos el procesamiento.
  }
}

/**
 * Crea la clave de caché para almacenar el buffer de /nueva_entrada por chat.
 */
function construirClaveSesionEntradaManual(chatId) {
  const id = normalizarChatId(chatId).replace(/[^\d\-]/g, "");
  return ENTRADA_MANUAL.PREFIJO_CACHE + (id || ENTRADA_MANUAL_ESTADO.CHAT_FALLBACK);
}

/**
 * Lee la sesión activa de entrada manual desde caché.
 */
function obtenerSesionEntradaManual(chatId) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(construirClaveSesionEntradaManual(chatId));
    if (!raw) return null;

    const parseo = parsearJsonSeguro(raw);
    if (!parseo.ok || !parseo.data || !Array.isArray(parseo.data.mensajes)) {
      return null;
    }

    return parseo.data;
  } catch (error) {
    return null;
  }
}

/**
 * Indica si hay una sesión /nueva_entrada activa para ese chat.
 */
function sesionEntradaManualActiva(chatId) {
  return Boolean(obtenerSesionEntradaManual(chatId));
}

/**
 * Inicializa una nueva sesión de captura manual y borra estado anterior si existe.
 */
function iniciarSesionEntradaManual(chatId) {
  const ahora = new Date();
  const sesion = {
    chatId: normalizarChatId(chatId),
    creadaEn: formatearFechaHoraSesionEntradaManual(ahora),
    actualizadaEn: formatearFechaHoraSesionEntradaManual(ahora),
    mensajes: [],
  };

  guardarSesionEntradaManual(chatId, sesion);
  return sesion;
}

/**
 * Elimina la sesión de entrada manual asociada al chat.
 */
function limpiarSesionEntradaManual(chatId) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(construirClaveSesionEntradaManual(chatId));
  } catch (error) {
    // Si cache falla, continuamos sin bloquear el flujo.
  }
}

/**
 * Agrega una línea de texto a la sesión manual activa.
 */
function agregarTextoSesionEntradaManual(chatId, msg) {
  const sesion = obtenerSesionEntradaManual(chatId);
  if (!sesion) {
    return {
      ok: false,
      error: ENTRADA_MANUAL_ESTADO.ERROR_SESION_INEXISTENTE,
    };
  }

  const texto = String((msg && msg.text) || "").trim();
  if (!texto) {
    return {
      ok: false,
      error: ENTRADA_MANUAL_ESTADO.ERROR_TEXTO_VACIO,
    };
  }

  if (sesion.mensajes.length >= ENTRADA_MANUAL.MAX_MENSAJES) {
    return {
      ok: false,
      error: ENTRADA_MANUAL_ESTADO.ERROR_MAX_MENSAJES,
      maxMensajes: ENTRADA_MANUAL.MAX_MENSAJES,
    };
  }

  const fechaLinea = obtenerFechaHoraMensajeEntradaManual(msg);
  sesion.mensajes.push({
    fecha_hora: fechaLinea,
    texto: texto,
  });
  sesion.actualizadaEn = formatearFechaHoraSesionEntradaManual(new Date());

  const totalChars = calcularTotalCharsSesionManual(sesion);
  if (totalChars > ENTRADA_MANUAL.MAX_CHARS) {
    sesion.mensajes.pop();
    return {
      ok: false,
      error: ENTRADA_MANUAL_ESTADO.ERROR_MAX_CHARS,
      maxChars: ENTRADA_MANUAL.MAX_CHARS,
    };
  }

  guardarSesionEntradaManual(chatId, sesion);

  return {
    ok: true,
    totalMensajes: sesion.mensajes.length,
    totalChars: totalChars,
  };
}

/**
 * Genera una transcripción consolidada con marca temporal por línea.
 */
function construirTranscripcionSesionEntradaManual(sesion) {
  if (!sesion || !Array.isArray(sesion.mensajes)) return "";

  const lineas = [];
  for (let i = 0; i < sesion.mensajes.length; i++) {
    const item = sesion.mensajes[i] || {};
    const marca = String(
      item.fecha_hora || ENTRADA_MANUAL_ESTADO.MARCA_SIN_FECHA,
    ).trim();
    const texto = String(item.texto || "").trim();
    if (!texto) continue;
    lineas.push("[" + marca + "] " + texto);
  }

  return lineas.join("\n");
}

/**
 * Obtiene métricas rápidas de la sesión manual actual.
 */
function obtenerResumenSesionEntradaManual(chatId) {
  const sesion = obtenerSesionEntradaManual(chatId);
  if (!sesion || !Array.isArray(sesion.mensajes)) {
    return {
      activa: false,
      totalMensajes: 0,
      totalChars: 0,
    };
  }

  return {
    activa: true,
    totalMensajes: sesion.mensajes.length,
    totalChars: calcularTotalCharsSesionManual(sesion),
    creadaEn: sesion.creadaEn,
    actualizadaEn: sesion.actualizadaEn,
  };
}

/**
 * Persiste la sesión de entrada manual en caché con TTL renovable.
 */
function guardarSesionEntradaManual(chatId, sesion) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(
      construirClaveSesionEntradaManual(chatId),
      JSON.stringify(sesion || {}),
      ENTRADA_MANUAL.TTL_CACHE_SEC,
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Suma caracteres del buffer para limitar tamaño de entrada manual.
 */
function calcularTotalCharsSesionManual(sesion) {
  if (!sesion || !Array.isArray(sesion.mensajes)) return 0;

  let total = 0;
  for (let i = 0; i < sesion.mensajes.length; i++) {
    const item = sesion.mensajes[i] || {};
    total += String(item.texto || "").length;
  }

  return total;
}

/**
 * Resuelve la fecha del mensaje actual en formato estable para transcripción.
 */
function obtenerFechaHoraMensajeEntradaManual(msg) {
  const timestampSeg = parseInt(msg && msg.date, 10);
  const fecha =
    !isNaN(timestampSeg) && timestampSeg > 0
      ? new Date(timestampSeg * 1000)
      : new Date();

  return formatearFechaHoraSesionEntradaManual(fecha);
}

/**
 * Formatea fecha/hora bajo timezone del proyecto.
 */
function formatearFechaHoraSesionEntradaManual(fecha) {
  return Utilities.formatDate(
    fecha || new Date(),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd HH:mm:ss",
  );
}
