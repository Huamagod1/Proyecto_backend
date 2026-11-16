# Progreso

| Fecha | Fase | Qué se hizo | Dudas abiertas |
|---|---|---|---|
| 2026-11-15 | 0 | Entorno revisado: Windows 11 con Git Bash, Node 24.4.1, Docker Desktop y Git. Plan adaptado a Windows y a `Proyecto_backend`. | Pendientes tuyos: llave SSH en Huamagod1, Node 26 LTS, `jq` y `MSYS_NO_PATHCONV=1` en `~/.bashrc`. La referencia `../lab-telemetria-motores/` no está. |
| 2026-11-15 | 1 | Esqueleto: `package.json` como ES module, carpetas, `.gitignore`, `.gitattributes`, `.env.example`, `README.md`. | Practicar a mano el flujo de ramas y PR: las fases se hicieron directo en `main`. |
| 2026-11-15 | 2 | MySQL 8.4 en Docker: esquema, datos iniciales, `telemetria_app` con permisos mínimos (clave desde `.env`), cinco consultas y `EXPLAIN` con `range` sobre la PK. | Por qué la consulta con JOIN por código hace `filesort` y la con id no. |
