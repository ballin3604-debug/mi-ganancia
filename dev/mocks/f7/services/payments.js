export async function uploadReceipt() {
  return 'https://example.com/receipt-demo.png';
}

export async function createPayment() {
  return { id: 'pay-demo', status: 'pending' };
}

export async function getAllPayments() {
  return [
    { id: 'pay-1', status: 'pending', planId: 'pro', cycle: 'monthly', amount: 49, reference: '123456', createdAt: new Date(), businessName: 'Tienda Doña Rosa' },
    { id: 'pay-2', status: 'approved', planId: 'premium', cycle: 'annual', amount: 990, reference: '998877', createdAt: new Date(), businessName: 'Minimarket Norte' },
  ];
}

export async function getReceiptUrl() {
  return '';
}

export async function reviewPayment() {
  return true;
}
