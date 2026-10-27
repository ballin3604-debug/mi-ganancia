const SUPABASE_HOST_SUFFIX = '.supabase.co';
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const KNOWN_ENVIRONMENTS = ['production', 'staging', 'test'];

export function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function projectRefFromUrl(url) {
  const value = cleanEnvValue(url);
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith(SUPABASE_HOST_SUFFIX)) return null;

    const ref = hostname.slice(0, -SUPABASE_HOST_SUFFIX.length);
    return ref || null;
  } catch {
    return null;
  }
}

export function isStagingEnvironment(mode, appEnv) {
  return cleanEnvValue(mode).toLowerCase() === 'staging'
    || cleanEnvValue(appEnv).toLowerCase() === 'staging';
}

function isValidAnonKey(value) {
  const key = cleanEnvValue(value);
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;

  const segments = key.split('.');
  if (segments.length !== 3 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    return false;
  }

  try {
    const payload = segments[1].replaceAll('-', '+').replaceAll('_', '/');
    const paddedPayload = payload.padEnd(payload.length + ((4 - payload.length % 4) % 4), '=');
    const binary = globalThis.atob(paddedPayload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)).role === 'anon';
  } catch {
    return false;
  }
}

// Reglas puras para poder probarlas sin cargar import.meta.env ni crear un
// cliente de Supabase. environment.js las aplica al arrancar la app.
export function validateEnvironment({
  mode,
  appEnv,
  url,
  anonKey,
  expectedRef,
  productionRef,
}) {
  const buildMode = cleanEnvValue(mode).toLowerCase();
  const declaredEnv = cleanEnvValue(appEnv).toLowerCase();
  const expected = cleanEnvValue(expectedRef).toLowerCase();
  const production = cleanEnvValue(productionRef).toLowerCase();
  const isStaging = isStagingEnvironment(buildMode, declaredEnv);
  const names = isStaging
    ? {
        url: 'VITE_STAGING_SUPABASE_URL',
        key: 'VITE_STAGING_SUPABASE_ANON_KEY',
        ref: 'VITE_STAGING_SUPABASE_PROJECT_REF',
      }
    : {
        url: 'VITE_SUPABASE_URL',
        key: 'VITE_SUPABASE_ANON_KEY',
        ref: 'VITE_SUPABASE_PROJECT_REF',
      };
  const errors = [];

  if (declaredEnv && !KNOWN_ENVIRONMENTS.includes(declaredEnv)) {
    errors.push('VITE_APP_ENV inválido. Usa "production", "staging" o "test".');
  }

  if (buildMode === 'production' && declaredEnv && declaredEnv !== 'production') {
    errors.push('VITE_APP_ENV debe estar vacío o ser "production" en un build de producción.');
  }

  if (declaredEnv === 'staging' && buildMode !== 'staging') {
    errors.push('VITE_APP_ENV contradice el modo de Vite; selecciona el modo staging.');
  }

  if (buildMode === 'staging' && declaredEnv && declaredEnv !== 'staging') {
    errors.push('El modo staging de Vite contradice VITE_APP_ENV.');
  }

  const value = cleanEnvValue(url);
  const projectRef = projectRefFromUrl(value);

  if (projectRef && !PROJECT_REF_PATTERN.test(projectRef)) {
    errors.push('La URL de Supabase no contiene un ref de proyecto válido.');
  }

  if (expected) {
    if (!value) {
      errors.push(`${names.ref} está definido, pero ${names.url} está vacío.`);
    } else if (!projectRef) {
      errors.push(`${names.ref} está definido, pero ${names.url} no es una URL estándar de Supabase.`);
    } else if (projectRef !== expected) {
      errors.push('El proyecto Supabase no coincide con la referencia configurada.');
    }
  } else if (isStaging) {
    errors.push(`Falta ${names.ref}. En staging es obligatorio para verificar el proyecto.`);
  }

  if (isStaging) {
    if (!production) {
      errors.push('Falta VITE_PRODUCTION_SUPABASE_PROJECT_REF. En staging es obligatorio para demostrar que no apunta a producción.');
    } else if (!PROJECT_REF_PATTERN.test(production)) {
      errors.push('VITE_PRODUCTION_SUPABASE_PROJECT_REF no tiene formato de ref de Supabase.');
    } else if (projectRef && projectRef === production) {
      errors.push('El proyecto Supabase de staging es el mismo que el de producción. Se aborta.');
    }

    if (!value) {
      errors.push(`Falta ${names.url} para staging.`);
    }

    if (!cleanEnvValue(anonKey)) {
      errors.push(`Falta ${names.key} para staging.`);
    }
  } else if (buildMode === 'production') {
    if (!value) {
      errors.push(`Falta ${names.url}.`);
    } else if (!projectRef || !PROJECT_REF_PATTERN.test(projectRef)) {
      errors.push(`${names.url} no es una URL HTTPS válida de Supabase.`);
    }

    if (!cleanEnvValue(anonKey)) {
      errors.push(`Falta ${names.key}.`);
    } else if (!isValidAnonKey(anonKey)) {
      errors.push(`${names.key} no tiene un formato público anon válido.`);
    }
  }

  return {
    isStaging,
    projectRef,
    errors,
    error: errors.join(' '),
  };
}

export function validateBuildEnvironment({ mode, env = {} }) {
  const buildMode = cleanEnvValue(mode).toLowerCase();
  const isStaging = isStagingEnvironment(buildMode, env.VITE_APP_ENV);

  if (buildMode === 'production') {
    return validateEnvironment({
      mode: buildMode,
      appEnv: env.VITE_APP_ENV,
      url: env.VITE_SUPABASE_URL,
      anonKey: env.VITE_SUPABASE_ANON_KEY,
      expectedRef: env.VITE_SUPABASE_PROJECT_REF,
    });
  }

  if (!isStaging) {
    return {
      isStaging: false,
      projectRef: null,
      errors: [],
      error: '',
    };
  }

  const validation = validateEnvironment({
    mode,
    appEnv: env.VITE_APP_ENV,
    url: env.VITE_STAGING_SUPABASE_URL,
    anonKey: env.VITE_STAGING_SUPABASE_ANON_KEY,
    expectedRef: env.VITE_STAGING_SUPABASE_PROJECT_REF,
    productionRef: env.VITE_PRODUCTION_SUPABASE_PROJECT_REF,
  });
  const errors = [...validation.errors];

  if (!cleanEnvValue(env.VITE_STAGING_SUPABASE_URL) && cleanEnvValue(env.VITE_SUPABASE_URL)) {
    errors.push('En staging se ignora VITE_SUPABASE_URL; define VITE_STAGING_SUPABASE_URL.');
  }

  if (!cleanEnvValue(env.VITE_STAGING_SUPABASE_ANON_KEY) && cleanEnvValue(env.VITE_SUPABASE_ANON_KEY)) {
    errors.push('En staging se ignora VITE_SUPABASE_ANON_KEY; define VITE_STAGING_SUPABASE_ANON_KEY.');
  }

  if (!cleanEnvValue(env.VITE_STAGING_SUPABASE_PROJECT_REF) && cleanEnvValue(env.VITE_SUPABASE_PROJECT_REF)) {
    errors.push('En staging se ignora VITE_SUPABASE_PROJECT_REF; define VITE_STAGING_SUPABASE_PROJECT_REF.');
  }

  const productionAdmin = cleanEnvValue(env.VITE_ADMIN_UID).toLowerCase();
  const stagingAdmin = cleanEnvValue(env.VITE_STAGING_ADMIN_UID).toLowerCase();
  if (productionAdmin && stagingAdmin && productionAdmin === stagingAdmin) {
    errors.push('VITE_STAGING_ADMIN_UID no puede ser igual a VITE_ADMIN_UID.');
  }

  return {
    ...validation,
    errors,
    error: errors.join(' '),
  };
}

// Staging nunca hereda el administrador de producción: si no hay UID de
// staging, devuelve vacío en vez de caer al UID de producción.
export function resolveAdminUid({ isStaging, stagingAdminUid, productionAdminUid }) {
  return isStaging
    ? cleanEnvValue(stagingAdminUid)
    : cleanEnvValue(productionAdminUid);
}
