/**
 * =======================================================================
 * 🚀 02_MAIN.GS | Punto de Entrada y Router Principal
 * =======================================================================
 * Intercepta los webhooks de Telegram y orquesta la ejecución.
 */

const MAIN_LOG_PREFIJO = "[doPost]";

/**
 * Punto de entrada de Apps Script para webhooks de Telegram.
 * Valida seguridad básica y enruta la entrada al módulo correspondiente.
 */
function doPost(e) {
  let chatId = null;
  let clavesDedupeRegistradas = [];

  try {
    // Carga snapshot de propiedades al inicio de la ejecución.
    cargarRuntimeConfig(true);

    if (!validarSecretoWebhookTelegram(e)) {
      Logger.log(MAIN_LOG_PREFIJO + " Webhook rechazado: secreto inválido.");
      return;
    }

    const payload = obtenerPayloadWebhook(e);
    const message = obtenerMensajeDesdePayload(payload);
    if (!message || !message.chat) return;

    chatId = message.chat.id;

    if (!esChatAutorizado(chatId)) {
      Logger.log(MAIN_LOG_PREFIJO + " Chat no autorizado: " + chatId);
      return;
    }

    // 1. Dedupe temprano para evitar ejecuciones duplicadas del mismo update
    // (incluye comandos largos como /fin_entrada cuando Telegram reintenta).
    const dedupe = verificarYRegistrarEntradaTelegram(payload, message);
    if (dedupe.duplicado) {
      const esComando =
        Boolean(message.text) &&
        String(message.text || "").trim().startsWith("/");

      // Para comandos duplicados, evitamos ruido visual y solo registramos log.
      if (!esComando) {
        enviarMensaje(chatId, msgMensajeDuplicadoIgnorado());
      }

      Logger.log(
        MAIN_LOG_PREFIJO +
          " Entrada duplicada ignorada: " +
          dedupe.claves.join(", "),
      );
      return;
    }
    clavesDedupeRegistradas = dedupe.claves || [];

    const estado = obtenerEstadoSistema();

    // 2. Interceptar comandos administrativos.
    if (procesarComandosSistema(message, chatId, estado)) return;

    // 3. Clasificar tipo de entrada restante.
    const tipoEntrada = clasificarEntrada(message);

    // 4. Router principal.
    if (tipoEntrada === "TEXT") {
      const procesadoOk = moduloTexto(message, chatId, estado);
      if (procesadoOk === false) {
        liberarRegistroEntradaTelegram(dedupe.claves);
      }
      return;
    }

    if (tipoEntrada === "VOICE") {
      const procesadoOk = moduloAudio(message, chatId, estado);
      if (procesadoOk === false) {
        liberarRegistroEntradaTelegram(dedupe.claves);
      }
      return;
    }

    enviarMensaje(chatId, msgTipoEntradaNoSoportado());
  } catch (error) {
    if (clavesDedupeRegistradas.length > 0) {
      // Evita bloquear reenvíos si algo explota después de registrar dedupe.
      liberarRegistroEntradaTelegram(clavesDedupeRegistradas);
    }

    if (chatId) {
      notificarError(chatId, msgErrorProcesamientoGeneral());
    }
    Logger.log(MAIN_LOG_PREFIJO + " " + error.toString());
  }
}

/**
 * Valida y parsea el payload del webhook de Telegram.
 */
function obtenerPayloadWebhook(e) {
  if (!e || !e.postData || !e.postData.contents) return null;

  const parseo = parsearJsonSeguro(e.postData.contents);
  return parseo.ok ? parseo.data : null;
}

/**
 * Extrae el objeto mensaje desde los tipos de update soportados.
 */
function obtenerMensajeDesdePayload(payload) {
  if (!payload) return null;
  if (payload.message) return payload.message;
  if (payload.edited_message) return payload.edited_message;
  return null;
}
