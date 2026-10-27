import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261027000000_registrar_venta_security.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('seguridad de registrar_venta', () => {
  it('exige sesión y pertenencia real al negocio antes de operar', () => {
    const sql = readMigration();

    expect(sql).toContain('if auth.uid() is null then');
    expect(sql).toMatch(/from public\.profiles\s+where id = auth\.uid\(\)\s+for share;/);
    expect(sql).toContain('v_profile.business_id is distinct from p_business_id');
    expect(sql).toContain('El usuario no pertenece a este negocio.');
  });

  it('valida la idempotencia contra el negocio de la venta existente', () => {
    const sql = readMigration();

    expect(sql).toMatch(/select business_id into v_existing_business_id\s+from public\.sales\s+where id = p_client_generated_id;/);
    expect(sql).toContain('v_existing_business_id is distinct from p_business_id');
    expect(sql).toContain('El id de venta ya pertenece a otro negocio.');
  });

  it('deja el chequeo de p_created_by después de la idempotencia', () => {
    const sql = readMigration();
    const lockAt = sql.indexOf('pg_advisory_xact_lock');
    const idempotencyAt = sql.indexOf('select business_id into v_existing_business_id');
    const createdByAt = sql.indexOf('v_created_by := coalesce(p_created_by, auth.uid())');
    const creatorCheckAt = sql.indexOf('v_creator.business_id is distinct from p_business_id');

    expect(lockAt).toBeGreaterThan(-1);
    expect(idempotencyAt).toBeGreaterThan(lockAt);
    expect(createdByAt).toBeGreaterThan(idempotencyAt);
    expect(creatorCheckAt).toBeGreaterThan(createdByAt);
    expect(sql).toContain('v_created_by := auth.uid();');
  });

  it('bloquea el producto por negocio y no permite stock negativo', () => {
    const sql = readMigration();

    expect(sql).toMatch(/from public\.products\s+where id = v_pid and business_id = p_business_id\s+for update;/);
    expect(sql).toContain('El producto no pertenece a este negocio.');
    expect(sql).toMatch(/update public\.products[\s\S]*?where id = v_pid[\s\S]*?and business_id = p_business_id[\s\S]*?and coalesce\(stock, 0\) >= v_base;/);
    expect(sql).toContain('Stock global insuficiente');
  });

  it('valida la sede y las restricciones del cajero', () => {
    const sql = readMigration();

    expect(sql).toMatch(/from public\.branches\s+where id = p_branch_id and business_id = p_business_id\s+for share;/);
    expect(sql).toContain('La sucursal no pertenece a este negocio.');
    expect(sql).toContain("v_branch_type = 'almacen'");
    expect(sql).toContain('v_profile.branch_ids');
    expect(sql).toContain('El usuario no tiene acceso a esta sucursal.');
    expect(sql).toContain('El usuario no tiene permiso para cobrar.');
    expect(sql).toContain("v_profile.status <> 'active'");
  });

  it('mantiene el ON CONFLICT de branch_stock sin WHERE de negocio', () => {
    const sql = readMigration();
    const branchUpsert = sql.slice(
      sql.indexOf('insert into public.branch_stock'),
      sql.indexOf('v_valid_items := v_valid_items + 1'),
    );

    expect(branchUpsert).toContain('on conflict (branch_id, product_id) do update');
    expect(branchUpsert).toContain('set stock = public.branch_stock.stock - v_base');
    expect(branchUpsert).not.toMatch(/where\s+public\.branch_stock\.business_id/i);
  });

  it('conserva subtotal y la lógica legacy de presentaciones', () => {
    const sql = readMigration();

    expect(sql).toContain('subtotal');
    expect(sql).toContain('v_has_item_pres');
    expect(sql).toContain('v_has_item_factor');
    expect(sql).toContain('v_has_item_variant');
    expect(sql).toContain("v_f ->> 'presentation'");
    expect(sql).toContain('v_qty * v_price');
    expect(sql).toContain("coalesce(v_item ->> 'category', 'Otros')");
  });

  it('cierra permisos públicos y conserva el wrapper de 10 argumentos', () => {
    const sql = readMigration();
    const wrapperAt = sql.indexOf('drop function if exists public.registrar_venta(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb);');
    const wrapperBody = sql.slice(wrapperAt);

    expect(sql).toMatch(/revoke all on function public\.registrar_venta\(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.registrar_venta\(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb, jsonb, uuid\) to authenticated;/);
    expect(wrapperAt).toBeGreaterThan(-1);
    expect(wrapperBody).toMatch(/create or replace function public\.registrar_venta\(\s*p_client_generated_id uuid, p_business_id uuid,/);
    expect(wrapperBody).toContain('null::jsonb, null::uuid');
    expect(wrapperBody).toMatch(/revoke all on function public\.registrar_venta\(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb\) from public, anon;/);
    expect(wrapperBody).toMatch(/grant execute on function public\.registrar_venta\(uuid, uuid, text, text, text, numeric, numeric, text, uuid, jsonb\) to authenticated;/);
  });
});
