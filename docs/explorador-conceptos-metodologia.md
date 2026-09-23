# Metodología del explorador de conceptos anotados

## Propósito y alcance

El explorador es un recurso educativo para que profesionales de la salud reconozcan tres aspectos diferentes de una anotación semántica:

1. qué conceptos y atributos aparecen en un conjunto anotado;
2. cómo se ubican esos conceptos en la jerarquía formal de SNOMED CT; y
3. qué conceptos tienen términos vectorialmente parecidos.

Su objetivo es favorecer preguntas y revisión crítica, no automatizar decisiones asistenciales. El explorador no diagnostica, no indica tratamientos, no selecciona el código correcto para una historia clínica y no mide por sí solo la calidad de una anotación.

## Estado de la evidencia

Conviene distinguir tres niveles antes de interpretar el mapa:

| Nivel | Estado | Qué permite afirmar |
|---|---|---|
| Artefacto disponible | Implementado e inspeccionado | El payload contiene conteos agregados, relaciones `is-a`, embeddings de 768 dimensiones, vecinos por similitud coseno y coordenadas PCA/t-SNE. |
| Antecedentes externos | Publicados por terceros | Existen métodos y prototipos relevantes para representación biomédica, reducción dimensional, visualización de SNOMED CT y aprendizaje con mapas conceptuales. |
| Evidencia propia del explorador | Pendiente | Todavía no se demostró utilidad educativa, validez clínica de los vecinos, mejora de la confiabilidad ni superioridad de una visualización. |

Una referencia publicada puede justificar una hipótesis o un diseño, pero no valida automáticamente este explorador, su conjunto de datos ni su población de usuarios.

## Conjunto publicado

El payload generado el 23 de septiembre de 2026 contiene:

| Elemento | Cantidad | Interpretación |
|---|---:|---|
| Apariciones anotadas | 1.609 | Veces que se registró un SCTID en el conjunto de origen. |
| Casos | 80 | Identificadores de caso distintos antes de la agregación; no implica 75 pacientes. |
| Anotadores | 31 | Identificadores de anotador distintos antes de la agregación. |
| Asignaciones caso–anotador | 150 | Unidades de trabajo asignadas; no implica que todos los casos hayan sido anotados por todas las personas. |
| SCTID anotados | 823 | Conceptos distintos observados al menos una vez. |
| Conceptos en el mapa | 802 | SCTID con metadatos y vector disponibles en el índice. |
| SCTID fuera del mapa | 21 | Conceptos sin metadatos recuperables del índice utilizado. |
| Relaciones `is-a` internas | 158 | Relaciones directas cuyos dos extremos están entre los 742 puntos. |

Cada punto conserva el SCTID, el término del índice, la etiqueta semántica, los conteos agregados, las relaciones directas con padres e hijos, dos coordenadas PCA, dos coordenadas t-SNE y seis vecinos vectoriales. La certeza no está incluida en esta vista, aunque sea una dimensión del juego de calibración.

## Tres lecturas separadas

### 1. Distribución de anotaciones: qué se registró

Esta lectura usa los conteos y filtros del panel: categoría clínica, polaridad, temporalidad y sujeto. Para un concepto determinado:

- **apariciones** cuenta todas sus anotaciones;
- **casos** cuenta casos distintos en los que aparece; y
- **anotadores** cuenta personas anotadoras distintas que lo utilizaron.

**Qué significa.** Describe la composición del conjunto anotado y permite localizar concentraciones, conceptos raros y combinaciones de atributos que merecen revisión.

**Qué no significa.** No estima prevalencia en una población, incidencia, gravedad, relevancia clínica ni calidad. Que varias personas hayan usado un concepto no demuestra acuerdo: podrían haber trabajado sobre casos diferentes. Los agregados tampoco permiten saber por qué se eligió un SCTID ni reconstruir el contexto de la mención.

Para estudiar desacuerdo se necesita conservar, en un entorno autorizado, la relación entre caso, mención, anotador y código; definir qué unidades recibieron anotación independiente; y comparar decisiones antes de adjudicarlas.

### 2. Jerarquía SNOMED CT: cómo se organiza el significado formal

Las relaciones se obtuvieron del Snapshot de relaciones de la edición argentina utilizado por el generador, con fecha de release 31 de mayo de 2025. Solo se seleccionaron relaciones activas `116680003 |is a|`.

En una relación `is-a`, el concepto de origen es el hijo más específico y el destino es el padre más general. SNOMED CT es una **polijerarquía**: un concepto puede tener más de un padre. La [guía oficial del modelo lógico de SNOMED CT](https://docs.snomed.org/snomed-ct-practical-guides/snomed-ct-starter-guide/5-snomed-ct-logical-model) explica esta estructura. El [Navegador de SNOMED CT de Argentina](https://www.argentina.gob.ar/salud/terminologia/navegador-snomed-ct) permite contrastar conceptos en la edición local.

**Qué significa.** Una línea informa una relación formal directa de subtipo a supertipo en esa edición. El panel de detalle también puede mostrar padres o hijos que existen en la terminología pero no forman parte de los 742 puntos.

**Qué no significa.** Una línea no indica causalidad, secuencia temporal, frecuencia conjunta, sinonimia ni preferencia de codificación. La ausencia de línea visible no demuestra ausencia de relación: puede haber ancestros intermedios, relaciones de atributos no incluidas, conceptos fuera del conjunto o cambios entre releases.

Las 158 líneas internas son solo el subgrafo inducido por los conceptos anotados. No representan la totalidad de SNOMED CT ni todas las relaciones definitorias de esos conceptos.

### 3. Similitud terminológica: qué términos se parecen en el índice

El generador recuperó vectores de 768 dimensiones de un índice FAISS, los normalizó y calculó vecinos con distancia coseno. La interfaz muestra `1 − distancia coseno` como un valor decimal entre −1 y 1 para los seis vecinos más próximos; no lo presenta como porcentaje. PCA y t-SNE reducen esos mismos vectores a dos dimensiones para dibujar el mapa.

**Qué significa.** Un vecino con mayor puntuación tiene una representación vectorial más próxima dentro del índice utilizado. Esto sirve para descubrir candidatos terminológicamente relacionados y casos llamativos que requieren revisión.

**Qué no significa.** La puntuación no es probabilidad, confianza clínica ni porcentaje de equivalencia. La cercanía no confirma sinonimia, relación `is-a`, intercambiabilidad de códigos ni adecuación al texto de un caso. Un modelo puede acercar términos por forma léxica, dominio o patrones aprendidos y, aun así, producir vecinos clínicamente inadecuados.

La lista de vecinos se calcula en las 768 dimensiones originales; es una evidencia distinta de la distancia visual entre puntos en PCA o t-SNE.

## Cómo se construyó la versión actual

La tarea realizada fue:

1. reunir los SCTID presentes en las anotaciones y agregar apariciones, casos, anotadores, categorías, polaridades, temporalidades y sujetos;
2. recuperar término, etiqueta semántica y vector desde el índice terminológico existente;
3. excluir del mapa 17 SCTID sin metadatos en ese índice;
4. leer relaciones activas `is-a` del Snapshot RF2 de la edición argentina utilizada;
5. normalizar los vectores y calcular seis vecinos por distancia coseno;
6. generar una vista lineal con PCA en dos dimensiones;
7. generar una vista no lineal con t-SNE, métrica coseno, inicialización PCA, perplejidad 30, 750 iteraciones y semilla 42; y
8. publicar solo el payload agregado y comprobar automáticamente la ausencia de campos sensibles conocidos.

La interfaz separa distribución, jerarquía y similitud; permite buscar por SCTID o término, filtrar atributos, alternar PCA/t-SNE, recorrer padres e hijos directos y abrir el detalle de cada concepto. El color conserva un único significado estable: categoría de anotación.

## PCA y t-SNE en esta versión

### PCA: vista general lineal

PCA busca dos direcciones lineales que concentran variación del espacio vectorial. En este conjunto, los dos ejes conservan 8,51 % de la variación de las 768 dimensiones: es una referencia técnica compacta, pero retiene una fracción pequeña de la información. La cercanía 2D puede diferir de la similitud coseno original.

### t-SNE: vecindarios locales con cautela

[t-SNE](https://www.jmlr.org/papers/v9/vandermaaten08a.html) busca representar vecindarios de alta dimensión en un plano. Puede revelar estructura local que PCA no muestra, pero su imagen depende de hiperparámetros, inicialización y convergencia. [How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/) muestra por qué el tamaño aparente de los grupos, el espacio vacío y la distancia entre grupos separados pueden ser engañosos.

Por eso, en este explorador:

- no se infieren grupos clínicos solo por “islas” visuales;
- no se compara la importancia de un grupo por su área o densidad;
- no se interpreta una gran distancia 2D como gran diferencia clínica; y
- se consulta la lista de vecinos en el espacio original y la jerarquía formal antes de formular una hipótesis.

La semilla fija mejora la reproducibilidad de esta imagen, pero no elimina la distorsión ni demuestra estabilidad frente a otros parámetros.

## Métodos y herramientas relacionados

Los siguientes trabajos ayudan a situar el explorador. Salvo PCA y t-SNE, no describen funciones ya implementadas.

### Representación biomédica

- [SapBERT](https://aclanthology.org/2021.naacl-main.334/) aprende representaciones de entidades biomédicas acercando sinónimos de UMLS; fue diseñado para tareas como vinculación de menciones con conceptos. El generador declara `cambridgeltl/SapBERT-UMLS-2020AB-all-lang-from-XLMR` y que la entrada fue únicamente el nombre preferido del concepto. Aún faltan una revisión inmutable, la estrategia de pooling y checksums del índice y los metadatos para una reproducción independiente completa.

### Visualización de SNOMED CT

- [Methods and Applications for Visualization of SNOMED CT Concept Sets](https://pmc.ncbi.nlm.nih.gov/articles/PMC3974253/) estudia la visualización conjunta de un “conjunto de interés”, sus caminos y ancestros comunes. Ofrece un antecedente directo para pasar de puntos aislados a vistas jerárquicas orientadas a tareas.
- [TermViz](https://pubmed.ncbi.nlm.nih.gov/17108619/) exploró foco más contexto, navegación animada y zoom semántico para terminologías con múltiples padres. Sus ideas ayudan a reducir pérdida de contexto, pero el explorador actual no implementa su algoritmo ni fue evaluado como TermViz.
- [WINS](https://par.nsf.gov/servlets/purl/10161024) visualiza subgrafos no reticulares de SNOMED CT para apoyar control de calidad ontológica. Es relevante para inspeccionar anomalías estructurales; no es una técnica de similitud textual ni una función presente en esta versión.

### Alternativas de reducción o representación

- [UMAP](https://arxiv.org/abs/1802.03426) construye una representación no lineal a partir de vecindarios y suele ser eficiente. Puede equilibrar estructura local y una parte de la global, pero también depende de parámetros y no convierte el plano en una métrica clínica.
- [PaCMAP](https://www.jmlr.org/papers/v22/20-1061.html) usa pares vecinos, intermedios y lejanos para buscar un mejor equilibrio entre estructura local y global. Debe compararse con métricas y estabilidad, no elegirse solo porque produzca una figura visualmente atractiva.
- [Embeddings de Poincaré](https://papers.neurips.cc/paper_files/paper/2017/hash/59dfa2df42d9e3d41f5b02bfc32229dd-Abstract.html) representan jerarquías en un espacio hiperbólico. Son una alternativa prometedora para modelar estructura `is-a`, pero requieren entrenamiento y evaluación propios; no se obtienen aplicando otra proyección a los vectores actuales.

### Aprendizaje con mapas conceptuales

- Una [revisión sobre mapas conceptuales en educación médica](https://doi.org/10.1111/j.1365-2923.2010.03628.x) describe usos para aprendizaje significativo, retroalimentación y evaluación.
- Una [revisión sistemática BEME sobre mapas conceptuales y pensamiento crítico](https://doi.org/10.1080/0142159X.2023.2281248) encuentra potencial educativo, pero también heterogeneidad e inconsistencias en la evidencia.

Estos antecedentes apoyan evaluar actividades guiadas —por ejemplo, justificar por qué dos conceptos son vecinos o distinguir similitud de subsunción—. No demuestran que observar el mapa actual produzca aprendizaje.

### Desacuerdo y confiabilidad en codificación SNOMED CT

- [Reliability of SNOMED-CT Coding by Three Physicians Using Two Terminology Browsers](https://pmc.ncbi.nlm.nih.gov/articles/PMC1839418/) encontró acuerdo exacto completo de 44 % con un navegador y 53 % con otro en 242 conceptos oftalmológicos. Es un estudio pequeño y situado, pero muestra que la interfaz y la estrategia de búsqueda pueden influir.
- [Variation of SNOMED CT Coding of Clinical Research Concepts among Coding Experts](https://pmc.ncbi.nlm.nih.gov/articles/PMC2244907/) informó que tres expertos eligieron el mismo concepto central en 33 % de las expresiones estudiadas. Sus resultados no se trasladan directamente a este corpus, pero advierten que experiencia profesional no garantiza uniformidad.
- [Semantic Krippendorff's α for Measuring Inter-rater Agreement in SNOMED CT Coding Studies](https://pubmed.ncbi.nlm.nih.gov/25160164/) propone ponderar el desacuerdo según distancia jerárquica, porque dos códigos cercanos no representan la misma diferencia que dos códigos alejados.

Estos estudios justifican medir tanto coincidencia exacta como proximidad semántica. No aportan una cifra de confiabilidad para SEMANTIAR: esa cifra debe calcularse con su diseño de anotación, sus unidades repetidas y su propia adjudicación.

## Privacidad y gobernanza

### Datos incluidos

- SCTID, término y etiqueta semántica;
- conteos agregados de apariciones, casos y anotadores;
- distribuciones agregadas de categoría, polaridad, temporalidad y sujeto;
- padres, hijos, aristas internas, coordenadas y vecinos.

### Datos excluidos

- texto clínico y fragmentos de notas;
- expresiones literales y offsets;
- identificadores de casos y anotadores;
- nombres de archivos y rutas de origen; y
- el payload local de contexto, que no debe publicarse.

El control automático revisa una lista de nombres de archivo y claves prohibidas, y exige que la política del payload declare esas cuatro exclusiones. Este control detecta errores estructurales conocidos; no analiza texto libre inesperado, inferencias por celdas pequeñas ni ataques de enlace.

Antes de incorporar otro lote se debe revisar finalidad, base legal o consentimiento aplicable, autorización institucional, retención, acceso, umbrales de publicación y riesgo residual. No se afirma anonimización certificada, cumplimiento de una norma específica ni riesgo cero.

## Limitaciones actuales

- La muestra es un conjunto de trabajo, no una muestra epidemiológica ni necesariamente representativa de una institución, especialidad o población.
- Los agregados eliminan el contexto que permitiría juzgar si una anotación concreta es correcta.
- El artefacto identifica familia y nombre del modelo, pero todavía no documenta revisión inmutable, estrategia de pooling, fecha de construcción y checksums del índice y los metadatos.
- Los 17 SCTID sin metadatos quedan fuera del mapa y pueden introducir sesgo de cobertura.
- Los términos y relaciones dependen de una edición de SNOMED CT; otras ediciones o fechas pueden producir diferencias.
- La jerarquía muestra `is-a` directas, no todas las relaciones definitorias ni todos los caminos entre conceptos.
- PCA y t-SNE pierden información al pasar de 768 a dos dimensiones. El mapa no debe usarse para medir distancias ni formar grupos sin validación adicional.
- La similitud coseno no está calibrada como probabilidad y los seis vecinos no fueron calificados sistemáticamente por expertos.
- Los conteos agregados de anotadores no miden acuerdo y la vista no incluye certeza.
- La verificación de privacidad se basa en campos prohibidos; todavía falta una evaluación formal del riesgo de reidentificación o enlace.
- No se realizaron todavía estudios de usabilidad, accesibilidad, aprendizaje, validez clínica o impacto sobre la confiabilidad.

## Plan de validación y mejora

### 1. Cerrar procedencia y reproducibilidad

- Mantener explícitas la edición y fecha de SNOMED CT ya registradas, el tipo de relación RF2 y la licencia aplicable.
- Completar la ficha del modelo ya identificado con revisión inmutable, tokenizer, pooling, normalización, datos de referencia y checksums del índice y los metadatos.
- Versionar parámetros, semilla, dependencias y resumen del conjunto de entrada sin publicar datos sensibles.
- Añadir pruebas de reconciliación de conteos, SCTID duplicados, valores no finitos, aristas, orientación hijo→padre y cobertura de metadatos.

### 2. Validar contenido con expertos

- Definir una muestra estratificada por categoría, frecuencia, etiqueta semántica y zona del mapa.
- Pedir a profesionales de salud y terminología, en evaluación ciega e independiente, que califiquen término, jerarquía y relevancia clínica de vecinos.
- Separar error terminológico, diferencia de granularidad, sinonimia, relación clínica no jerárquica y vecino irrelevante.
- Adjudicar desacuerdos y publicar protocolo, número de evaluadores, intervalos de confianza y ejemplos no sensibles.

### 3. Medir confiabilidad de la anotación

- Confirmar qué casos fueron anotados independientemente por más de una persona y usar solo esas unidades comparables.
- Informar acuerdo exacto por SCTID y por cada atributo, además de una medida corregida por azar apropiada al diseño.
- Evaluar una medida semántica sensible a distancia jerárquica, como el α de Krippendorff semántico, junto con el resultado nominal; no sustituir uno por otro.
- Analizar desacuerdo por categoría, experiencia, navegador y granularidad, sin usar el resultado para ranking punitivo de personas.

### 4. Comparar visualizaciones

- Comparar PCA y t-SNE con UMAP, PaCMAP y una representación de Poincaré bajo semillas y parámetros predefinidos.
- Medir preservación de vecinos, *trustworthiness*, continuidad, estabilidad entre corridas, correlación de distancias y recuperación de relaciones jerárquicas.
- Evaluar por separado similitud terminológica y jerarquía: un único plano no tiene por qué optimizar ambas.
- Probar vistas jerárquicas inspiradas en visualización de conjuntos, TermViz y WINS, con control de saturación y ancestros comunes.
- Seleccionar métodos por criterios previos y tareas de usuario, no por estética.

### 5. Validar utilidad educativa y usabilidad

- Definir tareas observables: localizar un concepto, distinguir padre de vecino, explicar una puntuación y detectar una interpretación incorrecta.
- Realizar pruebas con profesionales de distinto nivel de experiencia y medir exactitud, tiempo, confianza, carga percibida y errores de interpretación.
- Comparar una actividad guiada con el mapa frente a una referencia adecuada, con evaluación previa y posterior cuando corresponda.
- Verificar accesibilidad por teclado, lector de pantalla, contraste y alternativas al color.
- Publicar resultados negativos o mixtos y revisar textos, controles y ejemplos antes de ampliar el uso.

### 6. Reforzar privacidad antes de cada publicación

- Aplicar una evaluación de riesgo específica al lote y una política de celdas pequeñas.
- Revisar combinaciones raras de concepto y atributos, no solo identificadores directos.
- Mantener los contextos únicamente en entornos autorizados y auditar que no entren al artefacto estático.
- Documentar responsable, fecha de revisión, versión publicada y procedimiento de retiro.


