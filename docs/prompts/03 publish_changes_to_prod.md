Existe un directorio raíz (ej. el que devuelve `ls` en la terminal del
usuario) con múltiples proyectos, entre ellos posibles candidatos a
reestructurar: `amatista-app`, `ambar-app`, `phantom` (carpeta real
puede llamarse `spectre`), `moon-gem-app`, y otros que NO deben tocarse
(`citrino-app`, `kuarzo-app`, `kuspit-app`, `zafiro_app`, `demo`,
`caja-ahorro`, `gcp`, `scripts`, etc.).

### Instrucción
Para cada carpeta que sea un repositorio git dentro del directorio raíz:

1. Listar todas las carpetas del directorio raíz y marcar cuáles son
   repos git válidos (`git -C <carpeta> rev-parse --is-inside-work-tree`).
2. Para cada repo git, reportar en una tabla:
   - Nombre de carpeta
   - Rama actual (`git branch --show-current`)
   - ¿Tiene cambios sin commitear? (`git status --porcelain`, si hay
     salida = SUCIO)
   - ¿Tiene commits sin pushear? (`git log @{u}.. --oneline` si tiene
     upstream configurado)
   - ¿Tiene remoto configurado? (`git remote -v`)
   - ¿Hay procesos corriendo asociados (revisar `.pid.*`, o puertos
     conocidos en `.env` si existen)?
3. Presentar la tabla completa al usuario ANTES de proponer ningún
   cambio. No asumir que un proyecto está listo para reestructurar solo
   porque el usuario lo mencionó.
4. Marcar explícitamente como "NO TOCAR" cualquier carpeta que no sea
   uno de los proyectos objetivo, aunque esté en el mismo nivel del
   filesystem.
5. Para cualquier repo marcado como SUCIO (cambios sin commitear o sin
   pushear), detenerse y preguntar al usuario cómo proceder:
   - Opción A: commitear/pushear esos cambios primero.
   - Opción B: descartar cambios (requiere confirmación explícita,
     nunca asumir).
   - Opción C: excluir ese proyecto de la reestructuración por ahora.

No avanzar a la Parte 2 para ningún proyecto que no haya quedado
explícitamente confirmado como limpio por el usuario.

---

## PARTE 2 — Reestructuración a dev/prod (por proyecto, parametrizado)

Variables a definir antes de ejecutar (pedir al usuario si falta alguna):

- `PROJECT_DIR` → nombre real de la carpeta actual (ej. `ambar-app`,
  `spectre` para phantom)
- `PROJECT_NAME` → nombre corto usado en scripts/puertos (ej. `ambar`)
- `MAIN_BRANCH` → rama principal detectada (`main` o `master`)
- `PORT_DEV`, `PORT_PROD` → tomar del archivo central de referencia de
  puertos si existe (ej. `~/.orbital-ports.yaml`); si no existe,
  preguntar al usuario, nunca inventar valores.

### Estructura ANTES
```
<raiz>/
└── <PROJECT_DIR>/         (repo git normal, una sola rama activa)
```

### Estructura DESPUÉS
```
<raiz>/
└── apps/
    ├── <PROJECT_NAME>.git/              (repo bare, no se edita directo)
    ├── dev/
    │   └── <PROJECT_NAME>-dev/           (worktree, rama MAIN_BRANCH, PORT_DEV)
    └── prod/
        └── <PROJECT_NAME>-prod/           (worktree, rama prod, PORT_PROD)
```

### Pasos

1. Confirmar (otra vez, puntual) que `git -C <raiz>/<PROJECT_DIR> status
   --porcelain` no devuelve nada. Si devuelve algo, detenerse — no
   confiar solo en el resultado de la Parte 1 si pasó tiempo entre
   auditoría y ejecución.
2. Detener procesos activos del proyecto (script propio `stop` si
   existe, o matar por `.pid.*`).
3. Clonar como bare:
   ```
   git clone --bare <raiz>/<PROJECT_DIR> <raiz>/apps/<PROJECT_NAME>.git
   ```
4. Crear carpetas contenedoras:
   ```
   mkdir -p <raiz>/apps/dev <raiz>/apps/prod
   ```
5. Crear worktree de dev:
   ```
   git --git-dir=<raiz>/apps/<PROJECT_NAME>.git worktree add \
     <raiz>/apps/dev/<PROJECT_NAME>-dev <MAIN_BRANCH>
   ```
6. Crear rama y worktree de prod:
   ```
   git --git-dir=<raiz>/apps/<PROJECT_NAME>.git branch prod <MAIN_BRANCH>
   git --git-dir=<raiz>/apps/<PROJECT_NAME>.git worktree add \
     <raiz>/apps/prod/<PROJECT_NAME>-prod prod
   ```
7. Copiar manualmente archivos no versionados (`.env`, etc.) a cada
   worktree, ajustando `PORT` y `NODE_ENV` según corresponda
   (development en dev, production en prod).
8. Instalar dependencias en ambos worktrees (`npm install`).
9. Levantar ambos worktrees en sus puertos y confirmar que responden
   antes de continuar.
10. Preguntar explícitamente al usuario si se puede borrar
    `<raiz>/<PROJECT_DIR>` (el original). No borrar automáticamente.

### Reglas de seguridad (aplican siempre)

- Nunca sobreescribir una carpeta destino que ya exista.
- Nunca hacer push o merge sin instrucción explícita del usuario.
- Nunca tocar ningún proyecto fuera de la lista objetivo, aunque esté
  en el mismo directorio raíz.
- Si el proceso falla a mitad de camino, reportar exactamente en qué
  paso se detuvo y dejar el estado intermedio documentado — no intentar
  "arreglar" automáticamente ni revertir sin confirmación.
- Repetir la Parte 2 una vez por proyecto — no asumir que lo que aplica
  a uno aplica igual a otro sin volver a leer sus variables
  (`PROJECT_DIR`, puertos, nombre de rama principal).

### Resultado esperado por proyecto

- `apps/dev/<PROJECT_NAME>-dev` — checkout de la rama principal, corre
  en `PORT_DEV`, se le puede hacer commit/push libremente.
- `apps/prod/<PROJECT_NAME>-prod` — checkout de la rama `prod`, corre en
  `PORT_PROD`, solo se actualiza vía merge/pull intencional desde la
  rama principal.
- Ambos comparten el mismo historial de git (mismo repo bare de fondo).