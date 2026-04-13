# Diario AI Bot para Obsidian

![Runtime](https://img.shields.io/badge/Runtime-Google%20Apps%20Script-4285F4?style=for-the-badge)
![Bot](https://img.shields.io/badge/Bot-Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![LLM](https://img.shields.io/badge/LLM-Gemini-0F9D58?style=for-the-badge)
![Storage](https://img.shields.io/badge/Storage-GitHub%20Contents%20API-181717?style=for-the-badge&logo=github&logoColor=white)
![Knowledge Base](https://img.shields.io/badge/Knowledge%20Base-Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

Bot de Telegram construido en Google Apps Script que transforma notas de voz en entradas diarias estructuradas para Obsidian.
La aplicacion usa Gemini para extraer contexto, emociones y acciones, y sincroniza el resultado en un repositorio de GitHub.

## Tabla de Contenidos

- [Descripcion](#descripcion)
- [Caracteristicas Principales](#caracteristicas-principales)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitectura del Proyecto](#arquitectura-del-proyecto)
- [Prerrequisitos](#prerrequisitos)
- [Instalacion](#instalacion)
- [Configuracion de Script Properties](#configuracion-de-script-properties)
- [Uso](#uso)
- [Comandos Disponibles](#comandos-disponibles)
- [Seguridad y Buenas Practicas](#seguridad-y-buenas-practicas)
- [Troubleshooting](#troubleshooting)
- [Roadmap Recomendado](#roadmap-recomendado)
- [Licencia](#licencia)
- [Contacto](#contacto)

## Descripcion

Diario AI Bot para Obsidian automatiza la captura de notas de voz desde Telegram y las convierte en un diario enriquecido con analisis semantico.
El sistema genera JSON estructurado, lo transforma a Markdown con frontmatter y lo sincroniza en tu repositorio para consumirlo desde Obsidian.

## Caracteristicas Principales

- Procesa notas de voz y texto desde Telegram con un unico webhook.
- Incluye modo de entrada manual por chat con /nueva_entrada, /fin_entrada y /cancelar_entrada.
- Extrae informacion estructurada con Gemini: emociones, energia, eventos, tareas e insights.
- Mantiene continuidad diaria usando contexto previo del mismo dia.
- Genera Markdown compatible con Obsidian: frontmatter YAML, bloques narrativos y snapshot JSON.
- Sincroniza en GitHub con reintentos, manejo de conflictos SHA y trazabilidad.
- Incluye comandos operativos y de diagnostico como /estado, /test_conexion, /test_propiedades y /reset.

## Tecnologias Utilizadas

- Google Apps Script
- JavaScript
- Telegram Bot API
- Google Gemini API
- GitHub REST Contents API
- Obsidian

## Arquitectura del Proyecto

### Flujo principal

1. Telegram envia el update al webhook de Apps Script.
2. El router clasifica la entrada (texto o voice).
3. En audio, descarga el archivo, obtiene contexto diario y llama a Gemini.
4. Se normaliza el JSON, se renderiza Markdown y se sincroniza en GitHub.
5. El usuario recibe feedback por Telegram en cada paso clave.

### Modulos

- 01_Config.js: constantes globales, modelos y prompt de sistema.
- 02_Main.js: doPost, validacion inicial y enrutamiento.
- 03_Estado.js: comandos, estado y permisos.
- 04_Modulos.js: pipeline de texto y audio.
- 05_Telegram.js: capa de envio y descarga con Telegram.
- 06_Gemini.js: llamada a Gemini y contrato de respuesta.
- 07_Github.js: lectura y escritura diaria en GitHub.
- 08_Formateador.js: orquestador principal de transformacion IA -> markdown.
- 08_Formateador_Helpers.js: render markdown, fusion de datos y utilidades base del formateador.
- 08_Formateador_Historial.js: snapshot JSON, historial de transcripciones y extractores de fecha/hora.
- 09_Utils.js: utilidades base, seguridad y runtime config.
- 09_Utils_EntradaManual.js: deduplicacion y sesion temporal para /nueva_entrada.
- 09_Utils_Diagnostico.js: chequeos de properties y conectividad (Telegram/GitHub/Gemini).
- 10_Mensajes.js: base de mensajes y comandos/diagnostico.
- 10_Mensajes_Pipeline.js: mensajes de ejecucion, errores y cierre del pipeline.
- 11_Logger.js: logger de pipeline para debug.

## Prerrequisitos

- Cuenta de Google con acceso a Apps Script.
- Bot de Telegram creado en BotFather.
- API Key de Gemini.
- Token de GitHub con permisos sobre el repositorio objetivo.
- Repositorio de diario (por defecto: Gabiz053/diario-obsidian).
- Vault de Obsidian apuntando al repositorio sincronizado.

## Instalacion

### Opcion A (recomendada): despliegue directo en Apps Script

1. Crea un nuevo proyecto en Google Apps Script.
2. Copia los archivos JS del proyecto.
3. Despliega como Web App con acceso publico para recibir webhook.
4. Configura las Script Properties.
5. Configura el webhook de Telegram apuntando a la URL desplegada.

### Opcion B: flujo con clasp (CLI)

```bash
git clone <URL_DE_TU_REPO>
cd codigo-bot-diario
npm install -g @google/clasp
clasp login
```

Si ya tienes Script ID:

```bash
clasp clone <SCRIPT_ID>
clasp push
clasp deploy -d "Webhook Telegram"
```

### Registrar webhook en Telegram

```bash
# URL final del webhook de Apps Script
# Ejemplo: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<TELEGRAM_WEBHOOK_SECRET>

curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=<WEBHOOK_URL_ENCODED>"
```

## Configuracion de Script Properties

| Clave | Tipo | Obligatoria | Descripcion |
| --- | --- | --- | --- |
| TELEGRAM_TOKEN | string | Si | Token del bot de Telegram |
| GEMINI_API_KEY | string | Si | API key de Gemini |
| GITHUB_TOKEN | string | Si | Token de GitHub para lectura/escritura |
| TELEGRAM_WEBHOOK_SECRET | string | Recomendado | Secreto para validar webhook |
| ALLOWED_CHAT_IDS | CSV string | Recomendado | Lista de chats autorizados |
| ADMIN_CHAT_IDS | CSV string | Recomendado | Lista de chats con comandos sensibles |
| DEBUG_MODE | boolean string | No | Valor por defecto: false |
| IA_MODEL | string | No | Valor por defecto: gemini-3-flash-preview |
| LAST_SYNC_ROUTE | string | No | Ultima ruta sincronizada |
| LAST_SYNC_MODE | string | No | Ultimo modo de sincronizacion |
| LAST_SYNC_AT | string | No | Ultima fecha/hora de sincronizacion |

## Uso

1. Envia una nota de voz al bot de Telegram.
2. El bot procesa el audio y estructura la salida con Gemini.
3. El diario del dia se crea o actualiza en GitHub.
4. Abre tu vault de Obsidian y revisa la nota del dia.

### Vista esperada

El resultado final es una nota diaria en Obsidian con frontmatter YAML, secciones narrativas, tareas accionables e historial de transcripciones.

## Comandos Disponibles

### Generales

- /ayuda
- /help
- /start
- /comandos
- /nueva_entrada
- /fin_entrada
- /cancelar_entrada
- /ping
- /version
- /estado
- /fecha_logica
- /ruta_hoy
- /modelo_actual
- /modelos
- /ultimo_guardado

### Cambio de modelo

- /modelo_flash
- /modelo_lite
- /modelo_pro

### Diagnostico y administracion

- /debug_on
- /debug_off
- /test_conexion
- /test_propiedades
- /reset

Nota: algunos comandos son solo para chats admin cuando ADMIN_CHAT_IDS esta configurado.

## Seguridad y Buenas Practicas

- Mantener TELEGRAM_WEBHOOK_SECRET activo y no exponerlo.
- Definir ALLOWED_CHAT_IDS para limitar acceso en produccion.
- Definir ADMIN_CHAT_IDS para comandos sensibles.
- Rotar periodicamente tokens de Telegram, Gemini y GitHub.
- Evitar publicar logs con credenciales o payloads sensibles.

## Troubleshooting

### El bot no responde

- Verifica que el Web App este desplegado y accesible.
- Revisa que el webhook de Telegram este correctamente configurado.
- Ejecuta /test_conexion para validar APIs externas.

### No guarda en GitHub

- Revisa GITHUB_TOKEN y permisos del repositorio.
- Ejecuta /test_propiedades para detectar faltantes.
- Comprueba que GITHUB_REPO y GITHUB_BRANCH sean correctos.

### Falla en Gemini

- Verifica GEMINI_API_KEY.
- Cambia temporalmente de modelo con /modelo_flash o /modelo_lite.
- No hay reintentos automaticos para evitar gasto extra de API.
- Reenvia el mensaje manualmente para intentarlo de nuevo.

## Roadmap Recomendado

- Exportador de analitica (JSON a CSV) para consultas historicas.
- Dashboard de metricas (emociones por persona, patrones semanales).
- Alertas inteligentes por combinaciones de riesgo emocional.
- Reportes semanales y mensuales automatizados.

## Licencia

MIT.

Si aun no existe, agrega un archivo LICENSE en la raiz del repositorio.

## Contacto

- Nombre: Gabriel
- GitHub: [Gabiz053](https://github.com/Gabiz053)
- LinkedIn: [Tu LinkedIn aqui]
