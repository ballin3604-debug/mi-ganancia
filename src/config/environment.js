import { cleanEnvValue, validateEnvironment } from './environmentRules';

const isStagingBuild = import.meta.env.MODE === 'staging';

const buildMode = cleanEnvValue(import.meta.env.MODE);
const declaredEnv = cleanEnvValue(import.meta.env.VITE_APP_ENV);

const supabaseUrl = cleanEnvValue(
  isStagingBuild
    ? import.meta.env.VITE_STAGING_SUPABASE_URL
    : import.meta.env.VITE_SUPABASE_URL
);
const supabaseAnonKey = cleanEnvValue(
  isStagingBuild
    ? import.meta.env.VITE_STAGING_SUPABASE_ANON_KEY
    : import.meta.env.VITE_SUPABASE_ANON_KEY
);
const expectedProjectRef = cleanEnvValue(
  isStagingBuild
    ? import.meta.env.VITE_STAGING_SUPABASE_PROJECT_REF
    : import.meta.env.VITE_SUPABASE_PROJECT_REF
);
const productionProjectRef = isStagingBuild
  ? cleanEnvValue(import.meta.env.VITE_PRODUCTION_SUPABASE_PROJECT_REF)
  : '';

const validation = validateEnvironment({
  mode: buildMode,
  appEnv: declaredEnv,
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  expectedRef: expectedProjectRef,
  productionRef: productionProjectRef,
});

export const BUILD_MODE = buildMode;
export const APP_ENV = validation.isStaging
  ? 'staging'
  : (declaredEnv || buildMode || 'production');
export const IS_STAGING = validation.isStaging;
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
export const SUPABASE_PROJECT_REF = validation.projectRef;
export const EXPECTED_SUPABASE_PROJECT_REF = expectedProjectRef;
export const ENVIRONMENT_ERROR = validation.error;
export const IS_SUPABASE_ENV_VALID = validation.errors.length === 0;

// En staging se ignora VITE_ADMIN_UID a propósito: así un build de staging no
// hereda el administrador de producción desde el .env base. El admin de
// staging, si existe, se declara aparte.
export const STAGING_ADMIN_UID = isStagingBuild
  ? cleanEnvValue(import.meta.env.VITE_STAGING_ADMIN_UID)
  : '';
