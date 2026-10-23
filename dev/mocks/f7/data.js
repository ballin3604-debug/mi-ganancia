const today = new Date();

function ts(monthOffset, day, hours, minutes) {
  return new Date(today.getFullYear(), today.getMonth() + monthOffset, day, hours, minutes, 0, 0);
}

export const BUSINESS = {
  id: 'b-demo-f7',
  name: 'Tienda Doña Rosa',
  joinCode: 'ROSA-4821',
  ownerCode: 'DUENO-9137',
  ownerCodeUsed: false,
};

export const SETTINGS = {
  slogan: 'La mejor tienda del barrio',
  phone: '+591 70000000',
  logoData: '',
  qrData: '',
  businessCategory: 'abarrotes',
  legalName: 'Comercial Rosa S.R.L.',
  nit: '1029384019',
  city: 'Santa Cruz de la Sierra',
  address: 'Av. San Martín #1420',
  footerMessage: '¡Gracias por su compra!',
  showQrOnTicket: true,
};

export const BRANCHES = [
  { id: 'b-centro', name: 'Sucursal Centro', type: 'tienda', isMain: true, address: 'Av. Central #120' },
  { id: 'b-mercado', name: 'Sucursal Mercado', type: 'tienda', isMain: false, address: 'Mercado Los Pozos' },
  { id: 'b-deposito', name: 'Depósito Central', type: 'almacen', isMain: false, address: 'Zona Norte' },
];

export const TEAM_MEMBERS = [
  {
    id: 'u-dueno',
    displayName: 'Rosa Quispe',
    email: 'rosa@demo.bo',
    role: 'owner',
    status: 'active',
    customPermissions: [],
    branchIds: [],
  },
  {
    id: 'u-cajero',
    displayName: 'Carlos Mamani',
    email: 'carlos@demo.bo',
    role: 'cashier',
    status: 'active',
    customPermissions: ['sales', 'cash'],
    branchIds: ['b-centro'],
  },
  {
    id: 'u-suspendido',
    displayName: 'Ana Flores',
    email: 'ana@demo.bo',
    role: 'cashier',
    status: 'suspended',
    customPermissions: ['sales'],
    branchIds: ['b-mercado'],
  },
];

export const INVITES = [
  { code: 'INV-8821', email: 'nuevo@demo.bo', role: 'cashier', expiresAt: ts(0, today.getDate() + 5, 12, 0) },
];

export const EXPENSES = [
  { id: 'e1', description: 'Compra de gaseosas', category: 'Mercadería', amount: 450.5, expense_type: 'daily', payment_method: 'efectivo', supplier: 'Distribuidora Sur', invoice_number: 'F-1201', notes: 'Reposición semanal', expenseDate: ts(0, today.getDate(), 9, 30) },
  { id: 'e2', description: 'Pago de luz', category: 'Servicios básicos', amount: 180, expense_type: 'fixed', payment_method: 'qr', supplier: 'CRE', invoice_number: '', notes: 'Factura mensual', expenseDate: ts(0, today.getDate() - 2, 15, 10) },
  { id: 'e3', description: 'Transporte mercadería', category: 'Transporte', amount: 60, expense_type: 'daily', payment_method: 'transferencia', supplier: '', invoice_number: '', notes: '', expenseDate: ts(0, today.getDate() - 4, 11, 0) },
  { id: 'e4', description: 'Alquiler del local', category: 'Alquiler', amount: 1200, expense_type: 'fixed', payment_method: 'tarjeta', supplier: 'Inmobiliaria Central', invoice_number: 'R-88', notes: 'Mes en curso', expenseDate: ts(0, today.getDate() - 6, 8, 0) },
  { id: 'e5', description: 'Bolsas y limpieza', category: 'Limpieza', amount: 85, expense_type: 'daily', payment_method: 'efectivo', supplier: '', invoice_number: '', notes: '', expenseDate: ts(0, today.getDate() - 9, 17, 45) },
];
