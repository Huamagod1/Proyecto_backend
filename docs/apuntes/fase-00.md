# Fase 0 · Entorno de trabajo (Windows + Git Bash)

## Mapa
- Tu código, Node y Git corren en Windows; la terminal es Git Bash (bash sobre Windows).
- MySQL, Mosquitto y Node-RED corren en contenedores Linux, dentro de Docker Desktop (motor WSL 2).
- GitHub recibe el código por SSH, con la cuenta Huamagod1.
- El despliegue real (systemd y nginx) se hace en la Fase 13, en Ubuntu 24.04 (WSL 2 o EC2).

## Conceptos
- **Git Bash (MSYS2):** bash y las utilidades GNU compiladas para Windows.
- **WSL 1 y WSL 2:** WSL 1 traduce las llamadas de Linux a Windows y no tiene systemd; WSL 2 es un kernel Linux real en una VM liviana.
- **Docker Desktop:** corre el motor de Docker en una VM WSL 2 y lo expone a Windows por un *named pipe* (`npipe`).
- **LTS:** versión con soporte largo. Node 26 es la LTS activa desde octubre de 2026; la 24 quedó en mantenimiento.
- **CRLF y LF:** fin de línea de Windows (`\r\n`) y de Linux (`\n`). Bash falla con el `\r` sobrante.
- **Par de llaves SSH:** la privada queda en tu equipo; la pública se registra en GitHub para que te reconozca sin clave.

## Decisiones
- Windows nativo y no WSL → tu carpeta y tus herramientas ya están en Windows, y las dependencias corren en Linux igual.
- `.gitattributes` con `eol=lf` → los scripts y las configuraciones llegan con LF a los contenedores, aunque Git para Windows tenga `autocrlf=true`.
- Correo *noreply* de GitHub en este repositorio → el repositorio es público y tu correo personal no queda en el historial.
- `MSYS_NO_PATHCONV=1` → Git Bash no reescribe las rutas de Linux al llamar a `docker` o `taskkill`.

## Comandos para saber de memoria
`node -v` · `docker info` · `docker compose version` · `ssh -T git@github.com` · `git config --list --show-origin` · `wsl -l -v` · `file <archivo>` (dice si tiene CRLF)

## Preguntas de entrevista
- **¿Por qué desarrollas en Windows si el servicio corre en Linux?** El código Node es multiplataforma y las dependencias corren en contenedores Linux iguales a producción. Controlo los roces: saltos de línea con `.gitattributes`, rutas con `node:path` y señales probando el apagado en Docker y systemd.
- **¿Qué es una versión LTS y por qué la eliges?** Es la línea con parches de seguridad por unos 30 meses. En un servicio de producción prefiero estabilidad y parches a las novedades de la versión *Current*.

## Ejercicios a mano
La Fase 0 no tiene ejercicios en el plan. Dos opcionales:
1. Crea un `.sh` con CRLF en el Bloc de notas, ejecútalo en Git Bash, lee el error y arréglalo con `sed -i 's/\r$//'`.
2. Explica por escrito, en cinco líneas, qué pasa entre `docker compose up` en Git Bash y el proceso `mysqld` corriendo en Linux.
