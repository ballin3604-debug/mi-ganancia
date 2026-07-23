import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscribeToSales, subscribeToSaleItems } from '../services/sales';
import { subscribeToExpenses } from '../services/expenses';
import { subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { getBusinessSettings } from '../services/businessSettings';
import LoadingSpinner from '../components/LoadingSpinner';
import DataTable from '../components/DataTable';
import ReportHeader from '../components/ReportHeader';
import { toLocalISODate } from '../utils/dateRanges';
import { exportReportToPDF } from '../utils/pdfExport';

const PRICE_RANGES = [
    { label: "hasta Bs 50", max: 50 },
    { label: "Bs 51 - 100", max: 100 },
    { label: "Bs 101 - 200", max: 200 },
    { label: "Bs 201 - 300", max: 300 },
    { label: "Bs 301 - 400", max: 400 },
    { label: "Bs 401 - 500", max: 500 },
    { label: "Bs 501 - 700", max: 700 },
    { label: "Bs 701 - 1000", max: 1000 },
    { label: "Bs 1001 - 1500", max: 1500 },
    { label: "Bs 1501 - 2000", max: 2000 },
    { label: "Bs 2001 - 3000", max: 3000 },
    { label: "Bs 3001 - 4000", max: 4000 },
    { label: "Bs 4001 - 5000", max: 5000 },
    { label: "Más de 5000", max: Infinity }
];

const VALID_REPORT_TYPES = ['products', 'ranges', 'ranking', 'expenses', 'inventory', 'profit'];
const REPORT_TYPE_META = {
    products: { icon: '🥖', title: 'Productos Llevados', subtitle: 'Detalle de productos llevados por cada cliente en el periodo.' },
    ranges: { icon: '💰', title: 'Inversión por Cliente', subtitle: 'Cuánto invirtió cada cliente, agrupado por rango de precio.' },
    ranking: { icon: '🏆', title: 'Ranking de Productos', subtitle: 'Productos más vendidos por unidades e ingresos.' },
    expenses: { icon: '💵', title: 'Reporte de Egresos', subtitle: 'Egresos registrados y su distribución por categoría.' },
    inventory: { icon: '📦', title: 'Reporte de Inventario', subtitle: 'Stock actual, valorización y movimientos de entrada/salida.' },
    profit: { icon: '📈', title: 'Ganancias Diarias', subtitle: 'Ingresos, costos, gastos y ganancia neta día por día.' },
};

export default function MatrixReport() {
    const { businessId } = useAuth();
    const [searchParams] = useSearchParams();
    const [sales, setSales] = useState([]);
    const [saleItems, setSaleItems] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [products, setProducts] = useState([]);
    const [replenishments, setReplenishments] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const requestedType = searchParams.get('type');
    const reportType = VALID_REPORT_TYPES.includes(requestedType) ? requestedType : 'products'; // 'products' | 'ranges' | 'ranking' | 'expenses' | 'inventory' | 'profit'
    const [selectedDayDetail, setSelectedDayDetail] = useState(null);

    useEffect(() => {
        if (!businessId) return;
        getBusinessSettings(businessId).then(data => setSettings(data));
    }, [businessId]);

    function periodLabel() {
        const formattedStart = new Date(`${startDate}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
        const formattedEnd = new Date(`${endDate}T23:59:59.999`).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
        return `Periodo: ${formattedStart} hasta ${formattedEnd}`;
    }

    function exportProfitReportToPDF() {
        const rows = profitReportData.days.map((d) => {
            const dateStr = new Date(`${d.date}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
            return [
                dateStr,
                `Bs ${d.vendido.toFixed(2)}`,
                `Bs ${d.costoVendido.toFixed(2)}`,
                `Bs ${d.gananciaBruta.toFixed(2)}`,
                `Bs ${(d.egresosDiarios + d.egresosFijos).toFixed(2)}`,
                `Bs ${d.gananciaNeta.toFixed(2)}`,
            ];
        });
        exportReportToPDF({
            businessName: settings?.businessName,
            title: 'Reporte de Ganancias Diarias',
            subtitle: 'Ingresos, costos, gastos y ganancia neta día por día.',
            periodLabel: periodLabel(),
            columns: [
                { label: 'Fecha' },
                { label: 'Total Vendido', align: 'right' },
                { label: 'Costo Vendido', align: 'right' },
                { label: 'Ganancia Bruta', align: 'right' },
                { label: 'Gastos', align: 'right' },
                { label: 'Ganancia Neta', align: 'right' },
            ],
            rows,
            summary: [
                { label: 'Total Vendido (Ingresos):', value: `Bs ${profitReportData.totalVendido.toFixed(2)}` },
                { label: 'Costo de lo Vendido:', value: `Bs ${profitReportData.totalCostoVendido.toFixed(2)}` },
                { label: 'Ganancia Bruta:', value: `Bs ${profitReportData.totalGananciaBruta.toFixed(2)}` },
                { label: 'Gastos del Periodo:', value: `Bs ${(profitReportData.totalEgresosDiarios + profitReportData.totalEgresosFijos).toFixed(2)}` },
                { label: 'GANANCIA NETA REAL:', value: `Bs ${profitReportData.totalGananciaNeta.toFixed(2)}`, emphasis: true, negative: profitReportData.totalGananciaNeta < 0 },
            ],
        });
    }

    function handleExport() {
        if (reportType === 'profit') {
            exportProfitReportToPDF();
            return;
        }
        if (reportType === 'expenses') {
            const rows = filteredExpenses.map((exp) => {
                const d = exp.createdAt?.toDate ? exp.createdAt.toDate() : new Date(exp.createdAt);
                return [d.toLocaleDateString('es-BO'), exp.description || '', exp.supplier || '', exp.category || 'Otros', `Bs ${Number(exp.amount || 0).toFixed(2)}`];
            });
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Reporte de Egresos',
                subtitle: 'Egresos registrados y su distribución por categoría.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Fecha' },
                    { label: 'Descripción' },
                    { label: 'Proveedor' },
                    { label: 'Categoría' },
                    { label: 'Monto', align: 'right' },
                ],
                rows,
                totals: { values: { 4: `Bs ${totalExpenses.toFixed(2)}` } },
            });
            return;
        }
        if (reportType === 'inventory') {
            const rows = products.map((p) => [
                p.name,
                p.category || 'Otros',
                p.stock || 0,
                `Bs ${Number(p.price || 0).toFixed(2)}`,
                `Bs ${Number((p.stock || 0) * (p.price || 0)).toFixed(2)}`,
                productEntries[p.id] || 0,
                productMovements[p.id] || 0,
            ]);
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Reporte de Inventario',
                subtitle: 'Stock actual, valorización y movimientos de entrada/salida.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Producto' },
                    { label: 'Categoría' },
                    { label: 'Stock Actual', align: 'center' },
                    { label: 'Precio Unitario', align: 'right' },
                    { label: 'Valor Total', align: 'right' },
                    { label: 'Entradas (Periodo)', align: 'center' },
                    { label: 'Salidas (Periodo)', align: 'center' },
                ],
                rows,
                totals: {
                    values: {
                        2: products.reduce((sum, p) => sum + Number(p.stock || 0), 0),
                        4: `Bs ${totalInventoryValue.toFixed(2)}`,
                        5: products.reduce((sum, p) => sum + Number(productEntries[p.id] || 0), 0),
                        6: products.reduce((sum, p) => sum + Number(productMovements[p.id] || 0), 0),
                    },
                },
            });
            return;
        }
        if (reportType === 'ranking') {
            const rows = rankingMatrix.map((item, i) => [i + 1, item.productName, item.quantity, `Bs ${Number(item.totalRevenue || 0).toFixed(2)}`]);
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Ranking de Productos',
                subtitle: 'Productos más vendidos por unidades e ingresos.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Posición', align: 'center' },
                    { label: 'Producto' },
                    { label: 'Unidades Vendidas', align: 'right' },
                    { label: 'Monto Total Generado', align: 'right' },
                ],
                rows,
                totals: {
                    values: {
                        2: rankingMatrix.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
                        3: `Bs ${rankingMatrix.reduce((sum, item) => sum + Number(item.totalRevenue || 0), 0).toFixed(2)}`,
                    },
                },
            });
            return;
        }
        if (reportType === 'ranges') {
            const rows = matrix.map((row) => [
                row.clientName,
                ...activePriceRanges.map((r) => `Bs ${Number(row.ranges[r.originalIndex] || 0).toFixed(2)}`),
                `Bs ${Number(row.totalSpent || 0).toFixed(2)}`,
            ]);
            const rangeTotalsValues = {};
            activePriceRanges.forEach((r, i) => {
                rangeTotalsValues[1 + i] = `Bs ${matrix.reduce((sum, row) => sum + Number(row.ranges[r.originalIndex] || 0), 0).toFixed(2)}`;
            });
            rangeTotalsValues[1 + activePriceRanges.length] = `Bs ${matrix.reduce((sum, row) => sum + Number(row.totalSpent || 0), 0).toFixed(2)}`;
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Inversión por Cliente',
                subtitle: 'Cuánto invirtió cada cliente, agrupado por rango de precio.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Cliente' },
                    ...activePriceRanges.map((r) => ({ label: r.label, align: 'right' })),
                    { label: 'Total General', align: 'right' },
                ],
                rows,
                totals: { values: rangeTotalsValues },
            });
            return;
        }
        if (reportType === 'products') {
            const rows = productsMatrix.rows.map((row) => [
                row.clientName,
                ...productsMatrix.columns.map((col) => (row.products[col] ? row.products[col].qty : 0)),
                row.totalQty,
                `Bs ${Number(row.totalSpent || 0).toFixed(2)}`,
            ]);
            const productTotalsValues = {};
            productsMatrix.columns.forEach((col, i) => {
                productTotalsValues[1 + i] = productsMatrix.rows.reduce((sum, row) => sum + Number(row.products[col]?.qty || 0), 0);
            });
            productTotalsValues[1 + productsMatrix.columns.length] = productsMatrix.rows.reduce((sum, row) => sum + Number(row.totalQty || 0), 0);
            productTotalsValues[2 + productsMatrix.columns.length] = `Bs ${productsMatrix.rows.reduce((sum, row) => sum + Number(row.totalSpent || 0), 0).toFixed(2)}`;
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Productos Llevados',
                subtitle: 'Detalle de productos llevados por cada cliente en el periodo.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Cliente' },
                    ...productsMatrix.columns.map((col) => ({ label: col, align: 'right' })),
                    { label: 'Total Unidades', align: 'right' },
                    { label: 'Total Gastado', align: 'right' },
                ],
                rows,
                totals: { values: productTotalsValues },
            });
        }
    }

    // Fechas por defecto: inicio del mes actual hasta hoy (en hora local)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return toLocalISODate(d);
    });
    const [endDate, setEndDate] = useState(() => {
        return toLocalISODate(new Date());
    });

    useEffect(() => {
        if (!businessId) return;
        setLoading(true);

        let salesReady = false;
        let itemsReady = false;
        let expensesReady = false;
        let prodsReady = false;
        let repsReady = false;

        const checkReady = () => {
            if (salesReady && itemsReady && expensesReady && prodsReady && repsReady) {
                setLoading(false);
            }
        };

        const unsubSales = subscribeToSales(businessId, (data) => {
            setSales(data);
            salesReady = true;
            checkReady();
        });

        const unsubItems = subscribeToSaleItems(businessId, (data) => {
            setSaleItems(data);
            itemsReady = true;
            checkReady();
        });

        const unsubExpenses = subscribeToExpenses(businessId, (data) => {
            setExpenses(data);
            expensesReady = true;
            checkReady();
        });

        const unsubProds = subscribeToProducts(businessId, (data) => {
            setProducts(data);
            prodsReady = true;
            checkReady();
        });

        const unsubReps = subscribeToReplenishments(businessId, (data) => {
            setReplenishments(data);
            repsReady = true;
            checkReady();
        });

        return () => {
            unsubSales();
            unsubItems();
            unsubExpenses();
            unsubProds();
            unsubReps();
        };
    }, [businessId]);

    // Lógica para agrupar ventas reales en la matriz
    const matrix = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        const filtered = sales.filter(s => {
            if (!s.createdAt) return false;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            return d >= start && d <= end;
        });

        const clientTotals = {};

        filtered.forEach(sale => {
            const clientName = sale.clientName?.trim() || 'Cliente Casual';
            const total = sale.total || 0;

            let rangeIdx = PRICE_RANGES.length - 1;
            for (let i = 0; i < PRICE_RANGES.length; i++) {
                if (total <= PRICE_RANGES[i].max) {
                    rangeIdx = i;
                    break;
                }
            }

            if (!clientTotals[clientName]) {
                clientTotals[clientName] = {};
            }
            clientTotals[clientName][rangeIdx] = (clientTotals[clientName][rangeIdx] || 0) + total;
        });

        const rows = Object.keys(clientTotals).map(clientName => {
            const ranges = clientTotals[clientName];
            const totalSpent = Object.values(ranges).reduce((a, b) => a + b, 0);
            return { clientName, ranges, totalSpent };
        });

        // Ordenar clientes por los que más gastaron en total
        rows.sort((a, b) => b.totalSpent - a.totalSpent);

        return rows;
    }, [sales, startDate, endDate]);

    // Lógica para calcular qué rangos tienen al menos un valor mayor a cero
    const activePriceRanges = useMemo(() => {
        const usedIndices = new Set();
        matrix.forEach(row => {
            Object.keys(row.ranges).forEach(rIdx => {
                if (row.ranges[rIdx] > 0) {
                    usedIndices.add(Number(rIdx));
                }
            });
        });
        return PRICE_RANGES
            .map((r, i) => ({ ...r, originalIndex: i }))
            .filter((r) => usedIndices.has(r.originalIndex));
    }, [matrix]);

    // Lógica para el ranking de productos más vendidos
    const rankingMatrix = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        const validSalesSet = new Set();
        sales.forEach(s => {
            if (!s.createdAt) return;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            if (d >= start && d <= end) {
                validSalesSet.add(s.id);
            }
        });

        const productSales = {};
        saleItems.forEach(item => {
            if (!validSalesSet.has(item.saleId)) return;
            const pName = item.productName || 'Desconocido';
            const qty = item.quantity || 0;
            const subtotal = item.subtotal || 0;

            if (!productSales[pName]) {
                productSales[pName] = { productName: pName, quantity: 0, totalRevenue: 0 };
            }
            productSales[pName].quantity += qty;
            productSales[pName].totalRevenue += subtotal;
        });

        const ranking = Object.values(productSales);
        ranking.sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue);

        return ranking;
    }, [sales, saleItems, startDate, endDate]);

    // Lógica para el reporte de Productos Llevados
    const productsMatrix = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        // Mapa de las ventas válidas en estas fechas
        const validSalesMap = new Map();
        sales.forEach(s => {
            if (!s.createdAt) return;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            if (d >= start && d <= end) {
                validSalesMap.set(s.id, s.clientName?.trim() || 'Cliente Casual');
            }
        });

        const clientTotals = {};
        const productStats = {};

        saleItems.forEach(item => {
            if (!validSalesMap.has(item.saleId)) return;
            const clientName = validSalesMap.get(item.saleId);
            const pName = item.productName || 'Desconocido';

            if (!clientTotals[clientName]) clientTotals[clientName] = { products: {}, totalQty: 0, totalSpent: 0 };
            if (!clientTotals[clientName].products[pName]) clientTotals[clientName].products[pName] = { qty: 0, subtotal: 0 };

            clientTotals[clientName].products[pName].qty += item.quantity;
            clientTotals[clientName].products[pName].subtotal += item.subtotal;
            clientTotals[clientName].totalQty += item.quantity;
            clientTotals[clientName].totalSpent += item.subtotal;

            if (!productStats[pName]) productStats[pName] = 0;
            productStats[pName] += item.quantity;
        });

        const columns = Object.keys(productStats).sort((a, b) => productStats[b] - productStats[a]);

        const rows = Object.keys(clientTotals).map(clientName => ({
            clientName, ...clientTotals[clientName]
        }));
        rows.sort((a, b) => b.totalSpent - a.totalSpent);

        return { rows, columns };
    }, [sales, saleItems, startDate, endDate]);

    // -- Lógica para Reporte de Egresos --
    const start = useMemo(() => new Date(`${startDate}T00:00:00`), [startDate]);
    const end = useMemo(() => new Date(`${endDate}T23:59:59.999`), [endDate]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (!e.createdAt) return false;
            const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            return d >= start && d <= end;
        });
    }, [expenses, start, end]);

    const totalExpenses = useMemo(() => {
        return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [filteredExpenses]);

    const expensesByCategory = useMemo(() => {
        const categories = {};
        filteredExpenses.forEach(e => {
            const cat = e.category || 'Otros';
            categories[cat] = (categories[cat] || 0) + (e.amount || 0);
        });
        return Object.entries(categories)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [filteredExpenses, totalExpenses]);

    // -- Lógica para Reporte de Inventario --
    const salesInPeriod = useMemo(() => {
        const validSet = new Set();
        sales.forEach(s => {
            if (!s.createdAt) return;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            if (d >= start && d <= end) {
                validSet.add(s.id);
            }
        });
        return validSet;
    }, [sales, start, end]);

    const productMovements = useMemo(() => {
        const exits = {};
        saleItems.forEach(item => {
            if (!salesInPeriod.has(item.saleId)) return;
            const pId = item.productId;
            exits[pId] = (exits[pId] || 0) + (item.quantity || 0);
        });
        return exits;
    }, [saleItems, salesInPeriod]);

    const productEntries = useMemo(() => {
        const entries = {};
        replenishments.forEach(r => {
            if (!r.createdAt) return;
            const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            if (d < start || d > end) return;
            entries[r.productId] = (entries[r.productId] || 0) + (r.quantity || 0);
        });
        return entries;
    }, [replenishments, start, end]);

    const totalInventoryValue = useMemo(() => {
        return products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
    }, [products]);

    const lowStockCount = useMemo(() => {
        return products.filter(p => (p.stock || 0) <= (p.minStock || 5)).length;
    }, [products]);

    const profitReportData = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        const filteredSales = sales.filter(s => {
            if (!s.createdAt) return false;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            return d >= start && d <= end;
        });

        const filteredReplenishments = replenishments.filter(r => {
            if (!r.createdAt) return false;
            const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            return d >= start && d <= end;
        });

        const filteredExpenses = expenses.filter(e => {
            if (!e.createdAt) return false;
            const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            return d >= start && d <= end;
        });

        const dailyData = {};

        let cur = new Date(start);
        while (cur <= end) {
            const dateStr = toLocalISODate(cur);
            dailyData[dateStr] = {
                date: dateStr,
                vendido: 0,
                costoVendido: 0,
                egresosDiarios: 0,
                egresosFijos: 0,
                reposicion: 0,
                gananciaBruta: 0,
                gananciaNeta: 0,
            };
            cur.setDate(cur.getDate() + 1);
        }

        const saleIdToDate = {};
        filteredSales.forEach(s => {
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            const dateStr = toLocalISODate(d);
            saleIdToDate[s.id] = dateStr;
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { date: dateStr, vendido: 0, costoVendido: 0, egresosDiarios: 0, egresosFijos: 0, reposicion: 0, gananciaBruta: 0, gananciaNeta: 0 };
            }
            dailyData[dateStr].vendido += s.total || 0;
        });

        // Calcular costo de lo vendido diariamente
        saleItems.forEach(item => {
            const dateStr = saleIdToDate[item.saleId];
            if (dateStr) {
                const itemCost = item.supplier_price !== undefined && item.supplier_price !== null 
                    ? Number(item.supplier_price) 
                    : (item.supplierPrice !== undefined && item.supplierPrice !== null 
                        ? Number(item.supplierPrice) 
                        : null);

                if (!dailyData[dateStr]) {
                    dailyData[dateStr] = { date: dateStr, vendido: 0, costoVendido: 0, egresosDiarios: 0, egresosFijos: 0, reposicion: 0, gananciaBruta: 0, gananciaNeta: 0 };
                }
                if (itemCost !== null) {
                    dailyData[dateStr].costoVendido += itemCost * Number(item.quantity || 0);
                } else {
                    // Sin costo registrado: no se suma como si costara Bs 0 (eso
                    // inflaría la ganancia mostrada) — se cuenta aparte para avisar.
                    dailyData[dateStr].itemsSinCosto = (dailyData[dateStr].itemsSinCosto || 0) + 1;
                }
            }
        });

        filteredReplenishments.forEach(r => {
            const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            const dateStr = toLocalISODate(d);
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { date: dateStr, vendido: 0, costoVendido: 0, egresosDiarios: 0, egresosFijos: 0, reposicion: 0, gananciaBruta: 0, gananciaNeta: 0 };
            }
            // Costo total ya calculado una sola vez en products.js (precio proveedor x cantidad + gastos extra)
            const fallbackCost = (Number(r.supplierPrice || 0) * Number(r.quantity || 0))
                + Number(r.additionalExpenses || r.additional_expenses || 0);
            const cost = Number(r.totalCost || r.total_cost || fallbackCost);
            dailyData[dateStr].reposicion += cost;
        });

        filteredExpenses.forEach(e => {
            const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            const dateStr = toLocalISODate(d);
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { date: dateStr, vendido: 0, costoVendido: 0, egresosDiarios: 0, egresosFijos: 0, reposicion: 0, gananciaBruta: 0, gananciaNeta: 0 };
            }
            const amount = Number(e.amount || 0);
            const isFixed = e.expense_type === 'fixed' || e.expenseType === 'fixed';
            if (isFixed) {
                dailyData[dateStr].egresosFijos += amount;
            } else {
                dailyData[dateStr].egresosDiarios += amount;
            }
        });

        const days = Object.values(dailyData).map(day => {
            day.gananciaBruta = day.vendido - day.costoVendido;
            // La ganancia neta diaria solo resta los egresos diarios (los daily)
            day.gananciaNeta = day.gananciaBruta - day.egresosDiarios;
            return day;
        });

        days.sort((a, b) => b.date.localeCompare(a.date));

        const totalVendido = days.reduce((sum, d) => sum + d.vendido, 0);
        const totalCostoVendido = days.reduce((sum, d) => sum + d.costoVendido, 0);
        const totalEgresosDiarios = days.reduce((sum, d) => sum + d.egresosDiarios, 0);
        const totalEgresosFijos = days.reduce((sum, d) => sum + d.egresosFijos, 0);
        const totalReposicion = days.reduce((sum, d) => sum + d.reposicion, 0);
        const totalGananciaBruta = totalVendido - totalCostoVendido;
        // La ganancia neta del periodo resta tanto diarios como fijos
        const totalGananciaNeta = totalGananciaBruta - totalEgresosDiarios - totalEgresosFijos;
        const totalItemsSinCosto = days.reduce((sum, d) => sum + (d.itemsSinCosto || 0), 0);

        return {
            days,
            totalVendido,
            totalCostoVendido,
            totalEgresosDiarios,
            totalEgresosFijos,
            totalReposicion,
            totalGananciaBruta,
            totalGananciaNeta,
            totalItemsSinCosto
        };
    }, [sales, replenishments, expenses, saleItems, startDate, endDate]);

    if (loading) return <LoadingSpinner />;

    const meta = REPORT_TYPE_META[reportType];

    const currentReportHasData = (() => {
        switch (reportType) {
            case 'profit': return profitReportData.days.length > 0;
            case 'expenses': return filteredExpenses.length > 0;
            case 'inventory': return products.length > 0;
            case 'ranking': return rankingMatrix.length > 0;
            case 'ranges': return matrix.length > 0;
            case 'products': return productsMatrix.rows.length > 0;
            default: return true;
        }
    })();

    return (
        <div className="p-4 lg:p-6 pb-24 mg-fade-in w-full mx-auto">
            <ReportHeader
                icon={meta?.icon}
                title={meta?.title || 'Reportes y Estadísticas'}
                subtitle={meta?.subtitle}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onExport={handleExport}
                exportLabel="Exportar PDF"
                exportDisabled={!currentReportHasData}
            />

            <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-6 lg:p-8 shadow-sm">
                {reportType === 'expenses' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de Total destacado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-[#1670C2] mb-1">Total Egresos en Periodo</p>
                                    <h3 className="text-3xl font-black text-[#1670C2]">Bs {totalExpenses.toFixed(2)}</h3>
                                </div>
                                <span className="text-4xl">💵</span>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-1">Transacciones Registradas</p>
                                    <h3 className="text-3xl font-black text-gray-700">{filteredExpenses.length}</h3>
                                </div>
                                <span className="text-4xl">📝</span>
                            </div>
                        </div>

                        {/* Desglose por categoría (Gráfico de barras CSS) */}
                        {expensesByCategory.length > 0 && (
                            <div className="bg-white border border-[var(--mg-border)] rounded-[20px] p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--mg-text-primary)] mb-4">📊 Distribución de Egresos por Categoría</h3>
                                <div className="space-y-4">
                                    {expensesByCategory.map(({ category, amount, percentage }) => (
                                        <div key={category} className="space-y-1">
                                            <div className="flex justify-between text-sm font-semibold text-[var(--mg-text-primary)]">
                                                <span>{category}</span>
                                                <span>Bs {amount.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-gradient-to-r from-blue-500 to-[#1670C2] h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Listado detallado de Egresos */}
                        <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
                            <table className="w-full text-sm min-w-[700px] border-collapse bg-white">
                                <thead>
                                    <tr>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap w-36">
                                            Fecha
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap">
                                            Concepto / Descripción
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap w-44">
                                            Proveedor
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-center whitespace-nowrap w-36">
                                            Categoría
                                        </th>
                                        <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap w-36">
                                            Monto
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredExpenses.map((exp, idx) => {
                                        const dateStr = exp.createdAt?.toDate 
                                            ? exp.createdAt.toDate().toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : new Date(exp.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                        return (
                                            <tr key={exp.id || idx} className="hover:bg-blue-50/20 transition-colors">
                                                <td className="p-3 border border-[var(--mg-border)] font-mono text-[var(--mg-text-primary)]">
                                                    {dateStr}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-[var(--mg-text-primary)] font-medium">
                                                    {exp.description}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-[var(--mg-text-secondary)]">
                                                    {exp.supplier || <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-center">
                                                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
                                                        {exp.category || 'Otros'}
                                                    </span>
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right font-black text-[#1670C2]">
                                                    Bs {Number(exp.amount || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredExpenses.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                No se encontraron egresos en el rango de fechas seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : reportType === 'inventory' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de inventario destacado */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-[#1670C2] mb-1">Valor Total del Inventario</p>
                                    <h3 className="text-3xl font-black text-[#1670C2]">Bs {totalInventoryValue.toFixed(2)}</h3>
                                </div>
                                <span className="text-4xl">💰</span>
                            </div>
                            <div className={`border rounded-2xl p-6 flex items-center justify-between shadow-sm ${lowStockCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                                <div>
                                    <p className={`text-xs font-extrabold uppercase tracking-widest mb-1 ${lowStockCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>Stock Bajo (Reponer)</p>
                                    <h3 className={`text-3xl font-black ${lowStockCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{lowStockCount} {lowStockCount === 1 ? 'producto' : 'productos'}</h3>
                                </div>
                                <span className="text-4xl">{lowStockCount > 0 ? '⚠️' : '✅'}</span>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-1">Total Catálogo</p>
                                    <h3 className="text-3xl font-black text-gray-700">{products.length} productos</h3>
                                </div>
                                <span className="text-4xl">📦</span>
                            </div>
                        </div>

                        {/* Tabla detallada de Inventario */}
                        <DataTable
                            storageKey="mg-reporte-inventario-columns"
                            getRowKey={(p) => p.id}
                            emptyMessage="No hay productos registrados en el inventario."
                            rows={products}
                            columns={[
                                {
                                    key: 'producto', label: 'Producto', align: 'left',
                                    render: (p) => (
                                        <span className="font-bold text-[var(--mg-text-primary)]">
                                            {p.name}
                                            {p.brand && <span className="text-[10px] text-[var(--mg-text-muted)] font-normal block">{p.brand}</span>}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'categoria', label: 'Categoría', align: 'left', width: 'w-36',
                                    render: (p) => p.category || 'Otros',
                                },
                                {
                                    key: 'stock', label: 'Stock Actual', align: 'center', width: 'w-28',
                                    render: (p) => {
                                        const isLowStock = (p.stock || 0) <= (p.minStock || 5);
                                        return (
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${isLowStock ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                                                {p.stock} und.
                                            </span>
                                        );
                                    },
                                },
                                {
                                    key: 'precioUnitario', label: 'Precio Unitario', align: 'right', width: 'w-28',
                                    render: (p) => `Bs ${(p.price || 0).toFixed(2)}`,
                                },
                                {
                                    key: 'valorTotal', label: 'Valor Total', align: 'right', width: 'w-32',
                                    render: (p) => (
                                        <span className="font-black text-[#1670C2]">Bs {((p.stock || 0) * (p.price || 0)).toFixed(2)}</span>
                                    ),
                                },
                                {
                                    key: 'entradas', label: 'Entradas (Periodo)', align: 'center', width: 'w-32',
                                    render: (p) => {
                                        const entries = productEntries[p.id] || 0;
                                        return entries > 0 ? (
                                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded-full font-black">{entries} und.</span>
                                        ) : (
                                            <span className="text-gray-300">•</span>
                                        );
                                    },
                                },
                                {
                                    key: 'salidas', label: 'Salidas (Ventas)', align: 'center', width: 'w-32',
                                    render: (p) => {
                                        const exits = productMovements[p.id] || 0;
                                        return exits > 0 ? (
                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-black">{exits} und.</span>
                                        ) : (
                                            <span className="text-gray-300">•</span>
                                        );
                                    },
                                },
                            ]}
                        />
                        <p className="text-[11px] text-[var(--mg-text-muted)] italic text-right mt-1">
                            Entradas = unidades compradas (Compras) en el periodo. Salidas = unidades vendidas en el periodo.
                        </p>
                    </div>
                ) : reportType === 'profit' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de ganancias destacadas */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#1670C2] mb-1">Total Vendido</p>
                                        <h3 className="text-xl lg:text-2xl font-black text-[#1670C2]">Bs {profitReportData.totalVendido.toFixed(2)}</h3>
                                    </div>
                                    <span className="text-2xl">💰</span>
                                </div>
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-orange-700 mb-1">Costo de lo Vendido</p>
                                        <h3 className="text-xl lg:text-2xl font-black text-orange-700">Bs {profitReportData.totalCostoVendido.toFixed(2)}</h3>
                                    </div>
                                    <span className="text-2xl">📦</span>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 mb-1">Ganancia Bruta</p>
                                        <h3 className="text-xl lg:text-2xl font-black text-emerald-700">Bs {profitReportData.totalGananciaBruta.toFixed(2)}</h3>
                                    </div>
                                    <span className="text-2xl">📈</span>
                                </div>
                                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 mb-1">Gastos Diarios</p>
                                        <h3 className="text-xl lg:text-2xl font-black text-purple-700">Bs {profitReportData.totalEgresosDiarios.toFixed(2)}</h3>
                                    </div>
                                    <span className="text-2xl">💸</span>
                                </div>
                            </div>

                            {/* Tarjeta Ganancia Neta Real (Destacada con Desglose) */}
                            <div className={`border-[2px] rounded-[24px] p-6 flex flex-col md:flex-row md:items-center md:justify-between shadow-md transition-all gap-6 ${
                                profitReportData.totalGananciaNeta >= 0 
                                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                                    : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                            }`}>
                                <div className="space-y-1">
                                    <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                                        profitReportData.totalGananciaNeta >= 0 ? 'text-green-800' : 'text-red-800'
                                    }`}>
                                        🌟 Ganancia Neta Real del Periodo
                                    </p>
                                    <h3 className={`text-3xl lg:text-4xl font-black tracking-tight ${
                                        profitReportData.totalGananciaNeta >= 0 ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                        Bs {profitReportData.totalGananciaNeta.toFixed(2)}
                                    </h3>
                                    <p className="text-xs text-[var(--mg-text-muted)] mt-2 font-medium">
                                        Resultado neto de la operación comercial restando todos los costos y gastos del periodo.
                                    </p>
                                    {profitReportData.totalItemsSinCosto > 0 && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 font-semibold">
                                            ⚠️ {profitReportData.totalItemsSinCosto} {profitReportData.totalItemsSinCosto === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen'} costo de proveedor registrado — la ganancia real podría ser menor a la mostrada.
                                        </p>
                                    )}
                                </div>
                                
                                {/* Panel de Desglose Matemático */}
                                <div className="bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-4 text-xs font-medium space-y-2 min-w-[260px] shadow-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-gray-600 font-semibold">Ganancia Bruta:</span>
                                        <span className="font-bold text-gray-900">Bs {profitReportData.totalGananciaBruta.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 font-semibold">
                                        <span>(-) Gastos Diarios:</span>
                                        <span className="font-bold">Bs {profitReportData.totalEgresosDiarios.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-purple-600 font-semibold">
                                        <span>(-) Gastos Fijos (Periodo):</span>
                                        <span className="font-bold">Bs {profitReportData.totalEgresosFijos.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-dashed border-gray-300 pt-2 flex justify-between font-black text-green-700 text-sm">
                                        <span>Ganancia Neta Real:</span>
                                        <span>Bs {profitReportData.totalGananciaNeta.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabla de Ganancias Diarias */}
                        <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
                            <table className="w-full text-sm min-w-[800px] border-collapse bg-white">
                                <thead>
                                    <tr>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap">
                                            Fecha
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Total Vendido
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Costo Vendido
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Ganancia Bruta
                                        </th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Gastos Diarios
                                        </th>
                                        <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Ganancia Neta Diaria
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profitReportData.days.map((day, idx) => {
                                        const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                        const isDayPositive = day.gananciaNeta >= 0;
                                        return (
                                            <tr 
                                                key={day.date || idx} 
                                                className="hover:bg-blue-50/20 transition-colors cursor-pointer"
                                                onClick={() => setSelectedDayDetail(day)}
                                                title="Ver detalle del día"
                                            >
                                                <td className="p-3 border border-[var(--mg-border)] font-mono text-[var(--mg-text-primary)] font-bold">
                                                    {dateLabel} <span className="text-[10px] text-gray-400 font-normal">🔍</span>
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right font-medium text-[var(--mg-text-primary)]">
                                                    Bs {day.vendido.toFixed(2)}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right text-[var(--mg-text-secondary)]">
                                                    {day.costoVendido > 0 ? `Bs ${day.costoVendido.toFixed(2)}` : '—'}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right font-bold text-emerald-600">
                                                    Bs {day.gananciaBruta.toFixed(2)}
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right text-red-600 font-medium">
                                                    <div>Bs {day.egresosDiarios.toFixed(2)}</div>
                                                    {day.egresosFijos > 0 && (
                                                        <span className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded inline-block font-bold mt-0.5" title="Gasto fijo registrado este día (se descuenta al final en el global)">
                                                            + Bs {day.egresosFijos.toFixed(2)} fijos
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`p-3 border border-[var(--mg-border)] text-right font-black ${isDayPositive ? 'text-green-600' : 'text-red-500'}`}>
                                                    Bs {day.gananciaNeta.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {profitReportData.days.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                No hay registros para el rango de fechas seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
                        <table className="w-full text-sm min-w-[900px] border-collapse bg-white">
                            {reportType === 'ranking' ? (
                                <>
                                    <thead>
                                        <tr>
                                            <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-center whitespace-nowrap w-20">
                                                Posición
                                            </th>
                                            <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap">
                                                Nombre del Producto
                                            </th>
                                            <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-center whitespace-nowrap w-32">
                                                Unidades Vendidas
                                            </th>
                                            <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap w-40">
                                                Monto Total Generado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankingMatrix.map((item, index) => {
                                            const pos = index + 1;
                                            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
                                            const isTop3 = pos <= 3;
                                            return (
                                                <tr key={index} className={`hover:bg-blue-50/20 transition-colors group ${isTop3 ? 'bg-blue-50/5' : ''}`}>
                                                    <td className="p-3 border border-[var(--mg-border)] text-center font-bold text-base whitespace-nowrap">
                                                        {isTop3 ? (
                                                            <span className="text-xl" title={`Puesto ${pos}`}>{medal}</span>
                                                        ) : (
                                                            <span className="text-gray-400 font-semibold">{medal}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border border-[var(--mg-border)] font-bold text-[var(--mg-text-primary)]">
                                                        {item.productName}
                                                    </td>
                                                    <td className="p-3 border border-[var(--mg-border)] text-center font-black text-sm text-[var(--mg-text-primary)]">
                                                        {item.quantity} und.
                                                    </td>
                                                    <td className="p-3 border border-[var(--mg-border)] text-right font-black text-[#1670C2] text-[14px]">
                                                        Bs {item.totalRevenue.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {rankingMatrix.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                    No hay productos vendidos en este periodo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </>
                            ) : reportType === 'ranges' ? (
                                <>
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 bg-[#1670C2] text-white font-bold p-3.5 border border-[var(--mg-border)] border-r-2 border-r-[var(--mg-border)] z-10 text-left whitespace-nowrap min-w-[160px]">
                                                👥 Clientes
                                            </th>
                                            {activePriceRanges.map((r, i) => (
                                                <th key={i} className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] whitespace-nowrap text-center">
                                                    {r.label}
                                                </th>
                                            ))}
                                            <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] whitespace-nowrap text-center">
                                                Total General
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matrix.map((row, i) => (
                                            <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="sticky left-0 bg-white text-[var(--mg-text-primary)] font-bold p-3 border border-[var(--mg-border)] border-r-2 border-r-[var(--mg-border)] z-10 whitespace-nowrap group-hover:bg-blue-50/40 transition-colors">
                                                    {row.clientName}
                                                </td>
                                                {activePriceRanges.map((r) => {
                                                    const val = row.ranges[r.originalIndex] || 0;
                                                    return (
                                                        <td key={r.originalIndex} className="p-2 border border-[var(--mg-border)] text-center transition-all">
                                                            {val > 0 ? (
                                                                <span className={`inline-block px-3 py-1.5 rounded-2xl font-bold text-[13px] ${val > 500 ? 'bg-blue-50 text-[#1670C2] shadow-sm' : 'text-[var(--mg-text-primary)] bg-gray-50'}`}>
                                                                    Bs {val.toFixed(2)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-lg leading-none flex items-center justify-center h-full">•</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                                <td className="p-2 border border-[var(--mg-border)] text-center bg-blue-50/30 font-black text-[#1670C2] text-[14px]">
                                                    Bs {row.totalSpent.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {matrix.length === 0 && (
                                            <tr>
                                                <td colSpan={activePriceRanges.length + 2} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                    No hay ventas registradas en este periodo de tiempo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </>
                            ) : (
                                <>
                                    <thead>
                                        <tr>
                                            <th className="sticky left-0 bg-[#1670C2] text-white font-bold p-3.5 border border-[var(--mg-border)] border-r-2 border-r-[var(--mg-border)] z-10 text-left whitespace-nowrap min-w-[160px]">
                                                👥 Clientes
                                            </th>
                                            {productsMatrix.columns.map((col, i) => (
                                                <th key={i} className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] whitespace-nowrap text-center min-w-[100px]">
                                                    {col}
                                                </th>
                                            ))}
                                            <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] whitespace-nowrap text-center">
                                                Total General
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productsMatrix.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="sticky left-0 bg-white text-[var(--mg-text-primary)] font-bold p-3 border border-[var(--mg-border)] border-r-2 border-r-[var(--mg-border)] z-10 whitespace-nowrap group-hover:bg-blue-50/40 transition-colors">
                                                    {row.clientName}
                                                </td>
                                                {productsMatrix.columns.map((col, cIdx) => {
                                                    const val = row.products[col];
                                                    return (
                                                        <td key={cIdx} className="p-2 border border-[var(--mg-border)] text-center transition-all">
                                                            {val ? (
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <span className="font-bold text-[var(--mg-text-primary)] text-[13px]">{val.qty} und.</span>
                                                                    <span className="text-[var(--mg-text-muted)] text-[10px]">Bs {val.subtotal.toFixed(2)}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 text-lg leading-none flex items-center justify-center h-full">•</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                                <td className="p-2 border border-[var(--mg-border)] text-center bg-blue-50/30">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="font-black text-[#1670C2] text-[14px]">{row.totalQty} und.</span>
                                                        <span className="font-bold text-[#1670C2] text-[11px]">Bs {row.totalSpent.toFixed(2)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {productsMatrix.rows.length === 0 && (
                                            <tr>
                                                <td colSpan={productsMatrix.columns.length + 2} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                    No hay productos vendidos en este periodo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </>
                            )}
                        </table>
                    </div>
                )}

                <div className="mt-8 text-center text-xs text-[var(--mg-text-muted)] border-t border-dashed border-[var(--mg-border)] pt-5 flex justify-center gap-6 flex-wrap">
                    {reportType === 'ranges'
                        ? <span>🍞 Cada celda representa el dinero total invertido en ese rango de precios.</span>
                        : reportType === 'products'
                        ? <span>🍞 Cada celda muestra la cantidad de pan/productos llevados y su dinero equivalente.</span>
                        : reportType === 'ranking'
                        ? <span>🏆 Ranking ordenado de los productos con mayor demanda física e ingresos totales.</span>
                        : reportType === 'expenses'
                        ? <span>💵 Resumen detallado y desglose de egresos en tu negocio en el periodo.</span>
                        : reportType === 'profit'
                        ? <span>📈 Resumen detallado de ingresos, costos de reposición y egresos generales con ganancia neta.</span>
                        : <span>📦 Reporte de stock actual, valorización de inventario y movimientos en el rango de fechas.</span>
                    }
                    <span>⚡ Datos 100% reales calculados a partir de tu base de datos de ventas.</span>
                </div>
            </div>
            {selectedDayDetail && (
                <DayDetailModal
                    day={selectedDayDetail}
                    sales={sales}
                    saleItems={saleItems}
                    expenses={expenses}
                    onClose={() => setSelectedDayDetail(null)}
                />
            )}
        </div>
    );
}

function DayDetailModal({ day, sales, saleItems, expenses, onClose }) {
    const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });

    const daySales = useMemo(() => {
        return sales.filter(s => {
            if (!s.createdAt) return false;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            return toLocalISODate(d) === day.date;
        });
    }, [sales, day.date]);

    const daySalesIds = useMemo(() => new Set(daySales.map(s => s.id)), [daySales]);

    const daySaleItems = useMemo(() => {
        return saleItems.filter(item => daySalesIds.has(item.saleId));
    }, [saleItems, daySalesIds]);

    const dayExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (!e.createdAt) return false;
            const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            return toLocalISODate(d) === day.date;
        });
    }, [expenses, day.date]);

    const itemsBySale = useMemo(() => {
        const groups = {};
        daySaleItems.forEach(item => {
            if (!groups[item.saleId]) groups[item.saleId] = [];
            groups[item.saleId].push(item);
        });
        return groups;
    }, [daySaleItems]);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-[var(--mg-bg-surface)] rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200"
                style={{ maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-[var(--mg-border)] flex items-center justify-between bg-blue-50/20">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1670C2]">Detalle de Ganancia</span>
                        <h3 className="text-lg font-black text-[var(--mg-text-primary)] mt-0.5">{dateLabel}</h3>
                    </div>
                    <button onClick={onClose}
                        className="w-9 h-9 bg-[var(--mg-bg-elevated)] hover:bg-gray-200 rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-xl transition-all">×</button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                    
                    {/* Tarjetas de Resumen del Día */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)] text-center">
                            <span className="text-[9px] text-[var(--mg-text-faint)] uppercase font-bold tracking-wider block">Vendido</span>
                            <span className="text-sm font-black text-[var(--mg-text-primary)] mt-1 block">Bs {day.vendido.toFixed(2)}</span>
                        </div>
                        <div className="bg-[var(--mg-bg-elevated)] p-3 rounded-2xl border border-[var(--mg-border)] text-center">
                            <span className="text-[9px] text-[var(--mg-text-faint)] uppercase font-bold tracking-wider block">Costo de Ventas</span>
                            <span className="text-sm font-black text-[var(--mg-text-secondary)] mt-1 block">
                                {day.costoVendido > 0 ? `Bs ${day.costoVendido.toFixed(2)}` : '—'}
                            </span>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 text-center">
                            <span className="text-[9px] text-emerald-600 uppercase font-bold tracking-wider block">Ganancia Bruta</span>
                            <span className="text-sm font-black text-emerald-700 mt-1 block">Bs {day.gananciaBruta.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Ventas del Día */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#1670C2] flex items-center gap-1.5 border-b border-[var(--mg-border)] pb-1 font-bold">
                            🛒 Ventas del día ({daySales.length})
                        </h4>
                        {daySales.length === 0 ? (
                            <p className="text-xs text-[var(--mg-text-faint)] italic">No hubo ventas registradas.</p>
                        ) : (
                            <div className="space-y-3.5">
                                {daySales.map(sale => {
                                    const saleItemsList = itemsBySale[sale.id] || [];
                                    const paymentLabel = sale.paymentMethod === 'cash' ? '💵 Efectivo' : (sale.paymentMethod === 'qr' ? '📱 QR' : '🔄 Mixto');
                                    const saleTime = (() => {
                                        const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.created_at || sale.createdAt);
                                        return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
                                    })();

                                    return (
                                        <div key={sale.id} className="border border-[var(--mg-border)] rounded-2xl p-3.5 space-y-3 bg-[var(--mg-bg-surface)] hover:shadow-sm transition-all">
                                            {/* Cabecera Venta */}
                                            <div className="flex justify-between items-start text-xs border-b border-[var(--mg-border)] pb-2">
                                                <div>
                                                    <span className="font-black text-[var(--mg-text-primary)] block">
                                                        {sale.clientName || sale.client_name || 'Cliente Casual'}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--mg-text-faint)] mt-0.5 block font-semibold">
                                                        {saleTime} · {paymentLabel}
                                                    </span>
                                                </div>
                                                <span className="font-extrabold text-[#1670C2] text-sm">
                                                    Bs {(sale.total || 0).toFixed(2)}
                                                </span>
                                            </div>

                                            {/* Items de Venta */}
                                            <div className="space-y-2.5">
                                                {saleItemsList.map(item => {
                                                    const supplierPriceVal = item.supplier_price !== undefined && item.supplier_price !== null 
                                                        ? Number(item.supplier_price) 
                                                        : (item.supplierPrice !== undefined && item.supplierPrice !== null 
                                                            ? Number(item.supplierPrice) 
                                                            : null);

                                                    const isCostAvailable = supplierPriceVal !== null;
                                                    const lineCost = isCostAvailable ? supplierPriceVal * Number(item.quantity) : null;
                                                    const lineProfit = isCostAvailable ? (Number(item.price) - supplierPriceVal) * Number(item.quantity) : null;

                                                    return (
                                                        <div key={item.id} className="text-xs flex flex-col md:flex-row md:justify-between md:items-center gap-1 pb-1.5 border-b border-dashed border-[var(--mg-border)] last:border-0 last:pb-0">
                                                            <div className="min-w-0">
                                                                <span className="font-bold text-[var(--mg-text-primary)] block truncate">{item.productName}</span>
                                                                <span className="text-[10px] text-[var(--mg-text-muted)] mt-0.5 block">
                                                                    {item.quantity} und. × Bs {Number(item.price).toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 text-[10px] md:text-right font-medium">
                                                                <div className="text-[var(--mg-text-secondary)]">
                                                                    Costo: <span className="font-bold">{isCostAvailable ? `Bs ${supplierPriceVal.toFixed(2)}` : '—'}</span>
                                                                </div>
                                                                <div className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-extrabold">
                                                                    Ganancia: {isCostAvailable ? `Bs ${lineProfit.toFixed(2)}` : '—'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Gastos del Día */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-purple-700 flex items-center gap-1.5 border-b border-[var(--mg-border)] pb-1 font-bold">
                            💸 Gastos del día ({dayExpenses.length})
                        </h4>
                        {dayExpenses.length === 0 ? (
                            <p className="text-xs text-[var(--mg-text-faint)] italic">No hubo gastos registrados.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    {dayExpenses.map(exp => {
                                        const isFixed = exp.expense_type === 'fixed' || exp.expenseType === 'fixed';
                                        return (
                                            <div key={exp.id} className="flex justify-between items-center text-xs p-3 border border-[var(--mg-border)] rounded-2xl bg-purple-50/10">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-[var(--mg-text-primary)]">{exp.description}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                                                            isFixed ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                            {isFixed ? 'Fijo' : 'Diario'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-[var(--mg-text-faint)] font-semibold uppercase mt-0.5 block">{exp.category || 'Otros'}</span>
                                                </div>
                                                <span className="font-bold text-red-600">- Bs {Number(exp.amount).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Subtotales de gastos del día */}
                                <div className="flex flex-col gap-1 border-t border-dashed border-[var(--mg-border)] pt-3 text-[11px] font-medium text-right text-gray-500">
                                    <div>
                                        Subtotal Gastos Diarios: <span className="font-bold text-gray-700">Bs {day.egresosDiarios.toFixed(2)}</span>
                                    </div>
                                    {day.egresosFijos > 0 && (
                                        <div className="text-purple-600">
                                            Gastos Fijos registrados hoy (informativo): <span className="font-bold">Bs {day.egresosFijos.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--mg-border)] bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-faint)] block">Ganancia Neta Diaria (Venta − Costo − G. Diarios)</span>
                        <span className={`text-xl font-black ${day.gananciaNeta >= 0 ? 'text-green-600' : 'text-red-500'} mt-0.5 block`}>
                            Bs {day.gananciaNeta.toFixed(2)}
                        </span>
                        {day.egresosFijos > 0 && (
                            <span className="text-[9px] text-purple-600 block mt-1 font-semibold">
                                * Se registraron Bs {day.egresosFijos.toFixed(2)} fijos hoy (se restan del total del mes).
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-[#1670C2] text-white font-bold px-6 py-3 rounded-2xl text-xs active:scale-95 transition-all shadow-md sm:self-center"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}