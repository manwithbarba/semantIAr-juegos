# SEMANTIAR Juegos

Juego educativo de calibración de semántica clínica. Presenta rondas de casos
sintéticos y pregunta por categoría, polaridad, certeza, temporalidad, sujeto
de la relación y término SNOMED CT.

La aplicación es recreativa y educativa; no constituye una herramienta clínica
ni asistencial. El progreso se guarda sólo en el almacenamiento local del
navegador.

## Uso local

```bash
npm ci
npm run dev
```

Abrir <http://localhost:3000>.

## Build

```bash
npm run lint
npm run build
```

El build es estático y se publica en GitHub Pages desde `main`. La URL del
proyecto es:

<https://manwithbarba.github.io/semantIAr-juegos/>

El dataset incluido es sintético y de demostración. Los datasets privados o
de calibración no forman parte de este repositorio.
