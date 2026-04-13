/**
 * =======================================================================
 * 🧠 03_ESTADO.GS | Gestor de Estado y Comandos del Sistema
 * =======================================================================
 * Administra la caché persistente y el procesamiento de comandos del sistema.
 */

const COMANDOS_ENTRADA_MANUAL = {
  NUEVA: "nueva-entrada",
  FIN: "fin-entrada",
  CANCELAR: "cancelar-entrada",
};

const PREFIJO_COMANDO_MODELO = "modelo-";

/**
 * Clasifica el tipo de entrada recibido desde Telegram.
 */
function clasificarEntrada(msg) {
  if (msg.text) return "TEXT";
  if (msg.voice) return "VOICE";
  return "UNKNOWN";
}

/**
 * Comandos de alto impacto reservados a chats administradores.
 */
const COMANDOS_ADMIN_EXACTOS = {
  reset: true,
  "debug-on": true,
  "debug-off": true,
  "test-conexion": true,
  "test-propiedades": true,
};

/**
 * Estrategias para comandos de debug con efecto directo sobre estado runtime.
 */
const COMANDOS_DEBUG = {
  "debug-on": function (chatId) {
    guardarDebugMode(true);
    enviarMensaje(chatId, msgComandoDebugActivado());
  },
  "debug-off": function (chatId) {
    guardarDebugMode(false);
    enviarMensaje(chatId, msgComandoDebugDesactivado());
  },
};

/**
 * Estrategias de comandos de consulta para simplificar el router de estado.
 */
const COMANDOS_CONSULTA = {
  ping: function (chatId) {
    enviarMensaje(chatId, msgPing());
  },
  version: function (chatId) {
    enviarMensaje(chatId, msgVersionBot());
  },
  estado: function (chatId) {
    enviarMensaje(chatId, msgEstadoSistema(construirInfoEstadoComando()));
  },
  "modelo-actual": function (chatId) {
    const modeloTecnico = obtenerModeloIA();
    enviarMensaje(
      chatId,
      msgModeloActual(obtenerAliasModelo(modeloTecnico), modeloTecnico),
    );
  },
  modelos: function (chatId) {
    enviarMensaje(
      chatId,
      msgModelosDisponibles(obtenerModeloIA(), listarModelosDisponibles()),
    );
  },
  "fecha-logica": function (chatId) {
    const fechaLogica = Utilities.formatDate(
      calcularFechaLogica(),
      CONFIG.TIMEZONE,
      "yyyy-MM-dd",
    );
    enviarMensaje(
      chatId,
      msgFechaLogica(fechaLogica, CONFIG.HORA_FRONTERA, CONFIG.TIMEZONE),
    );
  },
  "ruta-hoy": function (chatId) {
    const rutaDiario = construirRutaDiario(calcularFechaLogica());
    enviarMensaje(chatId, msgRutaHoy(rutaDiario));
  },
  "test-conexion": function (chatId) {
    enviarMensaje(chatId, msgTestConexion(revisarConectividadServicios()));
  },
  "test-propiedades": function (chatId) {
    enviarMensaje(chatId, msgTestPropiedades(revisarScriptProperties()));
  },
  "ultimo-guardado": function (chatId) {
    enviarMensaje(chatId, msgUltimoGuardado(obtenerUltimaSincronizacion()));
  },
};

/**
 * Carga estado persistido y aplica defaults si faltan claves.
 */
function obtenerEstadoSistema() {
  return {
    isDebug: obtenerDebugMode(),
    modelo: obtenerModeloIA(),
  };
}

/**
 * Procesa comandos administrativos antes de entrar al flujo principal.
 */
function procesarComandosSistema(msg, chatId, estado) {
  if (!msg.text) return false;

  const estadoActual = estado || obtenerEstadoSistema();
  const textoOriginal = String(msg.text || "").trim();
  // Por diseño, solo comandos con slash entran al router administrativo.
  if (!textoOriginal.startsWith("/")) return false;

  const cmd = normalizarComando(textoOriginal);
  if (!cmd) return false;

  if (esComandoSoloAdmin(cmd) && !esChatAdmin(chatId)) {
    enviarMensaje(chatId, msgComandoSinPermiso());
    return true;
  }

  if (esComandoAyuda(cmd)) {
    enviarMensaje(chatId, msgAyuda());
    return true;
  }

  if (cmd === "reset") {
    ejecutarResetSistema(chatId);
    return true;
  }

  if (procesarComandoEntradaManual(cmd, msg, chatId, estadoActual)) return true;

  if (procesarComandoDebug(cmd, chatId)) return true;
  if (procesarComandoConsulta(cmd, chatId)) return true;
  if (procesarComandoModelo(cmd, chatId)) return true;

  enviarMensaje(chatId, msgComandoNoReconocido(cmd));
  return true;
}

/**
 * Uniforma el texto de comando para simplificar comparaciones.
 */
function normalizarComando(texto) {
  const textoLimpio = String(texto || "")
    .trim()
    .toLowerCase();
  if (!textoLimpio) return "";

  const tokenBruto = textoLimpio.split(/\s+/)[0] || "";
  const sinBarra = tokenBruto.startsWith("/")
    ? tokenBruto.substring(1)
    : tokenBruto;
  const sinMencionBot = sinBarra.split("@")[0];

  return sinMencionBot
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Determina si un comando debe restringirse a administradores.
 */
function esComandoSoloAdmin(cmd) {
  if (COMANDOS_ADMIN_EXACTOS[cmd]) return true;

  if (cmd.indexOf(PREFIJO_COMANDO_MODELO) === 0) {
    const peticion = cmd.replace(PREFIJO_COMANDO_MODELO, "").trim();
    return Boolean(peticion && peticion !== "actual");
  }

  return false;
}

/**
 * Acepta alias comunes de ayuda para mejorar UX en chat.
 */
function esComandoAyuda(cmd) {
  return (
    cmd === "ayuda" || cmd === "help" || cmd === "start" || cmd === "comandos"
  );
}

/**
 * Gestiona activación y desactivación del modo debug.
 */
function procesarComandoDebug(cmd, chatId) {
  const handler = COMANDOS_DEBUG[cmd];
  if (typeof handler !== "function") return false;

  handler(chatId);
  return true;
}

/**
 * Comandos de consulta y diagnóstico en tiempo real.
 */
function procesarComandoConsulta(cmd, chatId) {
  const handler = COMANDOS_CONSULTA[cmd];
  if (typeof handler !== "function") return false;

  handler(chatId);
  return true;
}

/**
 * Gestiona el flujo de captura manual: iniciar, finalizar o cancelar.
 */
function procesarComandoEntradaManual(cmd, msg, chatId, estado) {
  if (
    cmd !== COMANDOS_ENTRADA_MANUAL.NUEVA &&
    cmd !== COMANDOS_ENTRADA_MANUAL.FIN &&
    cmd !== COMANDOS_ENTRADA_MANUAL.CANCELAR
  ) {
    return false;
  }

  if (cmd === COMANDOS_ENTRADA_MANUAL.NUEVA) {
    const resumen = obtenerResumenSesionEntradaManual(chatId);

    if (resumen.activa) {
      enviarMensaje(chatId, msgEntradaManualYaActiva(resumen.totalMensajes));
      return true;
    }

    iniciarSesionEntradaManual(chatId);
    enviarMensaje(chatId, msgEntradaManualInicio());
    return true;
  }

  if (cmd === COMANDOS_ENTRADA_MANUAL.CANCELAR) {
    const resumenCancelacion = obtenerResumenSesionEntradaManual(chatId);
    if (!resumenCancelacion.activa) {
      enviarMensaje(chatId, msgEntradaManualSinSesion());
      return true;
    }

    limpiarSesionEntradaManual(chatId);
    enviarMensaje(
      chatId,
      msgEntradaManualCancelada(
        resumenCancelacion.totalMensajes,
        resumenCancelacion.totalChars,
      ),
    );
    return true;
  }

  const resumen = obtenerResumenSesionEntradaManual(chatId);
  if (!resumen.activa) {
    enviarMensaje(chatId, msgEntradaManualSinSesion());
    return true;
  }

  finalizarEntradaManual(chatId, estado || obtenerEstadoSistema(), msg);
  return true;
}

/**
 * Gestiona cambios dinámicos del modelo de IA.
 */
function procesarComandoModelo(cmd, chatId) {
  if (cmd.startsWith(PREFIJO_COMANDO_MODELO)) {
    const peticion = cmd.replace(PREFIJO_COMANDO_MODELO, "").trim();

    if (!peticion || peticion === "actual") {
      return false;
    }

    const nombreTecnico = CONFIG.MODELOS_DISPONIBLES[peticion];

    if (nombreTecnico) {
      guardarModeloIA(nombreTecnico);
      enviarMensaje(chatId, msgModeloActualizado(nombreTecnico));
    } else {
      enviarMensaje(chatId, msgModeloNoReconocido());
    }
    return true;
  }

  return false;
}

/**
 * Construye el snapshot de estado expuesto por el comando /estado.
 */
function construirInfoEstadoComando() {
  const modeloTecnico = obtenerModeloIA();
  const fechaBase = calcularFechaLogica();
  const fechaLogica = Utilities.formatDate(
    fechaBase,
    CONFIG.TIMEZONE,
    "yyyy-MM-dd",
  );

  return {
    debugActivo: obtenerDebugMode(),
    modeloTecnico: modeloTecnico,
    modeloAlias: obtenerAliasModelo(modeloTecnico),
    fechaLogica: fechaLogica,
    rutaDiario: construirRutaDiario(fechaBase),
  };
}

/**
 * Lista los modelos disponibles en formato alias + nombre técnico.
 */
function listarModelosDisponibles() {
  const salida = [];
  const aliases = Object.keys(CONFIG.MODELOS_DISPONIBLES);

  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    salida.push({ alias: alias, tecnico: CONFIG.MODELOS_DISPONIBLES[alias] });
  }

  return salida;
}

/**
 * Resuelve el alias interno asociado al nombre técnico activo.
 */
function obtenerAliasModelo(modeloTecnico) {
  const aliases = Object.keys(CONFIG.MODELOS_DISPONIBLES);
  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    if (CONFIG.MODELOS_DISPONIBLES[alias] === modeloTecnico) {
      return alias;
    }
  }

  return "personalizado";
}

/**
 * Reinicia el estado operativo del bot para el chat actual.
 */
function ejecutarResetSistema(chatId) {
  guardarDebugMode(false);
  guardarModeloIA(CONFIG.MODELO_POR_DEFECTO);

  // Reinicio de metadatos de seguimiento para empezar en limpio.
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_ROUTE, "");
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_MODE, "");
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_AT, "");

  // Limpia buffer manual en este chat para evitar estados colgados.
  limpiarSesionEntradaManual(chatId);

  // Refresca snapshot en memoria con los nuevos valores.
  cargarRuntimeConfig(true);

  enviarMensaje(chatId, msgComandoResetEjecutado(CONFIG.MODELO_POR_DEFECTO));
}
