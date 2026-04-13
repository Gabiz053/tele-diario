/**
 * =======================================================================
 * 💬 10_MENSAJES.GS | Catálogo de Mensajes para Telegram
 * =======================================================================
 * Centraliza formato visual y textos para mantener consistencia.
 */

/**
 * Enum lógico para clasificar mensajes según su intención.
 */
const TIPOS_MENSAJE = {
  PROGRESO: "PROGRESO",
  INFO: "INFO",
  OK: "OK",
  ADVERTENCIA: "ADVERTENCIA",
  ERROR: "ERROR",
  DEBUG: "DEBUG",
};

const MENSAJES_FALLBACK = {
  NO_DISPONIBLE: "N/A",
  COMANDO_VACIO: "(vacío)",
};

const ERRORES_ENTRADA_MANUAL = {
  MAX_MENSAJES: "MAX_MENSAJES",
  MAX_CHARS: "MAX_CHARS",
  TEXTO_VACIO: "TEXTO_VACIO",
};

/**
 * Mapa visual entre tipo de mensaje e ícono de Telegram.
 */
const ICONOS_MENSAJE = {
  PROGRESO: "🔄",
  INFO: "ℹ️",
  OK: "✅",
  ADVERTENCIA: "⚠️",
  ERROR: "❌",
  DEBUG: "🛠️",
};

/**
 * Renderiza un bloque visual uniforme para Telegram.
 */
function formatearMensaje(tipo, titulo, detalle) {
  const icono = ICONOS_MENSAJE[tipo] || ICONOS_MENSAJE.INFO;
  const lineas = normalizarDetalleMensaje(detalle);

  let mensaje = `[ ${icono} ] ${titulo}`;
  if (lineas.length > 0) {
    mensaje += "\n" + lineas.map((linea) => `• ${linea}`).join("\n");
  }

  return mensaje;
}

/**
 * Convierte cualquier input en una lista limpia de líneas.
 */
function normalizarDetalleMensaje(detalle) {
  if (detalle === null || detalle === undefined || detalle === "") return [];

  if (Array.isArray(detalle)) {
    return detalle.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(detalle)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Evita mensajes demasiado largos en vistas de resumen.
 */
function recortarTextoPlano(texto, maxChars) {
  const valor = String(texto || "").trim();
  if (!valor) return "";
  if (valor.length <= maxChars) return valor;
  return valor.substring(0, maxChars) + "...";
}

// -----------------------------------------------------------------------
// Mensajes de comandos y ayuda
// -----------------------------------------------------------------------

/**
 * Devuelve el mensaje de ayuda principal con catálogo de comandos.
 */
function msgAyuda() {
  return [
    formatearMensaje(TIPOS_MENSAJE.INFO, "Manual del Diario AI", [
      "Las notas de voz se guardan en Obsidian. Para texto largo usa /nueva_entrada ... /fin_entrada.",
      "Ayuda: /ayuda, /help, /start, /comandos.",
      "Modelos: /modelo_flash, /modelo_lite, /modelo_pro, /modelo_actual, /modelos.",
      "Entrada manual: /nueva_entrada, /fin_entrada y /cancelar_entrada.",
      "Sistema: /reset, /debug_on, /debug_off, /estado, /fecha_logica, /ruta_hoy.",
      "Diagnóstico: /test_conexion, /test_propiedades, /ultimo_guardado, /ping, /version.",
      "Comandos sensibles requieren chat admin.",
    ]),
    formatearMensaje(
      TIPOS_MENSAJE.INFO,
      "Tip rápido",
      "Puedes usar el menú de comandos de Telegram para no escribirlos a mano.",
    ),
  ].join("\n\n");
}

/**
 * Confirma activación de modo debug para el chat.
 */
function msgComandoDebugActivado() {
  return formatearMensaje(
    TIPOS_MENSAJE.DEBUG,
    "Modo debug activado",
    "Desde ahora recibirás trazas internas por etapas.",
  );
}

/**
 * Confirma desactivación de modo debug para el chat.
 */
function msgComandoDebugDesactivado() {
  return formatearMensaje(
    TIPOS_MENSAJE.INFO,
    "Modo debug desactivado",
    "Vuelves a una vista limpia con mensajes esenciales.",
  );
}

/**
 * Confirma reinicio operativo del bot para el chat actual.
 */
function msgComandoResetEjecutado(modeloPorDefecto) {
  return formatearMensaje(TIPOS_MENSAJE.OK, "Reset ejecutado", [
    "Estado operativo reiniciado.",
    "Debug: desactivado.",
    "Modelo activo: " + (modeloPorDefecto || MENSAJES_FALLBACK.NO_DISPONIBLE) + ".",
    "Sesión manual actual: limpiada.",
    "Último guardado: metadatos reiniciados.",
  ]);
}

/**
 * Informa que el modelo de IA fue actualizado correctamente.
 */
function msgModeloActualizado(modelo) {
  return formatearMensaje(
    TIPOS_MENSAJE.OK,
    "Modelo actualizado",
    "Motor activo: " + modelo,
  );
}

/**
 * Muestra error cuando el alias de modelo no es válido.
 */
function msgModeloNoReconocido() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "Modelo no reconocido",
    "Usa: /modelo_flash, /modelo_lite o /modelo_pro.",
  );
}

/**
 * Mensaje corto de latido para verificar disponibilidad del bot.
 */
function msgPing() {
  return formatearMensaje(
    TIPOS_MENSAJE.OK,
    "Bot activo",
    "Estoy en línea y listo para procesar tu siguiente entrada.",
  );
}

/**
 * Devuelve la versión funcional actualmente desplegada.
 */
function msgVersionBot() {
  return formatearMensaje(
    TIPOS_MENSAJE.INFO,
    "Versión del bot",
    "Diario AI con arquitectura estable y seguridad unificadas.",
  );
}

/**
 * Notifica que un comando está restringido por permisos.
 */
function msgComandoSinPermiso() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "Permiso insuficiente",
    "Ese comando está restringido a chats administradores.",
  );
}

/**
 * Notifica al usuario cuando un comando no existe o está mal escrito.
 */
function msgComandoNoReconocido(comandoNormalizado) {
  const cmd = String(comandoNormalizado || "").trim();
  const comandoMostrado = cmd
    ? "/" + cmd.replace(/-/g, "_")
    : MENSAJES_FALLBACK.COMANDO_VACIO;

  return formatearMensaje(TIPOS_MENSAJE.ADVERTENCIA, "Comando no reconocido", [
    "No existe: " + comandoMostrado,
    "Usa /ayuda para ver la lista completa.",
  ]);
}

/**
 * Mensaje inicial al activar /nueva_entrada.
 */
function msgEntradaManualInicio() {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Nueva entrada activada", [
    "Cuéntame qué quieres añadir. Puedes enviar varios mensajes.",
    "Cuando termines, escribe /fin_entrada para guardar en Obsidian.",
    "Si quieres salir sin guardar, usa /cancelar_entrada.",
  ]);
}

/**
 * Aviso cuando ya existe una sesión activa de /nueva_entrada.
 */
function msgEntradaManualYaActiva(totalMensajes) {
  return formatearMensaje(TIPOS_MENSAJE.ADVERTENCIA, "Sesión ya activa", [
    "Ya tienes una nueva entrada en curso.",
    "Mensajes acumulados: " + (totalMensajes || 0),
    "Usa /fin_entrada para cerrarla y guardar.",
  ]);
}

/**
 * Aviso cuando se intenta cerrar sin una sesión activa.
 */
function msgEntradaManualSinSesion() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "No hay sesión activa",
    "Primero ejecuta /nueva_entrada para empezar a capturar texto.",
  );
}

/**
 * Confirmación al cancelar una sesión manual en curso.
 */
function msgEntradaManualCancelada(totalMensajes, totalChars) {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Entrada cancelada", [
    "Se descartó la sesión actual.",
    "Mensajes descartados: " + (totalMensajes || 0),
    "Caracteres descartados: " + (totalChars || 0),
  ]);
}

/**
 * Confirmación tras agregar un mensaje al buffer manual.
 */
function msgEntradaManualTextoAgregado(totalMensajes, totalChars) {
  return formatearMensaje(TIPOS_MENSAJE.OK, "Texto agregado", [
    "Mensajes acumulados: " + (totalMensajes || 0),
    "Caracteres acumulados: " + (totalChars || 0),
    "Sigue escribiendo o usa /fin_entrada para guardar.",
  ]);
}

/**
 * Aviso cuando no hay contenido útil al cerrar /fin_entrada.
 */
function msgEntradaManualVacia() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "Entrada vacía",
    "No había texto útil para guardar. Inicia de nuevo con /nueva_entrada.",
  );
}

/**
 * Aviso de procesamiento cuando se ejecuta /fin_entrada.
 */
function msgEntradaManualProcesando(totalMensajes) {
  return formatearMensaje(TIPOS_MENSAJE.PROGRESO, "Procesando entrada manual", [
    "Mensajes recibidos: " + (totalMensajes || 0),
    "Estoy consolidando y enviando a Gemini.",
  ]);
}

/**
 * Error de captura al intentar agregar texto en modo manual.
 */
function msgEntradaManualErrorRegistro(resultado) {
  const error =
    (resultado && resultado.error) || MENSAJES_FALLBACK.NO_DISPONIBLE;

  if (error === ERRORES_ENTRADA_MANUAL.MAX_MENSAJES) {
    return formatearMensaje(
      TIPOS_MENSAJE.ADVERTENCIA,
      "Límite de mensajes alcanzado",
      "Usa /fin_entrada para guardar y empezar una nueva sesión.",
    );
  }

  if (error === ERRORES_ENTRADA_MANUAL.MAX_CHARS) {
    return formatearMensaje(
      TIPOS_MENSAJE.ADVERTENCIA,
      "Límite de caracteres alcanzado",
      "Usa /fin_entrada para guardar lo capturado hasta ahora.",
    );
  }

  if (error === ERRORES_ENTRADA_MANUAL.TEXTO_VACIO) {
    return formatearMensaje(
      TIPOS_MENSAJE.ADVERTENCIA,
      "Texto vacío",
      "Envía contenido de texto para añadirlo a la entrada.",
    );
  }

  return formatearMensaje(
    TIPOS_MENSAJE.ERROR,
    "No se pudo registrar el texto",
    "Intenta de nuevo o reinicia con /nueva_entrada.",
  );
}

/**
 * Avisa cuando llega un update duplicado y se ignora por seguridad.
 */
function msgMensajeDuplicadoIgnorado() {
  return formatearMensaje(
    TIPOS_MENSAJE.ADVERTENCIA,
    "Mensaje duplicado",
    "Mensaje duplicado ignorado por seguridad.",
  );
}

/**
 * Renderiza resumen de estado del bot para diagnóstico rápido.
 */
function msgEstadoSistema(estadoInfo) {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Estado del bot", [
    "Debug: " + (estadoInfo.debugActivo ? "activado" : "desactivado"),
    "Modelo: " + estadoInfo.modeloAlias + " (" + estadoInfo.modeloTecnico + ")",
    "Fecha lógica: " + estadoInfo.fechaLogica,
    "Ruta del diario: " + estadoInfo.rutaDiario,
  ]);
}

/**
 * Muestra el modelo activo en alias y nombre técnico.
 */
function msgModeloActual(aliasModelo, modeloTecnico) {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Modelo actual", [
    "Alias: " + aliasModelo,
    "Motor: " + modeloTecnico,
  ]);
}

/**
 * Lista modelos disponibles y marca el actualmente activo.
 */
function msgModelosDisponibles(modeloTecnicoActual, modelosDisponibles) {
  const lineas = [];

  for (let i = 0; i < modelosDisponibles.length; i++) {
    const item = modelosDisponibles[i];
    const activo = item.tecnico === modeloTecnicoActual ? " (activo)" : "";
    lineas.push("/modelo_" + item.alias + " -> " + item.tecnico + activo);
  }

  return formatearMensaje(TIPOS_MENSAJE.INFO, "Modelos disponibles", lineas);
}

/**
 * Muestra la fecha lógica calculada y su configuración temporal.
 */
function msgFechaLogica(fechaLogica, horaFrontera, timezone) {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Fecha lógica del diario", [
    "Fecha activa: " + fechaLogica,
    "Zona horaria: " + timezone,
    "Hora frontera: " + horaFrontera + ":00",
  ]);
}

/**
 * Muestra la ruta de diario en uso para la fecha actual lógica.
 */
function msgRutaHoy(rutaDiario) {
  return formatearMensaje(TIPOS_MENSAJE.INFO, "Ruta del diario de hoy", [
    "Destino actual: " + rutaDiario,
  ]);
}

/**
 * Resume el estado de conectividad de Telegram, GitHub y Gemini.
 */
function msgTestConexion(conexiones) {
  const t = conexiones.telegram || {};
  const g = conexiones.github || {};
  const ia = conexiones.gemini || {};

  return formatearMensaje(TIPOS_MENSAJE.INFO, "Test de conexión", [
    "Telegram: " +
      (t.ok ? "OK" : "ERROR") +
      " (" +
      (t.statusCode || MENSAJES_FALLBACK.NO_DISPONIBLE) +
      ")",
    "GitHub: " +
      (g.ok ? "OK" : "ERROR") +
      " (" +
      (g.statusCode || MENSAJES_FALLBACK.NO_DISPONIBLE) +
      ")",
    "Gemini: " +
      (ia.ok ? "OK" : "ERROR") +
      " (" +
      (ia.statusCode || MENSAJES_FALLBACK.NO_DISPONIBLE) +
      ")",
    "Detalle Gemini: " +
      recortarTextoPlano(ia.detalle || MENSAJES_FALLBACK.NO_DISPONIBLE, 220),
  ]);
}

/**
 * Resume el estado de Script Properties obligatorias y recomendadas.
 */
function msgTestPropiedades(reporte) {
  const faltantes = Array.isArray(reporte.faltantesConValor)
    ? reporte.faltantesConValor
    : [];
  const recomendadasSinValor = Array.isArray(reporte.recomendadasSinValor)
    ? reporte.recomendadasSinValor
    : [];
  const detalle = Array.isArray(reporte.detalle) ? reporte.detalle : [];

  const lineas = ["Resultado: " + (reporte.ok ? "OK" : "FALTAN VALORES")];

  if (faltantes.length > 0) {
    lineas.push("Pendientes: " + faltantes.join(", "));
  } else {
    lineas.push("Todas las propiedades obligatorias tienen valor.");
  }

  const seguridadOpcional = [];
  for (let i = 0; i < detalle.length; i++) {
    const item = detalle[i] || {};
    if (item.categoria !== "RECOMENDADA") continue;
    seguridadOpcional.push(
      item.clave + ": " + (item.tieneValor ? "OK" : "SIN_VALOR"),
    );
  }

  if (seguridadOpcional.length > 0) {
    lineas.push(
      "Seguridad opcional: " +
        recortarTextoPlano(seguridadOpcional.join(" | "), 220),
    );
  }

  if (recomendadasSinValor.length > 0) {
    lineas.push(
      "Aviso: faltan recomendadas -> " +
        recortarTextoPlano(recomendadasSinValor.join(", "), 220),
    );
  }

  return formatearMensaje(TIPOS_MENSAJE.INFO, "Test de propiedades", lineas);
}

/**
 * Muestra metadatos de la última sincronización de diario.
 */
function msgUltimoGuardado(info) {
  const ruta = String((info && info.ruta) || "").trim();
  const fechaHora = String((info && info.fechaHora) || "").trim();
  const modo = String((info && info.modo) || "").trim();

  if (!ruta && !fechaHora) {
    return formatearMensaje(
      TIPOS_MENSAJE.INFO,
      "Último guardado",
      "Aún no hay sincronizaciones registradas.",
    );
  }

  return formatearMensaje(TIPOS_MENSAJE.INFO, "Último guardado", [
    "Fecha: " + (fechaHora || MENSAJES_FALLBACK.NO_DISPONIBLE),
    "Ruta: " + (ruta || MENSAJES_FALLBACK.NO_DISPONIBLE),
    "Operación: " + (modo || MENSAJES_FALLBACK.NO_DISPONIBLE),
  ]);
}

// El resto de mensajes operativos se encuentran en 10_Mensajes_Pipeline.js.
