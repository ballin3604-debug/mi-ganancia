import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import { AppIcon } from '../components/icons';

function getExpenseFlow(e) {
    return (e.expense_type === 'fixed' || e.expenseType === 'fixed') ? 'fixed' : 'daily';
}

const VALID_REPORT_TYPES = ['ranking', 'expenses', 'inventory', 'profit', 'costoVendido'];
const REPORT_TYPE_META = {
    ranking: { icon: '🏆', title: 'Ranking de Productos', subtitle: 'Productos más vendidos por unidades e ingresos.' },
    expenses: { icon: '💵', title: 'Reporte de Egresos', subtitle: 'Egresos registrados y su distribución por categoría.' },
    inventory: { icon: '📦', title: 'Reporte de Inventario', subtitle: 'Stock actual al día de hoy · entradas y salidas del período elegido.' },
    profit: { icon: '📈', title: 'Ganancias Diarias', subtitle: 'Ingresos, costos, gastos y ganancia neta día por día.' },
    costoVendido: { icon: '📦', title: 'Costo de lo Vendido', subtitle: 'Costo de proveedor de cada producto vendido en el periodo.' },
};

export default function MatrixReport() {
    const { businessId } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [sales, setSales] = useState([]);
    const [saleItems, setSaleItems] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [products, setProducts] = useState([]);
    const [replenishments, setReplenishments] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const requestedType = searchParams.get('type');
    const reportType = VALID_REPORT_TYPES.includes(requestedType) ? requestedType : 'profit'; // 'ranking' | 'expenses' | 'inventory' | 'profit' | 'costoVendido'
    // Solo aplica al reporte de Egresos: llegar con ?flow=daily (desde el
    // botón "Gastos Diarios" de Ganancias Diarias) lo filtra a solo egresos
    // diarios, excluyendo los fijos.
    const flowFilter = searchParams.get('flow');
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
                const isFixed = getExpenseFlow(exp) === 'fixed';
                return [d.toLocaleDateString('es-BO'), exp.description || '', exp.supplier || '', exp.category || 'Otros', isFixed ? 'Fijo' : 'Diario', `Bs ${Number(exp.amount || 0).toFixed(2)}`];
            });
            exportReportToPDF({
                businessName: settings?.businessName,
                title: flowFilter === 'daily' ? 'Gastos Diarios' : 'Reporte de Egresos',
                subtitle: flowFilter === 'daily' ? 'Egresos diarios (no fijos) registrados en el periodo.' : 'Egresos registrados y su distribución por categoría.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Fecha' },
                    { label: 'Descripción' },
                    { label: 'Proveedor' },
                    { label: 'Categoría' },
                    { label: 'Tipo' },
                    { label: 'Monto', align: 'right' },
                ],
                rows,
                totals: { values: { 5: `Bs ${totalExpenses.toFixed(2)}` } },
            });
            return;
        }
        if (reportType === 'costoVendido') {
            const rows = costOfGoodsRows.map((r) => {
                const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
                return [
                    d.toLocaleDateString('es-BO'),
                    `#${String(r.saleNumber).padStart(4, '0')}`,
                    r.productName,
                    r.category,
                    r.quantity,
                    r.unitCost !== null ? `Bs ${r.unitCost.toFixed(2)}` : 'Sin costo',
                    r.costTotal !== null ? `Bs ${r.costTotal.toFixed(2)}` : 'Sin costo',
                ];
            });
            exportReportToPDF({
                businessName: settings?.businessName,
                title: 'Costo de lo Vendido',
                subtitle: 'Costo de proveedor de cada producto vendido en el periodo.',
                periodLabel: periodLabel(),
                columns: [
                    { label: 'Fecha' },
                    { label: 'N° Venta' },
                    { label: 'Producto' },
                    { label: 'Categoría' },
                    { label: 'Cantidad', align: 'right' },
                    { label: 'Costo Unitario', align: 'right' },
                    { label: 'Costo Total', align: 'right' },
                ],
                rows,
                totals: { values: { 6: `Bs ${totalCostOfGoodsRows.toFixed(2)}` } },
            });
            return;
        }
        if (reportType === 'inventory') {
            const rows = inventoryRows.map((p) => [
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
                subtitle: inventoryCategory === 'Todas'
                    ? 'Stock actual, valorización y movimientos de entrada/salida.'
                    : `Stock actual, valorización y movimientos · Categoría: ${inventoryCategory}.`,
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
                        2: inventoryRows.reduce((sum, p) => sum + Number(p.stock || 0), 0),
                        4: `Bs ${inventorySummary.value.toFixed(2)}`,
                        5: inventoryRows.reduce((sum, p) => sum + Number(productEntries[p.id] || 0), 0),
                        6: inventoryRows.reduce((sum, p) => sum + Number(productMovements[p.id] || 0), 0),
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
    }

    // Fechas por defecto: solo el día de hoy (salvo que se llegue con
    // ?start=&end= desde otro reporte, en cuyo caso se respeta ese rango).
    const [startDate, setStartDate] = useState(() => {
        const fromUrl = searchParams.get('start');
        if (fromUrl) return fromUrl;
        return toLocalISODate(new Date());
    });
    const [endDate, setEndDate] = useState(() => {
        return searchParams.get('end') || toLocalISODate(new Date());
    });

    // Filtro por categoría + kardex (solo reporte de inventario)
    const [inventoryCategory, setInventoryCategory] = useState('Todas');
    const [kardexProductId, setKardexProductId] = useState(null);

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
            const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
            const qty = Number(item.quantity || 0) * factor;
            const subtotal = item.subtotal || 0;

            if (!productSales[pName]) {
                productSales[pName] = {
                    productName: pName,
                    productId: item.productId || null,
                    image: item.image_url || '',
                    quantity: 0,
                    totalRevenue: 0,
                };
            }
            const entry = productSales[pName];
            entry.quantity += qty;
            entry.totalRevenue += subtotal;
            if (!entry.image && item.image_url) entry.image = item.image_url;
            if (!entry.productId && item.productId) entry.productId = item.productId;
        });

        // Foto desde el catálogo cuando el ítem vendido no trae imagen
        const imageById = {};
        products.forEach(p => {
            imageById[p.id] = p.imageData || p.image_url || '';
        });
        const ranking = Object.values(productSales).map(entry => ({
            ...entry,
            image: entry.image || (entry.productId ? (imageById[entry.productId] || '') : ''),
        }));
        ranking.sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue);

        return ranking;
    }, [sales, saleItems, products, startDate, endDate]);

    // -- Lógica para Reporte de Egresos --
    const start = useMemo(() => new Date(`${startDate}T00:00:00`), [startDate]);
    const end = useMemo(() => new Date(`${endDate}T23:59:59.999`), [endDate]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (!e.createdAt) return false;
            const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
            if (d < start || d > end) return false;
            if (flowFilter && getExpenseFlow(e) !== flowFilter) return false;
            return true;
        });
    }, [expenses, start, end, flowFilter]);

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

    const inventoryRows = useMemo(() => {
        if (inventoryCategory === 'Todas') return products;
        return products.filter(p => (p.category || 'Otros') === inventoryCategory);
    }, [products, inventoryCategory]);

    // -- Kardex de inventario: categorías, filtro y movimientos por producto --
    const inventoryCategories = useMemo(() => {
        const set = new Set();
        products.forEach(p => { if (p.category) set.add(p.category); });
        return ['Todas', ...[...set].sort((a, b) => a.localeCompare(b, 'es'))];
    }, [products]);

    const saleDateById = useMemo(() => {
        const map = {};
        sales.forEach(s => {
            if (!s.createdAt) return;
            map[s.id] = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        });
        return map;
    }, [sales]);

    // Movimientos del producto seleccionado en el periodo + saldo corrido.
    // Stock inicial = stock actual − (entradas − salidas del periodo).
    const kardexData = useMemo(() => {
        if (!kardexProductId) return null;
        const product = products.find(p => p.id === kardexProductId);
        if (!product) return null;
        const moves = [];
        replenishments.forEach(r => {
            if (r.productId !== kardexProductId || !r.createdAt) return;
            const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
            if (d < start || d > end) return;
            moves.push({ date: d, type: 'entrada', qty: Number(r.quantity || 0) });
        });
        saleItems.forEach(item => {
            if (item.productId !== kardexProductId) return;
            const d = saleDateById[item.saleId];
            if (!d || d < start || d > end) return;
            moves.push({ date: d, type: 'salida', qty: Number(item.quantity || 0) });
        });
        moves.sort((a, b) => a.date - b.date);
        const totalIn = moves.filter(m => m.type === 'entrada').reduce((s, m) => s + m.qty, 0);
        const totalOut = moves.filter(m => m.type === 'salida').reduce((s, m) => s + m.qty, 0);
        const currentStock = Number(product.stock || 0);
        let balance = currentStock - (totalIn - totalOut);
        const initialStock = balance;
        const rows = moves.map(m => {
            balance = m.type === 'entrada' ? balance + m.qty : balance - m.qty;
            return { ...m, balance };
        });
        return { product, rows, totalIn, totalOut, initialStock, currentStock };
    }, [kardexProductId, products, replenishments, saleItems, saleDateById, start, end]);

    // Resumen de lo que se está mostrando (respeta el filtro de categoría).
    // Un solo recorrido cacheado: valor, bajo stock y conteo salen juntos
    // y solo se recalculan si cambian las filas visibles.
    const inventorySummary = useMemo(() => {
        let value = 0;
        let low = 0;
        for (const p of inventoryRows) {
            value += (Number(p.stock) || 0) * (Number(p.price) || 0);
            if ((Number(p.stock) || 0) <= (Number(p.minStock) || 5)) low += 1;
        }
        return { value, low, count: inventoryRows.length };
    }, [inventoryRows]);

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
                    const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
                    dailyData[dateStr].costoVendido += itemCost * Number(item.quantity || 0) * factor;
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

    // N° Venta: correlativo estable por orden cronológico de TODO el
    // historial (no cambia si se mueve el filtro de fechas) — mismo criterio
    // que usa el Reporte de Ventas, para que el número sea consistente entre
    // reportes.
    const saleNumberById = useMemo(() => {
        const map = {};
        sales
            .slice()
            .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return da - db;
            })
            .forEach((s, i) => { map[s.id] = i + 1; });
        return map;
    }, [sales]);

    // Detalle línea por línea del Costo de lo Vendido — misma fuente y misma
    // resolución de costo (supplier_price / supplierPrice / sin costo) que
    // profitReportData.costoVendido, para que el total de esta tabla siempre
    // coincida exactamente con la tarjeta "Costo de lo Vendido".
    const costOfGoodsRows = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);

        const saleById = {};
        sales.forEach(s => {
            if (!s.createdAt) return;
            const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
            if (d >= start && d <= end) saleById[s.id] = s;
        });

        return saleItems
            .filter(item => saleById[item.saleId])
            .map(item => {
                const s = saleById[item.saleId];
                const hasCost = (item.supplier_price !== undefined && item.supplier_price !== null)
                    || (item.supplierPrice !== undefined && item.supplierPrice !== null);
                const unitCost = item.supplier_price !== undefined && item.supplier_price !== null
                    ? Number(item.supplier_price)
                    : (item.supplierPrice !== undefined && item.supplierPrice !== null ? Number(item.supplierPrice) : null);
                const quantity = Number(item.quantity || 0);
                const factor = Number(item.presentation_factor ?? item.presentationFactor ?? 1);
                return {
                    rowKey: item.id,
                    createdAt: s.createdAt,
                    saleNumber: saleNumberById[s.id],
                    productName: item.presentation ? `${item.productName} · ${item.presentation}` : item.productName,
                    category: item.category || 'Otros',
                    quantity: factor > 1 ? `${quantity} (${item.presentation || ''} x${factor})` : quantity,
                    unitCost,
                    costTotal: hasCost ? unitCost * quantity * factor : null,
                };
            })
            .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return db - da;
            });
    }, [sales, saleItems, saleNumberById, startDate, endDate]);

    const totalCostOfGoodsRows = useMemo(
        () => costOfGoodsRows.reduce((sum, r) => sum + (r.costTotal || 0), 0),
        [costOfGoodsRows]
    );

    if (loading) return <LoadingSpinner />;

    const meta = REPORT_TYPE_META[reportType];

    const currentReportHasData = (() => {
        switch (reportType) {
            case 'profit': return profitReportData.days.length > 0;
            case 'expenses': return filteredExpenses.length > 0;
            case 'inventory': return products.length > 0;
            case 'ranking': return rankingMatrix.length > 0;
            case 'costoVendido': return costOfGoodsRows.length > 0;
            default: return true;
        }
    })();

    return (
        <div className="p-4 lg:p-6 pb-24 mg-fade-in w-full mx-auto">
            <ReportHeader
                icon={meta?.icon}
                title={reportType === 'expenses' && flowFilter === 'daily' ? 'Gastos Diarios' : (meta?.title || 'Reportes y Estadísticas')}
                subtitle={reportType === 'expenses' && flowFilter === 'daily' ? 'Egresos diarios (no fijos) registrados en el periodo.' : meta?.subtitle}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onExport={handleExport}
                exportLabel="Exportar PDF"
                exportDisabled={!currentReportHasData}
            />

            <div className="bg-[var(--mg-bg-surface)] rounded-[20px] border border-[var(--mg-border)] p-3 sm:p-6 lg:p-8 shadow-sm">
                {reportType === 'expenses' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de Total destacado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-[#1670C2] mb-1">
                                        {flowFilter === 'daily' ? 'Total Gastos Diarios en Periodo' : 'Total Egresos en Periodo'}
                                    </p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-[#1670C2]">Bs {totalExpenses.toFixed(2)}</h3>
                                </div>
                                <AppIcon name="gastos" size={36} />
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-1">Transacciones Registradas</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-gray-700">{filteredExpenses.length}</h3>
                                </div>
                                <AppIcon name="texto" size={36} />
                            </div>
                        </div>

                        {/* Desglose por categoría (Gráfico de barras CSS) */}
                        {expensesByCategory.length > 0 && (
                            <div className="bg-white border border-[var(--mg-border)] rounded-[20px] p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-[var(--mg-text-primary)] mb-4 flex items-center gap-2"><AppIcon name="reportes" size={20} /> Distribución de Egresos por Categoría</h3>
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
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-center whitespace-nowrap w-24">
                                            Tipo
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
                                        const isFixed = getExpenseFlow(exp) === 'fixed';
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
                                                <td className="p-3 border border-[var(--mg-border)] text-center">
                                                    <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${isFixed ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {isFixed ? 'Fijo' : 'Diario'}
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
                                            <td colSpan={6} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                No se encontraron egresos en el rango de fechas seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : reportType === 'costoVendido' ? (
                    <div className="space-y-6">
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm max-w-md">
                            <div>
                                <p className="text-xs font-extrabold uppercase tracking-widest text-orange-700 mb-1">Total Costo de lo Vendido</p>
                                <h3 className="text-2xl sm:text-3xl font-black text-orange-700">Bs {totalCostOfGoodsRows.toFixed(2)}</h3>
                            </div>
                            <AppIcon name="nuevoProducto" size={36} />
                        </div>

                        <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
                            <table className="w-full text-sm min-w-[720px] border-collapse bg-white">
                                <thead>
                                    <tr>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap w-28">Fecha</th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap w-24">N° Venta</th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap">Producto</th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-center whitespace-nowrap w-32">Categoría</th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap w-24">Cantidad</th>
                                        <th className="bg-blue-50 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap w-32">Costo Unitario</th>
                                        <th className="bg-blue-100 text-[#1670C2] font-bold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap w-32">Costo Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {costOfGoodsRows.map((r) => {
                                        const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt);
                                        const dateStr = d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                        return (
                                            <tr key={r.rowKey} className="hover:bg-blue-50/20 transition-colors">
                                                <td className="p-3 border border-[var(--mg-border)] font-mono text-xs text-[var(--mg-text-primary)]">{dateStr}</td>
                                                <td className="p-3 border border-[var(--mg-border)] font-mono text-xs font-bold text-[var(--mg-text-primary)]">{`#${String(r.saleNumber).padStart(4, '0')}`}</td>
                                                <td className="p-3 border border-[var(--mg-border)] text-[var(--mg-text-primary)] font-medium">{r.productName}</td>
                                                <td className="p-3 border border-[var(--mg-border)] text-center">
                                                    <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">{r.category}</span>
                                                </td>
                                                <td className="p-3 border border-[var(--mg-border)] text-right">{r.quantity}</td>
                                                {r.unitCost !== null ? (
                                                    <>
                                                        <td className="p-3 border border-[var(--mg-border)] text-right">Bs {r.unitCost.toFixed(2)}</td>
                                                        <td className="p-3 border border-[var(--mg-border)] text-right font-black text-orange-700">Bs {r.costTotal.toFixed(2)}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="p-3 border border-[var(--mg-border)] text-right">
                                                            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 text-xs font-semibold">Sin costo</span>
                                                        </td>
                                                        <td className="p-3 border border-[var(--mg-border)] text-right">
                                                            <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 text-xs font-semibold">Sin costo</span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {costOfGoodsRows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-10 text-center text-[var(--mg-text-muted)] font-medium text-base bg-gray-50/30">
                                                No se encontraron productos vendidos en el rango de fechas seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                {costOfGoodsRows.length > 0 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan={6} className="p-3 border border-[var(--mg-border)] text-right font-bold text-[var(--mg-text-secondary)] bg-gray-50">
                                                Total Costo de lo Vendido
                                            </td>
                                            <td className="p-3 border border-[var(--mg-border)] text-right font-black text-orange-700 bg-gray-50">
                                                Bs {totalCostOfGoodsRows.toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                ) : reportType === 'inventory' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de lo que se está mostrando (respetan el filtro) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-[#1670C2] mb-1">Valor Total del Inventario</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-[#1670C2]">Bs {inventorySummary.value.toFixed(2)}</h3>
                                </div>
                                <AppIcon name="caja" size={36} />
                            </div>
                            <div className={`border rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm ${inventorySummary.low > 0 ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'}`}>
                                <div>
                                    <p className={`text-xs font-extrabold uppercase tracking-widest mb-1 ${inventorySummary.low > 0 ? 'text-amber-700' : 'text-green-700'}`}>Stock Bajo (Reponer)</p>
                                    <h3 className={`text-2xl sm:text-3xl font-black ${inventorySummary.low > 0 ? 'text-amber-700' : 'text-green-700'}`}>{inventorySummary.low} {inventorySummary.low === 1 ? 'producto' : 'productos'}</h3>
                                </div>
                                <span><AppIcon name={inventorySummary.low > 0 ? 'reloj' : 'check'} size={36} /></span>
                            </div>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 sm:p-6 gap-3 flex items-center justify-between shadow-sm">
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-500 mb-1">Total Catálogo</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-gray-700">{inventorySummary.count} {inventorySummary.count === 1 ? 'producto' : 'productos'}</h3>
                                    {inventoryCategory !== 'Todas' && (
                                        <p className="text-[11px] font-bold text-gray-500 mt-0.5">en {inventoryCategory} · {products.length} en total</p>
                                    )}
                                </div>
                                <AppIcon name="nuevoProducto" size={36} />
                            </div>
                        </div>

                        {/* Filtro por categoría */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)]">
                                Categoría
                            </label>
                            <select
                                value={inventoryCategory}
                                onChange={(e) => setInventoryCategory(e.target.value)}
                                className="mg-input text-xs font-bold py-2 w-auto min-w-44"
                                aria-label="Filtrar inventario por categoría"
                            >
                                {inventoryCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat === 'Todas' ? `Todas (${products.length})` : cat}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[11px] text-[var(--mg-text-muted)] font-medium">
                                Toca un producto para ver su kardex en el periodo.
                            </span>
                        </div>

                        {/* Tabla detallada de Inventario */}
                        <DataTable
                            storageKey="mg-reporte-inventario-columns"
                            getRowKey={(p) => p.id}
                            emptyMessage="No hay productos en esta categoría."
                            rows={inventoryRows}
                            columns={[
                                {
                                    key: 'producto', label: 'Producto', align: 'left',
                                    render: (p) => (
                                        <button
                                            type="button"
                                            onClick={() => setKardexProductId(p.id)}
                                            className="font-bold text-[var(--mg-text-primary)] text-left hover:text-[#1670C2] hover:underline transition-colors cursor-pointer"
                                            title="Ver kardex del producto en el periodo"
                                        >
                                            {p.name}
                                            {p.brand && <span className="text-[10px] text-[var(--mg-text-muted)] font-normal block">{p.brand}</span>}
                                        </button>
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
                                            <span className="text-green-600 bg-green-50 px-2 py-1 rounded-full font-black tabular-nums">+{entries} und.</span>
                                        ) : (
                                            <span className="text-[var(--mg-text-faint)] font-bold tabular-nums">0 und.</span>
                                        );
                                    },
                                },
                                {
                                    key: 'salidas', label: 'Salidas (Ventas)', align: 'center', width: 'w-32',
                                    render: (p) => {
                                        const exits = productMovements[p.id] || 0;
                                        return exits > 0 ? (
                                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-black tabular-nums">−{exits} und.</span>
                                        ) : (
                                            <span className="text-[var(--mg-text-faint)] font-bold tabular-nums">0 und.</span>
                                        );
                                    },
                                },
                            ]}
                        />
                        <p className="text-[11px] text-[var(--mg-text-muted)] italic text-right mt-1">
                            Stock actual al día de hoy. Entradas = unidades compradas y salidas = unidades vendidas en el periodo elegido.
                        </p>
                    </div>
                ) : reportType === 'profit' ? (
                    <div className="space-y-6">
                        {/* Tarjetas de ganancias destacadas */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mg-stagger">
                                {[
                                    {
                                        label: 'Total Vendido',
                                        value: profitReportData.totalVendido,
                                        hint: 'Ver Reporte de Ventas ›',
                                        title: 'Ver el detalle de ventas que justifica este total',
                                        to: `/ventas?tab=reporte&start=${startDate}&end=${endDate}`,
                                        accent: 'text-[var(--mg-accent)]',
                                        chip: 'bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] border-[var(--mg-accent-border)]',
                                        icon: '💰',
                                    },
                                    {
                                        label: 'Costo de lo Vendido',
                                        value: profitReportData.totalCostoVendido,
                                        hint: 'Ver detalle de costos ›',
                                        title: 'Ver el detalle de costos que justifica este total',
                                        to: `/reportes?type=costoVendido&start=${startDate}&end=${endDate}`,
                                        accent: 'text-orange-600',
                                        chip: 'bg-orange-50 text-orange-600 border-orange-100',
                                        icon: '📦',
                                    },
                                    {
                                        label: 'Ganancia Bruta',
                                        value: profitReportData.totalGananciaBruta,
                                        hint: 'Ver Reporte de Ventas ›',
                                        title: 'Ver el detalle de ventas y ganancia por producto que justifica este total',
                                        to: `/ventas?tab=reporte&start=${startDate}&end=${endDate}`,
                                        accent: 'text-emerald-600',
                                        chip: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                                        icon: '📈',
                                    },
                                    {
                                        label: 'Gastos Diarios',
                                        value: profitReportData.totalEgresosDiarios,
                                        hint: 'Ver detalle de gastos ›',
                                        title: 'Ver el detalle de egresos que justifica este total',
                                        to: `/reportes?type=expenses&flow=daily&start=${startDate}&end=${endDate}`,
                                        accent: 'text-purple-600',
                                        chip: 'bg-purple-50 text-purple-600 border-purple-100',
                                        icon: '💸',
                                    },
                                ].map((card) => (
                                    <button
                                        key={card.label}
                                        type="button"
                                        onClick={() => navigate(card.to)}
                                        title={card.title}
                                        className="group text-left bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-[22px] p-5 shadow-xs hover:shadow-md hover:-translate-y-1 active:scale-98 transition-all"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--mg-text-muted)]">
                                                {card.label}
                                            </span>
                                            <span className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base shrink-0 group-hover:scale-110 transition-transform ${card.chip}`}>
                                                {card.icon}
                                            </span>
                                        </div>

                                        <p className={`text-2xl lg:text-2xl sm:text-3xl font-black tracking-tight ${card.accent}`}>
                                            Bs {card.value.toFixed(2)}
                                        </p>

                                        <p className="text-[11px] font-bold text-[var(--mg-text-muted)] mt-3 pt-2.5 border-t border-[var(--mg-separator)] group-hover:text-[var(--mg-accent)] transition-colors">
                                            {card.hint}
                                        </p>
                                    </button>
                                ))}
                            </div>

                            {/* Tarjeta Ganancia Neta Real (Destacada con Desglose) */}
                            <div className={`relative overflow-hidden border-2 rounded-[24px] p-6 flex flex-col md:flex-row md:items-center md:justify-between shadow-sm transition-all gap-6 ${
                                profitReportData.totalGananciaNeta >= 0
                                    ? 'bg-[var(--mg-success-bg)] border-green-200'
                                    : 'bg-[var(--mg-danger-bg)] border-red-200'
                            }`}>
                                {/* Halo suave, en el tono del resultado */}
                                <div
                                    className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-40"
                                    style={{ background: profitReportData.totalGananciaNeta >= 0 ? 'var(--mg-success)' : 'var(--mg-danger)' }}
                                />

                                <div className="relative space-y-1">
                                    <p className={`text-[11px] font-black uppercase tracking-wider mb-1 ${
                                        profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                    }`}>
                                        🌟 Ganancia Neta Real del Periodo
                                    </p>
                                    <h3 className={`text-3xl lg:text-4xl font-black tracking-tight ${
                                        profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                    }`}>
                                        Bs {profitReportData.totalGananciaNeta.toFixed(2)}
                                    </h3>
                                    <p className="text-xs text-[var(--mg-text-secondary)] mt-2 font-medium max-w-md">
                                        Resultado neto de la operación comercial restando todos los costos y gastos del periodo.
                                    </p>
                                    {profitReportData.totalItemsSinCosto > 0 && (
                                        <p className="text-xs text-[var(--mg-warning)] bg-[var(--mg-warning-bg)] border border-amber-200 rounded-xl px-2.5 py-1.5 mt-2 font-bold">
                                            ⚠️ {profitReportData.totalItemsSinCosto} {profitReportData.totalItemsSinCosto === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen'} costo de proveedor registrado — la ganancia real podría ser menor a la mostrada.
                                        </p>
                                    )}
                                </div>

                                {/* Panel de Desglose Matemático */}
                                <div className="relative bg-[var(--mg-bg-surface)] border border-[var(--mg-border)] rounded-2xl p-4 text-xs space-y-2 min-w-[260px] shadow-sm shrink-0">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-[var(--mg-text-muted)] font-bold">Ganancia Bruta:</span>
                                        <span className="font-black text-[var(--mg-text-primary)]">Bs {profitReportData.totalGananciaBruta.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-[var(--mg-danger)] font-bold">
                                        <span>(-) Gastos Diarios:</span>
                                        <span className="font-black">Bs {profitReportData.totalEgresosDiarios.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-purple-600 font-bold">
                                        <span>(-) Gastos Fijos (Periodo):</span>
                                        <span className="font-black">Bs {profitReportData.totalEgresosFijos.toFixed(2)}</span>
                                    </div>
                                    <div className={`border-t border-dashed border-[var(--mg-border)] pt-2 flex justify-between gap-4 font-black text-sm ${
                                        profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                    }`}>
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
                                    <tr className="text-[11px] uppercase tracking-wider">
                                        <th className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-extrabold p-3.5 border border-[var(--mg-border)] text-left whitespace-nowrap">
                                            Fecha
                                        </th>
                                        <th className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-extrabold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Total Vendido
                                        </th>
                                        <th className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-extrabold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Costo Vendido
                                        </th>
                                        <th className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-extrabold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Ganancia Bruta
                                        </th>
                                        <th className="bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)] font-extrabold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
                                            Gastos Diarios
                                        </th>
                                        <th className="bg-[var(--mg-accent-bg)] text-[var(--mg-accent)] font-extrabold p-3.5 border border-[var(--mg-border)] text-right whitespace-nowrap">
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
                                                className="hover:bg-[var(--mg-bg-elevated)] transition-colors cursor-pointer group"
                                                onClick={() => setSelectedDayDetail(day)}
                                                title="Ver detalle del día"
                                            >
                                                <td className="p-3 border border-[var(--mg-border)] font-mono text-[var(--mg-text-primary)] font-bold">
                                                    {dateLabel}{' '}
                                                    <span className="text-[10px] text-[var(--mg-text-faint)] font-normal opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
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
                                                <td className="p-3 border border-[var(--mg-border)] text-right text-[var(--mg-danger)] font-medium">
                                                    <div>Bs {day.egresosDiarios.toFixed(2)}</div>
                                                    {day.egresosFijos > 0 && (
                                                        <span className="text-[9px] text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md inline-block font-bold mt-0.5" title="Gasto fijo registrado este día (se descuenta al final en el global)">
                                                            + Bs {day.egresosFijos.toFixed(2)} fijos
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`p-3 border border-[var(--mg-border)] text-right font-black ${isDayPositive ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                                                    Bs {day.gananciaNeta.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {profitReportData.days.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center bg-[var(--mg-bg-elevated)]">
                                                <p className="text-3xl mb-2">📈</p>
                                                <p className="font-extrabold text-[var(--mg-text-primary)] text-sm">Sin registros en este periodo</p>
                                                <p className="text-xs text-[var(--mg-text-muted)] mt-1 font-medium">Probá ampliando el rango de fechas.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[20px] shadow-sm border border-[var(--mg-border)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-50">
                        <table className="w-full text-sm min-w-[600px] border-collapse bg-white">
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
                                                <div className="flex items-center gap-3">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.productName}
                                                            className="w-10 h-10 rounded-xl object-cover border border-[var(--mg-border)] shrink-0 bg-gray-50"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span className="w-10 h-10 rounded-xl bg-[var(--mg-bg-elevated)] border border-[var(--mg-border)] flex items-center justify-center text-lg shrink-0">
                                                            📦
                                                        </span>
                                                    )}
                                                    <span className="min-w-0 break-words">{item.productName}</span>
                                                </div>
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
                        </table>
                    </div>
                )}

                <div className="mt-8 text-center text-xs text-[var(--mg-text-muted)] border-t border-dashed border-[var(--mg-border)] pt-5 flex justify-center gap-6 flex-wrap">
                    {reportType === 'ranking'
                        ? <span>🏆 Ranking ordenado de los productos con mayor demanda física e ingresos totales.</span>
                        : reportType === 'costoVendido'
                        ? <span>📦 Costo de proveedor de cada producto vendido — su suma es el "Costo de lo Vendido" de Ganancias Diarias.</span>
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
            {kardexData && (
                <KardexModal
                    data={kardexData}
                    periodLabel={periodLabel()}
                    onClose={() => setKardexProductId(null)}
                />
            )}
        </div>
    );
}

function KardexModal({ data, periodLabel, onClose }) {
    const { product, rows, totalIn, totalOut, initialStock, currentStock } = data;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-[var(--mg-bg-surface)] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200"
                style={{ maxHeight: '90vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-[var(--mg-border)] flex items-center justify-between bg-blue-50/20">
                    <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1670C2]">Kardex · {periodLabel}</span>
                        <h3 className="text-lg font-black text-[var(--mg-text-primary)] mt-0.5 truncate">{product.name}</h3>
                        {product.brand && <p className="text-xs text-[var(--mg-text-muted)]">{product.brand}</p>}
                    </div>
                    <button onClick={onClose}
                        className="w-9 h-9 shrink-0 bg-[var(--mg-bg-elevated)] hover:bg-gray-200 rounded-full flex items-center justify-center text-[var(--mg-text-muted)] font-bold text-xl transition-all">×</button>
                </div>

                <div className="px-5 pt-4 grid grid-cols-3 gap-2.5">
                    <div className="bg-[var(--mg-bg-elevated)] p-2.5 rounded-2xl border border-[var(--mg-border)] text-center">
                        <span className="text-[9px] text-[var(--mg-text-faint)] uppercase font-bold tracking-wider block">Stock inicial</span>
                        <span className="text-sm font-black text-[var(--mg-text-primary)] mt-0.5 block tabular-nums">{initialStock} und.</span>
                    </div>
                    <div className="bg-green-50 p-2.5 rounded-2xl border border-green-100 text-center">
                        <span className="text-[9px] text-green-600 uppercase font-bold tracking-wider block">Entradas</span>
                        <span className="text-sm font-black text-green-700 mt-0.5 block tabular-nums">+{totalIn}</span>
                    </div>
                    <div className="bg-blue-50 p-2.5 rounded-2xl border border-blue-100 text-center">
                        <span className="text-[9px] text-blue-600 uppercase font-bold tracking-wider block">Salidas</span>
                        <span className="text-sm font-black text-blue-700 mt-0.5 block tabular-nums">−{totalOut}</span>
                    </div>
                </div>

                <div className="p-5 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {rows.length > 0 ? (
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--mg-border)] text-[var(--mg-text-muted)] font-extrabold uppercase text-[10px] bg-[var(--mg-bg-elevated)]">
                                    <th className="py-2 px-3 rounded-l-xl">Fecha</th>
                                    <th className="py-2 px-3">Movimiento</th>
                                    <th className="py-2 px-3 text-center">Cant.</th>
                                    <th className="py-2 px-3 text-right rounded-r-xl">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--mg-separator)] font-bold">
                                {rows.map((m, i) => (
                                    <tr key={i} className="hover:bg-blue-50/20">
                                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                                            {m.date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' })} · {m.date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${m.type === 'entrada' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                                {m.type === 'entrada' ? '⤴ Entrada' : '⤵ Salida'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center tabular-nums">{m.type === 'entrada' ? `+${m.qty}` : `−${m.qty}`}</td>
                                        <td className="py-2.5 px-3 text-right font-black tabular-nums">{m.balance} und.</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-xs text-[var(--mg-text-muted)] text-center py-6 font-medium">
                            Sin movimientos en este periodo. El stock actual es {currentStock} und.
                        </p>
                    )}
                </div>

                <div className="px-5 pb-4">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-2xl px-4 py-2.5 flex items-center justify-between text-sm font-black text-[#1670C2]">
                        <span>Stock actual</span>
                        <span className="tabular-nums">{currentStock} und.</span>
                    </div>
                </div>
            </div>
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