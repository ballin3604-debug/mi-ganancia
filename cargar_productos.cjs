// ============================================================
// SCRIPT: Productos de licorería - Santa Cruz, Bolivia
// Uso: node cargar_productos.cjs
// ============================================================

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ⚠️ CAMBIA ESTOS DOS VALORES:
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
const BUSINESS_ID = 'EVDAfL6OR7yJSCiqdLH9';

const app = initializeApp({ credential: cert(require(SERVICE_ACCOUNT_PATH)) });
const db = getFirestore(app);

// ── Categorías de la licorería ───────────────────────────────
const CATEGORIAS = [
  'Cervezas', 'Whiskey', 'Ron', 'Vinos', 'Vodka', 'Refrescos', 'Agua', 'Otros'
];

const productos = [

  // ── CERVEZAS BOLIVIANAS ──────────────────────────────────
  { name: 'Paceña Lata 440ml',              brand: 'CBN',         category: 'Cervezas', price: 9,   stock: 120, minStock: 24 },
  { name: 'Paceña Botella 300ml',           brand: 'CBN',         category: 'Cervezas', price: 7,   stock: 120, minStock: 24 },
  { name: 'Paceña Botella 620ml',           brand: 'CBN',         category: 'Cervezas', price: 12,  stock: 100, minStock: 24 },
  { name: 'Paceña Pico de Plata 300ml',     brand: 'CBN',         category: 'Cervezas', price: 8,   stock: 80,  minStock: 20 },
  { name: 'Huari Lata 354ml',               brand: 'CBN',         category: 'Cervezas', price: 9,   stock: 100, minStock: 24 },
  { name: 'Huari Botella 300ml',            brand: 'CBN',         category: 'Cervezas', price: 7,   stock: 100, minStock: 24 },
  { name: 'Huari Botella 620ml',            brand: 'CBN',         category: 'Cervezas', price: 12,  stock: 80,  minStock: 20 },
  { name: 'Huari Miel 300ml',               brand: 'CBN',         category: 'Cervezas', price: 8,   stock: 60,  minStock: 12 },
  { name: 'Golden Lata 269ml',              brand: 'CBN',         category: 'Cervezas', price: 8,   stock: 60,  minStock: 12 },
  { name: 'Taquiña Botella 620ml',          brand: 'Taquiña',     category: 'Cervezas', price: 11,  stock: 60,  minStock: 12 },
  { name: 'Sureña Botella 620ml',           brand: 'Sureña',      category: 'Cervezas', price: 11,  stock: 60,  minStock: 12 },
  { name: 'Bendita IPA Lata 350ml',         brand: 'Bendita',     category: 'Cervezas', price: 18,  stock: 36,  minStock: 10 },
  { name: 'Corona Lata 355ml',              brand: 'CBN',         category: 'Cervezas', price: 20,  stock: 48,  minStock: 12 },
  { name: 'Budweiser King Lata 269ml',      brand: 'CBN',         category: 'Cervezas', price: 12,  stock: 48,  minStock: 12 },
  { name: 'Heineken Lata 330ml',            brand: 'Heineken',    category: 'Cervezas', price: 20,  stock: 36,  minStock: 10 },
  { name: 'Stella Artois Lata 330ml',       brand: 'Stella',      category: 'Cervezas', price: 20,  stock: 36,  minStock: 10 },

  // ── SINGANI (licor nacional boliviano) ──────────────────
  { name: 'Singani Casa Real 750ml',        brand: 'Casa Real',    category: 'Ron', price: 75,  stock: 20, minStock: 5 },
  { name: 'Singani Casa Real 350ml',        brand: 'Casa Real',    category: 'Ron', price: 40,  stock: 24, minStock: 6 },
  { name: 'Singani Los Parrales 750ml',     brand: 'Los Parrales', category: 'Ron', price: 65,  stock: 15, minStock: 4 },
  { name: 'Singani Rujero 750ml',           brand: 'Rujero',       category: 'Ron', price: 80,  stock: 12, minStock: 3 },
  { name: 'Singani San Pedro de Oro 750ml', brand: 'San Pedro',    category: 'Ron', price: 60,  stock: 15, minStock: 4 },
  { name: 'Singani Aranjuez 750ml',         brand: 'Aranjuez',     category: 'Ron', price: 70,  stock: 12, minStock: 3 },
  { name: 'La Viuda Descalza 700ml',        brand: 'La Viuda',     category: 'Ron', price: 120, stock: 8,  minStock: 2 },

  // ── WHISKEY ─────────────────────────────────────────────
  { name: 'Johnnie Walker Red Label 750ml',    brand: 'Johnnie Walker', category: 'Whiskey', price: 185, stock: 12, minStock: 3 },
  { name: 'Johnnie Walker Black 750ml',        brand: 'Johnnie Walker', category: 'Whiskey', price: 290, stock: 8,  minStock: 2 },
  { name: 'Johnnie Walker Double Black 750ml', brand: 'Johnnie Walker', category: 'Whiskey', price: 320, stock: 6,  minStock: 2 },
  { name: 'Jack Daniels 750ml',               brand: 'Jack Daniels',   category: 'Whiskey', price: 260, stock: 10, minStock: 2 },
  { name: 'Old Parr 750ml',                   brand: 'Old Parr',       category: 'Whiskey', price: 330, stock: 6,  minStock: 2 },
  { name: 'Chivas Regal 12Y 750ml',           brand: 'Chivas Regal',   category: 'Whiskey', price: 360, stock: 6,  minStock: 2 },
  { name: 'Ballantines 750ml',                brand: 'Ballantines',    category: 'Whiskey', price: 165, stock: 10, minStock: 3 },
  { name: "Grant's 750ml",                    brand: "Grant's",        category: 'Whiskey', price: 145, stock: 10, minStock: 3 },
  { name: 'Teachers 750ml',                   brand: 'Teachers',       category: 'Whiskey', price: 135, stock: 10, minStock: 3 },

  // ── RON ─────────────────────────────────────────────────
  { name: 'Ron Bacardi Blanco 750ml',    brand: 'Bacardi',     category: 'Ron', price: 115, stock: 15, minStock: 3 },
  { name: 'Ron Bacardi Gold 750ml',      brand: 'Bacardi',     category: 'Ron', price: 125, stock: 12, minStock: 3 },
  { name: 'Ron Millonario 8 años 750ml', brand: 'Millonario',  category: 'Ron', price: 130, stock: 10, minStock: 3 },
  { name: 'Ron Cartavio Blanco 750ml',   brand: 'Cartavio',    category: 'Ron', price: 90,  stock: 15, minStock: 3 },
  { name: 'Ron Havana Club 3Y 750ml',    brand: 'Havana Club', category: 'Ron', price: 135, stock: 8,  minStock: 2 },
  { name: 'Flor de Caña 7Y 750ml',       brand: 'Flor de Caña',category: 'Ron', price: 145, stock: 8,  minStock: 2 },

  // ── VINOS ───────────────────────────────────────────────
  { name: 'Kohlberg Tinto 750ml',              brand: 'Kohlberg',     category: 'Vinos', price: 68,  stock: 24, minStock: 6 },
  { name: 'Kohlberg Blanco 750ml',             brand: 'Kohlberg',     category: 'Vinos', price: 68,  stock: 20, minStock: 6 },
  { name: 'Kohlberg Rosé 750ml',               brand: 'Kohlberg',     category: 'Vinos', price: 68,  stock: 18, minStock: 5 },
  { name: 'La Cabaña Tinto 750ml',             brand: 'La Cabaña',    category: 'Vinos', price: 60,  stock: 20, minStock: 5 },
  { name: 'Gato Negro Tinto 750ml',            brand: 'Gato Negro',   category: 'Vinos', price: 55,  stock: 20, minStock: 5 },
  { name: 'Gato Negro Blanco 750ml',           brand: 'Gato Negro',   category: 'Vinos', price: 55,  stock: 20, minStock: 5 },
  { name: 'Casillero del Diablo Tinto 750ml',  brand: 'Casillero',    category: 'Vinos', price: 95,  stock: 15, minStock: 3 },
  { name: 'Concha y Toro Tinto 750ml',         brand: 'Concha y Toro',category: 'Vinos', price: 75,  stock: 15, minStock: 3 },
  { name: 'Santa Helena Tinto 750ml',          brand: 'Santa Helena', category: 'Vinos', price: 50,  stock: 18, minStock: 5 },
  { name: 'Sangría Don Simón 1L',              brand: 'Don Simón',    category: 'Vinos', price: 42,  stock: 24, minStock: 6 },
  { name: 'Chandon Brut 750ml',                brand: 'Chandon',      category: 'Vinos', price: 155, stock: 8,  minStock: 2 },

  // ── VODKA ───────────────────────────────────────────────
  { name: 'Smirnoff 750ml', brand: 'Smirnoff', category: 'Vodka', price: 125, stock: 12, minStock: 3 },
  { name: 'Absolut 750ml',  brand: 'Absolut',  category: 'Vodka', price: 165, stock: 10, minStock: 3 },
  { name: 'Skyy 750ml',     brand: 'Skyy',     category: 'Vodka', price: 115, stock: 10, minStock: 3 },

  // ── OTROS LICORES ────────────────────────────────────────
  { name: 'Gin Beefeater 750ml',            brand: 'Beefeater',   category: 'Otros', price: 185, stock: 8, minStock: 2 },
  { name: 'Tequila Jose Cuervo Gold 750ml', brand: 'Jose Cuervo', category: 'Otros', price: 165, stock: 8, minStock: 2 },
  { name: 'Fernet Branca 750ml',            brand: 'Branca',      category: 'Otros', price: 135, stock: 8, minStock: 2 },
  { name: 'Jagermeister 700ml',             brand: 'Jagermeister',category: 'Otros', price: 165, stock: 6, minStock: 2 },
  { name: 'Baileys 750ml',                  brand: 'Baileys',     category: 'Otros', price: 185, stock: 6, minStock: 2 },

  // ── REFRESCOS ───────────────────────────────────────────
  { name: 'Pepsi 2.5L',               brand: 'CBN',       category: 'Refrescos', price: 14, stock: 48, minStock: 12 },
  { name: 'Pepsi 500ml',              brand: 'CBN',       category: 'Refrescos', price: 6,  stock: 72, minStock: 24 },
  { name: '7Up 500ml',                brand: 'CBN',       category: 'Refrescos', price: 6,  stock: 72, minStock: 24 },
  { name: '7Up 2.5L',                 brand: 'CBN',       category: 'Refrescos', price: 14, stock: 36, minStock: 12 },
  { name: 'Mirinda Naranja 500ml',    brand: 'CBN',       category: 'Refrescos', price: 6,  stock: 60, minStock: 20 },
  { name: 'Gatorade Azul 500ml',      brand: 'CBN',       category: 'Refrescos', price: 11, stock: 48, minStock: 12 },
  { name: 'Gatorade Rojo 500ml',      brand: 'CBN',       category: 'Refrescos', price: 11, stock: 48, minStock: 12 },
  { name: 'Red Bull 250ml',           brand: 'Red Bull',  category: 'Refrescos', price: 20, stock: 48, minStock: 12 },
  { name: 'Monster Energy 473ml',     brand: 'Monster',   category: 'Refrescos', price: 22, stock: 36, minStock: 10 },
  { name: 'Vive 100 250ml',           brand: 'Vive 100',  category: 'Refrescos', price: 8,  stock: 72, minStock: 20 },
  { name: 'Schweppes Tónica 500ml',   brand: 'Schweppes', category: 'Refrescos', price: 9,  stock: 48, minStock: 12 },
  { name: 'Schweppes Ginger Ale 500ml', brand: 'Schweppes', category: 'Refrescos', price: 9, stock: 48, minStock: 12 },

  // ── AGUA ────────────────────────────────────────────────
  { name: 'Agua SOMOS 600ml',           brand: 'CBN',      category: 'Agua', price: 4, stock: 120, minStock: 24 },
  { name: 'Agua SOMOS 2L',              brand: 'CBN',      category: 'Agua', price: 8, stock: 60,  minStock: 12 },
  { name: 'Agua Vital 600ml',           brand: 'Vital',    category: 'Agua', price: 4, stock: 100, minStock: 24 },
  { name: 'Agua Brisa 600ml',           brand: 'Brisa',    category: 'Agua', price: 4, stock: 100, minStock: 24 },
  { name: 'Agua con Gas San Mateo 500ml', brand: 'San Mateo', category: 'Agua', price: 7, stock: 48, minStock: 12 },

  // ── SNACKS ──────────────────────────────────────────────
  { name: 'Papas Lays Original 150g',     brand: 'Lays',      category: 'Otros', price: 13, stock: 50, minStock: 12 },
  { name: 'Papas Lays Queso 150g',        brand: 'Lays',      category: 'Otros', price: 13, stock: 50, minStock: 12 },
  { name: 'Papas Pringles Original 149g', brand: 'Pringles',  category: 'Otros', price: 28, stock: 24, minStock: 6  },
  { name: 'Chizitos 60g',                 brand: 'Chizitos',  category: 'Otros', price: 6,  stock: 72, minStock: 20 },
  { name: 'Maní Japonés 100g',            brand: 'Genérico',  category: 'Otros', price: 8,  stock: 50, minStock: 15 },
  { name: 'Maní con Cáscara 200g',        brand: 'Genérico',  category: 'Otros', price: 10, stock: 40, minStock: 10 },
  { name: 'Nachos 150g',                  brand: 'Barcel',    category: 'Otros', price: 20, stock: 24, minStock: 6  },
  { name: 'Galletas Oreo 119g',           brand: 'Oreo',      category: 'Otros', price: 13, stock: 36, minStock: 10 },
  { name: 'Cigarrillos Marlboro Rojo x20',brand: 'Marlboro',  category: 'Otros', price: 30, stock: 30, minStock: 10 },
  { name: 'Cigarrillos Marlboro Gold x20',brand: 'Marlboro',  category: 'Otros', price: 30, stock: 30, minStock: 10 },
  { name: 'Cigarrillos L&M Rojo x20',     brand: 'L&M',       category: 'Otros', price: 24, stock: 30, minStock: 10 },
  { name: 'Chicles Trident Menta',         brand: 'Trident',   category: 'Otros', price: 4,  stock: 60, minStock: 20 },
];

async function cargarTodo() {
  console.log('\n🚀 Iniciando carga...\n');

  // ── 1. Actualizar categorías en business_settings ────────
  console.log('📂 Actualizando categorías...');
  await db.collection('business_settings').doc(BUSINESS_ID).set(
    { categories: CATEGORIAS, businessCategory: 'licorera' },
    { merge: true }
  );
  console.log(`✅ ${CATEGORIAS.length} categorías guardadas: ${CATEGORIAS.join(', ')}\n`);

  // ── 2. Subir productos en lotes ─────────────────────────
  console.log(`🍺 Subiendo ${productos.length} productos...`);
  const BATCH_SIZE = 20;
  let subidos = 0;
  let errores = 0;

  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const lote = productos.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const p of lote) {
      const ref = db.collection('products').doc();
      batch.set(ref, {
        businessId: BUSINESS_ID,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        stock: p.stock,
        minStock: p.minStock,
        description: '',
        imageData: '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      subidos += lote.length;
      console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${subidos}/${productos.length} productos`);
    } catch (err) {
      errores += lote.length;
      console.error(`  ❌ Error en lote ${Math.floor(i / BATCH_SIZE) + 1}:`, err.message);
    }
  }

  console.log(`\n🎉 ¡Listo! ${subidos} productos subidos · ${errores} errores`);
  console.log('👉 Recarga la app para ver los cambios\n');
  process.exit(0);
}

cargarTodo().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
