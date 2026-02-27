#!/usr/bin/env node

/**
 * Actualiza un plugin específico en el catálogo
 * Uso: node scripts/update-single.js Coongro/plugin-repo
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { parse, stringify } from 'yaml';

const CATALOG_FILE = 'plugins-catalog.yaml';

async function fetchPluginInfo(repoFullName) {
  const [org, repo] = repoFullName.split('/');

  console.log(`Fetching info from ${repoFullName}...`);

  // Fetch manifest
  const manifestUrl = `https://raw.githubusercontent.com/${repoFullName}/main/coongro.manifest.json`;
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) {
    throw new Error(`Could not fetch manifest from ${manifestUrl}`);
  }
  const manifest = await manifestRes.json();

  // Fetch package.json
  const packageUrl = `https://raw.githubusercontent.com/${repoFullName}/main/package.json`;
  const packageRes = await fetch(packageUrl);
  if (!packageRes.ok) {
    throw new Error(`Could not fetch package.json from ${packageUrl}`);
  }
  const pkg = await packageRes.json();

  return { manifest, pkg, repo: repoFullName };
}

function transformToPluginEntry(info) {
  const { manifest, pkg, repo } = info;

  // Determinar tipo basado en dependencias de otros plugins @coongro/*
  const deps = Object.keys(pkg.dependencies || {}).filter((d) =>
    d.startsWith('@coongro/')
  );
  const isKit = deps.length > 0 && manifest.contributes?.repositories?.length === 0;

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
    settings: [], // Se llenaría con info de settings si estuviera en el manifest
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
  const repoArg = process.argv[2];

  if (!repoArg) {
    console.error('Usage: node scripts/update-single.js Coongro/plugin-repo');
    process.exit(1);
  }

  try {
    // Fetch plugin info
    const pluginInfo = await fetchPluginInfo(repoArg);
    const newEntry = transformToPluginEntry(pluginInfo);

    // Read current catalog
    const catalogContent = readFileSync(CATALOG_FILE, 'utf-8');
    const catalog = parse(catalogContent);

    // Find and update or add plugin
    const existingIndex = catalog.plugins.findIndex((p) => p.id === newEntry.id);

    if (existingIndex >= 0) {
      console.log(`Updating existing plugin: ${newEntry.id}`);
      catalog.plugins[existingIndex] = newEntry;
    } else {
      console.log(`Adding new plugin: ${newEntry.id}`);
      catalog.plugins.push(newEntry);
    }

    // Update timestamp
    catalog.lastUpdated = new Date().toISOString();

    // Write updated catalog
    writeFileSync(CATALOG_FILE, stringify(catalog, { lineWidth: 120 }));

    console.log(`Successfully updated ${newEntry.id} in catalog`);
  } catch (error) {
    console.error('Error updating plugin:', error.message);
    process.exit(1);
  }
}

main();
