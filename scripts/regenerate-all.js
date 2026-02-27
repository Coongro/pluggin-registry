#!/usr/bin/env node

/**
 * Regenera el catálogo completo escaneando todos los repos en plugins-list.yaml
 * Uso: node scripts/regenerate-all.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

const PLUGINS_LIST_FILE = 'plugins-list.yaml';
const CATALOG_FILE = 'plugins-catalog.yaml';

async function fetchPluginInfo(repoFullName) {
  console.log(`Fetching info from ${repoFullName}...`);

  try {
    // Fetch manifest
    const manifestUrl = `https://raw.githubusercontent.com/${repoFullName}/main/coongro.manifest.json`;
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) {
      console.warn(`  Warning: Could not fetch manifest from ${repoFullName}`);
      return null;
    }
    const manifest = await manifestRes.json();

    // Fetch package.json
    const packageUrl = `https://raw.githubusercontent.com/${repoFullName}/main/package.json`;
    const packageRes = await fetch(packageUrl);
    if (!packageRes.ok) {
      console.warn(`  Warning: Could not fetch package.json from ${repoFullName}`);
      return null;
    }
    const pkg = await packageRes.json();

    return { manifest, pkg, repo: repoFullName };
  } catch (error) {
    console.warn(`  Error fetching ${repoFullName}: ${error.message}`);
    return null;
  }
}

function transformToPluginEntry(info, typeOverride) {
  const { manifest, pkg, repo } = info;

  // Determinar tipo basado en dependencias de otros plugins @coongro/*
  const deps = Object.keys(pkg.dependencies || {}).filter((d) =>
    d.startsWith('@coongro/')
  );
  const isKit =
    typeOverride === 'kit' ||
    (deps.length > 0 && manifest.contributes?.repositories?.length === 0);

  const entry = {
    id: manifest.id,
    name: pkg.name,
    version: manifest.version,
    repo: repo,
    description: pkg.description || '',
    type: isKit ? 'kit' : 'standalone',
    color: manifest.contributes?.menus?.[0]?.color || '#3B82F6',
    entities: [], // Se llenaría con info del schema si estuviera disponible
    views: (manifest.contributes?.views || []).map((v) => ({
      id: v.id,
      title: v.title,
      type: inferViewType(v.id),
      acceptsContributions: true,
      slots: ['sections', 'actions'],
    })),
    repositories: (manifest.contributes?.repositories || []).map((r) => ({
      prefix: r.prefix,
      methods: ['list', 'getById', 'create', 'update', 'delete'],
    })),
    dependencies: deps,
    settings: [],
  };

  return entry;
}

function inferViewType(viewId) {
  if (viewId.includes('dashboard')) return 'dashboard';
  if (viewId.includes('calendar') || viewId.includes('calendario')) return 'calendar';
  if (viewId.includes('detail')) return 'detail';
  if (viewId.includes('form')) return 'form';
  return 'list';
}

async function main() {
  try {
    // Read plugins list
    const listContent = readFileSync(PLUGINS_LIST_FILE, 'utf-8');
    const pluginsList = parse(listContent);

    if (!pluginsList.repos || pluginsList.repos.length === 0) {
      console.log('No repos configured in plugins-list.yaml');
      return;
    }

    console.log(`Found ${pluginsList.repos.length} repos to scan\n`);

    // Fetch all plugins
    const plugins = [];

    for (const repoConfig of pluginsList.repos) {
      const info = await fetchPluginInfo(repoConfig.repo);
      if (info) {
        const entry = transformToPluginEntry(info, repoConfig.type);
        plugins.push(entry);
        console.log(`  Added: ${entry.id} v${entry.version}\n`);
      }
    }

    // Read existing catalog to preserve manually-added entries
    let existingCatalog = { version: '1.0.0', plugins: [] };
    try {
      const existingContent = readFileSync(CATALOG_FILE, 'utf-8');
      existingCatalog = parse(existingContent);
    } catch {
      console.log('No existing catalog found, creating new one');
    }

    // Preserve entries with repo: null (manually maintained)
    const manualEntries = existingCatalog.plugins.filter((p) => p.repo === null);

    // Merge: scanned plugins + manual entries (avoiding duplicates)
    const scannedIds = new Set(plugins.map((p) => p.id));
    const finalPlugins = [
      ...plugins,
      ...manualEntries.filter((p) => !scannedIds.has(p.id)),
    ];

    // Create new catalog
    const catalog = {
      version: existingCatalog.version || '1.0.0',
      lastUpdated: new Date().toISOString(),
      plugins: finalPlugins,
    };

    // Write catalog
    const header = `# Coongro Plugin Registry
# Catálogo centralizado de plugins disponibles
# Última actualización: ${catalog.lastUpdated}

`;
    writeFileSync(CATALOG_FILE, header + stringify(catalog, { lineWidth: 120 }));

    console.log(`\nCatalog regenerated with ${finalPlugins.length} plugins`);
  } catch (error) {
    console.error('Error regenerating catalog:', error.message);
    process.exit(1);
  }
}

main();
