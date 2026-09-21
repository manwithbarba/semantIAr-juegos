# SEMANTIAR Juegos

> Recurso educativo para practicar anotación semántica clínica y explorar conceptos SNOMED CT sin exponer texto clínico en la vista pública.

- [Abrir el juego](https://manwithbarba.github.io/semantIAr-juegos/)
- [Abrir el explorador de conceptos](https://manwithbarba.github.io/semantIAr-juegos/explorador-conceptos/)
- [Leer la metodología y el estado de validación](docs/explorador-conceptos-metodologia.md)

La aplicación tiene fines educativos y recreativos. No diagnostica, no recomienda códigos para la atención y no reemplaza la revisión de un profesional con formación en terminología clínica.

## Qué incluye

### Juego de calibración

Presenta rondas basadas en casos sintéticos y pregunta por categoría, polaridad, certeza, temporalidad, sujeto de la relación y término SNOMED CT. El progreso se guarda únicamente en el almacenamiento local del navegador.

### Explorador de conceptos anotados

Presenta una vista pública y agregada del conjunto de conceptos. La publicación actual resume:

- 1.400 apariciones anotadas en 75 casos y por 27 anotadores;
- 759 SCTID distintos;
- 742 conceptos con representación vectorial y ubicación en el mapa;
- 17 SCTID sin metadatos en el índice, que no se ubican en el mapa; y
- 158 relaciones jerárquicas directas entre conceptos que están dentro del mapa.

Estas cantidades describen el conjunto publicado; no representan prevalencia clínica, calidad de atención ni desempeño de los anotadores.

## Cómo leer el explorador

El explorador reúne tres lecturas complementarias que no deben confundirse:

| Lectura | Qué muestra | Qué no demuestra |
|---|---|---|
| Distribución de anotaciones | Apariciones, casos, cantidad de anotadores y atributos agregados por concepto. | Prevalencia, importancia clínica, corrección o acuerdo entre anotadores. |
| Jerarquía SNOMED CT | Relaciones directas `is-a` entre conceptos más específicos y más generales. | Similitud de uso, causalidad, equivalencia ni el código más apropiado para un caso. |
| Similitud terminológica | Vecinos por similitud coseno en el espacio vectorial y vistas 2D mediante PCA o t-SNE. | Equivalencia clínica, sinonimia confirmada, probabilidad ni validación por expertos. |

La distancia entre puntos en dos dimensiones es orientativa. Para conocer vecinos terminológicos se usa la similitud calculada en el espacio vectorial original; aun así, el resultado debe revisarse con el contexto clínico y la edición correspondiente de SNOMED CT.

## Privacidad

El payload público incluye SCTID, términos, etiquetas semánticas, relaciones y conteos agregados. No incluye textos clínicos, fragmentos de notas, identificadores de casos, identificadores de anotadores ni rutas de archivos de origen. Una verificación automática impide publicar esos campos conocidos.

Esta minimización reduce el riesgo, pero no equivale por sí sola a una certificación de anonimización ni de cumplimiento normativo. La metodología propone revisar celdas pequeñas, riesgo de enlace y gobernanza antes de publicar nuevos lotes.

## Estado de evidencia

La navegación, los conteos agregados, las relaciones jerárquicas y las proyecciones PCA/t-SNE están implementados. La utilidad educativa, la calidad clínica de los vecinos, la reproducibilidad entre ediciones y la confiabilidad de la codificación todavía no fueron validadas para este explorador.

UMAP, PaCMAP, representaciones de Poincaré y vistas inspiradas en TermViz o WINS se describen como alternativas para evaluación futura; no forman parte de la versión actual. El payload identifica el modelo utilizado como `cambridgeltl/SapBERT-UMLS-2020AB-all-lang-from-XLMR`; todavía deben registrarse una revisión inmutable, el procedimiento de construcción y los checksums del índice para completar la reproducibilidad.

Consultá [Metodología del explorador de conceptos](docs/explorador-conceptos-metodologia.md) para ver el detalle del procesamiento, las limitaciones, las referencias y el plan de validación.

## Uso local

**Requisito:** Node.js compatible con Next.js 16.

```bash
npm ci
npm run dev
```

Abrí <http://localhost:3000>. El explorador está disponible en <http://localhost:3000/explorador-conceptos/>.

## Verificación y build

```bash
npm run lint
npm run build
```

El build es estático y se publica en GitHub Pages desde `main`.
