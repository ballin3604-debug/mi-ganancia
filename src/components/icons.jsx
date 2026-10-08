// ─────────────────────────────────────────────────────────────
// Mi Ganancia · Set central de iconos (lucide-react + colores de marca)
// Cambiar un color o tamaño aquí se refleja en toda la app.
// Uso: <AppIcon name="scan" size={18} /> o <AppIcon name="qr" />
// ─────────────────────────────────────────────────────────────
import {
  ScanLine,
  Search,
  Banknote,
  QrCode,
  Split,
  Eye,
  Printer,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  Save,
  CircleX,
  PackagePlus,
  Camera,
  ShoppingCart,
  MessageCircle,
  Phone,
  Users,
  ChartColumn,
  Trophy,
  Wallet,
  ReceiptText,
  Image as ImageIcon,
  Plus,
  Check,
  X,
  Folder,
  Store,
  Type,
  Tag,
  Clock,
  Building2,
  Rocket,
  Download,
  Stethoscope,
  Pill,
  Syringe,
  Bell,
  IdCard,
} from 'lucide-react';

// Azul banca, verde éxito, ámbar alerta, rojo peligro, morado QR
export const BRAND_COLORS = {
  primary: '#1670C2',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  qr: '#8b5cf6',
};

const ICONS = {
  scan: { Component: ScanLine, color: BRAND_COLORS.primary },
  search: { Component: Search, color: BRAND_COLORS.primary },
  cash: { Component: Banknote, color: BRAND_COLORS.success },
  qr: { Component: QrCode, color: BRAND_COLORS.qr },
  mixto: { Component: Split, color: BRAND_COLORS.primary },
  detalle: { Component: Eye, color: BRAND_COLORS.primary },
  recibo: { Component: Printer, color: BRAND_COLORS.primary },
  csv: { Component: FileSpreadsheet, color: BRAND_COLORS.success },
  pdf: { Component: FileText, color: BRAND_COLORS.danger },
  editar: { Component: Pencil, color: BRAND_COLORS.primary },
  eliminar: { Component: Trash2, color: BRAND_COLORS.danger },
  guardar: { Component: Save, color: BRAND_COLORS.primary },
  cancelar: { Component: CircleX, color: BRAND_COLORS.warning },
  nuevoProducto: { Component: PackagePlus, color: BRAND_COLORS.primary },
  camara: { Component: Camera, color: BRAND_COLORS.primary },
  carrito: { Component: ShoppingCart, color: BRAND_COLORS.primary },
  whatsapp: { Component: MessageCircle, color: BRAND_COLORS.success },
  llamar: { Component: Phone, color: BRAND_COLORS.primary },
  equipo: { Component: Users, color: BRAND_COLORS.primary },
  reportes: { Component: ChartColumn, color: BRAND_COLORS.primary },
  ranking: { Component: Trophy, color: BRAND_COLORS.warning },
  caja: { Component: Wallet, color: BRAND_COLORS.primary },
  gastos: { Component: ReceiptText, color: BRAND_COLORS.danger },
  galeria: { Component: ImageIcon, color: BRAND_COLORS.primary },
  agregar: { Component: Plus, color: BRAND_COLORS.primary },
  check: { Component: Check, color: BRAND_COLORS.success },
  cerrar: { Component: X, color: BRAND_COLORS.primary },
  carpeta: { Component: Folder, color: BRAND_COLORS.primary },
  tienda: { Component: Store, color: BRAND_COLORS.primary },
  texto: { Component: Type, color: BRAND_COLORS.primary },
  etiqueta: { Component: Tag, color: BRAND_COLORS.primary },
  reloj: { Component: Clock, color: BRAND_COLORS.warning },
  sucursales: { Component: Building2, color: BRAND_COLORS.primary },
  plan: { Component: Rocket, color: BRAND_COLORS.primary },
  respaldo: { Component: Download, color: BRAND_COLORS.primary },
  consulta: { Component: Stethoscope, color: BRAND_COLORS.primary },
  receta: { Component: Pill, color: BRAND_COLORS.primary },
  vacuna: { Component: Syringe, color: BRAND_COLORS.success },
  recordatorio: { Component: Bell, color: BRAND_COLORS.warning },
  carnet: { Component: IdCard, color: BRAND_COLORS.primary },
};

export function AppIcon({ name, size = 18, color, strokeWidth = 2, className = '' }) {
  const entry = ICONS[name];
  if (!entry) return null;
  const { Component } = entry;
  return (
    <Component
      size={size}
      color={color || entry.color}
      strokeWidth={strokeWidth}
      className={`shrink-0 ${className}`}
    />
  );
}

export const ICON_NAMES = Object.keys(ICONS);
