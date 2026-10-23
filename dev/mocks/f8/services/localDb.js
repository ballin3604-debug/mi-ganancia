const now = Date.now();

const OPERATIONS = [
  {
    id: 'op-1',
    business_id: 'b-demo-f7',
    operation_type: 'create_sale',
    status: 'error',
    retry_count: 5,
    error_details: 'No se pudo conectar con el servidor después de 5 intentos.',
    payload: { client_name: 'María López', total: 87.5 },
    created_at: new Date(now - 1000 * 60 * 4).toISOString(),
  },
  {
    id: 'op-2',
    business_id: 'b-demo-f7',
    operation_type: 'update_stock',
    status: 'pending',
    retry_count: 2,
    payload: { product_name: 'Arroz 1kg' },
    created_at: new Date(now - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'op-3',
    business_id: 'b-demo-f7',
    operation_type: 'create_expense',
    status: 'pending',
    retry_count: 0,
    payload: { description: 'Pago de luz', amount: 180 },
    created_at: new Date(now - 1000 * 60 * 26).toISOString(),
  },
];

export const db = {
  pending_operations: {
    toArray: async () => OPERATIONS,
  },
};
