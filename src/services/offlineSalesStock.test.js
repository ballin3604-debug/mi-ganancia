import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261028000000_offline_sales_stock.sql',
);

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('sincronización de ventas offline con stock desfasado', () => {
  it('permite stock negativo solo dentro de una transacción de venta', () => {
    const sql = readMigration();

    expect(sql).toMatch(/current_setting\('mg\.allow_negative_stock', true\)/);
    expect(sql).toContain("<> 'on'");
    expect(sql).toContain("raise exception 'El stock no puede ser negativo.'");
    expect(sql).toContain('Stock insuficiente: la operación dejaría stock negativo.');
  });

  it('marca ambas RPC de venta como ventas ya ocurridas', () => {
    const sql = readMigration();
    const flag = "perform set_config('mg.allow_negative_stock', 'on', true);";

    expect(sql.split(flag)).toHaveLength(3);
    expect(sql.indexOf(flag)).toBeGreaterThan(sql.indexOf('create or replace function public.registrar_venta('));
    expect(sql.lastIndexOf(flag)).toBeGreaterThan(
      sql.indexOf('create or replace function public.registrar_venta_presentaciones('),
    );
  });

  it('no rechaza la venta por stock insuficiente en el servidor', () => {
    const sql = readMigration();

    expect(sql).not.toContain('Stock global insuficiente');
    expect(sql).not.toContain('Stock insuficiente en la sucursal');
    expect(sql).toContain('No se pudo descontar el stock del producto');
  });

  it('mantiene el filtro por negocio y el stock por sede', () => {
    const sql = readMigration();

    expect(sql).toContain('where id = v_pid and business_id = p_business_id');
    expect(sql).toContain('where id = v_product_id and business_id = p_business_id');
    expect(sql).toContain('v_base_quantity * -1');
    expect(sql).toContain('on conflict (branch_id, product_id) do update');
  });

  it('vuelve a cerrar el acceso público de ambas RPC', () => {
    const sql = readMigration();

    expect(sql).toMatch(/revoke all on function public\.registrar_venta\([^)]+\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.registrar_venta\([^)]+\) to authenticated;/);
    expect(sql).toMatch(/revoke all on function public\.registrar_venta_presentaciones\([^)]+\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.registrar_venta_presentaciones\([^)]+\) to authenticated;/);
  });
});
