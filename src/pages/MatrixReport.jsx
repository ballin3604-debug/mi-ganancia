import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { subscribeToSales, subscribeToSaleItems } from '../services/sales';
import { subscribeToExpenses } from '../services/expenses';
import { subscribeToProducts, subscribeToReplenishments } from '../services/products';
import { getBusinessSettings } from '../services/businessSettings';
import LoadingSpinner from '../components/LoadingSpinner';
import DataTable from '../components/DataTable';
import ReportHeader from '../components/ReportHeader';
import { BranchSelect } from '../components/BranchSelect';
import { toLocalISODate } from '../utils/dateRanges';
import { exportReportToPDF } from '../utils/pdfExport';
import { AppIcon } from '../components/icons';
import MetricCard from '../components/ui/MetricCard';
import EmptyState from '../components/ui/EmptyState';
import SectionCard from '../components/ui/SectionCard';
import { useBranches } from '../context/BranchContext';
import { useBranchStocks } from '../hooks/useBranchStocks';
import { toStockMap } from '../services/branchStock';

function getExpenseFlow(e) {
    return (e.expense_type === 'fixed' || e.expenseType === 'fixed') ? 'fixed' : 'daily';
}

function formatReportDate(value) {
    if (!value) return '—';
    const d = value.toDate ? value.toDate() : new Date(value);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VALID_REPORT_TYPES = ['ranking', 'expenses', 'inventory', 'profit', 'costoVendido'];
const REPORT_TYPE_META = {
    ranking: { icon: 'ranking', title: 'Ranking de Productos', subtitle: 'Productos más vendidos por unidades e ingresos.' },
    expenses: { icon: 'gastos', title: 'Reporte de Egresos', subtitle: 'Egresos registrados y su distribución por categoría.' },
    inventory: { icon: 'almacen', title: 'Reporte de Inventario', subtitle: 'Stock actual al día de hoy · entradas y salidas del período elegido.' },
    profit: { icon: 'reportes', title: 'Ganancias Diarias', subtitle: 'Ingresos, costos, gastos y ganancia neta día por día.' },
    costoVendido: { icon: 'etiqueta', title: 'Costo de lo Vendido', subtitle: 'Costo de proveedor de cada producto vendido en el periodo.' },
};

export default function MatrixReport() {
    const { businessId } = useAuth();
    const { sectorConfig } = useBusiness();
    // Restaurante: los platos no tienen stock que valorizar; el reporte de
    // inventario no aplica (Ranking y Ganancias cubren lo necesario).
    const isRestaurantMode = !!sectorConfig?.features?.dishes;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [allSales, setSales] = useState([]);
    const [allSaleItems, setSaleItems] = useState([]);
    const [allExpenses, setExpenses] = useState([]);
    const [reportBranch, setReportBranch] = useState('all');
    const { branches } = useBranches();
    const mainBranchId = branches.find((b) => b.isMain)?.id || branches[0]?.id || null;
    const branchOfSale = (s) => s.branchId || s.branch_id || mainBranchId;
    const branchOfExpense = (e) => e.branch_id || mainBranchId;

    // Todo el reporte respeta la sede elegida (ventas, ítems y gastos).
    const sales = useMemo(() => (
      reportBranch === 'all' ? allSales : allSales.filter((s) => branchOfSale(s) === reportBranch)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [allSales, reportBranch, mainBranchId]);
    const saleItems = useMemo(() => {
      if (reportBranch === 'all') return allSaleItems;
      const ids = new Set(sales.map((s) => s.id));
      return allSaleItems.filter((it) => ids.has(it.saleId));
    }, [allSaleItems, sales, reportBranch]);
    const expenses = useMemo(() => (
      reportBranch === 'all' ? allExpenses : allExpenses.filter((e) => branchOfExpense(e) === reportBranch)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [allExpenses, reportBranch, mainBranchId]);

    // Stock por sede para el inventario (global si se ve todo).
    const branchStockRows = useBranchStocks(businessId, mainBranchId);
    const branchStockMap = useMemo(() => toStockMap(branchStockRows), [branchStockRows]);
    const [products, setProducts] = useState([]);
    const [replenishments, setReplenishments] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const requestedType = searchParams.get('type');
    // En restaurante el reporte de inventario cae a Ganancias Diarias.
    const effectiveType = isRestaurantMode && requestedType === 'inventory' ? 'profit' : requestedType;
    const reportType = VALID_REPORT_TYPES.includes(effectiveType) ? effectiveType : 'profit'; // 'ranking' | 'expenses' | 'inventory' | 'profit' | 'costoVendido'
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
        const sede = reportBranch === 'all'
            ? 'Todas las sedes'
            : (branches.find((b) => b.id === reportBranch)?.name || 'Sede');
        return `Periodo: ${formattedStart} hasta ${formattedEnd} · Sede: ${sede}`;
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

    // Productos con stock de la sede elegida (para el inventario).
    const invProducts = useMemo(() => {
      if (reportBranch === 'all' || branchStockRows.length === 0) return products;
      return products.map((p) => ({ ...p, stock: Number(branchStockMap.get(`${reportBranch}:${p.id}`) ?? 0) }));
    }, [products, reportBranch, branchStockRows, branchStockMap]);

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
        if (inventoryCategory === 'Todas') return invProducts;
        return invProducts.filter(p => (p.category || 'Otros') === inventoryCategory);
    }, [invProducts, inventoryCategory]);

    // -- Kardex de inventario: categorías, filtro y movimientos por producto --
    const inventoryCategories = useMemo(() => {
        const set = new Set();
        invProducts.forEach(p => { if (p.category) set.add(p.category); });
        return ['Todas', ...[...set].sort((a, b) => a.localeCompare(b, 'es'))];
    }, [invProducts]);

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
        const product = invProducts.find(p => p.id === kardexProductId);
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
    }, [kardexProductId, invProducts, replenishments, saleItems, saleDateById, start, end]);

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
                icon={<AppIcon name={meta?.icon || 'reportes'} size={21} />}
                title={reportType === 'expenses' && flowFilter === 'daily' ? 'Gastos Diarios' : (meta?.title || 'Reportes y Estadísticas')}
                subtitle={reportType === 'expenses' && flowFilter === 'daily' ? 'Egresos diarios (no fijos) registrados en el periodo.' : meta?.subtitle}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onExport={handleExport}
                exportLabel="Exportar PDF"
                exportDisabled={!currentReportHasData}
                branchSelector={
                    <BranchSelect
                        branches={branches}
                        value={reportBranch}
                        onChange={setReportBranch}
                        label="Sede"
                        allLabel="Todas"
                    />
                }
            />

            <div className="rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3 shadow-[var(--mg-shadow-sm)] sm:p-6 lg:p-8">
                {reportType === 'expenses' ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <MetricCard
                                label={flowFilter === 'daily' ? 'Total gastos diarios' : 'Total egresos'}
                                value={`Bs ${totalExpenses.toFixed(2)}`}
                                hint={`${filteredExpenses.length} ${filteredExpenses.length === 1 ? 'egreso registrado' : 'egresos registrados'}`}
                                icon="gastos"
                                tone="danger"
                            />
                            <MetricCard
                                label="Transacciones"
                                value={filteredExpenses.length}
                                hint={flowFilter === 'daily' ? 'Gastos diarios del período' : 'Movimientos del período'}
                                icon="recibo"
                                tone="neutral"
                            />
                        </div>

                        {expensesByCategory.length > 0 && (
                            <SectionCard
                                title="Distribución por categoría"
                                subtitle="Participación de cada categoría en el total de egresos."
                                bodyClassName="p-4 sm:p-5"
                            >
                                <div className="space-y-4">
                                    {expensesByCategory.map(({ category, amount, percentage }) => (
                                        <div key={category} className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--mg-text-primary)]">
                                                <span className="truncate">{category}</span>
                                                <span className="shrink-0 tabular-nums text-[var(--mg-text-secondary)]">
                                                    Bs {amount.toFixed(2)} <span className="text-[var(--mg-text-muted)]">({percentage.toFixed(1)}%)</span>
                                                </span>
                                            </div>
                                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--mg-bg-elevated)]">
                                                <div
                                                    className="h-full rounded-full bg-[var(--mg-brand)] transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </SectionCard>
                        )}

                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5 px-1">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]">
                                    <AppIcon name="gastos" size={17} />
                                </span>
                                <div>
                                    <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">Detalle de egresos</h2>
                                    <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
                                        {filteredExpenses.length} {filteredExpenses.length === 1 ? 'movimiento registrado' : 'movimientos registrados'} en el período.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 lg:hidden">
                                {filteredExpenses.map((exp, idx) => {
                                    const dateStr = exp.createdAt?.toDate
                                        ? exp.createdAt.toDate().toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : new Date(exp.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                    const isFixed = getExpenseFlow(exp) === 'fixed';
                                    return (
                                        <div key={exp.id || idx} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-[var(--mg-text-primary)]">{exp.description}</p>
                                                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--mg-text-muted)]">
                                                        {dateStr} · {exp.supplier || 'Sin proveedor'}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
                                                    Bs {Number(exp.amount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-full bg-[var(--mg-bg-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-text-secondary)]">
                                                    {exp.category || 'Otros'}
                                                </span>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isFixed ? 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]' : 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'}`}>
                                                    {isFixed ? 'Fijo' : 'Diario'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredExpenses.length === 0 && (
                                    <EmptyState
                                        icon="gastos"
                                        title="Sin egresos en este período"
                                        description="Cambia el rango de fechas para consultar otros movimientos."
                                    />
                                )}
                            </div>

                            <div className="hidden overflow-x-auto rounded-2xl border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] lg:block">
                                <table className="w-full min-w-[700px] border-collapse bg-[var(--mg-bg-surface)] text-sm">
                                    <thead>
                                        <tr>
                                            {['Fecha', 'Concepto / Descripción', 'Proveedor', 'Categoría', 'Tipo', 'Monto'].map((label, idx) => (
                                                <th
                                                    key={label}
                                                    className={`whitespace-nowrap bg-[var(--mg-bg-section)] p-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-brand-text)] ${
                                                        idx === 5 ? 'text-right' : idx >= 3 ? 'text-center' : 'text-left'
                                                    }`}
                                                >
                                                    {label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredExpenses.map((exp, idx) => {
                                            const dateStr = exp.createdAt?.toDate
                                                ? exp.createdAt.toDate().toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : new Date(exp.createdAt).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                            const isFixed = getExpenseFlow(exp) === 'fixed';
                                            return (
                                                <tr key={exp.id || idx} className="border-t border-[var(--mg-separator)] transition-colors hover:bg-[var(--mg-bg-elevated)]">
                                                    <td className="whitespace-nowrap p-3.5 text-xs font-semibold tabular-nums text-[var(--mg-text-secondary)]">{dateStr}</td>
                                                    <td className="p-3.5 font-semibold text-[var(--mg-text-primary)]">{exp.description}</td>
                                                    <td className="p-3.5 text-[var(--mg-text-secondary)]">{exp.supplier || <span className="text-[var(--mg-text-faint)]">—</span>}</td>
                                                    <td className="p-3.5 text-center">
                                                        <span className="inline-block rounded-full bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[10px] font-bold text-[var(--mg-text-secondary)]">
                                                            {exp.category || 'Otros'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${isFixed ? 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]' : 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'}`}>
                                                            {isFixed ? 'Fijo' : 'Diario'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-right font-black tabular-nums text-[var(--mg-brand-text)]">
                                                        Bs {Number(exp.amount || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {filteredExpenses.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="bg-[var(--mg-bg-elevated)] p-10 text-center text-sm font-semibold text-[var(--mg-text-muted)]">
                                                    No se encontraron egresos en el rango de fechas seleccionado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : reportType === 'costoVendido' ? (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <MetricCard
                                label="Total costo de lo vendido"
                                value={`Bs ${totalCostOfGoodsRows.toFixed(2)}`}
                                hint="Costo de proveedor del período"
                                icon="etiqueta"
                                tone="warning"
                            />
                            <MetricCard
                                label="Líneas vendidas"
                                value={costOfGoodsRows.length}
                                hint="Productos registrados en el período"
                                icon="recibo"
                                tone="neutral"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5 px-1">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]">
                                    <AppIcon name="etiqueta" size={17} />
                                </span>
                                <div>
                                    <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">Detalle de costos</h2>
                                    <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
                                        Costo de proveedor de cada producto vendido.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 lg:hidden">
                                {costOfGoodsRows.map((r) => (
                                    <div key={r.rowKey} className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-[var(--mg-text-primary)]">{r.productName}</p>
                                                <p className="mt-0.5 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                                                    {formatReportDate(r.createdAt)} · #{String(r.saleNumber).padStart(4, '0')} · {r.quantity} und.
                                                </p>
                                            </div>
                                            <span className="shrink-0 text-sm font-black tabular-nums text-[var(--mg-gold-text)]">
                                                {r.costTotal !== null ? `Bs ${r.costTotal.toFixed(2)}` : 'Sin costo'}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-[var(--mg-bg-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-text-secondary)]">{r.category}</span>
                                            {r.unitCost !== null && (
                                                <span className="text-[10px] font-semibold text-[var(--mg-text-muted)]">
                                                    Unitario: Bs {r.unitCost.toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {costOfGoodsRows.length === 0 && (
                                    <EmptyState
                                        icon="etiqueta"
                                        title="Sin productos vendidos"
                                        description="No hay ventas registradas en el rango de fechas seleccionado."
                                    />
                                )}
                            </div>

                            <div className="hidden lg:block">
                                <DataTable
                                    storageKey="mg-reporte-costo-columns"
                                    getRowKey={(r) => r.rowKey}
                                    emptyMessage="No se encontraron productos vendidos en el rango de fechas seleccionado."
                                    rows={costOfGoodsRows}
                                    columns={[
                                        {
                                            key: 'fecha', label: 'Fecha', width: 'w-28',
                                            render: (r) => <span className="text-xs font-semibold tabular-nums text-[var(--mg-text-secondary)]">{formatReportDate(r.createdAt)}</span>,
                                        },
                                        {
                                            key: 'venta', label: 'N° Venta', width: 'w-24',
                                            render: (r) => <span className="font-mono text-xs font-bold text-[var(--mg-text-secondary)]">{`#${String(r.saleNumber).padStart(4, '0')}`}</span>,
                                        },
                                        {
                                            key: 'producto', label: 'Producto',
                                            render: (r) => <span className="font-semibold text-[var(--mg-text-primary)]">{r.productName}</span>,
                                        },
                                        {
                                            key: 'categoria', label: 'Categoría', align: 'center', width: 'w-32',
                                            render: (r) => <span className="inline-block rounded-full bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[10px] font-bold text-[var(--mg-text-secondary)]">{r.category}</span>,
                                        },
                                        {
                                            key: 'cantidad', label: 'Cantidad', align: 'right', width: 'w-24',
                                            render: (r) => <span className="tabular-nums">{r.quantity}</span>,
                                        },
                                        {
                                            key: 'costoUnitario', label: 'Costo Unitario', align: 'right', width: 'w-32',
                                            render: (r) => r.unitCost !== null
                                                ? <span className="tabular-nums">Bs {r.unitCost.toFixed(2)}</span>
                                                : <span className="rounded-lg border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-gold-text)]">Sin costo</span>,
                                        },
                                        {
                                            key: 'costoTotal', label: 'Costo Total', align: 'right', width: 'w-32',
                                            render: (r) => r.costTotal !== null
                                                ? <span className="font-black tabular-nums text-[var(--mg-gold-text)]">Bs {r.costTotal.toFixed(2)}</span>
                                                : <span className="rounded-lg border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--mg-gold-text)]">Sin costo</span>,
                                        },
                                    ]}
                                    footer={[{ key: 'costoTotal', label: 'Total costo de lo vendido', value: `Bs ${totalCostOfGoodsRows.toFixed(2)}` }]}
                                />
                            </div>
                        </div>
                    </div>
                ) : reportType === 'inventory' ? (
                    <div className="space-y-4 sm:space-y-5">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <MetricCard
                                label="Valor total"
                                value={`Bs ${inventorySummary.value.toFixed(2)}`}
                                hint={`${inventoryRows.length} ${inventoryRows.length === 1 ? 'producto visible' : 'productos visibles'}`}
                                icon="caja"
                                tone="brand"
                            />
                            <MetricCard
                                label="Stock bajo"
                                value={inventorySummary.low}
                                hint={inventorySummary.low === 1 ? 'producto en el mínimo' : 'productos en o bajo el mínimo'}
                                icon={inventorySummary.low > 0 ? 'reloj' : 'check'}
                                tone={inventorySummary.low > 0 ? 'warning' : 'success'}
                            />
                            <MetricCard
                                label="Catálogo"
                                value={inventorySummary.count}
                                hint={inventoryCategory === 'Todas' ? `${products.length} productos en total` : `${inventoryCategory} · ${products.length} en total`}
                                icon="nuevoProducto"
                                tone="neutral"
                            />
                        </div>

                        {/* Filtro por categoría — compacto */}
                        <div className="flex items-center gap-2">
                            <label className="hidden sm:block text-[10px] font-extrabold uppercase tracking-widest text-[var(--mg-text-muted)] shrink-0">
                                Categoría
                            </label>
                            <select
                                value={inventoryCategory}
                                onChange={(e) => setInventoryCategory(e.target.value)}
                                className="mg-input text-xs font-bold py-2 flex-1 sm:flex-none sm:w-auto sm:min-w-44 min-w-0"
                                aria-label="Filtrar inventario por categoría"
                            >
                                {inventoryCategories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat === 'Todas' ? `Todas (${products.length})` : cat}
                                    </option>
                                ))}
                            </select>
                            <span className="hidden md:inline text-[11px] text-[var(--mg-text-muted)] font-medium truncate">
                                Toca un producto para ver su kardex.
                            </span>
                        </div>

                        <div className="lg:hidden">
                            {inventoryRows.length === 0 ? (
                                <EmptyState
                                    icon="almacen"
                                    title="No hay productos en esta categoría"
                                    description="Prueba con otra categoría o registra productos en el inventario."
                                />
                            ) : (
                                <div className="overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
                                    <div className="flex items-center justify-between gap-2 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-4 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-[var(--mg-text-secondary)]">
                                            Productos ({inventoryRows.length})
                                        </p>
                                        <p className="text-[11px] font-black tabular-nums text-[var(--mg-brand-text)]">
                                            Valor: Bs {inventoryRows.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-[var(--mg-separator)]">
                                        {inventoryRows.map((p) => {
                                            const isLowStock = (p.stock || 0) <= (p.minStock || 5);
                                            return (
                                                <div
                                                    key={p.id}
                                                    onClick={() => setKardexProductId(p.id)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setKardexProductId(p.id); }}
                                                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--mg-bg-elevated)]"
                                                >
                                                    {p.imageData ? (
                                                        <img src={p.imageData} alt={p.name} loading="lazy" className="h-11 w-11 shrink-0 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] object-contain p-0.5" />
                                                    ) : (
                                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
                                                            <AppIcon name="paquete" size={19} />
                                                        </span>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-bold text-[var(--mg-text-primary)]">{p.name}</p>
                                                        <p className="truncate text-[11px] font-semibold text-[var(--mg-text-muted)]">
                                                            {p.category || 'Otros'}
                                                        </p>
                                                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${isLowStock ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]'}`}>
                                                            {p.stock} und.
                                                        </span>
                                                    </div>
                                                    <span className="shrink-0 text-right">
                                                        <span className="block text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
                                                            Bs {((p.stock || 0) * (p.price || 0)).toFixed(2)}
                                                        </span>
                                                        <AppIcon name="detalle" size={15} className="ml-auto mt-0.5 text-[var(--mg-text-faint)]" />
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Tabla detallada de Inventario */}
                        <div className="hidden lg:block">
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
                                            className="cursor-pointer text-left font-bold text-[var(--mg-text-primary)] transition-colors hover:text-[var(--mg-accent-text)] hover:underline"
                                            title="Ver kardex del producto en el periodo"
                                        >
                                            {p.name}
                                            {p.brand && <span className="text-[10px] text-[var(--mg-text-muted)] font-normal block">{p.brand}</span>}
                                        </button>
                                    ),
                                },
                                {
                                    key: 'categoria', label: 'Categoría', align: 'left', width: 'w-36',
                                    render: (p) => <span className="rounded-full bg-[var(--mg-bg-elevated)] px-2.5 py-1 text-[10px] font-bold text-[var(--mg-text-secondary)]">{p.category || 'Otros'}</span>,
                                },
                                {
                                    key: 'stock', label: 'Stock Actual', align: 'center', width: 'w-28',
                                    render: (p) => {
                                        const isLowStock = (p.stock || 0) <= (p.minStock || 5);
                                        return (
                                            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${isLowStock ? 'bg-[var(--mg-danger-bg)] text-[var(--mg-danger)]' : 'bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]'}`}>
                                                {p.stock} und.
                                            </span>
                                        );
                                    },
                                },
                                {
                                    key: 'precioUnitario', label: 'Precio Unitario', align: 'right', width: 'w-28',
                                    render: (p) => <span className="tabular-nums">Bs {(p.price || 0).toFixed(2)}</span>,
                                },
                                {
                                    key: 'valorTotal', label: 'Valor Total', align: 'right', width: 'w-32',
                                    render: (p) => (
                                        <span className="font-black tabular-nums text-[var(--mg-brand-text)]">Bs {((p.stock || 0) * (p.price || 0)).toFixed(2)}</span>
                                    ),
                                },
                                {
                                    key: 'entradas', label: 'Entradas (Periodo)', align: 'center', width: 'w-32',
                                    render: (p) => {
                                        const entries = productEntries[p.id] || 0;
                                        return entries > 0 ? (
                                            <span className="rounded-full bg-[var(--mg-success-bg)] px-2 py-1 font-black tabular-nums text-[var(--mg-success-text)]">+{entries} und.</span>
                                        ) : (
                                            <span className="font-bold tabular-nums text-[var(--mg-text-faint)]">0 und.</span>
                                        );
                                    },
                                },
                                {
                                    key: 'salidas', label: 'Salidas (Ventas)', align: 'center', width: 'w-32',
                                    render: (p) => {
                                        const exits = productMovements[p.id] || 0;
                                        return exits > 0 ? (
                                            <span className="rounded-full bg-[var(--mg-accent-bg)] px-2 py-1 font-black tabular-nums text-[var(--mg-accent-text)]">−{exits} und.</span>
                                        ) : (
                                            <span className="font-bold tabular-nums text-[var(--mg-text-faint)]">0 und.</span>
                                        );
                                    },
                                },
                            ]}
                        />
                        <p className="mt-1 text-right text-[11px] font-medium text-[var(--mg-text-muted)]">
                            Stock actual al día de hoy. Entradas = unidades compradas y salidas = unidades vendidas en el periodo elegido.
                        </p>
                        </div>
                    </div>
                ) : reportType === 'profit' ? (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    {
                                        label: 'Total vendido',
                                        value: profitReportData.totalVendido,
                                        hint: 'Ver reporte de ventas',
                                        title: 'Ver el detalle de ventas que justifica este total',
                                        to: `/ventas?tab=reporte&start=${startDate}&end=${endDate}`,
                                        icon: 'caja',
                                        tone: 'brand',
                                    },
                                    {
                                        label: 'Costo de lo vendido',
                                        value: profitReportData.totalCostoVendido,
                                        hint: 'Ver detalle de costos',
                                        title: 'Ver el detalle de costos que justifica este total',
                                        to: `/reportes?type=costoVendido&start=${startDate}&end=${endDate}`,
                                        icon: 'etiqueta',
                                        tone: 'warning',
                                    },
                                    {
                                        label: 'Ganancia bruta',
                                        value: profitReportData.totalGananciaBruta,
                                        hint: 'Ver reporte de ventas',
                                        title: 'Ver el detalle de ventas y ganancia por producto que justifica este total',
                                        to: `/ventas?tab=reporte&start=${startDate}&end=${endDate}`,
                                        icon: 'reportes',
                                        tone: 'success',
                                    },
                                    {
                                        label: 'Gastos diarios',
                                        value: profitReportData.totalEgresosDiarios,
                                        hint: 'Ver detalle de gastos',
                                        title: 'Ver el detalle de egresos que justifica este total',
                                        to: `/reportes?type=expenses&flow=daily&start=${startDate}&end=${endDate}`,
                                        icon: 'gastos',
                                        tone: 'danger',
                                    },
                                ].map((card) => (
                                    <button
                                        key={card.label}
                                        type="button"
                                        onClick={() => navigate(card.to)}
                                        title={card.title}
                                        className="group h-full text-left"
                                    >
                                        <MetricCard
                                            label={card.label}
                                            value={`Bs ${card.value.toFixed(2)}`}
                                            hint={card.hint}
                                            icon={card.icon}
                                            tone={card.tone}
                                            className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md"
                                        />
                                    </button>
                                ))}
                            </div>

                            <div className={`rounded-3xl border p-5 shadow-[var(--mg-shadow-sm)] sm:p-6 ${
                                profitReportData.totalGananciaNeta >= 0
                                    ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)]'
                                    : 'border-[var(--mg-danger-border)] bg-[var(--mg-danger-bg)]'
                            }`}>
                                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <p className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
                                            profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                        }`}>
                                            <AppIcon name={profitReportData.totalGananciaNeta >= 0 ? 'ok' : 'reloj'} size={15} />
                                            Ganancia neta real del período
                                        </p>
                                        <h3 className={`text-3xl font-black tracking-tight tabular-nums lg:text-4xl ${
                                            profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                        }`}>
                                            Bs {profitReportData.totalGananciaNeta.toFixed(2)}
                                        </h3>
                                        <p className="mt-2 max-w-md text-xs font-medium text-[var(--mg-text-secondary)]">
                                            Resultado neto de la operación comercial restando todos los costos y gastos del período.
                                        </p>
                                        {profitReportData.totalItemsSinCosto > 0 && (
                                            <div className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-2.5 py-1.5 text-xs font-bold text-[var(--mg-gold-text)]">
                                                <AppIcon name="ayuda" size={14} className="mt-0.5" />
                                                <span>
                                                    {profitReportData.totalItemsSinCosto} {profitReportData.totalItemsSinCosto === 1 ? 'producto vendido no tiene' : 'productos vendidos no tienen'} costo de proveedor registrado — la ganancia real podría ser menor a la mostrada.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full shrink-0 space-y-2 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-4 text-xs shadow-[var(--mg-shadow-sm)] md:w-auto md:min-w-[280px]">
                                        <div className="flex justify-between gap-4">
                                            <span className="font-bold text-[var(--mg-text-muted)]">Ganancia bruta:</span>
                                            <span className="font-black tabular-nums text-[var(--mg-text-primary)]">Bs {profitReportData.totalGananciaBruta.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 font-bold text-[var(--mg-danger)]">
                                            <span>(-) Gastos diarios:</span>
                                            <span className="font-black tabular-nums">Bs {profitReportData.totalEgresosDiarios.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 font-bold text-[var(--mg-gold-text)]">
                                            <span>(-) Gastos fijos:</span>
                                            <span className="font-black tabular-nums">Bs {profitReportData.totalEgresosFijos.toFixed(2)}</span>
                                        </div>
                                        <div className={`flex justify-between gap-4 border-t border-dashed border-[var(--mg-border)] pt-2 text-sm font-black ${
                                            profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'
                                        }`}>
                                            <span>Ganancia neta:</span>
                                            <span className="tabular-nums">Bs {profitReportData.totalGananciaNeta.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:hidden">
                            {profitReportData.days.length === 0 ? (
                                <EmptyState
                                    icon="reportes"
                                    title="Sin registros en este período"
                                    description="Prueba ampliando el rango de fechas."
                                />
                            ) : (
                                <div className="overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-[var(--mg-shadow-sm)]">
                                    <div className="flex items-center justify-between gap-2 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-4 py-3">
                                        <p className="text-[11px] font-black uppercase tracking-wider text-[var(--mg-text-secondary)]">
                                            Ganancia por día ({profitReportData.days.length})
                                        </p>
                                        <p className={`text-[11px] font-black tabular-nums ${profitReportData.totalGananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                                            Total: Bs {profitReportData.totalGananciaNeta.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="divide-y divide-[var(--mg-separator)]">
                                        {profitReportData.days.map((day, idx) => {
                                            const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
                                            const isDayPositive = day.gananciaNeta >= 0;
                                            return (
                                                <div
                                                    key={day.date || idx}
                                                    onClick={() => setSelectedDayDetail(day)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDayDetail(day); }}
                                                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--mg-bg-elevated)]"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold capitalize text-[var(--mg-text-primary)]">
                                                            {dateLabel}
                                                        </p>
                                                        <p className="mt-0.5 text-[11px] font-semibold leading-4 tabular-nums text-[var(--mg-text-muted)]">
                                                            <span className="whitespace-nowrap">Vendido Bs {day.vendido.toFixed(2)}</span>
                                                            <span className="mx-1 text-[var(--mg-text-faint)]">·</span>
                                                            <span className="whitespace-nowrap">Gastos Bs {(Number(day.egresosDiarios || 0) + Number(day.egresosFijos || 0)).toFixed(2)}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 text-sm font-black tabular-nums ${isDayPositive ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                                                        Bs {day.gananciaNeta.toFixed(2)}
                                                    </span>
                                                    <AppIcon name="detalle" size={15} className="shrink-0 text-[var(--mg-text-faint)]" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] lg:block">
                            <table className="w-full min-w-[800px] border-collapse bg-[var(--mg-bg-surface)] text-sm">
                                <thead>
                                    <tr>
                                        {['Fecha', 'Total vendido', 'Costo vendido', 'Ganancia bruta', 'Gastos diarios', 'Ganancia neta'].map((label, idx) => (
                                            <th
                                                key={label}
                                                className={`whitespace-nowrap bg-[var(--mg-bg-section)] p-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-brand-text)] ${
                                                    idx === 0 ? 'text-left' : 'text-right'
                                                } ${idx === 5 ? 'text-[var(--mg-accent-text)]' : ''}`}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {profitReportData.days.map((day, idx) => {
                                        const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
                                        const isDayPositive = day.gananciaNeta >= 0;
                                        return (
                                            <tr
                                                key={day.date || idx}
                                                className="group cursor-pointer border-t border-[var(--mg-separator)] transition-colors hover:bg-[var(--mg-bg-elevated)]"
                                                onClick={() => setSelectedDayDetail(day)}
                                                title="Ver detalle del día"
                                            >
                                                <td className="whitespace-nowrap p-3.5">
                                                    <span className="font-semibold tabular-nums text-[var(--mg-text-primary)]">{dateLabel}</span>
                                                    <AppIcon name="detalle" size={13} className="ml-1.5 inline-block text-[var(--mg-text-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                                                </td>
                                                <td className="p-3.5 text-right font-semibold tabular-nums text-[var(--mg-text-primary)]">
                                                    Bs {day.vendido.toFixed(2)}
                                                </td>
                                                <td className="p-3.5 text-right tabular-nums text-[var(--mg-text-secondary)]">
                                                    {day.costoVendido > 0 ? `Bs ${day.costoVendido.toFixed(2)}` : '—'}
                                                </td>
                                                <td className="p-3.5 text-right font-semibold tabular-nums text-[var(--mg-success-text)]">
                                                    Bs {day.gananciaBruta.toFixed(2)}
                                                </td>
                                                <td className="p-3.5 text-right font-semibold tabular-nums text-[var(--mg-danger)]">
                                                    <div>Bs {day.egresosDiarios.toFixed(2)}</div>
                                                    {day.egresosFijos > 0 && (
                                                        <span className="mt-0.5 inline-block rounded-md border border-[var(--mg-gold-border)] bg-[var(--mg-gold-bg)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--mg-gold-text)]" title="Gasto fijo registrado este día (se descuenta al final en el global)">
                                                            + Bs {day.egresosFijos.toFixed(2)} fijos
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={`p-3.5 text-right font-black tabular-nums ${isDayPositive ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                                                    Bs {day.gananciaNeta.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {profitReportData.days.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="bg-[var(--mg-bg-elevated)] p-12 text-center">
                                                <AppIcon name="reportes" size={24} className="mx-auto text-[var(--mg-text-muted)]" />
                                                <p className="mt-2 text-sm font-bold text-[var(--mg-text-primary)]">Sin registros en este período</p>
                                                <p className="mt-1 text-xs font-medium text-[var(--mg-text-muted)]">Prueba ampliando el rango de fechas.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2.5 px-1">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]">
                                <AppIcon name="ranking" size={17} />
                            </span>
                            <div>
                                <h2 className="text-sm font-black tracking-tight text-[var(--mg-brand-text)]">Ranking de productos</h2>
                                <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">
                                    Ordenado por unidades vendidas e ingresos del período.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 lg:hidden">
                            {rankingMatrix.map((item, index) => {
                                const pos = index + 1;
                                return (
                                    <div key={`${item.productName}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
                                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                            pos === 1
                                                ? 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
                                                : pos <= 3
                                                    ? 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
                                                    : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                                        }`}>
                                            {pos}
                                        </span>
                                        {item.image ? (
                                            <img src={item.image} alt={item.productName} loading="lazy" className="h-10 w-10 shrink-0 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] object-cover" />
                                        ) : (
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
                                                <AppIcon name="paquete" size={18} />
                                            </span>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-[var(--mg-text-primary)]">{item.productName}</p>
                                            <p className="text-[11px] font-semibold text-[var(--mg-text-muted)]">{item.quantity} und. vendidas</p>
                                        </div>
                                        <span className="shrink-0 text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
                                            Bs {item.totalRevenue.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                            {rankingMatrix.length === 0 && (
                                <EmptyState
                                    icon="ranking"
                                    title="Sin productos vendidos"
                                    description="No hay ventas registradas en el rango de fechas seleccionado."
                                />
                            )}
                        </div>

                        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--mg-border)] shadow-[var(--mg-shadow-sm)] lg:block">
                            <table className="w-full min-w-[600px] border-collapse bg-[var(--mg-bg-surface)] text-sm">
                                <thead>
                                    <tr>
                                        {['Posición', 'Producto', 'Unidades vendidas', 'Monto generado'].map((label, idx) => (
                                            <th
                                                key={label}
                                                className={`whitespace-nowrap bg-[var(--mg-bg-section)] p-3.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--mg-brand-text)] ${
                                                    idx === 0 || idx === 2 ? 'text-center' : idx === 3 ? 'text-right' : 'text-left'
                                                } ${idx === 0 ? 'w-24' : idx === 2 ? 'w-32' : idx === 3 ? 'w-40' : ''}`}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingMatrix.map((item, index) => {
                                        const pos = index + 1;
                                        return (
                                            <tr key={`${item.productName}-${index}`} className="border-t border-[var(--mg-separator)] transition-colors hover:bg-[var(--mg-bg-elevated)]">
                                                <td className="p-3.5 text-center">
                                                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                                                        pos === 1
                                                            ? 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
                                                            : pos <= 3
                                                                ? 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]'
                                                                : 'bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]'
                                                    }`}>
                                                        {pos}
                                                    </span>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="flex items-center gap-3">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.productName} loading="lazy" className="h-10 w-10 shrink-0 rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] object-cover" />
                                                        ) : (
                                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] text-[var(--mg-text-muted)]">
                                                                <AppIcon name="paquete" size={18} />
                                                            </span>
                                                        )}
                                                        <span className="min-w-0 break-words font-semibold text-[var(--mg-text-primary)]">{item.productName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3.5 text-center font-black tabular-nums text-[var(--mg-text-primary)]">
                                                    {item.quantity} und.
                                                </td>
                                                <td className="p-3.5 text-right font-black tabular-nums text-[var(--mg-brand-text)]">
                                                    Bs {item.totalRevenue.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {rankingMatrix.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="bg-[var(--mg-bg-elevated)] p-10 text-center text-sm font-semibold text-[var(--mg-text-muted)]">
                                                No hay productos vendidos en este período.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-dashed border-[var(--mg-border)] pt-5 text-center text-[11px] font-medium text-[var(--mg-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                        <AppIcon name="reportes" size={14} />
                        {reportType === 'ranking'
                            ? 'Ranking ordenado por demanda física e ingresos totales.'
                            : reportType === 'costoVendido'
                            ? 'Costo de proveedor de cada producto vendido en el período.'
                            : reportType === 'expenses'
                            ? 'Resumen y desglose de egresos del negocio en el período.'
                            : reportType === 'profit'
                            ? 'Ingresos, costos de reposición, egresos y ganancia neta.'
                            : 'Stock actual, valorización y movimientos del período.'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[var(--mg-success-text)]">
                        <AppIcon name="check" size={13} />
                        Calculado con los datos de tu negocio.
                    </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl animate-in zoom-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-label="Kardex del producto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--mg-brand-text)]">Kardex · {periodLabel}</p>
                        <h3 className="mt-0.5 truncate text-lg font-black text-[var(--mg-text-primary)]">{product.name}</h3>
                        {product.brand && <p className="text-xs font-medium text-[var(--mg-text-muted)]">{product.brand}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar kardex"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
                    >
                        <AppIcon name="cerrar" size={17} />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 px-5 pt-4">
                    <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-2.5 text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Stock inicial</span>
                        <span className="mt-0.5 block text-sm font-black tabular-nums text-[var(--mg-text-primary)]">{initialStock} und.</span>
                    </div>
                    <div className="rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] p-2.5 text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-success-text)]">Entradas</span>
                        <span className="mt-0.5 block text-sm font-black tabular-nums text-[var(--mg-success-text)]">+{totalIn}</span>
                    </div>
                    <div className="rounded-2xl border border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] p-2.5 text-center">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-accent-text)]">Salidas</span>
                        <span className="mt-0.5 block text-sm font-black tabular-nums text-[var(--mg-accent-text)]">−{totalOut}</span>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    {rows.length > 0 ? (
                        <table className="w-full border-collapse text-left text-[11px] sm:text-xs">
                            <thead>
                                <tr className="bg-[var(--mg-bg-elevated)] text-[10px] font-black uppercase tracking-wider text-[var(--mg-text-muted)]">
                                    <th className="rounded-l-xl px-2 py-2 sm:px-3">Fecha</th>
                                    <th className="px-2 py-2 sm:px-3">Movimiento</th>
                                    <th className="whitespace-nowrap px-2 py-2 text-center sm:px-3">Cant.</th>
                                    <th className="whitespace-nowrap rounded-r-xl px-2 py-2 text-right sm:px-3">Saldo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--mg-separator)] font-semibold">
                                {rows.map((m, i) => (
                                    <tr key={i} className="transition-colors hover:bg-[var(--mg-bg-elevated)]">
                                        <td className="whitespace-nowrap px-2 py-2.5 text-[var(--mg-text-secondary)] sm:px-3">
                                            {m.date.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' })} · {m.date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </td>
                                        <td className="px-2 py-2.5 sm:px-3">
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                                                m.type === 'entrada'
                                                    ? 'border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] text-[var(--mg-success-text)]'
                                                    : 'border-[var(--mg-accent-border)] bg-[var(--mg-accent-bg)] text-[var(--mg-accent-text)]'
                                            }`}>
                                                {m.type === 'entrada' ? 'Entrada' : 'Salida'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-2.5 text-center tabular-nums text-[var(--mg-text-primary)] sm:px-3">{m.type === 'entrada' ? `+${m.qty}` : `−${m.qty}`}</td>
                                        <td className="whitespace-nowrap px-2 py-2.5 text-right font-black tabular-nums text-[var(--mg-text-primary)] sm:px-3">{m.balance} und.</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="py-6 text-center text-xs font-medium text-[var(--mg-text-muted)]">
                            Sin movimientos en este periodo. El stock actual es {currentStock} und.
                        </p>
                    )}
                </div>

                <div className="px-5 pb-4">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--mg-brand-border)] bg-[var(--mg-brand-bg)] px-4 py-2.5 text-sm font-black text-[var(--mg-brand-text)]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] shadow-2xl animate-in zoom-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-label={`Detalle de ganancia del ${dateLabel}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-[var(--mg-separator)] bg-[var(--mg-bg-elevated)] px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--mg-brand-text)]">Detalle de ganancia</p>
                        <h3 className="mt-0.5 truncate text-lg font-black text-[var(--mg-text-primary)]">{dateLabel}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar detalle del día"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] text-[var(--mg-text-muted)] transition-colors hover:text-[var(--mg-text-primary)]"
                    >
                        <AppIcon name="cerrar" size={17} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-center">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Vendido</span>
                            <span className="mt-1 block text-sm font-black tabular-nums text-[var(--mg-text-primary)]">Bs {day.vendido.toFixed(2)}</span>
                        </div>
                        <div className="rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-center">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-text-muted)]">Costo de ventas</span>
                            <span className="mt-1 block text-sm font-black tabular-nums text-[var(--mg-text-secondary)]">
                                {day.costoVendido > 0 ? `Bs ${day.costoVendido.toFixed(2)}` : '—'}
                            </span>
                        </div>
                        <div className="rounded-2xl border border-[var(--mg-success-border)] bg-[var(--mg-success-bg)] p-3 text-center">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--mg-success-text)]">Ganancia bruta</span>
                            <span className="mt-1 block text-sm font-black tabular-nums text-[var(--mg-success-text)]">Bs {day.gananciaBruta.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="flex items-center gap-1.5 border-b border-[var(--mg-separator)] pb-2 text-xs font-black uppercase tracking-widest text-[var(--mg-brand-text)]">
                            <AppIcon name="carrito" size={14} />
                            Ventas del día ({daySales.length})
                        </h4>
                        {daySales.length === 0 ? (
                            <p className="text-xs font-medium text-[var(--mg-text-muted)]">No hubo ventas registradas.</p>
                        ) : (
                            <div className="space-y-3">
                                {daySales.map(sale => {
                                    const saleItemsList = itemsBySale[sale.id] || [];
                                    const payment = sale.paymentMethod === 'cash'
                                        ? { icon: 'cash', label: 'Efectivo' }
                                        : sale.paymentMethod === 'qr'
                                            ? { icon: 'qr', label: 'QR' }
                                            : { icon: 'mixto', label: 'Mixto' };
                                    const saleTime = (() => {
                                        const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date(sale.created_at || sale.createdAt);
                                        return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
                                    })();

                                    return (
                                        <div key={sale.id} className="space-y-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-surface)] p-3.5 shadow-[var(--mg-shadow-sm)]">
                                            <div className="flex items-start justify-between gap-3 border-b border-[var(--mg-separator)] pb-2 text-xs">
                                                <div className="min-w-0">
                                                    <span className="block truncate font-bold text-[var(--mg-text-primary)]">
                                                        {sale.clientName || sale.client_name || 'Cliente Casual'}
                                                    </span>
                                                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[var(--mg-text-muted)]">
                                                        {saleTime}
                                                        <span>·</span>
                                                        <AppIcon name={payment.icon} size={11} />
                                                        {payment.label}
                                                    </span>
                                                </div>
                                                <span className="shrink-0 text-sm font-black tabular-nums text-[var(--mg-brand-text)]">
                                                    Bs {(sale.total || 0).toFixed(2)}
                                                </span>
                                            </div>

                                            <div className="space-y-2.5">
                                                {saleItemsList.map(item => {
                                                    const supplierPriceVal = item.supplier_price !== undefined && item.supplier_price !== null
                                                        ? Number(item.supplier_price)
                                                        : (item.supplierPrice !== undefined && item.supplierPrice !== null
                                                            ? Number(item.supplierPrice)
                                                            : null);

                                                    const isCostAvailable = supplierPriceVal !== null;
                                                    const lineProfit = isCostAvailable ? (Number(item.price) - supplierPriceVal) * Number(item.quantity) : null;

                                                    return (
                                                        <div key={item.id} className="flex flex-col gap-1 border-b border-dashed border-[var(--mg-separator)] pb-1.5 text-xs last:border-0 last:pb-0 md:flex-row md:items-center md:justify-between">
                                                            <div className="min-w-0">
                                                                <span className="block truncate font-semibold text-[var(--mg-text-primary)]">{item.productName}</span>
                                                                <span className="mt-0.5 block text-[10px] text-[var(--mg-text-muted)]">
                                                                    {item.quantity} und. × Bs {Number(item.price).toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 text-[10px] font-medium md:text-right">
                                                                <div className="text-[var(--mg-text-secondary)]">
                                                                    Costo: <span className="font-bold">{isCostAvailable ? `Bs ${supplierPriceVal.toFixed(2)}` : '—'}</span>
                                                                </div>
                                                                <div className="rounded bg-[var(--mg-success-bg)] px-1.5 py-0.5 font-bold text-[var(--mg-success-text)]">
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

                    <div className="space-y-3">
                        <h4 className="flex items-center gap-1.5 border-b border-[var(--mg-separator)] pb-2 text-xs font-black uppercase tracking-widest text-[var(--mg-danger)]">
                            <AppIcon name="gastos" size={14} />
                            Gastos del día ({dayExpenses.length})
                        </h4>
                        {dayExpenses.length === 0 ? (
                            <p className="text-xs font-medium text-[var(--mg-text-muted)]">No hubo gastos registrados.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    {dayExpenses.map(exp => {
                                        const isFixed = exp.expense_type === 'fixed' || exp.expenseType === 'fixed';
                                        return (
                                            <div key={exp.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-3 text-xs">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="truncate font-semibold text-[var(--mg-text-primary)]">{exp.description}</span>
                                                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${
                                                            isFixed ? 'bg-[var(--mg-brand-bg)] text-[var(--mg-brand-text)]' : 'bg-[var(--mg-gold-bg)] text-[var(--mg-gold-text)]'
                                                        }`}>
                                                            {isFixed ? 'Fijo' : 'Diario'}
                                                        </span>
                                                    </div>
                                                    <span className="mt-0.5 block text-[10px] font-semibold uppercase text-[var(--mg-text-muted)]">{exp.category || 'Otros'}</span>
                                                </div>
                                                <span className="shrink-0 font-bold tabular-nums text-[var(--mg-danger)]">- Bs {Number(exp.amount).toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-col gap-1 border-t border-dashed border-[var(--mg-border)] pt-3 text-right text-[11px] font-medium text-[var(--mg-text-muted)]">
                                    <div>
                                        Subtotal gastos diarios: <span className="font-bold text-[var(--mg-text-primary)]">Bs {day.egresosDiarios.toFixed(2)}</span>
                                    </div>
                                    {day.egresosFijos > 0 && (
                                        <div className="text-[var(--mg-gold-text)]">
                                            Gastos fijos registrados hoy (informativo): <span className="font-bold">Bs {day.egresosFijos.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--mg-border)] bg-[var(--mg-bg-elevated)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--mg-text-muted)]">Ganancia neta diaria</span>
                        <span className={`mt-0.5 block text-xl font-black tabular-nums ${day.gananciaNeta >= 0 ? 'text-[var(--mg-success-text)]' : 'text-[var(--mg-danger)]'}`}>
                            Bs {day.gananciaNeta.toFixed(2)}
                        </span>
                        {day.egresosFijos > 0 && (
                            <span className="mt-1 block text-[9px] font-semibold text-[var(--mg-gold-text)]">
                                * Se registraron Bs {day.egresosFijos.toFixed(2)} fijos hoy (se restan del total del mes).
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[var(--mg-accent)] px-6 py-3 text-xs font-bold text-white shadow-md transition-all hover:bg-[var(--mg-accent-hover)] active:scale-95 sm:self-center"
                    >
                        <AppIcon name="check" size={15} color="#fff" />
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}