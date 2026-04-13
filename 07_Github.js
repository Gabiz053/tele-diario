/**
 * =======================================================================
 * 🐙 07_GITHUB.GS | Interfaz de Red: GitHub REST API
 * =======================================================================
 * Gestiona el almacenamiento persistente mediante operaciones idempotentes.
 * Soporta creación y actualización diaria del archivo del día.
 */

const GITHUB_MODO_OPERACION = {
  ERROR: "ERROR",
  PRIMER_REGISTRO_DIA: "PRIMER REGISTRO DEL DIA",
  ACTUALIZACION_DIA: "ACTUALIZACION DEL DIA",
};

/**
 * Orquestador principal de sincronización con el repositorio.
 */
function sincronizarConGitHub(datosMarkdown, isDebug, rutaForzada) {
  const githubToken = obtenerGitHubToken();
  if (!githubToken) {
    return {
      exito: false,
      modo: GITHUB_MODO_OPERACION.ERROR,
      traza: "Falta Script Property: " + CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN,
    };
  }

  const destino = resolverDestinoDiario(rutaForzada);
  const fechaFormateada = destino.fechaFormateada;
  const rutaArchivo = destino.rutaArchivo;
  const archivoExistente = obtenerArchivoGitHub(
    rutaArchivo,
    isDebug,
    githubToken,
  );

  if (archivoExistente && archivoExistente.errorGravedad) {
    return { exito: false, modo: "ERROR", traza: archivoExistente.traza };
  }

  const contenidoFinalStr = construirContenidoFinalDiario(datosMarkdown);
  const yaExiste = Boolean(archivoExistente && archivoExistente.sha);
  const shaUpdate = yaExiste ? archivoExistente.sha : null;
  const modoOperacionPreferido = yaExiste
    ? GITHUB_MODO_OPERACION.ACTUALIZACION_DIA
    : GITHUB_MODO_OPERACION.PRIMER_REGISTRO_DIA;
  const mensajeCommit = construirMensajeCommit(fechaFormateada, yaExiste);

  const resultadoCommit = hacerCommitGitHub(
    rutaArchivo,
    contenidoFinalStr,
    shaUpdate,
    mensajeCommit,
    isDebug,
    githubToken,
  );
  const modoOperacionFinal = resolverModoOperacionFinal(
    modoOperacionPreferido,
    resultadoCommit,
  );

  if (resultadoCommit.ok) {
    guardarUltimaSincronizacion(rutaArchivo, modoOperacionFinal);
  }

  return {
    exito: resultadoCommit.ok,
    ruta: rutaArchivo,
    modo: modoOperacionFinal,
    traza: resultadoCommit.traza,
  };
}

/**
 * Resuelve la ruta final del diario, priorizando una ruta fija si existe.
 */
function resolverDestinoDiario(rutaForzada) {
  if (esRutaDiarioValida(rutaForzada)) {
    return {
      rutaArchivo: rutaForzada,
      fechaFormateada: extraerFechaDesdeRuta(rutaForzada),
    };
  }

  const fechaLogica = calcularFechaLogica();
  return {
    rutaArchivo: construirRutaDiario(fechaLogica),
    fechaFormateada: Utilities.formatDate(
      fechaLogica,
      CONFIG.TIMEZONE,
      "yyyy-MM-dd",
    ),
  };
}

/**
 * Verifica que la ruta siga el patrón esperado de ruta diaria.
 */
function esRutaDiarioValida(ruta) {
  return /^\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}\.md$/.test(String(ruta || ""));
}

/**
 * Extrae la fecha YYYY-MM-DD desde una ruta YYYY/MM/YYYY-MM-DD.md.
 */
function extraerFechaDesdeRuta(ruta) {
  const partes = String(ruta || "").split("/");
  const nombreArchivo = partes[2] || "";
  return nombreArchivo.replace(".md", "");
}

/**
 * Consulta la API de GitHub evitando la caché para obtener siempre el SHA real.
 */
function obtenerArchivoGitHub(rutaArchivo, isDebug, githubToken) {
  const token = githubToken || obtenerGitHubToken();
  if (!token) {
    return {
      errorGravedad: true,
      traza: "Falta Script Property: " + CONFIG.SCRIPT_PROPERTIES.GITHUB_TOKEN,
    };
  }

  // Añadimos un parámetro timestamp aleatorio para romper la caché de Apps Script.
  const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${rutaArchivo}?ref=${CONFIG.GITHUB_BRANCH}&t=${new Date().getTime()}`;

  const options = {
    method: "get",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github.v3+json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    muteHttpExceptions: true,
  };

  const maxReintentos = 3;

  // Reintento controlado para lecturas GET con fallos transitorios.
  for (let intento = 1; intento <= maxReintentos; intento++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const textoRespuesta = response.getContentText();

      // 200: archivo presente, 404: no existe aún para ese día.
      if (code === 200) {
        const parseo = parsearJsonSeguro(textoRespuesta);
        if (!parseo.ok) {
          return {
            errorGravedad: true,
            traza: isDebug
              ? "[GET 200]: JSON inválido en respuesta de GitHub."
              : "Respuesta inválida de GitHub.",
          };
        }

        const data = parseo.data || {};
        return { sha: data.sha, base64Content: data.content };
      }

      if (code === 404) {
        return null;
      }

      // Códigos reintentables (429/5xx) aplican backoff progresivo.
      if (debeReintentarGitHub(code, intento, maxReintentos)) {
        Utilities.sleep(1000 * intento);
        continue;
      }

      const errorMsg = isDebug
        ? `[GET ${code}]: ${textoRespuesta}`
        : `Error HTTP ${code}.`;
      return { errorGravedad: true, traza: errorMsg };
    } catch (e) {
      if (intento < maxReintentos) {
        Utilities.sleep(1000 * intento);
        continue;
      }

      return {
        errorGravedad: true,
        traza: isDebug ? e.toString() : "Fallo de conexión GET.",
      };
    }
  }

  return { errorGravedad: true, traza: "Fallo inesperado en GET GitHub." };
}

/**
 * Ejecuta el Commit con codificación segura.
 */
function hacerCommitGitHub(
  rutaArchivo,
  contenidoStr,
  sha,
  mensajeCommit,
  isDebug,
  githubToken,
) {
  const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/${rutaArchivo}`;

  // Codificación segura UTF-8 para evitar errores con emojis o tildes.
  const contenidoBase64 = Utilities.base64Encode(
    contenidoStr,
    Utilities.Charset.UTF_8,
  );

  let shaActual = sha || null;
  const maxReintentos = 3;

  // Reintento controlado para escrituras PUT y resolución de conflictos SHA.
  for (let intento = 1; intento <= maxReintentos; intento++) {
    const payload = {
      message: mensajeCommit,
      content: contenidoBase64,
      branch: CONFIG.GITHUB_BRANCH,
    };

    if (shaActual) payload.sha = shaActual;

    const options = {
      method: "put",
      headers: {
        Authorization: "Bearer " + githubToken,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const textoRespuesta = response.getContentText();

      if (code === 200 || code === 201) {
        return {
          ok: true,
          statusCode: code,
          traza: isDebug ? `[PUT ${code}]: Éxito.` : null,
        };
      }

      // 409 indica conflicto de versión (SHA desactualizado o carrera de creación).
      if (code === 409) {
        const actualizado = obtenerArchivoGitHub(
          rutaArchivo,
          isDebug,
          githubToken,
        );

        if (actualizado && actualizado.errorGravedad) {
          return {
            ok: false,
            statusCode: 409,
            traza: isDebug
              ? `[PUT 409]: ${actualizado.traza || "No se pudo refrescar SHA."}`
              : "Conflicto de versión en GitHub.",
          };
        }

        if (actualizado && actualizado.sha) {
          shaActual = actualizado.sha;
        }

        if (intento < maxReintentos) {
          Utilities.sleep(500 * intento);
          continue;
        }
      }

      if (debeReintentarGitHub(code, intento, maxReintentos)) {
        Utilities.sleep(1000 * intento);
        continue;
      }

      return {
        ok: false,
        statusCode: code,
        traza: isDebug ? `[PUT ${code}]: ${textoRespuesta}` : `Error ${code}`,
      };
    } catch (e) {
      if (intento < maxReintentos) {
        Utilities.sleep(1000 * intento);
        continue;
      }

      return {
        ok: false,
        statusCode: null,
        traza: isDebug ? e.toString() : "Fallo de conexión PUT.",
      };
    }
  }

  return {
    ok: false,
    statusCode: null,
    traza: "Fallo inesperado en PUT GitHub.",
  };
}

/**
 * Determina si un error HTTP de GitHub amerita reintento automático.
 */
function debeReintentarGitHub(statusCode, intento, maxReintentos) {
  return debeReintentarHttp(statusCode, intento, maxReintentos, [429], true);
}

/**
 * Une frontmatter y cuerpo cuando la respuesta de IA es válida.
 */
function construirContenidoFinalDiario(datosMarkdown) {
  if (!datosMarkdown || !datosMarkdown.valido) {
    return (datosMarkdown && datosMarkdown.cuerpo) || "";
  }

  return (datosMarkdown.yaml || "") + (datosMarkdown.cuerpo || "");
}

/**
 * Genera el mensaje de commit según modo de operación.
 */
function construirMensajeCommit(fechaFormateada, yaExiste) {
  if (yaExiste) {
    return `Diario AI 🤖: Actualización del día - ${Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "HH:mm")}`;
  }

  return `Diario AI 🤖: Registro del día ${fechaFormateada}`;
}

/**
 * Ajusta el modo reportado según el resultado real del PUT en GitHub.
 */
function resolverModoOperacionFinal(modoPreferido, resultadoCommit) {
  if (!resultadoCommit || !resultadoCommit.ok) {
    return modoPreferido;
  }

  if (resultadoCommit.statusCode === 201) {
    return GITHUB_MODO_OPERACION.PRIMER_REGISTRO_DIA;
  }

  if (resultadoCommit.statusCode === 200) {
    return GITHUB_MODO_OPERACION.ACTUALIZACION_DIA;
  }

  return modoPreferido;
}
