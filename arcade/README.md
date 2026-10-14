# SEMANTIAR-86

Consola educativa de SemantIAr: semántica clínica 6D, capa léxica y revisión de candidatos. Conserva las explicaciones y referencias del banco publicado; el puntaje mide coincidencias con esas referencias, no desempeño clínico validado.

## Uso

Abrir `index.html` o servir esta carpeta con `python -m http.server 8000 --bind 127.0.0.1` y visitar http://127.0.0.1:8000.

Fuente sin dependencias: `index.html`, `styles.css`, `game.js`, `scoreboard.js`. No requiere compilación.

## Celulares

- Barra inferior: Inicio, Partida, Biblioteca y Puntajes.
- Puntaje, récord y progreso visibles durante la partida.
- Opciones táctiles de al menos 44 px; una columna en pantallas pequeñas.
- Pantalla y sonido en un panel desplegable; CRT desactivado inicialmente en móvil.
- Biblioteca y resultados en fichas sin desplazamiento horizontal en móvil.
- Navegación por teclado, foco visible, estados seleccionados y avisos accesibles.

## Scoreboard

Un punto por coincidencia. La racha no multiplica puntos; las pistas no restan. La clasificación compara iguales modo, dificultad, número de casos, reloj y cantidad de pistas. Guarda hasta 200 partidas y muestra las diez mejores por reglas. Los totales históricos v3 se conservan sin inventar partidas ni mezclarlas con los récords comparables.

Todo queda en este navegador y origen. Si no se permite almacenamiento, funciona en memoria durante la sesión y lo informa. No envía resultados ni textos a un servidor.

## Pruebas y despliegue

`node tests/game.test.mjs`: 15 pruebas funcionales con DOM simulado.
Verificación manual en navegador: partida léxica completa, persistencia al recargar y navegación móvil; biblioteca a 320, 390 y 768 px, sin desborde horizontal y con botones de al menos 44 px. No sustituye pruebas en Android/iOS reales ni con lectores de pantalla.

En `main`, esta carpeta se conserva como `arcade/`. El workflow compila el explorador Next.js, ejecuta las pruebas del juego y copia los archivos de la consola a la raíz del sitio generado. El explorador mantiene su ruta propia.

Procedencia del banco: `gh-pages`, commit `df0c56f15be5d8c6ba74718007f068a86393f1bc`. Las fechas de etiquetas se retiraron; la documentación original conserva la procedencia. Se conserva `LICENSE.txt`, CC BY-SA 4.0, Proyecto SemantIAr.

