// ─────────────────────────────────────────────────────────────
// Mi Ganancia · Textos de ayuda en lenguaje simple (tendero)
// Este archivo centraliza TODAS las explicaciones de la app.
// Si quieres cambiar cómo se explica algo, cámbialo aquí una sola vez
// y se actualiza en el botón "?" de cada pantalla, Onboarding y Tutorial.
// ─────────────────────────────────────────────────────────────

export const AYUDA = {
  inicio: {
    emoji: '🏠',
    titulo: 'Inicio: tu resumen del día',
    linea: 'Aquí ves cuánto vendiste hoy de un vistazo.',
    explicacion:
      'Es como abrir tu caja al final del día, pero en vivo. Ves lo vendido en efectivo y QR, cuántas ventas hiciste, tu hora pico y qué productos se están acabando.',
    pasos: [
      'Mira el total de hoy arriba: efectivo + QR.',
      'Si algo está en rojo en "Stock bajo", tócalo para reponerlo.',
      'Toca cualquier venta para ver su detalle o reimprimir su recibo.',
    ],
    ejemplo: 'Llegas en la mañana, abres Inicio y sabes: "Hoy Bs 850 en 20 ventas, me quedan 3 Coca 2L".',
    tip: 'Si hoy está vacío, es normal. Toca "Nueva venta" para empezar.',
  },

  ventas: {
    emoji: '🛒',
    titulo: 'Ventas: cobrar rápido',
    linea: 'Busca el producto, súmalo al carrito y cobra.',
    explicacion:
      'Es tu caja registradora. Buscas por nombre o categoría, sumas con + y cobras en Efectivo, QR, Mixto (parte y parte) o Fiado. La app calcula el cambio sola y no deja vender más de lo que tienes en stock.',
    pasos: [
      'Busca el producto o filtra por categoría.',
      'Toca el botón azul del lector para escanear el código de barras con tu cámara.',
      'Tócalo para sumarlo al carrito (+ / − para ajustar).',
      'Elige cómo te pagan y toca "Cobrar".',
      'Si es QR, muestra tu QR y confirma. Si es Fiado, escribe el nombre del cliente.',
    ],
    ejemplo: 'Vendes 3 cosas por Bs 75, te pagan con Bs 100. La app te dice: "Devolver Bs 25".',
    tip: 'Si sales a mitad de una venta, no se borra: al volver la recupera sola.',
  },

  'ventas-reporte': {
    emoji: '🧾',
    titulo: 'Reporte de ventas: qué vendiste',
    linea: 'El historial detallado de cada producto vendido.',
    explicacion:
      'Aquí ves línea por línea qué se vendió, a cuánto, con qué pagaron y cuánto ganaste en cada uno. Sirve para responder "¿qué se mueve más?" y se puede exportar a PDF.',
    pasos: [
      'Elige el rango de fechas arriba.',
      'Revisa la tabla: producto, cantidad, total y ganancia.',
      'Toca "Exportar PDF" para guardarlo o mandarlo por WhatsApp.',
    ],
    ejemplo: 'Quieres saber cuánto vendiste del 1 al 15: filtras esas fechas y ves el total abajo.',
    tip: 'La columna Ganancia ya resta lo que te costó comprarlo.',
  },

  compras: {
    emoji: '🛍️',
    titulo: 'Compras: reponer mercadería',
    linea: 'Registra lo que compras para que el stock suba solo.',
    explicacion:
      'Cuando te llega mercadería del proveedor, la registras aquí: cantidad, lo que pagaste, gastos extra (pasaje, hielo) y vencimiento. El stock sube automáticamente y la app aprende si compras por unidad o por caja.',
    pasos: [
      'Busca el producto y tócalo.',
      'Escribe cantidad, costo unitario y proveedor.',
      'Si tiene vencimiento, anótalo para que te avise.',
      'Guarda y el stock se actualiza solo.',
    ],
    ejemplo: 'Compras 12 leches a Bs 7 c/u. El stock pasa de 5 a 17 sin que hagas cuentas.',
    tip: 'Anota siempre el precio de compra: así tu ganancia sale real.',
  },

  'compras-historial': {
    emoji: '📋',
    titulo: 'Historial de compras',
    linea: 'Todo lo que le compraste a tus proveedores.',
    explicacion:
      'Ves cada reposición con fecha, proveedor, cantidad y total pagado. Útil para saber cuánto invertiste este mes.',
    pasos: [
      'Filtra por fechas.',
      'Revisa el total del período abajo.',
      'Exporta a PDF si tu contador lo pide.',
    ],
    ejemplo: '¿Cuánto invertiste en marzo? Filtras marzo y ves: "Total Bs 4.200".',
    tip: 'El número #C001 es correlativo y no cambia aunque muevas las fechas.',
  },

  inventario: {
    emoji: '📦',
    titulo: 'Inventario: tu estante en el celular',
    linea: 'Foto, precio, stock y alertas en un solo lugar.',
    explicacion:
      'Cada producto tiene su ficha con foto, precio de venta y compra, stock actual y aviso de "quedan pocos". También ves cuánto dinero tienes invertido y qué está por vencer.',
    pasos: [
      'Toca "+ Nuevo" para crear un producto con foto.',
      'En la ficha ponle su código de barras (escanéalo con el botón azul).',
      'Toca un producto para ver su ficha o editarlo.',
      'Usa el lector del buscador para encontrarlo al instante.',
    ],
    ejemplo: 'Buscas "Pil", ves su foto, stock 4 en rojo porque tu mínimo es 5: toca reponer.',
    tip: 'Sácale foto con la cámara: venderás más rápido desde Ventas.',
  },

  egresos: {
    emoji: '💸',
    titulo: 'Egresos: lo que sale de tu bolsillo',
    linea: 'Anota alquiler, luz, pasajes y todo gasto.',
    explicacion:
      'No solo la mercadería cuesta. Aquí anotas los gastos diarios (bolsas, pasaje, hielo) y los fijos del mes (alquiler, luz, sueldo). Así tu ganancia no es mentira.',
    pasos: [
      'Toca "+ Registrar Egreso".',
      'Escribe qué fue, cuánto y su categoría.',
      'Marca si es Diario o Fijo mensual.',
    ],
    ejemplo: 'Pagaste Bs 50 de luz: lo anotas en 10 segundos y a fin de mes no te preguntas "¿dónde se fue la plata?".',
    tip: 'Separa bien Diario vs Fijo: los reportes los usan para calcular tu ganancia real.',
  },

  'cxc-pendientes': {
    emoji: '📖',
    titulo: 'Fiados: que nadie se olvide de pagarte',
    linea: 'Quién te debe, cuánto y desde cuándo.',
    explicacion:
      'Se acabó el cuaderno mojado. Cada venta al fiado crea sola su deuda con nombre, teléfono y fecha límite. Los vencidos salen en rojo primero para que cobres a quien más urge.',
    pasos: [
      'Vende al fiado desde Ventas o toca "+ Fiado manual".',
      'Busca por nombre o filtra "Solo vencidos".',
      'Toca "Cobrar" cuando te paguen: elige Efectivo o QR.',
    ],
    ejemplo: 'Don Juan te debe Bs 120 desde el lunes. Lo ves en rojo como vencido y lo cobras en 1 clic.',
    tip: 'Anota siempre el teléfono y la fecha límite: cobrarás el doble de rápido.',
  },

  'cxc-cobrados': {
    emoji: '✅',
    titulo: 'Cobros realizados',
    linea: 'Los fiados que ya recuperaste.',
    explicacion: 'Historial de deudas ya pagadas, ordenadas de la más reciente a la más antigua. Sirve como comprobante de que te pagaron.',
    pasos: ['Revisa quién ya te pagó.', 'Busca por nombre si necesitas comprobar algo.'],
    ejemplo: 'Doña María dice "ya te pagué": la buscas aquí y ves la fecha del cobro.',
    tip: 'Los cobrados también suman a tu total del día en Inicio.',
  },

  'reportes-ganancias': {
    emoji: '📈',
    titulo: 'Ganancia real día por día',
    linea: 'Vendido − Costo − Gastos = tu ganancia neta.',
    explicacion:
      'El reporte más importante. Te muestra por cada día: cuánto vendiste, cuánto te costó esa mercadería, tus gastos y lo que te quedó limpio. Vender mucho no sirve si ganas poco: aquí lo ves.',
    pasos: [
      'Elige el mes o rango de fechas.',
      'Mira la tarjeta "Ganancia neta real" arriba.',
      'Toca un día para ver su detalle.',
      'Exporta a PDF para guardarlo.',
    ],
    ejemplo: 'Vendiste Bs 1.000 pero tu costo fue Bs 650 y gastos Bs 130. Tu ganancia real: Bs 220.',
    tip: 'Si un producto no tiene precio de compra, la app te avisa: anótalo para que la ganancia sea exacta.',
  },

  'reportes-ranking': {
    emoji: '🏆',
    titulo: 'Ranking: qué deja más plata',
    linea: 'Tus productos más vendidos y los que más dinero generan.',
    explicacion: 'Ordena tus productos por unidades vendidas e ingresos. Así sabes qué nunca debe faltarte y qué no se mueve.',
    pasos: ['Elige el período.', 'Los primeros 5 son tus estrellas: nunca te quedes sin ellos.'],
    ejemplo: 'La Coca 2L es #1 en unidades y el queso es #1 en dinero: pides más de ambos.',
    tip: 'Lo que está al final del ranking, pide menos o ponlo en oferta.',
  },

  'reportes-costo': {
    emoji: '🏷️',
    titulo: 'Costo de lo vendido',
    linea: 'Cuánto te costó lo que ya vendiste.',
    explicacion: 'Por cada venta muestra lo que pagaste al proveedor por ese producto. La suma es lo que realmente invertiste para vender en ese período.',
    pasos: ['Filtra el período.', 'Revisa el total naranja arriba: ese es tu costo.'],
    ejemplo: 'Vendiste 10 aceites que te costaron Bs 22 c/u. Tu costo: Bs 220.',
    tip: 'Si dice "Sin costo", abre ese producto en Inventario y ponle su precio de compra.',
  },

  'reportes-inventario': {
    emoji: '📊',
    titulo: 'Reporte de inventario',
    linea: 'Cuánto tienes, cuánto vale y qué se movió.',
    explicacion: 'Foto general: valor total de tu stock, cuántos productos están bajos y entradas vs salidas del período.',
    pasos: ['Mira el valor total arriba.', 'Los marcados en rojo necesitan pedido urgente.'],
    ejemplo: 'Tu inventario vale Bs 8.500 y 4 productos están en rojo: esos pides hoy.',
    tip: 'Entradas = lo que compraste. Salidas = lo que vendiste en esas fechas.',
  },

  'reportes-egresos': {
    emoji: '💵',
    titulo: 'Reporte de egresos',
    linea: 'En qué se fue tu plata, por categoría.',
    explicacion: 'Agrupa tus gastos por categoría con barra de porcentaje. Ves de un vistazo si el alquiler o la mercadería se come tu ganancia.',
    pasos: ['Filtra el período.', 'La barra más larga es tu gasto más grande: atácalo primero.'],
    ejemplo: 'El 40% de tus gastos es "Transporte": quizás conviene otro proveedor.',
    tip: 'Toca cada categoría para entender el detalle.',
  },

  configuracion: {
    emoji: '⚙️',
    titulo: 'Ajustes: tu QR y tu equipo',
    linea: 'Sube tu QR una vez y todos cobran con él.',
    explicacion:
      'Aquí subes tu QR de cobro, pones el nombre y datos de tu negocio para los recibos, y manejas quién puede ver qué (dueño ve todo, cajero solo sus ventas).',
    pasos: [
      'Sube tu imagen QR en "Cobro QR".',
      'Completa nombre del negocio para que salga en recibos y PDFs.',
      'Invita a tu cajero y ponle rol Cajero.',
    ],
    ejemplo: 'Subes tu QR el lunes. Desde entonces tú y tu ayudante cobran con el mismo QR.',
    tip: 'El recibo térmico sale con tus datos: revísalos aquí si salen mal.',
  },
  mascotas: {
    emoji: '🐾',
    titulo: 'Mascotas: tus pacientes',
    linea: 'Ficha, historial, recetas, vacunas y recordatorios por WhatsApp.',
    explicacion:
      'Registra cada mascota con su dueño y teléfono. Anota consultas con diagnóstico, emite recetas imprimibles, registra vacunas (crean su recordatorio solas) y avisa a los dueños por WhatsApp cuando toca volver.',
    pasos: [
      'Toca "+ Paciente" y carga mascota + dueño con teléfono.',
      'En su ficha toca Consulta, Receta, Vacuna o Carnet.',
      'En Recordatorios ves lo vencido y avisás por WhatsApp en 1 toque.',
    ],
    ejemplo: 'Vacunas a Rocky contra la rabia: queda anotada, se crea el recordatorio del año que viene y le mandas el carnet impreso.',
    tip: 'Sin teléfono del dueño no hay WhatsApp: pídelo siempre al registrar.',
  },
};

// Devuelve la clave de ayuda según la ruta actual.
// Así el botón "?" flotante siempre muestra la ayuda correcta sin
// tener que editar cada página por separado.
export function claveAyudaParaRuta(pathname, search = '') {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  const type = params.get('type');

  if (pathname === '/') return 'inicio';
  if (pathname === '/ventas') return tab === 'reporte' ? 'ventas-reporte' : 'ventas';
  if (pathname === '/compras') return tab === 'historial' ? 'compras-historial' : 'compras';
  if (pathname === '/inventario') return 'inventario';
  if (pathname === '/egresos') return 'egresos';
  if (pathname === '/cxc') return tab === 'paid' ? 'cxc-cobrados' : 'cxc-pendientes';
  if (pathname === '/mascotas') return 'mascotas';
  if (pathname === '/configuracion') return 'configuracion';
  if (pathname === '/reportes') {
    if (type === 'ranking') return 'reportes-ranking';
    if (type === 'costoVendido') return 'reportes-costo';
    if (type === 'inventory') return 'reportes-inventario';
    if (type === 'expenses') return 'reportes-egresos';
    return 'reportes-ganancias';
  }
  return 'inicio';
}
