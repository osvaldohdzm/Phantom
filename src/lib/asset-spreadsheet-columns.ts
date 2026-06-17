export type AssetSourceType =
  | 'inventory'
  | 'external_recon'
  | 'external_attack_surface'
  | 'internal_recon'
  | 'internal_attack_surface';

export type AssetCellType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'readonly' | 'severity' | 'status';

export interface AssetGridColumn {
  key: string;
  label: string;
  type: AssetCellType;
  width?: number;
  options?: string[];
  /** Campo de primer nivel en Asset (resto va a metadata) */
  topLevel?: string;
}

export const ASSET_SOURCE_LABELS: Record<AssetSourceType, string> = {
  inventory: 'Inventario (Assets Inventory)',
  external_recon: 'External Reconnaissance',
  external_attack_surface: 'External Attack Surface',
  internal_recon: 'Internal Reconnaissance',
  internal_attack_surface: 'Internal Attack Surface',
};

const text = (key: string, label: string, width = 140, topLevel?: string): AssetGridColumn => ({
  key,
  label,
  type: 'text',
  width,
  topLevel,
});

const inv = (key: string, label: string, width = 130, topLevel?: string) =>
  text(key, label, width, topLevel);

export const INVENTORY_COLUMNS: AssetGridColumn[] = [
  text('id', 'Id del Activo', 100, 'id'),
  inv('ip_direccion', 'Dirección IP', 120, 'ip_privada'),
  inv('proyecto_scope', 'Proyecto / Scope', 140),
  text('nombre', 'Nombre del Activo', 160, 'nombre'),
  inv('hostname_desc', 'Hostname / Descripción', 160),
  inv('tipo_recurso', 'Tipo de Recurso', 120, 'asset_type'),
  text('ambiente', 'Ambiente', 100, 'ambiente'),
  inv('exposicion', 'Exposición'),
  inv('url', 'URL'),
  inv('comentarios_scope', 'Comentarios'),
  inv('pci', 'PCI'),
  inv('rv_waf_fw', 'RV WAF FW'),
  inv('deteccion_waf', 'Detección de WAF'),
  inv('deteccion_fw', 'Detección de FW'),
  inv('columna1', 'Columna1'),
  inv('tipo_inventario', 'Tipo de Inventario'),
  inv('nombre_inventario', 'Nombre del Inventario'),
  inv('ambitos_seleccionados', 'Ámbitos Seleccionados'),
  inv('grupos_activos', 'Grupos de Activos'),
  inv('subgrupos_activos', 'Subgrupos de Activos'),
  inv('ipv4_publico', 'IPv4 Público', 120, 'ip_publica'),
  inv('fqdn_publico', 'FQDN Público', 160, 'fqdn'),
  inv('ipv4_privado', 'IPv4 Privado', 120),
  inv('hostname_privado', 'Nombre de Host Privado'),
  inv('ipv6_publico', 'IPv6 Público'),
  inv('ipv6_privado', 'IPv6 Privado'),
  inv('fqdn_privado', 'FQDN Privado'),
  inv('dominio_privado', 'Nombre de Dominio Privado'),
  inv('dominio_publico', 'Nombre de Dominio Público'),
  inv('mascara_red', 'Máscara de Red'),
  inv('otros_fqdns', 'Otros FQDNs'),
  inv('ip_admin', 'IP de Administración'),
  inv('ip_monitoreo', 'IP de Monitoreo'),
  inv('ip_backup', 'IP de Interfaz de Respaldo'),
  inv('puerta_enlace', 'Puerta de Enlace Predeterminada'),
  inv('dns_configurado', 'DNS Configurado'),
  inv('acceso_publico', 'Tiene Acceso Público'),
  inv('dominio_tecnologico', 'Dominio Tecnológico'),
  inv('tipo_maquina', 'Tipo de Máquina'),
  inv('subtipo_maquina', 'Subtipo de Máquina'),
  inv('tipo_infra', 'Tipo de Infraestructura'),
  inv('entorno', 'Entorno'),
  text('os', 'Sistema Operativo', 140, 'os'),
  inv('aplicacion', 'Aplicación Asociada'),
  inv('es_critico', 'Es Crítico'),
  inv('es_regulatorio', 'Es Regulatorio'),
  inv('marca', 'Marca'),
  inv('modelo', 'Modelo'),
  inv('numero_serie', 'Número de Serie'),
  inv('funcion_operacional', 'Función Operacional'),
  text('owner', 'Responsable', 120, 'owner'),
  inv('usuario_responsable', 'Usuario Responsable'),
  inv('cargo_responsable', 'Cargo del Usuario Responsable'),
  inv('usuario_final', 'Usuario Final'),
  inv('fecha_asignacion', 'Fecha de Asignación del Usuario'),
  inv('nombre_sitio', 'Nombre de Sitio'),
  text('location', 'Ubicación Física', 140, 'location'),
  inv('id_ubicacion', 'Identificación de Ubicación Física'),
  inv('ubicacion_piso', 'Ubicación Física en Piso'),
  inv('ubicacion_sitio', 'Ubicación Física en Sitio'),
  inv('almacenamiento', 'Almacenamiento Provisionado'),
  inv('memoria', 'Tamaño de Memoria'),
  inv('cpu', 'CPU'),
  inv('antivirus', 'Agente Antivirus'),
  inv('estado_asignacion', 'Estado de Asignación'),
  inv('fecha_retiro', 'Fecha de Retiro del Activo'),
  inv('estado_considerado', 'Estado Considerado'),
  inv('ultimo_ping', 'Último Estado de Ping'),
  inv('ultima_credencial', 'Última Prueba de Credenciales'),
  inv('aplicar_credenciales', 'Aplicar Pruebas de Credenciales de Seguridad'),
  inv('usuario_seguridad', 'Usuario de Seguridad'),
  inv('password_seguridad', 'Contraseña de Seguridad'),
  inv('privilegio_seguridad', 'Privilegio de Usuario de Seguridad'),
  inv('proveedor', 'Proveedor'),
  inv('gestion_terceros', 'Gestión de Terceros'),
  inv('comentarios_estado', 'Comentarios del Estado'),
  inv('descripcion', 'Descripción'),
  inv('comentarios', 'Comentarios'),
  inv('notas', 'Notas'),
  text('criticidad', 'Criticidad', 100, 'criticidad'),
];

export const EXTERNAL_RECON_COLUMNS: AssetGridColumn[] = [
  text('id', 'Id', 90, 'id'),
  inv('fuente', 'Fuente', 100, 'discovery_method'),
  inv('tipo', 'Tipo', 100, 'asset_type'),
  inv('subtipo', 'SubTipo'),
  text('nombre', 'Activo', 140, 'nombre'),
  text('fqdn', 'FQDN', 160, 'fqdn'),
  text('ip', 'IP', 120, 'ip_publica'),
  inv('reverse_domain', 'Reverse domain'),
  inv('netblock_owner', 'NetBlock Owner'),
  inv('services', 'Services'),
  inv('http_services', 'HTTP Services'),
  inv('remote_services', 'Remote Services'),
  inv('fecha_deteccion', 'Fecha de Detección'),
  inv('ultima_revision', 'Última Revisión'),
];

export const EXTERNAL_ATTACK_SURFACE_COLUMNS: AssetGridColumn[] = [
  text('id', 'ID', 90, 'id'),
  text('ip', 'IP', 120, 'ip_publica'),
  text('fqdn', 'FQDN / Subdominio', 160, 'fqdn'),
  inv('dns_reverso', 'DNS Reverso'),
  inv('hostname', 'Hostname'),
  inv('puerto', 'Puerto'),
  inv('servicio', 'Servicio'),
  inv('banner', 'Banner'),
  inv('tecnologia', 'Tecnología'),
  inv('metodo', 'Método', 100, 'discovery_method'),
  inv('observacion', 'Observación'),
  inv('prioridad', 'Prioridad', 100, 'criticidad'),
  inv('estado', 'Estado'),
  inv('tipo', 'Tipo', 100, 'asset_type'),
  text('nombre', 'Nombre', 140, 'nombre'),
];

export const INTERNAL_RECON_COLUMNS: AssetGridColumn[] = [
  text('id', 'Id', 90, 'id'),
  text('ip', 'IP', 120, 'ip_privada'),
  text('fqdn', 'FQDN / Hostname', 160, 'fqdn'),
  inv('segmento', 'Segmento / Red'),
  inv('hostname', 'Hostname'),
  inv('estado_host', 'Estado host'),
  inv('os_detectado', 'SO detectado', 120, 'os'),
  inv('puertos_abiertos', 'Puertos abiertos'),
  inv('servicios', 'Servicios'),
  inv('en_inventario', 'En inventario'),
  inv('metodo', 'Método', 100, 'discovery_method'),
  inv('fecha_escaneo', 'Fecha escaneo'),
  inv('observacion', 'Observación'),
  text('nombre', 'Activo', 140, 'nombre'),
];

export const INTERNAL_ATTACK_SURFACE_COLUMNS: AssetGridColumn[] = [
  text('id', 'Id', 90, 'id'),
  text('ip', 'IP', 120, 'ip_privada'),
  text('fqdn', 'FQDN / Subdominio', 160, 'fqdn'),
  inv('puerto', 'Puerto'),
  inv('transporte', 'Transporte'),
  inv('servicio', 'Servicio'),
  inv('banner', 'Banner'),
  inv('tecnologia', 'Tecnología'),
  inv('metodo', 'Método', 100, 'discovery_method'),
  inv('observacion', 'Observación'),
  inv('prioridad', 'Prioridad', 100, 'criticidad'),
  inv('estado', 'Estado'),
  inv('tipo', 'Tipo', 100, 'asset_type'),
  text('nombre', 'Nombre', 140, 'nombre'),
];

export function columnsForSource(source: AssetSourceType): AssetGridColumn[] {
  switch (source) {
    case 'inventory':
      return INVENTORY_COLUMNS;
    case 'external_recon':
      return EXTERNAL_RECON_COLUMNS;
    case 'external_attack_surface':
      return EXTERNAL_ATTACK_SURFACE_COLUMNS;
    case 'internal_recon':
      return INTERNAL_RECON_COLUMNS;
    case 'internal_attack_surface':
      return INTERNAL_ATTACK_SURFACE_COLUMNS;
    default:
      return INVENTORY_COLUMNS;
  }
}

export const EDITABLE_TOP_LEVEL = new Set([
  'nombre',
  'ip_publica',
  'ip_privada',
  'fqdn',
  'criticidad',
  'ambiente',
  'os',
  'asset_type',
  'owner',
  'location',
  'discovery_method',
  'is_in_scope',
]);
