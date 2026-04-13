/**
 * =======================================================================
 * 📝 08_FORMATEADOR.GS | Motor de Plantillas y Markdown
 * =======================================================================
 * Responsabilidad Única: Transformar el JSON de la IA en formato Obsidian.
 */

/**
 * Convierte la salida de IA en un documento markdown final con YAML + cuerpo.
 */
function procesarRespuestaIA(textoIA, opciones) {
  // 1) Parseo robusto de JSON de IA.
  const parseo = parsearJsonSeguro(limpiarJsonMarkdown(textoIA));
  if (!parseo.ok) {
    return {
      valido: false,
      cuerpo: `\n## Error de Formato IA\nLa IA no devolvió un JSON válido. Texto original:\n\n${textoIA}\n\n---`,
    };
  }

  // 2) Normalización de datos y resolución de la fecha canónica del registro.
  const datosActuales = normalizarRespuestaIA(parseo.data);
  const config = opciones || {};
  const fechaEntrada = resolverFechaEntrada(config.timestampEntradaMs);

  const fechaForzada = normalizarTexto(config.fechaForzada);
  const fechaDesdeRuta = extraerFechaDesdeRutaDiario(config.rutaDiaria);
  const fechaLogicaActual = Utilities.formatDate(
    calcularFechaLogica(fechaEntrada),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd",
  );
  const fechaCanonica =
    fechaForzada || fechaDesdeRuta || fechaLogicaActual || datosActuales.fecha;

  const hora = Utilities.formatDate(fechaEntrada, CONFIG.TIMEZONE, "HH:mm");
  const marcaEntrada = `${fechaCanonica} ${hora}`;
  const fecha = fechaCanonica;
  const tipoEntrada = normalizarTexto(config.tipoEntrada) || "desconocido";
  const modeloIA = normalizarTexto(config.modeloIA) || "N/A";
  const actualizadoEn = Utilities.formatDate(
    new Date(),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd HH:mm:ss",
  );

  // Cargamos snapshot previo para no perder arrays/propiedades históricas del día.
  const datosPrevios = extraerSnapshotJsonDesdeMarkdown(
    config.contextoPrevioMarkdown,
  );

  // 3) Fusión de historial previo + transcripción actual sin duplicados.
  const historialPrevio = extraerHistorialTranscripcionesDesdeMarkdown(
    config.contextoPrevioMarkdown,
    fecha,
  );
  const historialActual = construirHistorialTranscripcionActual(
    datosActuales.transcripcion_anotada,
    marcaEntrada,
  );
  const historialFinal = fusionarHistorialTranscripciones(
    historialPrevio,
    historialActual,
  );
  const datosFusionados = fusionarDatosDiario(datosPrevios, datosActuales);
  normalizarEntidadesObsidian(datosFusionados);
  datosFusionados.eventos_clave_cronologicos =
    normalizarEventosClaveCronologicos(
      datosFusionados.eventos_clave_cronologicos,
      hora,
      CONFIG.HORA_FRONTERA,
    );
  // Forzamos la fecha final para evitar inconsistencias del modelo en snapshot.
  datosFusionados.fecha = fecha;
  const snapshotJson = construirSnapshotJson(datosFusionados, historialFinal);
  const rayadasImportantes = construirRayadasImportantes(
    datosFusionados.rayadas,
  );
  const tagsFrontmatter = construirTagsFrontmatterObsidian(
    datosFusionados,
    tipoEntrada,
    modeloIA,
  );

  const d = new Date(fecha);
  const ayer = Utilities.formatDate(
    new Date(d.getTime() - 86400000),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd",
  );
  const manana = Utilities.formatDate(
    new Date(d.getTime() + 86400000),
    CONFIG.TIMEZONE,
    "yyyy-MM-dd",
  );

  // 4) Render de frontmatter YAML con métricas y entidades.
  let yaml = `---\n`;
  yaml += `fecha: ${fecha}\n`;
  yaml += `updated_at: "${escaparYaml(actualizadoEn)}"\n`;
  yaml += `canal: "telegram"\n`;
  yaml += `origen_entrada: "${escaparYaml(tipoEntrada)}"\n`;
  yaml += `modelo_ia: "${escaparYaml(modeloIA)}"\n`;
  yaml += `tags: ${renderizarArrayYaml(tagsFrontmatter)}\n`;
  yaml += `total_transcripciones: ${historialFinal.length}\n`;
  yaml += `vibracion: "${escaparYaml(datosFusionados.vibracion_del_dia || "Normal")}"\n`;
  yaml += `emociones: ${renderizarArrayYaml(datosFusionados.emociones_detectadas)}\n`;
  yaml += `energia: ${normalizarEscala(datosFusionados.nivel_energia, 3)}\n`;
  yaml += `estres: ${normalizarEscala(datosFusionados.nivel_estres, 3)}\n`;
  yaml += `calidad_transcripcion: ${normalizarEscala(datosFusionados.calidad_transcripcion, 3)}\n`;
  yaml += `confianza_extraccion: ${normalizarEscala(datosFusionados.confianza_extraccion, 3)}\n`;
  yaml += `personas: ${renderizarArrayYaml(datosFusionados.personas_mencionadas)}\n`;
  yaml += `lugares: ${renderizarArrayYaml(datosFusionados.lugares_mencionados)}\n`;
  yaml += `proyectos: ${renderizarArrayYaml(datosFusionados.proyectos_activos)}\n`;
  yaml += `conceptos: ${renderizarArrayYaml(datosFusionados.conceptos_clave)}\n`;
  yaml += `salud: ${renderizarArrayYaml(datosFusionados.salud_fisica_sintomas)}\n`;
  yaml += `habitos: ${renderizarArrayYaml(datosFusionados.habitos_mencionados)}\n`;
  yaml += `consumo: ${renderizarArrayYaml(datosFusionados.consumo_cultural)}\n`;
  yaml += `eventos_clave: ${renderizarArrayYaml(datosFusionados.eventos_clave_cronologicos)}\n`;
  yaml += `insights: ${renderizarArrayYaml(datosFusionados.insights_patrones)}\n`;
  yaml += `rayadas: ${renderizarArrayYaml(rayadasImportantes)}\n`;
  yaml += `alertas_emocionales: ${renderizarArrayYaml(datosFusionados.alertas_emocionales)}\n`;
  yaml += `acciones_24h: ${renderizarArrayYaml(datosFusionados.acciones_recomendadas_24h)}\n`;
  yaml += `---\n\n`;
  yaml += `# Diario: ${fecha}\n`;

  let metaVisual = `> [!abstract] Conexiones del día\n`;
  metaVisual += `> 📅 **Secuencia:** [[${ayer}]] ← **[[${fecha}]]** → [[${manana}]]\n`;
  metaVisual += `> 👥 **Personas:** ${renderizarArrayWikiLinks(datosFusionados.personas_mencionadas, CARPETAS_ENTIDADES_OBSIDIAN.personas_mencionadas)}\n`;
  metaVisual += `> 📍 **Lugares:** ${renderizarArrayWikiLinks(datosFusionados.lugares_mencionados, CARPETAS_ENTIDADES_OBSIDIAN.lugares_mencionados)}\n`;
  metaVisual += `> 🏗️ **Proyectos:** ${renderizarArrayWikiLinks(datosFusionados.proyectos_activos, CARPETAS_ENTIDADES_OBSIDIAN.proyectos_activos)}\n`;
  metaVisual += `> 🧠 **Conceptos:** ${renderizarArrayWikiLinks(datosFusionados.conceptos_clave, CARPETAS_ENTIDADES_OBSIDIAN.conceptos_clave)}\n`;
  metaVisual += `> 😊 **Emociones:** ${renderizarArrayWikiLinks(datosFusionados.emociones_detectadas, CARPETAS_ENTIDADES_OBSIDIAN.emociones_detectadas)}\n`;
  metaVisual += `> 🎬 **Consumo:** ${renderizarArrayWikiLinks(datosFusionados.consumo_cultural, CARPETAS_ENTIDADES_OBSIDIAN.consumo_cultural)}\n`;
  metaVisual += `> 🍃 **Hábitos:** ${renderizarArrayWikiLinks(datosFusionados.habitos_mencionados, CARPETAS_ENTIDADES_OBSIDIAN.habitos_mencionados)}\n`;
  metaVisual += `> 💊 **Salud:** ${renderizarArrayWikiLinks(datosFusionados.salud_fisica_sintomas, CARPETAS_ENTIDADES_OBSIDIAN.salud_fisica_sintomas)}\n\n`;

  // 5) Render del cuerpo narrativo y bloques operativos del día.
  let cuerpo = `\n## 🎙️ Entrada actual · ${marcaEntrada}\n\n`;
  cuerpo += metaVisual;
  cuerpo += construirBloqueRelatoExtenso(datosFusionados.resumen_narrativo);
  cuerpo += construirBloqueEntidadesEnlazadas(datosFusionados);
  cuerpo += construirSeccionListaMarkdown(
    "### 🏆 Micro-Victorias",
    datosFusionados.logros_micro,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 🚧 Fricciones",
    datosFusionados.fricciones_y_obstaculos,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 🙏 Gratitud",
    datosFusionados.momentos_gratitud,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 🌀 Rayadas Importantes",
    rayadasImportantes,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 🧭 Eventos Clave",
    datosFusionados.eventos_clave_cronologicos,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 🔎 Patrones e Insights",
    datosFusionados.insights_patrones,
    false,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### 📋 Tareas Capturadas",
    datosFusionados.tareas_pendientes,
    true,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### ✅ Acciones Próximas 24h",
    datosFusionados.acciones_recomendadas_24h,
    true,
  );
  cuerpo += construirSeccionListaMarkdown(
    "### ⚠️ Alertas Emocionales",
    datosFusionados.alertas_emocionales,
    false,
  );
  if (
    datosFusionados.nota_para_el_futuro &&
    datosFusionados.nota_para_el_futuro.length > 0
  ) {
    cuerpo += `> [!warning] Nota para el yo del futuro\n> ${datosFusionados.nota_para_el_futuro.join("\n> ")}\n\n`;
  }

  if (datosFusionados.analisis_interno_oculto) {
    cuerpo += `> [!note]- Análisis interno del modelo\n> ${datosFusionados.analisis_interno_oculto.split("\n").join("\n> ")}\n\n`;
  }

  cuerpo += construirBloqueHistorialTranscripciones(historialFinal);

  cuerpo += `\n\n### 🧾 Snapshot JSON\n\n`;
  cuerpo += `\`\`\`json\n${JSON.stringify(snapshotJson, null, 2)}\n\`\`\`\n`;

  cuerpo += `\n\n---`;

  return { valido: true, yaml: yaml, cuerpo: cuerpo, rawJson: snapshotJson };
}

/**
 * Sanea el objeto de IA para evitar valores nulos o tipos inesperados.
 */
function normalizarRespuestaIA(datos) {
  const fuente =
    datos && typeof datos === "object" && !Array.isArray(datos) ? datos : {};

  return {
    analisis_interno_oculto: normalizarTexto(fuente.analisis_interno_oculto),
    fecha: normalizarTexto(fuente.fecha),
    vibracion_del_dia: normalizarTexto(fuente.vibracion_del_dia),
    emociones_detectadas: normalizarArray(fuente.emociones_detectadas),
    nivel_energia: normalizarEscala(fuente.nivel_energia, 3),
    nivel_estres: normalizarEscala(fuente.nivel_estres, 3),
    calidad_transcripcion: normalizarEscala(fuente.calidad_transcripcion, 3),
    confianza_extraccion: normalizarEscala(fuente.confianza_extraccion, 3),
    personas_mencionadas: normalizarArray(fuente.personas_mencionadas),
    lugares_mencionados: normalizarArray(fuente.lugares_mencionados),
    salud_fisica_sintomas: normalizarArray(fuente.salud_fisica_sintomas),
    momentos_gratitud: normalizarArray(fuente.momentos_gratitud),
    consumo_cultural: normalizarArray(fuente.consumo_cultural),
    habitos_mencionados: normalizarArray(fuente.habitos_mencionados),
    fricciones_y_obstaculos: normalizarArray(fuente.fricciones_y_obstaculos),
    logros_micro: normalizarArray(fuente.logros_micro),
    rayadas: normalizarArray(fuente.rayadas),
    nota_para_el_futuro: normalizarArray(fuente.nota_para_el_futuro),
    tareas_pendientes: normalizarArray(fuente.tareas_pendientes),
    proyectos_activos: normalizarArray(fuente.proyectos_activos),
    conceptos_clave: normalizarArray(fuente.conceptos_clave),
    eventos_clave_cronologicos: normalizarArray(
      fuente.eventos_clave_cronologicos,
    ),
    insights_patrones: normalizarArray(fuente.insights_patrones),
    alertas_emocionales: normalizarArray(fuente.alertas_emocionales),
    acciones_recomendadas_24h: normalizarArray(
      fuente.acciones_recomendadas_24h,
    ),
    resumen_narrativo: normalizarTexto(
      fuente.resumen_narrativo ||
        fuente.relato_extenso ||
        fuente.cronica_extensa,
    ),
    transcripcion_anotada: normalizarTranscripcion(
      fuente.transcripcion_anotada,
    ),
  };
}

// Helpers de formateo/mixins extraídos a 08_Formateador_Helpers.js.
