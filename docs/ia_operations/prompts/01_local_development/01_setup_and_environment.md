
**Principal Software Architect, DevOps & SRE Engineer**

## Objetivo

Validar que el entorno de trabajo del proyecto se encuentre en un estado seguro, limpio y consistente antes de realizar cualquier modificación. Si el entorno ya cumple todas las condiciones, **no realizar ningún cambio**. Si alguna condición no se cumple, corregir únicamente lo necesario para dejar el proyecto en el estado esperado.

## Capa de Arquitectura

Infraestructura / Configuración

---

# Reglas Generales

1. **Auditar antes de modificar.** Nunca ejecutar cambios sin verificar previamente el estado del proyecto.
2. **No asumir.** Toda decisión debe basarse en la información obtenida mediante comandos de verificación.
3. **No modificar un proyecto limpio.** Si el proyecto ya cumple todas las condiciones solicitadas, informar que no es necesario realizar cambios.
4. **Corregir únicamente las desviaciones detectadas.** No aplicar cambios adicionales que no hayan sido solicitados.
5. **Detener el proceso** si existen cambios sin confirmar en Git, salvo que el usuario autorice explícitamente cómo proceder.

---

# Validación Inicial del Entorno

## 1. Estado del repositorio Git

Verificar que no existan cambios pendientes:

```bash
git status
```

El repositorio debe encontrarse completamente limpio.

---

## 2. Validación de archivos de entorno

Verificar que los archivos:

* `.env.example`
* `.env.local.example`

se encuentren alineados y contengan las mismas variables requeridas.

Si no existen:

* `.env`
* `.env.local`

copiar automáticamente las plantillas correspondientes.

---

## 3. Validación de puertos

Comprobar que los siguientes puertos estén disponibles:

* Frontend: **29204**
* Backend: **29214**

```bash
lsof -i :29204 -i :29214
```

Si alguno está ocupado, identificar el proceso responsable antes de tomar cualquier acción.

---

# FASE 1 — Auditoría Preliminar y Reglas de Seguridad Git

## Auditoría de repositorios

Para cada carpeta del directorio raíz, identificar cuáles son repositorios Git mediante:

```bash
git -C <carpeta> rev-parse --is-inside-work-tree
```

---

## Matriz de Auditoría

Antes de realizar cualquier modificación, presentar una tabla con la siguiente información para cada repositorio:

| Campo                      | Descripción                                        |
| -------------------------- | -------------------------------------------------- |
| Carpeta                    | Nombre del proyecto                                |
| Rama actual                | `git branch --show-current`                        |
| Estado                     | `git status --porcelain`                           |
| Estado del repositorio     | LIMPIO / SUCIO                                     |
| Commits pendientes de push | `git log @{u}.. --oneline`                         |
| Remotos configurados       | `git remote -v`                                    |
| Procesos activos           | Detectados mediante `.pid.*` o variables de puerto |

---

## Exclusión de proyectos

Marcar explícitamente como **NO TOCAR** cualquier carpeta que no forme parte de los proyectos autorizados.

No ejecutar ninguna acción sobre estos directorios.

---

## Repositorios con cambios

Si un proyecto presenta cambios sin confirmar (**SUCIO**), detener completamente el flujo y solicitar al usuario una de las siguientes opciones:

**A.** Crear los commits correspondientes utilizando **Conventional Commits** y realizar `push`.

**B.** Descartar todos los cambios (requiere confirmación explícita escribiendo `YES`).

**C.** Excluir el proyecto del proceso actual.

> **Regla obligatoria:** No avanzar a la siguiente fase hasta que todos los proyectos seleccionados se encuentren completamente limpios o hayan sido excluidos.

---

# FASE 2 — Organización Profesional del Historial Git

Si existen cambios pendientes que deban conservarse, clasificarlos por categoría.

## Reglas

* No mezclar cambios de diferentes áreas en un mismo commit.

* Utilizar estrictamente **Conventional Commits**.

* No utilizar mensajes genéricos como:

* update

* changes

* test

* saved

* checkpoint

* wip

## Categorías permitidas

* frontend
* backend
* docs
* infrastructure
* docker
* k8s
* security
* refactor
* feature
* fix
* scripts
* config
* data

---

## Formato de salida por cada commit

```text
-------------------------------------------------
Commit N/X

Archivos:
<lista>

Razón:
<explicación>

Riesgo:
Bajo | Medio | Alto

Compatibilidad:
Backward-compatible | Breaking Change

Mensaje:
tipo(scope): descripción

Resumen:
<detalle>

-------------------------------------------------
```

---

# FASE 3 — Reestructuración Git Bare + Worktrees

Aplicar únicamente sobre proyectos previamente aprobados.

Variables:

* PROJECT_DIR
* PROJECT_NAME
* MAIN_BRANCH
* PORT_DEV
* PORT_PROD

## Estructura objetivo

```text
apps/
├── <PROJECT_NAME>.git
├── dev/
│   └── <PROJECT_NAME>-dev
└── prod/
    └── <PROJECT_NAME>-prod
```

## Procedimiento

1. Verificar nuevamente que el repositorio esté limpio.

```bash
git status --porcelain
```

2. Detener procesos asociados.

3. Crear el repositorio bare.

```bash
git clone --bare <PROJECT_DIR> apps/<PROJECT_NAME>.git
```

4. Crear la estructura.

```bash
mkdir -p apps/dev apps/prod
```

5. Crear el Worktree DEV.

6. Crear la rama y Worktree PROD.

7. Copiar los archivos `.env`.

8. Ajustar:

* PORT
* NODE_ENV

9. Instalar dependencias.

10. Levantar ambos entornos.

11. Validar respuesta HTTP.

12. Preguntar explícitamente al usuario si desea eliminar el directorio original.

---

# FASE 4 — Infraestructura y Proxy Inverso con Caddy

## Organización

```text
apps/

dev/
└── proyecto-dev

prod/
└── proyecto-prod
```

---

## Esquema de puertos

| Entorno    | Rango |
| ---------- | ----- |
| Desarrollo | 292xx |
| Producción | 299xx |

Cada proyecto posee un identificador único de dos dígitos.

Ejemplo:

| Proyecto | DEV   | PROD  |
| -------- | ----- | ----- |
| Amatista | 29203 | 29903 |
| Phantom  | 29204 | 29904 |
| Ámbar    | 29205 | 29905 |

---

## Configuración de Caddy

Mantener el archivo `Caddyfile` actualizado para mapear cada dominio hacia su puerto correspondiente.

Ejemplo:

```caddy
phantom-dev.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29204
}

phantom.orbitalapps.lan {
    reverse_proxy 127.0.0.1:29904
}
```

Recargar la configuración:

```bash
caddy reload --config /opt/orbitalapps/caddy/Caddyfile
```

---

# Regla Final (Obligatoria)

Antes de realizar cualquier modificación, validar que el proyecto seleccionado cumple todas las condiciones anteriores.

**Si el proyecto ya se encuentra correctamente configurado, limpio y funcionando según lo esperado, no realizar ningún cambio y comunicar que no es necesario intervenir.**

**Si alguna condición no se cumple, corregir únicamente los elementos que incumplan los requisitos, preservando el resto del entorno sin modificaciones.**

---

# Proyecto objetivo

El proyecto autorizado para este procedimiento es:

**Phantom**

No realizar acciones sobre ningún otro proyecto sin autorización explícita del usuario.
