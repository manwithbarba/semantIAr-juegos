# SemantIAr-86 · Consola educativa retro v3.0

Versión corregida el 13/10/2026 a partir del prototipo aportado. Funciona como un HTML autónomo, sin bibliotecas, fuentes remotas ni solicitudes de red propias de la aplicación. El audio se genera localmente con Web Audio.

## Abrir

Abrir `index.html` en un navegador moderno. También puede servirse mediante cualquier servidor estático. No requiere instalación ni cuenta. Si el navegador impide el almacenamiento local, la partida sigue funcionando sin guardar estadísticas. La copia al portapapeles depende de los permisos del navegador; el texto de revisión puede seleccionarse y copiarse manualmente.

## Banco y alcance

- **24 escenarios semánticos adaptados**, con seis dimensiones: categoría, polaridad, certeza, temporalidad, sujeto y SCTID. Los filtros por longitud contienen 8 escenarios fáciles (<130 caracteres), 10 normales (130–250) y 6 difíciles (>250). La longitud es un filtro del juego, no una medida validada de dificultad clínica.
- **16 escenarios léxicos adaptados**, con tipo formal, función, sección didáctica y sentido previsto para el ejercicio. No se certifica que ese sentido sea correcto en todos los usos reales de una sigla.
- **16 ejercicios sobre decisiones históricas**, extraídos de las 21 decisiones públicas aceptadas el 29/09/2026. Acción, candidato, score, expansión y limitaciones se sincronizan con una copia de la fuente pública incorporada al HTML. La clasificación del motivo mediante opciones es didáctica. Los contextos clínicos no disponibles no se reconstruyen ni se presentan como evidencia.

Los dos primeros modos conservan escenarios del prototipo, identificados como educativos y sin auditoría independiente. Las respuestas no constituyen un gold standard ni un benchmark de exactitud. Los SCTID no fueron revalidados contra una edición licenciada. El juego no calcula IIS, estabilidad Monte Carlo ni probabilidades de acierto. Los porcentajes indican aciertos en el juego.

## Importación local: referencia sin puntaje

F4 permite importar:

- JSONL del recurso público: `terminology_occurrences.jsonl`, `terminology_mapping.jsonl`, `faiss_candidate_occurrences.jsonl`, `faiss_candidates.jsonl` y `lexical_inventory.jsonl`.
- `REVIEW_DECISIONS.json` con su lista `decisions`.
- Arrays JSON de registros con una forma literal.
- JSON de anotación con `cases[].concepts` o `cases[].lexicalMentions`.
- Referencias exportadas por esta versión, con `schemaVersion: "semantiar-juegos-reference.v1"` y `records`.

Los registros se consultan en F3, con el filtro **Referencias importadas**. No se convierten en respuestas del juego: el corpus público carece de notas fuente y sus candidatos siguen pendientes. No se inventan contexto, expansión, polaridad o certeza cuando faltan. Un JSON de entrada con casos sin anotaciones se rechaza como banco de referencias.

Límites: 10 MiB por archivo, 10.000 registros por archivo y 10.000 referencias totales. Se comprueba todo el archivo antes de incorporar sus registros; un error no deja una importación parcial. Los duplicados exactos se omiten para consulta, sin modificar los archivos de origen. Las estadísticas de esta vista no deben usarse como frecuencias del corpus.

Las referencias permanecen en memoria hasta recargar o cerrar la página. **Exportar referencias importadas** genera un JSON compatible con su posterior reimportación. No exporta las notas completas, los IDs de caso, los anotadores ni el banco didáctico. Se preserva una selección explícita de campos terminológicos; revisar su contenido antes de compartirlo, porque los campos libres podrían contener información sensible. La selección de campos no constituye una garantía automática de desidentificación.

El HTML muestra los valores como texto escapado y las opciones usan atributos de datos y eventos, sin construir código a partir de contenido importado. Las estadísticas educativas se guardan en una clave propia, separada de la versión anterior.

## Controles y accesibilidad

Clic o Tab/Espacio para seleccionar opciones; Enter confirma o avanza; H muestra una pista; M alterna sonido; C alterna el efecto CRT; F1–F4 cambian de vista. Los atajos no interceptan escritura en campos de entrada. Algunos navegadores reservan teclas de función: los botones visibles ofrecen las mismas acciones.

Hay cuatro paletas, foco visible y respeto de `prefers-reduced-motion`. El reloj se pausa al cambiar de vista; una respuesta confirmada no se vuelve a puntuar. Se recomienda desactivar el efecto CRT o usar alto contraste según preferencia.

## Propuestas de revisión

F4 genera texto Markdown para una propuesta. Completar archivo origen, `occurrenceId` o `termId`, cambio, evidencia verificable, edición consultada e incertidumbres. Los campos pendientes se marcan expresamente. Generar o copiar el texto no abre un issue, no lo publica ni acepta la propuesta.

## Fuentes públicas y licencia

- [Recurso léxico-terminológico v2](https://github.com/manwithbarba/semantiar-terminology-corpus)
- [Decisiones del 29/09/2026](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/REVIEW_DECISIONS.json)
- [Contrato de capa léxica](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/CONTRATO_CAPA_LEXICA_V2.md)
- [Campos del recurso](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/ETIQUETAS_Y_CAMPOS.md)
- [Licencia de datos propios](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/LICENSE-DATA.txt)
- [Condiciones SNOMED CT](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/NOTICE-SNOMED.md)

Las condiciones de los datos públicos y de SNOMED CT se conservan. Esta revisión no establece una nueva licencia para el código del prototipo. La edición Argentina 20260520 es la declarada por el recurso, sin revalidación ontológica independiente en esta entrega.

## Publicación

Este paquete queda preparado localmente; no se publicó ni sustituyó el sitio existente. Antes de reemplazar una aplicación publicada, conservar una copia y comprobar la configuración real de GitHub Pages: podría construirse mediante un workflow en vez de servir la raíz. Publicar `index.html`, este README y `.nojekyll` en la ubicación configurada. No incorporar archivos clínicos de trabajo al repositorio ni al despliegue.

## Verificación realizada

Tres rondas completas con puntuación exacta; opciones de los escenarios léxicos; posiciones de los literales; importación de los JSONL públicos y las 21 decisiones; deduplicación; fallo atómico ante JSONL inválido; escape de contenido HTML; exportación/reimportación; funcionamiento con almacenamiento bloqueado. También se probó en navegador la selección y confirmación de una pregunta léxica. Estas pruebas funcionales no equivalen a una auditoría clínica de las respuestas.
