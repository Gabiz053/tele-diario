/**
 * =======================================================================
 * 🤖 06_GEMINI.GS | Interfaz de Red: Google AI Studio
 * =======================================================================
 * Capa de abstracción para la IA. Procesa llamadas a la API REST de Gemini.
 */

const GEMINI_ERROR_TIPOS = {
  MISSING_CONFIG: "MISSING_CONFIG",
  HTTP_ERROR: "HTTP_ERROR",
  INVALID_JSON: "INVALID_JSON",
  EMPTY_CONTENT: "EMPTY_CONTENT",
  NETWORK_ERROR: "NETWORK_ERROR",
};

const GEMINI_TEST_LOG = {
  INICIO: "=== INICIANDO AUDITORÍA DE RED (GOOGLE AI) ===",
  FIN: "=== FIN DE AUDITORÍA ===",
};

/**
 * Ejecuta la llamada principal a Gemini sin reintentos.
 */
function llamarGeminiAPI(
  base64Data,
  mime,
  modeloActivo,
  isDebug,
  contextoPrevio = "",
) {
  return llamarGeminiConBuilderPayload(
    modeloActivo,
    isDebug,
    contextoPrevio,
    function (promptTexto) {
      return construirPayloadGemini(promptTexto, mime, base64Data);
    },
  );
}

/**
 * Ejecuta la llamada de Gemini para entrada manual de texto.
 */
function llamarGeminiTextoAPI(
  textoEntrada,
  modeloActivo,
  isDebug,
  contextoPrevio = "",
) {
  return llamarGeminiConBuilderPayload(
    modeloActivo,
    isDebug,
    contextoPrevio,
    function (promptTexto) {
      return construirPayloadGeminiTexto(promptTexto, textoEntrada);
    },
  );
}

/**
 * Ejecuta una llamada Gemini usando un constructor de payload (audio o texto).
 */
function llamarGeminiConBuilderPayload(
  modeloActivo,
  isDebug,
  contextoPrevio,
  construirPayload,
) {
  const solicitud = construirContextoSolicitudGemini(
    modeloActivo,
    contextoPrevio,
  );
  if (!solicitud.ok) return solicitud.error;

  const url = solicitud.url;
  const promptTexto = solicitud.promptTexto;
  const payload = construirPayload(promptTexto);
  const options = construirOpcionesHttpGemini(payload);

  return ejecutarSolicitudGemini(url, options, isDebug);
}

/**
 * Ejecuta petición HTTP a Gemini sin reintentos.
 */
function ejecutarSolicitudGemini(url, options, isDebug) {
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      return construirErrorGemini(
        GEMINI_ERROR_TIPOS.HTTP_ERROR,
        "Google AI rechazó la conexión.",
        isDebug ? `HTTP ${statusCode}\n${responseText}` : null,
        statusCode,
      );
    }

    // Validamos JSON de API y extraemos texto útil de candidatos/partes.
    const parseo = parsearJsonSeguro(responseText);
    if (!parseo.ok) {
      return construirErrorGemini(
        GEMINI_ERROR_TIPOS.INVALID_JSON,
        "Gemini devolvió una respuesta inválida.",
        isDebug ? responseText : null,
        statusCode,
      );
    }

    const texto = extraerTextoGemini(parseo.data);
    if (!texto) {
      return construirErrorGemini(
        GEMINI_ERROR_TIPOS.EMPTY_CONTENT,
        "Gemini no devolvió contenido utilizable.",
        isDebug ? responseText : null,
        statusCode,
      );
    }

    return { ok: true, texto: texto };
  } catch (error) {
    return construirErrorGemini(
      GEMINI_ERROR_TIPOS.NETWORK_ERROR,
      "Pérdida de conexión con Google AI.",
      isDebug ? error.toString() : null,
      null,
    );
  }
}

/**
 * Construye contexto común de solicitud Gemini (auth + URL + prompt base).
 */
function construirContextoSolicitudGemini(modeloActivo, contextoPrevio) {
  const geminiApiKey = obtenerGeminiApiKey();
  if (!geminiApiKey) {
    return {
      ok: false,
      error: construirErrorGemini(
        GEMINI_ERROR_TIPOS.MISSING_CONFIG,
        "Falta Script Property: " + CONFIG.SCRIPT_PROPERTIES.GEMINI_API_KEY,
        null,
        null,
      ),
    };
  }

  return {
    ok: true,
    url: construirUrlGemini(modeloActivo, geminiApiKey),
    promptTexto: construirPromptGemini(contextoPrevio),
  };
}

/**
 * Construye la URL de generateContent para el modelo activo.
 */
function construirUrlGemini(modeloActivo, geminiApiKey) {
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    modeloActivo +
    ":generateContent?key=" +
    geminiApiKey
  );
}

/**
 * Extrae texto útil recorriendo candidatos y partes disponibles.
 */
function extraerTextoGemini(responseJson) {
  if (!responseJson || !Array.isArray(responseJson.candidates)) {
    return null;
  }

  for (let i = 0; i < responseJson.candidates.length; i++) {
    const candidato = responseJson.candidates[i] || {};
    const content = candidato.content || {};
    const parts = Array.isArray(content.parts) ? content.parts : [];

    const fragmentos = [];
    for (let j = 0; j < parts.length; j++) {
      const parte = parts[j] || {};
      const texto = String(parte.text || "").trim();
      if (!texto) continue;
      fragmentos.push(texto);
    }

    if (fragmentos.length > 0) {
      return fragmentos.join("\n").trim();
    }
  }

  return null;
}

/**
 * Normaliza errores para que el pipeline maneje un contrato estable.
 */
function construirErrorGemini(tipo, mensaje, detalle, statusCode) {
  return {
    ok: false,
    tipo: tipo,
    mensaje: mensaje,
    detalle: detalle,
    statusCode: statusCode,
  };
}

/**
 * Función de prueba manual.
 * Ejecutar desde el editor de Apps Script para auditar el estado del endpoint.
 */
function testConexionGemini() {
  Logger.log(GEMINI_TEST_LOG.INICIO);
  Logger.log("Modelo objetivo: " + CONFIG.MODELO_POR_DEFECTO);

  const geminiApiKey = obtenerGeminiApiKey();

  if (!geminiApiKey) {
    Logger.log(
      "❌ ERROR FATAL: Falta Script Property " +
        CONFIG.SCRIPT_PROPERTIES.GEMINI_API_KEY,
    );
    return;
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    CONFIG.MODELO_POR_DEFECTO +
    ":generateContent?key=" +
    geminiApiKey;
  const payload = {
    contents: [
      {
        parts: [
          { text: "Responde EXCLUSIVAMENTE con el código: STATUS_OK_200." },
        ],
      },
    ],
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    Logger.log("Código HTTP devuelto: " + code);

    if (code === 200) {
      Logger.log("✅ HANDSHAKE EXITOSO. Canal cifrado y activo.");
      const parseo = parsearJsonSeguro(response.getContentText());
      const echo =
        parseo.ok &&
        parseo.data &&
        Array.isArray(parseo.data.candidates) &&
        parseo.data.candidates[0] &&
        parseo.data.candidates[0].content &&
        Array.isArray(parseo.data.candidates[0].content.parts) &&
        parseo.data.candidates[0].content.parts[0]
          ? parseo.data.candidates[0].content.parts[0].text
          : "N/A";

      Logger.log("Echo IA: " + String(echo || "N/A"));
    } else {
      Logger.log(
        "❌ ERROR EN HANDSHAKE. Dump de respuesta:\n" +
          response.getContentText(),
      );
    }
  } catch (error) {
    Logger.log("❌ CRASH DEL ENTORNO LOCAL: " + error.toString());
  }
  Logger.log(GEMINI_TEST_LOG.FIN);
}

/**
 * Inserta el contexto previo del día para fusionar la narrativa.
 */
function construirPromptGemini(contextoPrevio) {
  let promptTexto = SYSTEM_PROMPT;

  if (contextoPrevio) {
    promptTexto += `\n\n[CONTEXTO PREVIO DEL DÍA (Úsalo para fusionar la historia)]:\n${contextoPrevio}`;
  }

  return promptTexto;
}

/**
 * Construye el payload multimodal (texto + audio).
 */
function construirPayloadGemini(promptTexto, mime, base64Data) {
  return {
    contents: [
      {
        parts: [
          { text: promptTexto },
          { inline_data: { mime_type: mime, data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };
}

/**
 * Construye payload para entrada de texto manual consolidada.
 */
function construirPayloadGeminiTexto(promptTexto, textoEntrada) {
  const textoLimpio = String(textoEntrada || "").trim();
  const bloqueEntrada =
    "[TRANSCRIPCIÓN ACTUAL - ENTRADA MANUAL]\n" + (textoLimpio || "N/A");

  return {
    contents: [
      {
        parts: [{ text: promptTexto + "\n\n" + bloqueEntrada }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };
}

/**
 * Agrupa opciones HTTP para evitar duplicación.
 */
function construirOpcionesHttpGemini(payload) {
  return {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
}
