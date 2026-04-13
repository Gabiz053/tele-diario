/**
 * =======================================================================
 * 🧰 09_UTILS_DIAGNOSTICO.GS | Validaciones y Conectividad
 * =======================================================================
 * Utilidades de chequeo de Script Properties y conectividad externa.
 */

/**
 * Ejecuta una prueba manual desde Apps Script y deja trazas en Logger.
 */
function testScriptProperties() {
  const reporte = revisarScriptProperties();

  Logger.log("=== CHEQUEO SCRIPT PROPERTIES ===");
  for (let i = 0; i < reporte.detalle.length; i++) {
    const item = reporte.detalle[i];
    const estadoValor = item.tieneValor ? "OK" : "SIN_VALOR";
    const marcaObligatoria = item.categoria || "DEFAULT";
    const origen = item.inicializada ? "CREADA" : "EXISTENTE";
    Logger.log(
      "[" +
        estadoValor +
        "] " +
        item.clave +
        " | " +
        marcaObligatoria +
        " | " +
        origen,
    );
  }

  if (reporte.ok) {
    Logger.log(
      "Resultado: OK. Todas las propiedades obligatorias tienen valor.",
    );
  } else {
    Logger.log(
      "Resultado: FALTAN VALORES en -> " + reporte.faltantesConValor.join(", "),
    );
  }

  if (reporte.recomendadasSinValor.length > 0) {
    Logger.log(
      "Aviso: seguridad opcional sin configurar -> " +
        reporte.recomendadasSinValor.join(", "),
    );
  } else {
    Logger.log("Seguridad opcional: OK (todas las recomendadas tienen valor).");
  }

  Logger.log("=== CHEQUEO CONECTIVIDAD SERVICIOS ===");
  const conexiones = revisarConectividadServicios();

  logResultadoConexion("TELEGRAM", conexiones.telegram);
  logResultadoConexion("GITHUB", conexiones.github);
  logResultadoConexion("GEMINI", conexiones.gemini);

  const okGlobal = reporte.ok && conexiones.ok;
  Logger.log("Resultado global: " + (okGlobal ? "OK" : "ERROR"));

  return {
    ok: okGlobal,
    propiedades: reporte,
    conexiones: conexiones,
  };
}

/**
 * Ejecuta ping de conectividad a todos los servicios externos.
 */
function revisarConectividadServicios() {
  const telegram = probarConexionTelegram();
  const github = probarConexionGitHub();
  const gemini = probarConexionGemini();

  return {
    ok: telegram.ok && github.ok && gemini.ok,
    telegram: telegram,
    github: github,
    gemini: gemini,
  };
}

/**
 * Valida token y handshake básico contra Telegram getMe.
 */
function probarConexionTelegram() {
  const tokenTelegram = obtenerTokenTelegram();
  if (!tokenTelegram) {
    return {
      ok: false,
      statusCode: null,
      detalle:
        "Falta valor en Script Property " +
        CONFIG.SCRIPT_PROPERTIES.TELEGRAM_TOKEN,
    };
  }

  const url = CONFIG.TELEGRAM_API + tokenTelegram + "/getMe";

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    if (statusCode !== 200) {
      return {
        ok: false,
        statusCode: statusCode,
        detalle: "HTTP " + statusCode + ": " + resumirTexto(body, 250),
      };
    }

    const parseo = parsearJsonSeguro(body);
    if (!parseo.ok || !parseo.data || parseo.data.ok !== true) {
      return {
        ok: false,
        statusCode: statusCode,
        detalle: "Respuesta inválida: " + resumirTexto(body, 250),
      };
    }

    const bot =
      (parseo.data.result && parseo.data.result.username) || "sin_username";
    return {
      ok: true,
      statusCode: statusCode,
      detalle: "Conectado como @" + bot,
    };
  } catch (error) {
    return { ok: false, statusCode: null, detalle: error.toString() };
  }
}

/**
 * Valida token y acceso al repositorio configurado.
 */
function probarConexionGitHub() {
  const githubToken = obtenerGitHubToken();
  if (!githubToken) {
    return {
      ok: false,
      statusCode: null,
      detalle:
        "Falta valor en Script Property " +
        CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN,
    };
  }

  const url = "https://api.github.com/repos/" + CONFIG.GITHUB_REPO;
  const options = {
    method: "get",
    headers: {
      Authorization: "Bearer " + githubToken,
      Accept: "application/vnd.github.v3+json",
    },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    if (statusCode !== 200) {
      return {
        ok: false,
        statusCode: statusCode,
        detalle: "HTTP " + statusCode + ": " + resumirTexto(body, 250),
      };
    }

    const parseo = parsearJsonSeguro(body);
    const repo =
      parseo.ok && parseo.data && parseo.data.full_name
        ? parseo.data.full_name
        : CONFIG.GITHUB_REPO;

    return {
      ok: true,
      statusCode: statusCode,
      detalle: "Acceso confirmado a " + repo,
    };
  } catch (error) {
    return { ok: false, statusCode: null, detalle: error.toString() };
  }
}

/**
 * Valida API key con una llamada liviana al endpoint de modelos.
 */
function probarConexionGemini() {
  const geminiApiKey = obtenerGeminiApiKey();
  if (!geminiApiKey) {
    return {
      ok: false,
      statusCode: null,
      detalle:
        "Falta valor en Script Property " +
        CONFIG.SCRIPT_PROPERTIES.GEMINI_API_KEY,
    };
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models?key=" +
    geminiApiKey;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
    });
    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    if (statusCode !== 200) {
      return {
        ok: false,
        statusCode: statusCode,
        detalle: "HTTP " + statusCode + ": " + resumirTexto(body, 250),
      };
    }

    const parseo = parsearJsonSeguro(body);
    const modelos =
      parseo.ok && parseo.data && Array.isArray(parseo.data.models)
        ? parseo.data.models
        : [];

    const nombresModelos = [];
    for (let i = 0; i < modelos.length; i++) {
      const modelo = modelos[i] || {};
      const nombre = modelo.displayName || modelo.name || "";
      if (nombre) nombresModelos.push(nombre);
    }

    const detalleModelos = nombresModelos.length
      ? "Modelos disponibles: " + resumirTexto(nombresModelos.join(", "), 1500)
      : "Conexión activa. No se pudieron extraer nombres de modelos.";

    return {
      ok: true,
      statusCode: statusCode,
      detalle: detalleModelos,
    };
  } catch (error) {
    return { ok: false, statusCode: null, detalle: error.toString() };
  }
}

/**
 * Registra en Logger el estado de conectividad de cada servicio.
 */
function logResultadoConexion(servicio, resultado) {
  const estado = resultado && resultado.ok ? "OK" : "ERROR";
  const http =
    resultado && typeof resultado.statusCode === "number"
      ? "HTTP " + resultado.statusCode
      : "SIN_HTTP";
  const detalle =
    (resultado && resultado.detalle) || "Sin detalle de diagnóstico.";

  Logger.log("[" + estado + "] " + servicio + " | " + http + " | " + detalle);
}

/**
 * Recorta texto de diagnóstico para evitar mensajes excesivamente largos.
 */
function resumirTexto(texto, maxLen) {
  const limpio = String(texto || "")
    .replace(/\s+/g, " ")
    .trim();
  const limite = typeof maxLen === "number" ? maxLen : 250;
  if (limpio.length <= limite) return limpio;
  return limpio.substring(0, limite) + "...";
}
