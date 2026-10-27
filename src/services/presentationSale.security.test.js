import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261027000001_presentation_sale_creator.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('creador en registrar_venta_presentaciones', () => {
  it('no exige que el creador sea la sesión actual antes de la idempotencia', () => {
    const sql = readMigration();

    expect(sql).not.toContain('El vendedor de la venta no coincide con la sesión.');
    expect(sql).not.toMatch(/p_created_by\s*<>\s*auth\.uid\(\)/);
  });

  it('valida al creador después de resolver la idempotencia', () => {
    const sql = readMigration();
    const idempotencyAt = sql.indexOf('select business_id into v_existing_business_id');
    const lockAt = sql.indexOf('pg_advisory_xact_lock');
    const createdByAt = sql.indexOf('v_created_by := coalesce(p_created_by, auth.uid())');
    const creatorCheckAt = sql.indexOf('v_creator.business_id is distinct from p_business_id');

    expect(lockAt).toBeGreaterThan(-1);
    expect(idempotencyAt).toBeGreaterThan(lockAt);
    expect(createdByAt).toBeGreaterThan(idempotencyAt);
    expect(creatorCheckAt).toBeGreaterThan(createdByAt);
  });

  it('permite al mismo negocio y atribuye a la sesión si el perfil ya no existe', () => {
    const sql = readMigration();

    expect(sql).toContain('v_created_by := auth.uid();');
    expect(sql).toContain('El vendedor de la venta no pertenece a este negocio.');
    expect(sql).toContain('v_created_by, p_branch_id');
  });

  it('mantiene el aislamiento por negocio y cierra el acceso anónimo', () => {
    const sql = readMigration();

    expect(sql).toContain('El usuario no pertenece a este negocio.');
    expect(sql).toContain('El id de venta ya pertenece a otro negocio.');
    expect(sql).toContain('El producto no pertenece a este negocio.');
    expect(sql).toMatch(/revoke all on function public\.registrar_venta_presentaciones\([^)]+\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.registrar_venta_presentaciones\([^)]+\) to authenticated;/);
  });
});
