/**
 * =======================================================================
 * 📈 11_LOGGER.GS | Logger de Pipeline para Debug
 * =======================================================================
 * Emite trazas detalladas por etapas solo cuando debug está activo.
 */

const LOGGER_PIPELINE_ESTADO = {
  INICIO: "INICIO",
  INFO: "INFO",
  OK: "OK",
  ADVERTENCIA: "ADVERTENCIA",
  ERROR: "ERROR",
  INCOMPLETA: "INCOMPLETA",
};

const LOGGER_TIEMPO_NO_DISPONIBLE = "N/A";

/**
 * Crea un logger de pipeline con eventos por etapa y tiempos acumulados.
 */
function crearLoggerPipeline(chatId, isDebug) {
  if (!isDebug) return crearLoggerSilencioso();

  const inicioMs = Date.now();
  let paso = 0;

  /**
   * Emite un evento formateado de pipeline con tiempos de etapa y total.
   */
  function enviarEvento(tipo, titulo, estado, detalle, duracionEtapaMs) {
    const totalMs = Date.now() - inicioMs;
    const tiempoEtapa =
      typeof duracionEtapaMs === "number"
        ? duracionEtapaMs + " ms"
        : LOGGER_TIEMPO_NO_DISPONIBLE;

    const lineas = [
      "Estado: " + estado,
      "Tiempo etapa: " + tiempoEtapa,
      "Tiempo total: " + totalMs + " ms",
    ];

    const detalleNormalizado = normalizarDetalleMensaje(detalle);
    for (let i = 0; i < detalleNormalizado.length; i++) {
      lineas.push(detalleNormalizado[i]);
    }

    enviarMensaje(chatId, formatearMensaje(tipo, titulo, lineas));
  }

  return {
    etapa: function (nombre, ejecutar, opciones) {
      const config = opciones || {};
      const esError =
        config.esError ||
        function (resultado) {
          return Boolean(resultado && resultado.ok === false);
        };

      paso += 1;
      const inicioEtapa = Date.now();
      const tituloBase = "Paso " + paso + " · " + nombre;

      enviarEvento(
        TIPOS_MENSAJE.DEBUG,
        tituloBase,
        LOGGER_PIPELINE_ESTADO.INICIO,
        config.detalleInicio || null,
        null,
      );

      try {
        const resultado = ejecutar();
        const duracion = Date.now() - inicioEtapa;

        if (esError(resultado)) {
          const detalleError = config.detalleError
            ? config.detalleError(resultado)
            : (resultado && resultado.detalle) ||
              "La etapa no pudo completarse.";
          enviarEvento(
            TIPOS_MENSAJE.ADVERTENCIA,
            tituloBase,
            LOGGER_PIPELINE_ESTADO.INCOMPLETA,
            detalleError,
            duracion,
          );
          return resultado;
        }

        const detalleExito = config.detalleExito
          ? config.detalleExito(resultado)
          : null;
        enviarEvento(
          TIPOS_MENSAJE.DEBUG,
          tituloBase,
          LOGGER_PIPELINE_ESTADO.OK,
          detalleExito,
          duracion,
        );
        return resultado;
      } catch (error) {
        const duracion = Date.now() - inicioEtapa;
        const detalleExcepcion = config.detalleExcepcion
          ? config.detalleExcepcion(error)
          : error.toString();
        enviarEvento(
          TIPOS_MENSAJE.ERROR,
          tituloBase,
          LOGGER_PIPELINE_ESTADO.ERROR,
          detalleExcepcion,
          duracion,
        );
        throw error;
      }
    },

    paso: function (titulo, detalle) {
      paso += 1;
      enviarEvento(
        TIPOS_MENSAJE.DEBUG,
        "Paso " + paso + " · " + titulo,
        LOGGER_PIPELINE_ESTADO.INFO,
        detalle,
        null,
      );
    },
    info: function (titulo, detalle) {
      enviarEvento(
        TIPOS_MENSAJE.INFO,
        titulo,
        LOGGER_PIPELINE_ESTADO.INFO,
        detalle,
        null,
      );
    },
    advertencia: function (titulo, detalle) {
      enviarEvento(
        TIPOS_MENSAJE.ADVERTENCIA,
        titulo,
        LOGGER_PIPELINE_ESTADO.ADVERTENCIA,
        detalle,
        null,
      );
    },
    error: function (titulo, detalle) {
      enviarEvento(
        TIPOS_MENSAJE.ERROR,
        titulo,
        LOGGER_PIPELINE_ESTADO.ERROR,
        detalle,
        null,
      );
    },
    exito: function (titulo, detalle) {
      enviarEvento(
        TIPOS_MENSAJE.OK,
        titulo,
        LOGGER_PIPELINE_ESTADO.OK,
        detalle,
        null,
      );
    },
  };
}

/**
 * Devuelve un logger no-op para mantener el flujo sin condicionales.
 */
function crearLoggerSilencioso() {
  const noop = function () {};
  const ejecutar = function (_, fn) {
    return fn();
  };

  return {
    etapa: ejecutar,
    paso: noop,
    info: noop,
    advertencia: noop,
    error: noop,
    exito: noop,
  };
}
