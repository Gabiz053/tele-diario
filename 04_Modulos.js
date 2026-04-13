/**
 * =======================================================================
 * 🧩 04_MODULOS.GS | Lógica de Procesamiento Central
 * =======================================================================
 * Contiene los orquestadores de texto/audio y el pipeline diario común.
 */

const MODULOS_TEXTO = {
  SI: "sí",
  NO: "no",
  NO_DISPONIBLE: "N/A",
  SIN_DETALLE: "Sin detalle",
  SIN_TRAZA: "Sin traza",
};

/**
 * Procesa texto normal o lo agrega al buffer cuando /nueva_entrada está activo.
 */
function moduloTexto(msg, chatId, estado) {
  const estadoActual = estado || obtenerEstadoSistema();
  const logger = crearLoggerPipeline(chatId, estadoActual.isDebug);
  const texto = String(msg.text || "").trim();

  if (sesionEntradaManualActiva(chatId)) {
    const agregado = agregarTextoSesionEntradaManual(chatId, msg);

    if (!agregado.ok) {
      enviarMensaje(chatId, msgEntradaManualErrorRegistro(agregado));
      logger.advertencia("No se pudo agregar texto a nueva entrada", [
        "Error: " + (agregado.error || MODULOS_TEXTO.NO_DISPONIBLE),
      ]);
      return false;
    }

    enviarMensaje(
      chatId,
      msgEntradaManualTextoAgregado(
        agregado.totalMensajes,
        agregado.totalChars,
      ),
    );

    logger.paso("Texto agregado a nueva entrada", [
      "ID mensaje: " + (msg.message_id || "N/A"),
      "Mensajes acumulados: " + agregado.totalMensajes,
      "Caracteres acumulados: " + agregado.totalChars,
    ]);
    return true;
  }

  enviarMensaje(chatId, msgTextoRegistrado(texto));
  logger.paso("Texto recibido", [
    "ID mensaje: " + (msg.message_id || "N/A"),
    "Caracteres: " + texto.length,
  ]);

  return true;
}

/**
 * Cierra /nueva_entrada, consolida texto y ejecuta el pipeline de guardado.
 */
function finalizarEntradaManual(chatId, estado, msgComandoFin) {
  const estadoActual = estado || obtenerEstadoSistema();
  const logger = crearLoggerPipeline(chatId, estadoActual.isDebug);
  const sesion = obtenerSesionEntradaManual(chatId);

  if (
    !sesion ||
    !Array.isArray(sesion.mensajes) ||
    sesion.mensajes.length === 0
  ) {
    finalizarSesionManualSinContenido(chatId);
    return false;
  }

  const fechaReferencia = obtenerFechaReferenciaMensaje(msgComandoFin || {});
  const textoConsolidado = construirTranscripcionSesionEntradaManual(sesion);

  if (!textoConsolidado) {
    finalizarSesionManualSinContenido(chatId);
    return false;
  }

  enviarMensaje(chatId, msgEntradaManualProcesando(sesion.mensajes.length));

  logger.paso("Inicio de pipeline texto manual", [
    "Modelo: " + estadoActual.modelo,
    "Mensajes acumulados: " + sesion.mensajes.length,
    "Caracteres de entrada: " + textoConsolidado.length,
  ]);

  const pipelineOk = ejecutarPipelineDiario({
    chatId: chatId,
    estado: estadoActual,
    logger: logger,
    fechaReferencia: fechaReferencia,
    tipoEntrada: "texto_manual",
    modeloIA: estadoActual.modelo,
    obtenerMensajeErrorPipeline: function () {
      return msgErrorPipelineEntradaManual();
    },
    construirMensajeExito: function (datosMarkdown, syncGit, isDebug) {
      return msgRegistroGuardadoEntradaManual(datosMarkdown, syncGit, isDebug);
    },
    obtenerResultadoIA: function (contextoResultado) {
      return ejecutarEtapaGeminiPipeline(
        logger,
        chatId,
        estadoActual,
        contextoResultado,
        "Procesar texto con Gemini",
        "Iniciando procesamiento de entrada manual.",
        function () {
          return llamarGeminiTextoAPI(
            textoConsolidado,
            estadoActual.modelo,
            estadoActual.isDebug,
            contextoResultado.contexto,
          );
        },
      );
    },
  });

  if (pipelineOk) {
    // Solo limpiamos buffer al guardar correctamente para permitir reintento.
    limpiarSesionEntradaManual(chatId);
  }

  return pipelineOk;
}

/**
 * Finaliza y limpia sesiones manuales sin contenido útil para persistir.
 */
function finalizarSesionManualSinContenido(chatId) {
  limpiarSesionEntradaManual(chatId);
  enviarMensaje(chatId, msgEntradaManualVacia());
}

/**
 * Orquesta el pipeline completo de audio con etapas desacopladas.
 */
function moduloAudio(msg, chatId, estado) {
  const estadoActual = estado || obtenerEstadoSistema();
  const logger = crearLoggerPipeline(chatId, estadoActual.isDebug);
  const fechaReferencia = obtenerFechaReferenciaMensaje(msg);

  enviarMensaje(chatId, msgAudioInicio());

  logger.paso("Inicio de pipeline", [
    "Modelo: " + estadoActual.modelo,
    "ID mensaje: " + (msg.message_id || "N/A"),
    "Fecha referencia: " +
      Utilities.formatDate(
        fechaReferencia,
        CONFIG.TIMEZONE,
        "yyyy-MM-dd HH:mm:ss",
      ),
  ]);

  return ejecutarPipelineDiario({
    chatId: chatId,
    estado: estadoActual,
    logger: logger,
    fechaReferencia: fechaReferencia,
    tipoEntrada: "audio",
    modeloIA: estadoActual.modelo,
    obtenerMensajeErrorPipeline: function () {
      return msgErrorPipelineAudio();
    },
    construirMensajeExito: function (datosMarkdown, syncGit, isDebug) {
      return msgRegistroGuardado(datosMarkdown, syncGit, isDebug);
    },
    obtenerResultadoIA: function (contextoResultado) {
      const audioResultado = logger.etapa(
        "Preparar audio",
        function () {
          return prepararAudio(msg, chatId);
        },
        {
          detalleExito: function (resultado) {
            return [
              "MIME: " + resultado.mimeType,
              "Duración audio: " + resultado.duracion + "s",
              "Tamaño aprox base64: " + resultado.kbBase64 + "KB",
            ];
          },
          detalleError: function (resultado) {
            return resultado.detalle || "No se pudo preparar el audio.";
          },
        },
      );

      if (!audioResultado || !audioResultado.ok) return null;

      return ejecutarEtapaGeminiPipeline(
        logger,
        chatId,
        estadoActual,
        contextoResultado,
        "Procesar audio con Gemini",
        "Iniciando llamada a Gemini.",
        function () {
          return llamarGeminiAPI(
            audioResultado.base64Audio,
            audioResultado.mimeType,
            estadoActual.modelo,
            estadoActual.isDebug,
            contextoResultado.contexto,
          );
        },
      );
    },
  });
}

/**
 * Orquesta el pipeline común (contexto -> IA -> markdown -> GitHub).
 */
function ejecutarPipelineDiario(config) {
  const chatId = config.chatId;
  const estado = config.estado;
  const logger = config.logger;
  const fechaReferencia = config.fechaReferencia || new Date();
  const tipoEntrada = String(config.tipoEntrada || "desconocido").trim();
  const modeloIA = String(
    config.modeloIA || (estado && estado.modelo) || "N/A",
  ).trim();
  const obtenerResultadoIA = config.obtenerResultadoIA;
  const construirMensajeExito = config.construirMensajeExito;
  const obtenerMensajeErrorPipeline = config.obtenerMensajeErrorPipeline;
  const limpiarAlFinal = config.limpiarAlFinal;

  try {
    const contextoResultado = resolverContextoPipeline(
      logger,
      chatId,
      estado,
      fechaReferencia,
    );
    if (!contextoResultado || !contextoResultado.ok) {
      return false;
    }

    const iaResultado =
      typeof obtenerResultadoIA === "function"
        ? obtenerResultadoIA(contextoResultado)
        : null;

    if (!iaResultado || !iaResultado.ok) {
      return false;
    }

    const datosMarkdown = convertirRespuestaIaMarkdownPipeline(
      logger,
      iaResultado,
      contextoResultado,
      fechaReferencia,
      tipoEntrada,
      modeloIA,
    );

    if (!datosMarkdown || !datosMarkdown.valido) {
      enviarMensaje(chatId, msgErrorFormatoIA());
      return false;
    }

    logger.paso(
      "Previa de contenido antes de GitHub",
      detalleDebugAntesDeGitHub(datosMarkdown, contextoResultado.ruta),
    );

    const syncGit = sincronizarDiarioPipeline(
      logger,
      estado,
      datosMarkdown,
      contextoResultado,
    );

    if (!syncGit || !syncGit.exito) {
      enviarMensaje(chatId, msgErrorSyncGitHub());
      return false;
    }

    const mensajeExito =
      typeof construirMensajeExito === "function"
        ? construirMensajeExito(datosMarkdown, syncGit, estado.isDebug)
        : msgRegistroGuardado(datosMarkdown, syncGit, estado.isDebug);

    enviarMensaje(chatId, mensajeExito);
    logger.exito("Pipeline completado", [
      "Ruta final: " + syncGit.ruta,
      "Operación: " + syncGit.modo,
      "Traza: " + (syncGit.traza || MODULOS_TEXTO.SIN_TRAZA),
    ]);

    return true;
  } catch (error) {
    logger.error("Excepción no controlada", error.toString());
    const mensajeError =
      typeof obtenerMensajeErrorPipeline === "function"
        ? obtenerMensajeErrorPipeline()
        : msgErrorPipelineAudio();
    notificarError(chatId, mensajeError);
    return false;
  } finally {
    if (typeof limpiarAlFinal === "function") {
      limpiarAlFinal();
    }
  }
}

/**
 * Resuelve el contexto del diario para cualquier tipo de entrada.
 */
function resolverContextoPipeline(logger, chatId, estado, fechaReferencia) {
  return logger.etapa(
    "Resolver contexto diario",
    function () {
      return prepararContextoDiario(chatId, estado, fechaReferencia);
    },
    {
      detalleExito: function (resultado) {
        return [
          "Ruta: " + resultado.ruta,
          "Contexto previo: " +
            (resultado.contexto ? MODULOS_TEXTO.SI : MODULOS_TEXTO.NO),
        ];
      },
      detalleError: function (resultado) {
        return resultado.detalle || "No se pudo recuperar el contexto diario.";
      },
    },
  );
}

/**
 * Ejecuta etapa Gemini (audio o texto) y normaliza el contrato del pipeline.
 */
function ejecutarEtapaGeminiPipeline(
  logger,
  chatId,
  estado,
  contextoResultado,
  tituloEtapa,
  mensajeInicio,
  ejecutarLlamadaGemini,
) {
  return logger.etapa(
    tituloEtapa,
    function () {
      const resultadoIA = ejecutarLlamadaGemini();
      return normalizarResultadoGeminiPipeline(resultadoIA, estado, chatId);
    },
    {
      detalleInicio: [
        mensajeInicio,
        "Este paso puede tardar unos segundos según la carga.",
      ],
      detalleExito: function (resultado) {
        return [
          "Caracteres recibidos: " + resultado.caracteres,
          "Contexto enviado a Gemini: " +
            (contextoResultado.contexto
              ? MODULOS_TEXTO.SI
              : MODULOS_TEXTO.NO),
          "Caracteres de contexto: " +
            String(contextoResultado.contexto || "").length,
        ];
      },
      detalleError: function (resultado) {
        return [
          "Tipo: " + (resultado.tipo || MODULOS_TEXTO.NO_DISPONIBLE),
          "Status: " +
            (resultado.statusCode || MODULOS_TEXTO.NO_DISPONIBLE),
          "Detalle: " + (resultado.detalle || MODULOS_TEXTO.SIN_DETALLE),
        ];
      },
    },
  );
}

/**
 * Convierte respuesta IA a markdown validado para persistencia.
 */
function convertirRespuestaIaMarkdownPipeline(
  logger,
  iaResultado,
  contextoResultado,
  fechaReferencia,
  tipoEntrada,
  modeloIA,
) {
  return logger.etapa(
    "Convertir respuesta IA a markdown",
    function () {
      return procesarRespuestaIA(iaResultado.texto, {
        contextoPrevioMarkdown: contextoResultado.contexto,
        rutaDiaria: contextoResultado.ruta,
        timestampEntradaMs: fechaReferencia.getTime(),
        tipoEntrada: tipoEntrada,
        modeloIA: modeloIA,
      });
    },
    {
      esError: function (resultado) {
        return Boolean(!resultado || resultado.valido === false);
      },
      detalleExito: function (resultado) {
        return "JSON válido: " +
          (resultado.valido ? MODULOS_TEXTO.SI : MODULOS_TEXTO.NO);
      },
      detalleError: function () {
        return "La IA devolvió una estructura no parseable. Se cancela el guardado.";
      },
    },
  );
}

/**
 * Sincroniza el resultado final en GitHub de forma idempotente.
 */
function sincronizarDiarioPipeline(
  logger,
  estado,
  datosMarkdown,
  contextoResultado,
) {
  return logger.etapa(
    "Sincronizar diario con GitHub",
    function () {
      return sincronizarConGitHub(
        datosMarkdown,
        estado.isDebug,
        contextoResultado.ruta,
      );
    },
    {
      esError: function (resultado) {
        return Boolean(resultado && resultado.exito === false);
      },
      detalleExito: function (resultado) {
        return [
          "Ruta: " + resultado.ruta,
          "Operación: " + resultado.modo,
          "Traza: " + (resultado.traza || MODULOS_TEXTO.SIN_TRAZA),
        ];
      },
      detalleError: function (resultado) {
        return resultado.traza || "No se pudo sincronizar el diario.";
      },
    },
  );
}

/**
 * Normaliza el contrato de salida de Gemini para el pipeline común.
 */
function normalizarResultadoGeminiPipeline(resultadoIA, estado, chatId) {
  if (!resultadoIA || !resultadoIA.ok) {
    const fallo = resultadoIA || {};
    enviarMensaje(chatId, msgErrorGemini(fallo, estado.isDebug));
    return {
      ok: false,
      error: "GEMINI_ERROR",
      tipo: fallo.tipo,
      statusCode: fallo.statusCode,
      detalle: fallo.detalle || fallo.mensaje,
    };
  }

  return {
    ok: true,
    texto: resultadoIA.texto,
    caracteres: String(resultadoIA.texto || "").length,
  };
}

/**
 * Recupera contexto previo del diario para enriquecer el prompt de IA.
 */
function prepararContextoDiario(chatId, estado, fechaReferencia) {
  const ruta = construirRutaDiario(calcularFechaLogica(fechaReferencia));
  const githubToken = obtenerGitHubToken();
  if (!githubToken) {
    enviarMensaje(chatId, msgErrorConsultaGitHub());
    return {
      ok: false,
      error: "GITHUB_TOKEN_MISSING",
      detalle:
        "Falta Script Property: " + CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN,
    };
  }

  const archivoGitHub = obtenerArchivoGitHub(ruta, estado.isDebug, githubToken);

  if (archivoGitHub && archivoGitHub.errorGravedad) {
    enviarMensaje(chatId, msgErrorConsultaGitHub());
    return {
      ok: false,
      error: "GITHUB_CONTEXT_ERROR",
      detalle: archivoGitHub.traza || "No se pudo leer el diario actual.",
    };
  }

  const contexto = extraerContextoPrevio(archivoGitHub);
  if (contexto) {
    enviarMensaje(chatId, msgAudioContextoRecuperado());
  } else {
    enviarMensaje(chatId, msgAudioPrimerRegistro());
  }

  return { ok: true, contexto: contexto, ruta: ruta };
}

/**
 * Descarga y prepara el audio para el envío multimodal.
 */
function prepararAudio(msg, chatId) {
  if (!msg.voice || !msg.voice.file_id) {
    enviarMensaje(chatId, msgErrorDescargaAudio());
    return {
      ok: false,
      error: "VOICE_PAYLOAD_INVALID",
      detalle: "No se encontró voice.file_id en el webhook.",
    };
  }

  const base64Audio = descargarAudioEnBase64(msg.voice.file_id);
  if (!base64Audio) {
    enviarMensaje(chatId, msgErrorDescargaAudio());
    return {
      ok: false,
      error: "VOICE_DOWNLOAD_ERROR",
      detalle: "Telegram no devolvió el archivo correctamente.",
    };
  }

  const mimeType = msg.voice.mime_type || "audio/ogg";

  return {
    ok: true,
    base64Audio: base64Audio,
    mimeType: mimeType,
    duracion: msg.voice.duration || 0,
    kbBase64: Math.round(base64Audio.length / 1024),
  };
}

/**
 * Decodifica el markdown previo desde GitHub para reusar contexto.
 */
function extraerContextoPrevio(archivoGitHub) {
  if (!archivoGitHub || !archivoGitHub.sha || !archivoGitHub.base64Content) {
    return "";
  }

  try {
    return Utilities.newBlob(
      Utilities.base64Decode(archivoGitHub.base64Content),
    ).getDataAsString();
  } catch (e) {
    return "";
  }
}

/**
 * Obtiene la fecha de referencia del mensaje Telegram para evitar desfases.
 */
function obtenerFechaReferenciaMensaje(msg) {
  const timestampSeg = parseInt(msg && msg.date, 10);
  if (!isNaN(timestampSeg) && timestampSeg > 0) {
    return new Date(timestampSeg * 1000);
  }

  return new Date();
}
