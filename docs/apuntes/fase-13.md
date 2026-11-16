# Fase 13 · Linux: despliegue como servicio

## Mapa
- La API y el gateway corren como servicios de systemd (`deploy/*.service`), con el usuario `telemetria`, rearme a los 5 s y endurecimiento.
- nginx (`deploy/nginx-telemetria.conf`) es la única entrada: `/` hacia `127.0.0.1:3000` y `/ws` con `Upgrade`.
- `desplegar.sh <tag>` clona la versión en `releases/<tag>`, cambia el enlace `actual`, reinicia y comprueba la salud; si falla, vuelve atrás.
- `respaldo.sh` hace un `mysqldump` comprimido dentro del contenedor y borra los de más de 7 días.

## Verificado en este equipo (Windows, con contenedores)
- **nginx de verdad delante de la API:** salud y dashboard por el puerto del proxy; el WebSocket con token inválido devuelve 401 desde el *upgrade* (un GET normal a `/ws` da 404); `/ws` no queda en el log.
- **Respaldo y restauración:** 8,7 MB comprimidos; restaurado en `telemetria_restore` en 27 s, con 2.426.101 lecturas, iguales a las originales, y el evento incluido.
- **Unidades de systemd** en Ubuntu 24.04: `systemd-analyze verify` sin errores; `systemd-analyze security` bajó de 8,3 (EXPOSED) a 3,0 (OK).
- **`trust proxy`:** prueba automática; detrás de nginx, el límite de logins se cuenta por la IP real.

## Falta hacerlo en un Ubuntu real (WSL 2 o EC2)
1. Preparar el Ubuntu (Fase 13, "Prepara el Ubuntu de WSL") y `setup_26.x` de NodeSource.
2. `useradd --system ... telemetria`, crear `/opt/telemetria/releases`, `/var/lib/telemetria` y `/etc/telemetria`.
3. `install -m 600 -o root deploy/api.env.example /etc/telemetria/api.env` (y `gateway.env`) y poner las claves.
4. `sudo deploy/desplegar.sh fase-13`, copiar las unidades, `daemon-reload` y `enable --now`.
5. nginx, `ufw` (primero `OpenSSH`), `crontab` del respaldo y la prueba de rearme con `systemctl kill -s KILL`.

## Conceptos
- **systemd:** el supervisor de servicios de Linux: arranca, reinicia y junta los logs en journald.
- **Unidad de servicio:** el archivo que describe el servicio (`[Unit]`, `[Service]`, `[Install]`).
- **Endurecimiento (sandboxing):** restringir lo que el proceso puede ver y hacer, aunque lo comprometan.
- **Proxy inverso:** nginx recibe al cliente y reenvía a la app; TLS, límites y logs en un solo lugar.
- **Despliegue por enlace simbólico:** cada versión en su carpeta; cambiar el enlace es atómico.

## Decisiones
- Comentarios en su propia línea → en systemd, un `#` al final de una directiva pasa a ser parte del valor.
- Sin `MemoryDenyWriteExecute` → el JIT de V8 lo necesita; el servicio no arrancaría.
- `mv -T` sobre un enlace nuevo → el cambio de versión nunca deja un instante sin `actual`.
- `access_log off` en `/ws` → el token de la URL no queda en el disco.
- `server_tokens off` → nginx no anuncia su versión.
- `CONFIAR_PROXY=1` solo detrás de nginx → con más saltos de los reales, un atacante inventaría su IP.

## Comandos para saber de memoria
`systemctl status|restart|enable --now <servicio>` · `journalctl -u telemetria-api -f` · `systemd-analyze security <servicio>` · `ss -tulpn` · `df -h` · `sudo nginx -t && sudo systemctl reload nginx` · `sudo ufw allow OpenSSH` · `crontab -e`

## Preguntas de entrevista
- **¿Cómo desplegarías y operarías este servicio en Linux?** systemd con un usuario sin privilegios, rearme automático y endurecimiento; los secretos en un archivo que solo lee root; nginx adelante con TLS y el firewall abierto solo en SSH, 80 y 443; logs en journald; respaldos programados y probados; cada versión en su carpeta para volver atrás cambiando un enlace.
- **¿Cómo sabes que un respaldo sirve?** Restaurándolo. Restauré el mío en otra base y comparé los conteos tabla por tabla.

## Ejercicios a mano
1. Escribe de memoria una unidad de systemd mínima.
2. Simula un despliegue fallido y vuelve atrás con el enlace.
