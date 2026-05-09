import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultModelLibraryPath = path.resolve(repoRoot, "components/model-packages.v0.1.json");

const normalizeKey = (value) => String(value ?? "").trim().toUpperCase();

export const readModelPackageLibrary = (relativeOrAbsolutePath = defaultModelLibraryPath) => {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(repoRoot, relativeOrAbsolutePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
};

export const resolveModelPackage = (device, modelLibrary) => {
  if (!device.model || !modelLibrary?.models) return null;

  const wantedModel = normalizeKey(device.model);
  let modelName = null;
  let modelSpec = null;

  for (const [candidateName, candidateSpec] of Object.entries(modelLibrary.models)) {
    const aliases = candidateSpec.aliases ?? [];
    if (normalizeKey(candidateName) === wantedModel || aliases.some((alias) => normalizeKey(alias) === wantedModel)) {
      modelName = candidateName;
      modelSpec = candidateSpec;
      break;
    }
  }

  if (!modelSpec) return null;

  const packages = modelSpec.packages ?? {};
  const packageQuery = normalizeKey(device.package || modelSpec.default_package);
  let packageName = null;
  let packageSpec = null;

  for (const [candidateName, candidateSpec] of Object.entries(packages)) {
    const aliases = candidateSpec.package_aliases ?? [];
    if (normalizeKey(candidateName) === packageQuery || aliases.some((alias) => normalizeKey(alias) === packageQuery)) {
      packageName = candidateName;
      packageSpec = candidateSpec;
      break;
    }
  }

  if (!packageSpec && modelSpec.default_package) {
    packageName = modelSpec.default_package;
    packageSpec = packages[packageName];
  }

  if (!packageSpec) return { modelName, modelSpec, packageName: null, packageSpec: null };

  return { modelName, modelSpec, packageName, packageSpec };
};

export const applyModelPackageDefaults = (ir, modelLibrary) => ({
  ...ir,
  devices: (ir.devices ?? []).map((device) => {
    const resolved = resolveModelPackage(device, modelLibrary);
    if (!resolved?.packageSpec) return device;
    const componentType = device.component_type ?? resolved.modelSpec.component_type;
    const packagePinMap = componentType === resolved.modelSpec.component_type
      ? resolved.packageSpec.pin_map
      : resolved.packageSpec.unit_pin_maps?.[device.unit];

    return {
      ...device,
      component_type: componentType,
      package: device.package ?? resolved.packageName,
      pin_map: {
        ...(packagePinMap ?? {}),
        ...(device.pin_map ?? {})
      },
      internal_ties: [
        ...(resolved.packageSpec.internal_ties ?? []),
        ...(device.internal_ties ?? [])
      ]
    };
  })
});
