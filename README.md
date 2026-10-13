# SemantIAr-86 · Consola educativa retro v3.0

Versión corregida el 13/10/2026 a partir del prototipo aportado. Funciona como un HTML autónomo, sin bibliotecas, fuentes remotas ni solicitudes de red propias de la aplicación. El audio se genera localmente con Web Audio.

## Abrir

Abrir `index.html` en un navegador moderno. También puede servirse mediante cualquier servidor estático. No requiere instalación ni cuenta. Si el navegador impide el almacenamiento local, la partida sigue funcionando sin guardar estadísticas.

## Banco y alcance

- **24 escenarios semánticos adaptados**, con seis dimensiones: categoría, polaridad, certeza, temporalidad, sujeto y SCTID. Los filtros por longitud contienen 6 escenarios fáciles (<130 caracteres), 12 normales (130–250) y 6 difíciles (>250). La longitud es un filtro del juego, no una medida validada de dificultad clínica.
- **16 escenarios léxicos adaptados**, con tipo formal, función, sección didáctica y sentido previsto para el ejercicio. No se certifica que ese sentido sea correcto en todos los usos reales de una sigla.
- **16 ejercicios sobre decisiones históricas**, extraídos de las 21 decisiones públicas aceptadas el 29/09/2026. Acción, candidato, score, expansión y limitaciones se sincronizan con una copia de la fuente pública incorporada al HTML. La clasificación del motivo mediante opciones es didáctica. Los contextos clínicos no disponibles no se reconstruyen ni se presentan como evidencia.

Los dos primeros modos conservan escenarios del prototipo, identificados como educativos y sin auditoría independiente. Las respuestas no constituyen un gold standard ni un benchmark de exactitud. Los códigos y descripciones de las opciones semánticas se comprobaron por FHIR en la edición congelada indicada más abajo. El juego no calcula IIS, estabilidad Monte Carlo ni probabilidades de acierto. Los porcentajes indican aciertos en el juego.

## Banco fijo y opciones relacionadas

La página funciona con sus 56 ejercicios incorporados. No incluye carga de lotes JSON/JSONL ni exportación de referencias.

Cada ejercicio semántico tiene tres distractores preparados según el significado del literal. Solo se mezcla el orden de presentación; ya no se eligen conceptos al azar de todo el banco. Al confirmar aparecen los motivos por los que las alternativas no corresponden al fragmento.

Se verificaron por FHIR las 24 referencias y los 72 distractores en `http://snomed.info/sct/11000221109/version/20260520`, usando `https://implementation-demo.snomedtools.org/fhir`. Cada concepto dispone de código, descripción, FSN, versión y estado activo de esa edición. La página utiliza el banco fijo verificado, sin depender del servidor al jugar.

`distractor-bank.json` conserva la selección y las razones; `fhir-verification.json` reúne las respuestas de consulta. Se corrigieron cuatro referencias del prototipo: producto con fentanilo (`40648001`), antecedente familiar de diabetes tipo 2 (`430679000`), dolor a la descompresión (`35611005`) y resección del riñón derecho (`765473008`). Las correcciones afectan al juego, sin modificar el corpus de origen.

En el escenario ARM se explicita el tubo endotraqueal para distinguir ventilación invasiva de no invasiva. El escenario de saturación indica que la medición se encuentra dentro del rango de referencia. La negación se responde en su dimensión propia; no transforma la identidad del concepto.

## Controles y accesibilidad

Clic o Tab/Espacio para seleccionar opciones; Enter confirma o avanza; H muestra una pista; M alterna sonido; C alterna el efecto CRT; F1–F3 cambian de vista. Los atajos no interceptan escritura en campos de entrada. Algunos navegadores reservan teclas de función: los botones visibles ofrecen las mismas acciones.

Hay cuatro paletas, foco visible y respeto de `prefers-reduced-motion`. El reloj se pausa al cambiar de vista; una respuesta confirmada no se vuelve a puntuar. Se recomienda desactivar el efecto CRT o usar alto contraste según preferencia.

## Informar un error

El enlace **Informar un error** abre el formulario de issues del repositorio en GitHub. Puede requerir iniciar sesión. La página no envía información automáticamente; describir el ejercicio y el problema sin incluir notas clínicas de trabajo ni datos personales.

## Fuentes públicas y licencia

- [Recurso léxico-terminológico v2](https://github.com/manwithbarba/semantiar-terminology-corpus)
- [Decisiones del 29/09/2026](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/REVIEW_DECISIONS.json)
- [Contrato de capa léxica](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/CONTRATO_CAPA_LEXICA_V2.md)
- [Campos del recurso](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/ETIQUETAS_Y_CAMPOS.md)
- [Licencia de datos propios](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/LICENSE-DATA.txt)
- [Condiciones SNOMED CT](https://github.com/manwithbarba/semantiar-terminology-corpus/blob/main/NOTICE-SNOMED.md)

Las condiciones de los datos públicos y de SNOMED CT se conservan. Los materiales propios del juego (código, documentación y contenidos educativos propios) se distribuyen bajo CC BY-SA 4.0; consultar LICENSE.txt. Los componentes SNOMED CT y de terceros conservan sus condiciones de origen. Las opciones semánticas se consultaron expresamente en la edición Argentina 20260520; esta comprobación no sustituye las condiciones de licencia de SNOMED CT.

## Publicación

Página pública: https://manwithbarba.github.io/semantIAr-juegos/
GitHub Pages sirve la raíz de la rama `gh-pages`. La consola es un HTML autónomo; se conserva el explorador previo. El paquete contiene además el banco verificado, evidencia FHIR, documentación y `.nojekyll`.

## Verificación realizada

Rondas completas con puntuación exacta en los tres modos; 24 conjuntos de cuatro SCTID distintos con una referencia y tres distractores relacionados; versión FHIR exacta y conceptos activos; posiciones de literales y opciones seleccionables; ausencia de controles o código de importación de archivos. Las notas de adjudicación y otros archivos clínicos de trabajo no forman parte del paquete publicado.

## Documentación separada

El enlace Documentación abre `documentation.html`, con campos técnicos, edición, fuentes y evidencia. Las consignas y opciones del juego usan etiquetas en español sin nombres de archivos ni claves del modelo.

La documentación incluye una introducción a SemantIAr, formas breves, conceptos SNOMED CT, jerarquías y categorías de trabajo, contexto clínico y condiciones de licencia.
