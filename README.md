# Coongro Plugin Registry

Catálogo centralizado de plugins disponibles para la plataforma Coongro.

## Propósito

Este repositorio mantiene un registro actualizado de todos los plugins publicados, permitiendo:

1. **Claude Web** (Plugin Spec Generator) conocer el ecosistema para diseñar nuevos plugins
2. **Desarrolladores** descubrir plugins existentes y sus capacidades
3. **Automatización** de dependencias y compatibilidad

## Archivos principales

| Archivo | Descripción |
|---------|-------------|
| `plugins-catalog.yaml` | Catálogo completo de plugins con metadata, entidades, vistas y repositorios |
| `plugins-list.yaml` | Lista de repos de plugins a escanear |

## Estructura del catálogo

Cada plugin en `plugins-catalog.yaml` incluye:

```yaml
- id: "plugin-id"
  name: "@coongro/plugin-id"
  version: "1.0.0"
  repo: "Coongro/plugin-repo"
  description: "Descripción del plugin"
  type: "standalone | kit"

  entities:
    - name: "entity-name"
      table: "module_plugin_entities"
      fields: [field1, field2, ...]

  views:
    - id: "plugin.view.open"
      title: "Título"
      type: "list | detail | form | dashboard | calendar"
      acceptsContributions: true
      slots: [sections, actions]

  repositories:
    - prefix: "plugin.entities"
      methods: [list, getById, create, update, delete]

  dependencies: ["@coongro/other-plugin"]

  settings:
    - key: "plugin.setting"
      type: "boolean | string | number | enum"
```

## Actualización automática

El catálogo se actualiza automáticamente cuando:

1. **Un plugin dispara el workflow** via `repository_dispatch`
2. **Manualmente** via `workflow_dispatch`
3. **Diariamente** via cron (backup)

### Configurar un nuevo plugin

Agregar este workflow en el repo del plugin (`.github/workflows/on-publish.yml`):

```yaml
name: Publish & Update Registry

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-and-notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Build & Publish
        run: |
          npm ci
          npm run build
          npm publish

      - name: Trigger Registry Update
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.REGISTRY_PAT }}
          repository: Coongro/pluggin-registry
          event-type: plugin-updated
          client-payload: '{"plugin_repo": "${{ github.repository }}"}'
```

### Secreto requerido

Cada repo de plugin necesita el secreto `REGISTRY_PAT` con un Personal Access Token que tenga permisos de escritura en este repo.

## Uso por Claude Web

Claude Web lee `plugins-catalog.yaml` para:

- Identificar plugins existentes que pueden reutilizarse
- Detectar entidades disponibles para referencias (`ref`)
- Conocer vistas que aceptan contributions
- Entender el grafo de dependencias
- Evitar duplicar funcionalidad existente
