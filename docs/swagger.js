import path from "path";
import { fileURLToPath } from "url";
import YAML from "yamljs";

// ---------------------------------------------------------------------------
// Path setup
// ---------------------------------------------------------------------------

// Resolve the docs directory relative to this file.
// Adjust "../../docs" if your folder layout differs.
const docsDir = path.resolve(process.cwd(), "docs");

// ---------------------------------------------------------------------------
// Base document — the skeleton that every module merges into.
// ---------------------------------------------------------------------------
const baseDoc = {
  openapi: "3.0.3",
  info: {
    title: "MarketIQ API",
    version: "1.0.0",
    description: "Combined API documentation for all MarketIQ modules.",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "Auth", description: "Authentication & sessions" },
    { name: "Locations", description: "Countries, states, LGAs, cities" },
  ],
  paths: {},
  components: {
    schemas: {},
    responses: {},
    parameters: {},
    securitySchemes: {},
  },
};

// ---------------------------------------------------------------------------
// Module files to merge, in load order.
// Later files override earlier ones on key collisions.
// ---------------------------------------------------------------------------
const MODULES = [
  "common.openapi.yaml",    // optional — shared components
  "location.openapi.yaml",
  "auth.openapi.yaml",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clone the base document so repeated calls to buildSwaggerDocument()
 * never mutate shared state.
 */
function createEmptyDoc() {
  return {
    ...baseDoc,
    info: { ...baseDoc.info },
    servers: baseDoc.servers.map((s) => ({ ...s })),
    tags: baseDoc.tags.map((t) => ({ ...t })),
    paths: {},
    components: {
      schemas: {},
      responses: {},
      parameters: {},
      securitySchemes: {},
    },
  };
}

/**
 * Load a YAML file from the docs directory.
 * Returns null if the file is missing or unparseable, with a log message.
 *
 * @param {string} file - Filename (e.g. "auth.openapi.yaml")
 * @returns {object|null}
 */
function loadModule(file) {
  const fullPath = path.join(docsDir, file);

  try {
    const doc = YAML.load(fullPath);
    return { fullPath, doc };
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(`[swagger] skipped "${file}" — file not found at ${fullPath}`);
    } else {
      console.error(`[swagger] failed to parse "${file}":`, err.message);
    }
    return null;
  }
}

/**
 * Merge one module document into the target.
 * Returns a small summary object for logging.
 */
function mergeModule(target, doc) {
  const pathCount = Object.keys(doc.paths || {}).length;
  const schemaCount = Object.keys(doc.components?.schemas || {}).length;

  // Merge paths
  Object.assign(target.paths, doc.paths || {});

  // Merge components (only for known buckets)
  if (doc.components) {
    for (const key of Object.keys(target.components)) {
      Object.assign(target.components[key], doc.components[key] || {});
    }
  }

  // Merge tags (dedupe by name)
  for (const tag of doc.tags || []) {
    if (!target.tags.find((t) => t.name === tag.name)) {
      target.tags.push(tag);
    }
  }

  return { pathCount, schemaCount };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the merged OpenAPI document from all module YAML files.
 * @returns {Promise<object>}
 */
export async function buildSwaggerDocument() {
  console.log("[swagger] building combined OpenAPI document");
  console.log("[swagger] docs directory:", docsDir);

  const merged = createEmptyDoc();

  for (const file of MODULES) {
    const loaded = loadModule(file);
    if (!loaded) continue;

    const { doc } = loaded;
    const { pathCount, schemaCount } = mergeModule(merged, doc);

    console.log(
      `[swagger] merged "${file}" — ${pathCount} paths, ${schemaCount} schemas`,
    );
  }

  const totalPaths = Object.keys(merged.paths).length;
  const totalSchemas = Object.keys(merged.components.schemas).length;
  const totalResponses = Object.keys(merged.components.responses).length;
  const totalSecuritySchemes = Object.keys(merged.components.securitySchemes).length;

  console.log(
    `[swagger] done — ${totalPaths} paths, ${totalSchemas} schemas, ` +
      `${totalResponses} shared responses, ${totalSecuritySchemes} security schemes`,
  );

  if (totalPaths === 0) {
    console.warn(
      "[swagger] WARNING: no paths were merged. " +
        "Check that your YAML files exist and contain a top-level `paths:` key.",
    );
  }

  return merged;
}