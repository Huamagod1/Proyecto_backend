# Fase 1 · Git y esqueleto del proyecto

## Mapa
- `git init -b main` crea el repositorio; el remoto `origin` apunta a `git@github.com:Huamagod1/Proyecto_backend.git`.
- `npm init` y `npm pkg set` dejan un `package.json` de ES modules, con `engines` y el script `test`.
- `.gitignore` deja fuera los secretos y lo regenerable; `.gitattributes` fija LF; `.env.example` documenta las variables.
- Cada fase termina en un commit convencional y un tag `fase-NN`.

## Conceptos
- **Commit:** una foto del proyecto con autor, fecha y motivo. Es la intervención anotada en la bitácora.
- **Rama:** una línea de trabajo aparte; no toca `main` hasta el merge.
- **PR (pull request):** la solicitud de revisión antes de integrar una rama.
- **Merge:** integrar los commits de una rama en otra.
- **Tag:** un nombre fijo para un commit, como `fase-02` o `v1.0.0`; marca lo que se despliega.
- **ES modules:** `import` y `export` estándar; `"type": "module"` los activa en los `.js`.
- **Conventional Commits:** `tipo(alcance): resumen` (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`).

## Decisiones
- Secretos en `.env`, que Git ignora → el repositorio es público; `.env.example` lleva solo ejemplos.
- `package-lock.json` se sube → `npm ci` instala exactamente las mismas versiones en cualquier equipo.
- `"private": true` en `package.json` → impide publicar el proyecto en npm por error.
- `mosquitto/passwd` ignorado desde ya → guarda hashes de claves y el repositorio es público.

## Comandos para saber de memoria
`git status` · `git add -p` · `git commit -m "feat: ..."` · `git log --oneline --graph` · `git switch -c fase-02-mysql` · `git tag -a fase-02 -m "..."` · `git push --follow-tags` · `git check-ignore -v .env` · `npm pkg set clave=valor`

## Preguntas de entrevista
- **¿Cómo trabajas con Git en equipo?** Ramas cortas por tarea, commits pequeños que explican el porqué, PR con revisión antes de integrar, nunca secretos en el repositorio y tags en lo que se despliega, para poder volver atrás.
- **¿Qué haces si subiste un secreto por error?** Lo cambio de inmediato: queda en el historial aunque borre el archivo. Después lo saco de la historia (`git filter-repo`) y reviso quién pudo verlo.

## Ejercicios a mano
1. Crea una rama, haz un commit convencional, ábrelo como PR y ponle un tag.
2. Deshaz un commit ya subido con `git revert` y explica por qué no se usa `reset`.
