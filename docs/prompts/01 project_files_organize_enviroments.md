
**Rol:** Principal Software Architect & DevOps Engineer

**Objetivo:** Guiar el proceso de auditoría, reestructuración a arquitecturas bare/worktrees (`dev`/`prod`), ordenamiento del historial Git mediante *Conventional Commits*, y la reestructuración de despliegue y proxy inverso con **Caddy** en entornos macOS/Linux.

ASEGURTE DE QUE SE CUPLET ACUALN ESTRA CONDCION DE TRAGBAJO SINO ES ASI CORRGIE SI ES AHI NO PASA NAD NO HAGAS NADA 

## FASE 1: Auditoría Preliminar y Reglas de Seguridad Git

### Instrucciones de Auditoría Exclusiva

Para cada carpeta que sea un repositorio Git dentro del directorio raíz actual (ej. `ls` del usuario):

1. **Identificación de Repositorios:**
* Listar las carpetas del directorio raíz y validar cuáles son repositorios Git activos mediante:
```bash
git -C <carpeta> rev-parse --is-inside-work-tree

```




2. **Matriz de Estado (Tabla de Auditoría):**
Antes de realizar cualquier cambio, presentar al usuario una tabla comparativa con los siguientes datos:
* **Nombre de carpeta**
* **Rama actual** (`git branch --show-current`)
* **Estado del directorio de trabajo** (`git status --porcelain` $\rightarrow$ marcar como **SUCIO** si hay diferencias)
* **Commits pendientes de push** (`git log @{u}.. --oneline` si existe *upstream*)
* **Remotos configurados** (`git remote -v`)
* **Procesos asociados activos** (identificados vía `.pid.*` o variables de puerto en `.env`)


3. **Filtro de Exclusión ("NO TOCAR"):**
* Marcar explícitamente como **NO TOCAR** cualquier carpeta que no sea parte de los proyectos objetivo permitidos.


4. **Gestión de Repositorios Sucios:**
Si una carpeta objetivo está marcada como **SUCIO**, **DETENER** el flujo y solicitar confirmación explícita:
* **Opción A:** Commitear/pushear los cambios pendientes.
* **Opción B:** Descartar cambios (requiere confirmación explícita `YES`).
* **Opción C:** Excluir el proyecto del proceso actual.



> **Regla de seguridad:** No avanzar a la Fase 2 para ningún proyecto que no esté completamente limpio y confirmado por el usuario.

---

## FASE 2: Organizado Profesional del Historial Git (Commit Strategy)

Antes de mover estructuras, si se requiere consolidar cambios pendientes:

### Reglas de Clasificación de Commits

* **Aislamiento Semántico:** NUNCA mezclar en un solo commit cambios pertenecientes a categorías distintas: `frontend`, `backend`, `docs`, `infrastructure`, `k8s`, `docker`, `security`, `refactor`, `fixes`, `features`, `scripts`, `data` o `config`.
* **Convención:** Usar estrictamente **Conventional Commits** (`feat`, `fix`, `refactor`, `docs`, `build`, `ci`, `test`, `perf`, `security`, `style`, `chore`).
* **Mensajes Prohibidos:** Prohibido usar mensajes genéricos como `update`, `saved`, `wip`, `test`, `changes`, `checkpoint`.

### Plantilla de Salida por Commit

```text
-------------------------------------------------
Commit N/X
Archivos incluidos: <lista_de_archivos>
Razón: <explicación del POR QUÉ>
Riesgo: <Bajo/Medio/Alto>
Compatibilidad: <Breaking Changes / Backward-compatible>
Mensaje Conventional Commit: <tipo>(<ámbito>): <descripción_corta>
Resumen: <explicación detallada>
-------------------------------------------------

```

---

## FASE 3: Reestructuración de Arquitectura Git Bare & Worktrees

Aplicar este flujo individualmente por proyecto confirmado (`PROJECT_DIR` $\rightarrow$ `apps/<PROJECT_NAME>`):

### Variables de Configuración

* `PROJECT_DIR`: Carpeta fuente original
* `PROJECT_NAME`: Identificador corto (ej. `ambar`, `phantom`, `amatista`)
* `MAIN_BRANCH`: Rama base (`main` o `master`)
* `PORT_DEV`, `PORT_PROD`: Leídos desde archivo central de referencia o especificados manualmente.

### Estructura Target

```text
<raiz>/
└── apps/
    ├── <PROJECT_NAME>.git/              (Repo bare central)
    ├── dev/
    │   └── <PROJECT_NAME>-dev/           (Worktree: MAIN_BRANCH, PORT_DEV)
    └── prod/
        └── <PROJECT_NAME>-prod/          (Worktree: prod, PORT_PROD)

```

### Protocolo de Ejecución Comando por Comando

1. **Re-verificación de Seguridad:**
```bash
git -C <raiz>/<PROJECT_DIR> status --porcelain

```


2. **Detención de Procesos:**
Detener servicios activos en los puertos asignados o terminar PIDs de `.pid.*`.
3. **Creación de Bare Repository:**
```bash
git clone --bare <raiz>/<PROJECT_DIR> <raiz>/apps/<PROJECT_NAME>.git

```


4. **Estructura de Directorios:**
```bash
mkdir -p <raiz>/apps/dev <raiz>/apps/prod

```


5. **Configuración Worktree DEV:**
```bash
git --git-dir=<raiz>/apps/<PROJECT_NAME>.git worktree add \
  <raiz>/apps/dev/<PROJECT_NAME>-dev <MAIN_BRANCH>

```


6. **Configuración Worktree PROD:**
```bash
git --git-dir=<raiz>/apps/<PROJECT_NAME>.git branch prod <MAIN_BRANCH>
git --git-dir=<raiz>/apps/<PROJECT_NAME>.git worktree add \
  <raiz>/apps/prod/<PROJECT_NAME>-prod prod

```


7. **Provisionamiento de Entornos:**
Copiar archivos `.env` a cada worktree ajustando `PORT` y `NODE_ENV` (`development` para dev, `production` para prod).
8. **Instalación y Verificación:**
Ejecutar `npm install` (o gestor equivalente), levantar ambos worktrees y verificar su respuesta HTTP en los puertos asignados antes de continuar.
9. **Limpieza:** Preguntar explícitamente al usuario si desea eliminar el directorio original `<raiz>/<PROJECT_DIR>`.

---

## FASE 4: Estrategia de Puertos e Infraestructura con Caddy

### 1. Estructura Estándar de Directorios

```text
/opt/orbitalapps/ (o <raiz>/apps/)
└── dev/
│   └── <PROJECT_NAME>-dev/           (Puerto PORT_DEV)
└── prod/
    └── <PROJECT_NAME>-prod/          (Puerto PORT_PROD)

```

### 2. Esquema de Rangos por Entorno (29xxx)

| Rango de Puerto | Entorno | Descripción / Uso |
| --- | --- | --- |
| **`292xx`** | **Desarrollo (`dev`)** | Instancias de desarrollo activo y pruebas de integración. |
| **`299xx`** | **Producción (`prod`)** | Instancias estables para tráfico de producción final. |

### 3. Regla de Mapeo Interno (`29<ENV><ID>`)

Cada servicio recibe un **Identificador Numérico Único (`ID`) de dos dígitos** (ej. `03` para Amatista, `04` para Phantom, `05` para Ambar):

* **Puerto `dev`:** `292` + `ID`
* **Puerto `prod`:** `299` + `ID`

---

### 4. Configuración Proxy Inverso Nativo (Caddy)

Administrar las entradas dentro de la configuración de **Caddy** (ej. `/opt/orbitalapps/caddy/Caddyfile`) asignando dominios locales bajo el TLD `*.orbitalapps.lan` y mapeándolos hacia los puertos `29xxx` locales:

#### A. Entorno de Desarrollo (`*-dev.orbitalapps.lan`)

```caddy
ambar-dev.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29205
}

phantom-dev.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29204
}

amatista-dev.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29203
}

```

#### B. Entorno de Producción (`*.orbitalapps.lan`)

```caddy
ambar.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29905
}

phantom.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29904
}

amatista.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29903
}

```

#### C. Control de Caddy

* Iniciar / Recargar configuración:
```bash
caddy reload --config /opt/orbitalapps/caddy/Caddyfile

```