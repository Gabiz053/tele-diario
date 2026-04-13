/**
 * =======================================================================
 * 🧰 09_UTILS.GS | Utilidades Compartidas
 * =======================================================================
 * Helpers de fecha, parseo seguro y utilidades comunes.
 */

/**
 * Caché en memoria por ejecución para reducir lecturas repetidas de Properties.
 */
const RUNTIME_CONFIG = {
  inicializado: false,
  valores: {},
};

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Calcula la fecha lógica de diario usando hora frontera configurable.
 */
function calcularFechaLogica(baseDate) {
  const fechaBase = baseDate || new Date();
  const horaActual = parseInt(
    Utilities.formatDate(fechaBase, CONFIG.TIMEZONE, "H"),
    10,
  );

  if (horaActual >= CONFIG.HORA_FRONTERA) {
    return new Date(fechaBase.getTime());
  }

  return new Date(fechaBase.getTime() - MILISEGUNDOS_POR_DIA);
}

/**
 * Construye la ruta anual/mensual del diario a partir de la fecha objetivo.
 */
function construirRutaDiario(fecha) {
  const fechaObjetivo = fecha || calcularFechaLogica();
  const fechaFormateada = Utilities.formatDate(
    fechaObjetivo,
    CONFIG.TIMEZONE,
    "yyyy-MM-dd",
  );
  const partes = fechaFormateada.split("-");
  return `${partes[0]}/${partes[1]}/${fechaFormateada}.md`;
}

/**
 * Limpia wrappers markdown para dejar JSON puro antes de parsear.
 */
function limpiarJsonMarkdown(texto) {
  if (!texto) return "";
  return texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Intenta parsear JSON y devuelve resultado seguro sin lanzar excepción.
 */
function parsearJsonSeguro(texto) {
  try {
    return { ok: true, data: JSON.parse(texto) };
  } catch (error) {
    return { ok: false, error: error };
  }
}

/**
 * Determina si una solicitud HTTP debe reintentarse según política configurable.
 */
function debeReintentarHttp(
  statusCode,
  intento,
  maxReintentos,
  codigosExactos,
  permitir5xx,
) {
  if (intento >= maxReintentos) return false;

  const codigos = Array.isArray(codigosExactos) ? codigosExactos : [];
  if (codigos.indexOf(statusCode) !== -1) return true;
  if (permitir5xx && statusCode >= 500) return true;

  return false;
}

/**
 * Determina si un valor de propiedad cuenta como configurado.
 */
function tieneValorNoVacio(valor) {
  return String(valor || "").trim() !== "";
}

/**
 * Clasifica una propiedad en obligatoria, recomendada o default.
 */
function clasificarPropiedadScript(
  clave,
  obligatoriasConValor,
  recomendadasConValor,
) {
  const requiereValor = obligatoriasConValor.indexOf(clave) !== -1;
  const recomiendaValor = recomendadasConValor.indexOf(clave) !== -1;

  let categoria = "DEFAULT";
  if (requiereValor) categoria = "OBLIGATORIA";
  else if (recomiendaValor) categoria = "RECOMENDADA";

  return {
    requiereValor: requiereValor,
    recomiendaValor: recomiendaValor,
    categoria: categoria,
  };
}

/**
 * Normaliza cualquier chatId a string estable para comparaciones.
 */
function normalizarChatId(chatId) {
  if (chatId === null || chatId === undefined) return "";
  return String(chatId).trim();
}

/**
 * Convierte un CSV de chat IDs en lista limpia sin duplicados.
 */
function extraerListaChatIds(valorCsv) {
  const entrada = String(valorCsv || "").trim();
  if (!entrada) return [];

  const items = entrada.split(/[\s,;]+/);
  const salida = [];
  const vistos = {};

  for (let i = 0; i < items.length; i++) {
    const id = normalizarChatId(items[i]);
    if (!id || vistos[id]) continue;
    vistos[id] = true;
    salida.push(id);
  }

  return salida;
}

/**
 * Obtiene la allowlist de chats autorizados desde Script Properties.
 */
function obtenerChatIdsPermitidos() {
  return extraerListaChatIds(
    obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.ALLOWED_CHAT_IDS),
  );
}

/**
 * Obtiene la lista de chats administradores desde Script Properties.
 */
function obtenerChatIdsAdmin() {
  return extraerListaChatIds(
    obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.ADMIN_CHAT_IDS),
  );
}

/**
 * Valida si un chat puede usar el bot según allowlist configurada.
 */
function esChatAutorizado(chatId) {
  const permitidos = obtenerChatIdsPermitidos();
  if (permitidos.length === 0) return true;

  const id = normalizarChatId(chatId);
  return permitidos.indexOf(id) !== -1;
}

/**
 * Valida privilegios de administrador sobre un chat autorizado.
 */
function esChatAdmin(chatId) {
  if (!esChatAutorizado(chatId)) return false;

  const admins = obtenerChatIdsAdmin();
  if (admins.length === 0) return true;

  const id = normalizarChatId(chatId);
  return admins.indexOf(id) !== -1;
}

/**
 * Obtiene el secreto esperado para validar el webhook de Telegram.
 */
function obtenerSecretoWebhookTelegram() {
  return obtenerPropiedadRuntime(
    CONFIG.SCRIPT_PROPERTIES.TELEGRAM_WEBHOOK_SECRET,
  );
}

/**
 * Extrae el secreto recibido por query params del evento de Apps Script.
 */
function extraerSecretoWebhookDesdeEvento(e) {
  if (!e || !e.parameter) return "";

  const secreto =
    e.parameter.secret || e.parameter.webhook_secret || e.parameter.token || "";

  return String(secreto).trim();
}

/**
 * Compara el secreto de webhook recibido con el esperado en configuración.
 */
function validarSecretoWebhookTelegram(e) {
  const secretoEsperado = obtenerSecretoWebhookTelegram();
  if (!secretoEsperado) return true;

  const secretoRecibido = extraerSecretoWebhookDesdeEvento(e);
  return Boolean(secretoRecibido && secretoRecibido === secretoEsperado);
}

// Dedupe y sesiones manuales extraídos a 09_Utils_EntradaManual.js.

// -----------------------------------------------------------------------
// Script Properties y runtime config
// -----------------------------------------------------------------------

/**
 * Define el valor por defecto por cada Script Property.
 */
function obtenerDefaultPropiedadScript(clave) {
  if (clave === CONFIG.SCRIPT_PROPERTIES.DEBUG_MODE) return "false";
  if (clave === CONFIG.SCRIPT_PROPERTIES.IA_MODEL)
    return CONFIG.MODELO_POR_DEFECTO;
  return "";
}

/**
 * Lee una propiedad del proyecto y devuelve string limpio.
 */
function obtenerPropiedadScript(clave) {
  const valor = PropertiesService.getScriptProperties().getProperty(clave);
  return String(valor || "").trim();
}

/**
 * Lee una propiedad; si no existe, guarda un valor por defecto y lo devuelve.
 */
function obtenerPropiedadScriptConDefault(clave, valorPorDefecto) {
  const props = PropertiesService.getScriptProperties();
  const valorActual = props.getProperty(clave);

  if (valorActual === null || String(valorActual).trim() === "") {
    const valorNormalizado = String(valorPorDefecto);
    props.setProperty(clave, valorNormalizado);
    return valorNormalizado;
  }

  return String(valorActual).trim();
}

/**
 * Persiste una propiedad del proyecto en formato string.
 */
function guardarPropiedadScript(clave, valor) {
  const valorNormalizado = String(valor).trim();
  PropertiesService.getScriptProperties().setProperty(clave, valorNormalizado);

  if (RUNTIME_CONFIG.inicializado) {
    RUNTIME_CONFIG.valores[clave] = valorNormalizado;
  }
}

/**
 * Carga todas las Script Properties en memoria para esta ejecución.
 */
function cargarRuntimeConfig(forzarRecarga) {
  if (!forzarRecarga && RUNTIME_CONFIG.inicializado) {
    return RUNTIME_CONFIG.valores;
  }

  const aliases = Object.keys(CONFIG.SCRIPT_PROPERTIES);
  const snapshot = {};

  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    const clave = CONFIG.SCRIPT_PROPERTIES[alias];
    snapshot[clave] = obtenerPropiedadScriptConDefault(
      clave,
      obtenerDefaultPropiedadScript(clave),
    );
  }

  RUNTIME_CONFIG.valores = snapshot;
  RUNTIME_CONFIG.inicializado = true;
  return RUNTIME_CONFIG.valores;
}

/**
 * Lee una propiedad desde caché runtime; si falta, hace fallback a Script Properties.
 */
function obtenerPropiedadRuntime(clave) {
  const valores = cargarRuntimeConfig(false);
  const valorCacheado = valores[clave];
  if (typeof valorCacheado === "string") {
    return valorCacheado.trim();
  }

  const valorRecuperado = obtenerPropiedadScriptConDefault(
    clave,
    obtenerDefaultPropiedadScript(clave),
  );
  valores[clave] = String(valorRecuperado).trim();
  return valores[clave];
}

/**
 * Inicializa todas las Script Properties declaradas en CONFIG.
 * Si faltan, se crean con su valor por defecto.
 */
function inicializarScriptProperties() {
  const aliases = Object.keys(CONFIG.SCRIPT_PROPERTIES);
  const reporte = [];
  const props = PropertiesService.getScriptProperties();

  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    const clave = CONFIG.SCRIPT_PROPERTIES[alias];
    const valorAntes = props.getProperty(clave);
    const valorFinal = obtenerPropiedadScriptConDefault(
      clave,
      obtenerDefaultPropiedadScript(clave),
    );

    reporte.push({
      alias: alias,
      clave: clave,
      inicializada: valorAntes === null || String(valorAntes).trim() === "",
      tieneValor: String(valorFinal).trim() !== "",
    });
  }

  // Después de asegurar defaults, actualizamos snapshot en memoria.
  cargarRuntimeConfig(true);

  return reporte;
}

/**
 * Revisión integral de Script Properties (crea faltantes y valida valores).
 */
function revisarScriptProperties() {
  const estado = inicializarScriptProperties();
  const obligatoriasConValor = [
    CONFIG.SCRIPT_PROPERTIES.TELEGRAM_TOKEN,
    CONFIG.SCRIPT_PROPERTIES.GEMINI_API_KEY,
    CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN,
  ];
  const recomendadasConValor = [
    CONFIG.SCRIPT_PROPERTIES.TELEGRAM_WEBHOOK_SECRET,
    CONFIG.SCRIPT_PROPERTIES.ALLOWED_CHAT_IDS,
    CONFIG.SCRIPT_PROPERTIES.ADMIN_CHAT_IDS,
  ];

  const detalle = [];
  const faltantesConValor = [];
  const recomendadasSinValor = [];

  // En modo abierto: solo las obligatorias afectan el estado global "ok".
  // Las recomendadas se reportan como aviso de endurecimiento opcional.
  for (let i = 0; i < estado.length; i++) {
    const item = estado[i];
    const valorActual = obtenerPropiedadScript(item.clave);
    const clasificacion = clasificarPropiedadScript(
      item.clave,
      obligatoriasConValor,
      recomendadasConValor,
    );
    const tieneValor = tieneValorNoVacio(valorActual);

    if (clasificacion.requiereValor && !tieneValor) {
      faltantesConValor.push(item.clave);
    }

    if (clasificacion.recomiendaValor && !tieneValor) {
      recomendadasSinValor.push(item.clave);
    }

    detalle.push({
      alias: item.alias,
      clave: item.clave,
      inicializada: item.inicializada,
      requiereValor: clasificacion.requiereValor,
      recomiendaValor: clasificacion.recomiendaValor,
      categoria: clasificacion.categoria,
      tieneValor: tieneValor,
    });
  }

  return {
    ok: faltantesConValor.length === 0,
    faltantesConValor: faltantesConValor,
    recomendadasSinValor: recomendadasSinValor,
    detalle: detalle,
  };
}

// Diagnóstico y conectividad extraídos a 09_Utils_Diagnostico.js.

// -----------------------------------------------------------------------
// Accesores de configuración runtime
// -----------------------------------------------------------------------

/**
 * Lee el token de Telegram desde runtime config.
 */
function obtenerTokenTelegram() {
  return obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.TELEGRAM_TOKEN);
}

/**
 * Lee la API key de Gemini desde runtime config.
 */
function obtenerGeminiApiKey() {
  return obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.GEMINI_API_KEY);
}

/**
 * Lee el token de GitHub desde runtime config.
 */
function obtenerGitHubToken() {
  return obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN);
}

/**
 * Devuelve el estado de debug como booleano.
 */
function obtenerDebugMode() {
  return (
    obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.DEBUG_MODE) === "true"
  );
}

/**
 * Persiste el estado de debug en Script Properties.
 */
function guardarDebugMode(activo) {
  guardarPropiedadScript(
    CONFIG.SCRIPT_PROPERTIES.DEBUG_MODE,
    activo ? "true" : "false",
  );
}

/**
 * Obtiene el modelo IA activo desde runtime config.
 */
function obtenerModeloIA() {
  return obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.IA_MODEL);
}

/**
 * Persiste el modelo IA activo en Script Properties.
 */
function guardarModeloIA(modelo) {
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.IA_MODEL, modelo);
}

/**
 * Guarda metadatos de la última sincronización exitosa con GitHub.
 */
function guardarUltimaSincronizacion(ruta, modo) {
  const marca = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd HH:mm:ss",
  );

  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_ROUTE, ruta || "");
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_MODE, modo || "");
  guardarPropiedadScript(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_AT, marca);
}

/**
 * Obtiene metadatos de la última sincronización guardada.
 */
function obtenerUltimaSincronizacion() {
  return {
    ruta: obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_ROUTE),
    modo: obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_MODE),
    fechaHora: obtenerPropiedadRuntime(CONFIG.SCRIPT_PROPERTIES.LAST_SYNC_AT),
  };
}
