/**
 * =======================================================================
 * 📡 05_TELEGRAM.GS | Interfaz de Red: Telegram API
 * =======================================================================
 * Capa de abstracción para todas las comunicaciones salientes hacia Telegram.
 */

const TELEGRAM_MAX_CHARS = 3900;
const TELEGRAM_FILE_BASE_URL = "https://api.telegram.org/file/bot";

const TELEGRAM_LOG = {
  ENVIAR_BLOQUE: "[enviarBloqueTelegram]",
  OBTENER_RUTA: "[obtenerRutaArchivo]",
  DESCARGAR_AUDIO: "[descargarAudioEnBase64]",
};

/**
 * Construye URL para un método de Telegram Bot API.
 */
function construirUrlApiTelegram(tokenTelegram, metodo) {
  return CONFIG.TELEGRAM_API + tokenTelegram + "/" + metodo;
}

/**
 * Envía un mensaje completo, partiéndolo en bloques seguros si hace falta.
 */
function enviarMensaje(chatId, texto) {
  const bloques = dividirMensajeTelegram(texto, TELEGRAM_MAX_CHARS);

  for (let i = 0; i < bloques.length; i++) {
    if (!enviarBloqueTelegram(chatId, bloques[i])) return false;
  }

  return true;
}

/**
 * Ejecuta una petición sendMessage individual contra Telegram.
 */
function enviarBloqueTelegram(chatId, texto) {
  const tokenTelegram = obtenerTokenTelegram();
  if (!tokenTelegram) {
    Logger.log(
      TELEGRAM_LOG.ENVIAR_BLOQUE +
        " Falta Script Property: " +
        CONFIG.SCRIPT_PROPERTIES.TELEGRAM_TOKEN,
    );
    return false;
  }

  const url = construirUrlApiTelegram(tokenTelegram, "sendMessage");
  const payload = {
    chat_id: chatId,
    text: texto,
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      Logger.log(
        TELEGRAM_LOG.ENVIAR_BLOQUE +
          " HTTP " +
          response.getResponseCode() +
          ": " +
          response.getContentText(),
      );
      return false;
    }

    return true;
  } catch (error) {
    Logger.log(TELEGRAM_LOG.ENVIAR_BLOQUE + " " + error.toString());
    return false;
  }
}

/**
 * Evita superar el límite de caracteres de Telegram por mensaje.
 */
function dividirMensajeTelegram(texto, maxChars) {
  const contenido = String(texto || "").trim();
  if (!contenido) return [];

  const partes = [];
  let inicio = 0;

  while (inicio < contenido.length) {
    const fin = Math.min(inicio + maxChars, contenido.length);
    partes.push(contenido.substring(inicio, fin));
    inicio = fin;
  }

  return partes;
}

/**
 * Envía una notificación de error con formato unificado.
 */
function notificarError(chatId, motivo) {
  enviarMensaje(
    chatId,
    formatearMensaje(TIPOS_MENSAJE.ERROR, "Error de sistema", motivo),
  );
}

/**
 * Consulta a Telegram la ruta temporal de descarga para un file_id.
 */
function obtenerRutaArchivo(fileId) {
  try {
    const tokenTelegram = obtenerTokenTelegram();
    if (!tokenTelegram) {
      Logger.log(
        TELEGRAM_LOG.OBTENER_RUTA +
          " Falta Script Property: " +
          CONFIG.SCRIPT_PROPERTIES.TELEGRAM_TOKEN,
      );
      return null;
    }

    const url =
      construirUrlApiTelegram(tokenTelegram, "getFile") +
      "?file_id=" +
      encodeURIComponent(String(fileId || ""));
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const parseo = parsearJsonSeguro(response.getContentText());
    if (!parseo.ok) return null;

    const json = parseo.data || {};

    return json.ok
      ? TELEGRAM_FILE_BASE_URL + tokenTelegram + "/" + json.result.file_path
      : null;
  } catch (error) {
    Logger.log(TELEGRAM_LOG.OBTENER_RUTA + " " + error.toString());
    return null;
  }
}

/**
 * Descarga el audio y lo transforma a base64 para la API multimodal.
 */
function descargarAudioEnBase64(fileId) {
  const ruta = obtenerRutaArchivo(fileId);
  if (!ruta) return null;

  try {
    const audioBlob = UrlFetchApp.fetch(ruta, {
      muteHttpExceptions: true,
    }).getBlob();
    return Utilities.base64Encode(audioBlob.getBytes());
  } catch (error) {
    Logger.log(TELEGRAM_LOG.DESCARGAR_AUDIO + " " + error.toString());
    return null;
  }
}
